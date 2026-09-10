-- Phase 4G: durable 48-hour acceptance window. Payment remains a fake sandbox;
-- this migration does not charge, capture, refund, release, or pay out money.

create type public.service_job_acceptance_status as enum (
  'pending',
  'help_requested',
  'customer_accepted',
  'automatic_accepted'
);

create table private.service_job_acceptance_configuration (
  singleton boolean primary key default true check (singleton),
  acceptance_window_hours integer not null default 48
    check (acceptance_window_hours between 1 and 168),
  payment_mode text not null default 'fake_sandbox'
    check (payment_mode = 'fake_sandbox'),
  updated_at timestamptz not null default now()
);

insert into private.service_job_acceptance_configuration (singleton)
values (true);

revoke all on private.service_job_acceptance_configuration
  from public, anon, authenticated;

create table public.service_job_acceptances (
  service_job_id uuid primary key
    references public.service_jobs (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null references public.profiles (id) on delete restrict,
  status public.service_job_acceptance_status not null default 'pending',
  review_started_at timestamptz not null,
  review_deadline_at timestamptz not null,
  total_amount_snapshot numeric(12, 2) not null
    check (total_amount_snapshot > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_mode text not null check (payment_mode = 'fake_sandbox'),
  accepted_by uuid references public.profiles (id) on delete restrict,
  accepted_at timestamptz,
  help_requested_at timestamptz,
  help_reason text check (
    help_reason is null or char_length(trim(help_reason)) between 10 and 1000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_job_acceptance_participants_differ
    check (customer_id <> technician_id),
  constraint service_job_acceptance_deadline_after_start
    check (review_deadline_at > review_started_at),
  constraint service_job_acceptance_state_shape check (
    (status = 'pending'
      and accepted_by is null and accepted_at is null
      and help_requested_at is null and help_reason is null)
    or (status = 'help_requested'
      and accepted_by is null and accepted_at is null
      and help_requested_at is not null and help_reason is not null)
    or (status = 'customer_accepted'
      and accepted_by = customer_id and accepted_at is not null
      and help_requested_at is null and help_reason is null)
    or (status = 'automatic_accepted'
      and accepted_by is null and accepted_at is not null
      and help_requested_at is null and help_reason is null)
  )
);

create index service_job_acceptances_due_idx
  on public.service_job_acceptances (review_deadline_at, service_job_id)
  where status = 'pending';

create trigger service_job_acceptances_set_updated_at
before update on public.service_job_acceptances
for each row execute function public.set_updated_at();

alter table public.service_job_acceptances enable row level security;
revoke all on public.service_job_acceptances from public, anon, authenticated;
grant select on public.service_job_acceptances to authenticated;

create policy "service_job_acceptances_participant_read"
on public.service_job_acceptances
for select to authenticated
using (
  private.is_active_account((select auth.uid()))
  and (select auth.uid()) in (customer_id, technician_id)
);

create function private.open_service_job_acceptance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_configuration private.service_job_acceptance_configuration;
  v_started_at timestamptz := now();
begin
  if new.status <> 'awaiting_acceptance'
    or (tg_op = 'UPDATE' and old.status = new.status) then
    return new;
  end if;

  select * into strict v_configuration
  from private.service_job_acceptance_configuration
  where singleton;

  insert into public.service_job_acceptances (
    service_job_id,
    customer_id,
    technician_id,
    review_started_at,
    review_deadline_at,
    total_amount_snapshot,
    currency,
    payment_mode
  ) values (
    new.id,
    new.customer_id,
    new.technician_id,
    v_started_at,
    v_started_at + make_interval(hours => v_configuration.acceptance_window_hours),
    new.total_amount,
    new.currency,
    v_configuration.payment_mode
  ) on conflict (service_job_id) do nothing;

  return new;
end;
$$;

revoke all on function private.open_service_job_acceptance() from public;

create trigger service_jobs_open_acceptance
after insert or update of status on public.service_jobs
for each row execute function private.open_service_job_acceptance();

-- Backfill any jobs that reached acceptance before this phase was deployed.
insert into public.service_job_acceptances (
  service_job_id,
  customer_id,
  technician_id,
  review_started_at,
  review_deadline_at,
  total_amount_snapshot,
  currency,
  payment_mode
)
select
  job.id,
  job.customer_id,
  job.technician_id,
  job.updated_at,
  job.updated_at + make_interval(hours => configuration.acceptance_window_hours),
  job.total_amount,
  job.currency,
  configuration.payment_mode
from public.service_jobs as job
cross join private.service_job_acceptance_configuration as configuration
where job.status = 'awaiting_acceptance'
on conflict (service_job_id) do nothing;

create function private.finalize_service_job_acceptance(
  p_job_id uuid,
  p_now timestamptz default now()
)
returns public.service_job_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acceptance public.service_job_acceptances;
  v_job public.service_jobs;
begin
  select * into v_acceptance
  from public.service_job_acceptances
  where service_job_id = p_job_id
  for update;

  if not found or v_acceptance.status <> 'pending'
    or v_acceptance.review_deadline_at > p_now then
    return v_acceptance;
  end if;

  select * into v_job
  from public.service_jobs
  where id = p_job_id
  for update;

  if v_job.status <> 'awaiting_acceptance' then
    return v_acceptance;
  end if;

  update public.service_job_acceptances set
    status = 'automatic_accepted',
    accepted_at = p_now
  where service_job_id = p_job_id
  returning * into v_acceptance;

  update public.service_jobs set status = 'completed' where id = p_job_id;

  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id, reason
  ) values (
    p_job_id, 'awaiting_acceptance', 'completed', null,
    'ครบกำหนดช่วงตรวจรับโดยไม่มีการแจ้งปัญหา'
  );

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    null, 'service_job.acceptance_automatic', 'service_job', p_job_id,
    jsonb_build_object(
      'acceptance_status', 'automatic_accepted',
      'payment_mode', v_acceptance.payment_mode,
      'real_money_moved', false
    )
  );

  return v_acceptance;
end;
$$;

revoke all on function private.finalize_service_job_acceptance(uuid, timestamptz)
  from public;

create function public.get_service_job_acceptance(p_job_id uuid)
returns setof public.service_job_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id)
    or not exists (
      select 1 from public.service_jobs
      where id = p_job_id
        and v_actor_id in (customer_id, technician_id)
    ) then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  perform private.finalize_service_job_acceptance(p_job_id);

  return query
  select * from public.service_job_acceptances
  where service_job_id = p_job_id;
end;
$$;

create function public.confirm_service_job_acceptance(p_job_id uuid)
returns public.service_job_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_acceptance public.service_job_acceptances;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select * into v_job from public.service_jobs
  where id = p_job_id and customer_id = v_actor_id
  for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  perform private.finalize_service_job_acceptance(p_job_id);
  select * into v_acceptance from public.service_job_acceptances
  where service_job_id = p_job_id for update;

  if not found then
    raise exception 'Acceptance window not found' using errcode = 'P0002';
  end if;
  if v_acceptance.status in ('customer_accepted', 'automatic_accepted') then
    return v_acceptance;
  end if;
  if v_acceptance.status = 'help_requested' then
    raise exception 'Acceptance is on hold for HomeCare help' using errcode = '55000';
  end if;
  if v_job.status <> 'awaiting_acceptance' then
    raise exception 'Service job status changed' using errcode = '40001';
  end if;

  update public.service_job_acceptances set
    status = 'customer_accepted',
    accepted_by = v_actor_id,
    accepted_at = now()
  where service_job_id = p_job_id
  returning * into v_acceptance;

  update public.service_jobs set status = 'completed' where id = p_job_id;
  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id
  ) values (p_job_id, 'awaiting_acceptance', 'completed', v_actor_id);
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.acceptance_confirmed', 'service_job', p_job_id,
    jsonb_build_object(
      'acceptance_status', 'customer_accepted',
      'payment_mode', v_acceptance.payment_mode,
      'real_money_moved', false
    )
  );

  return v_acceptance;
end;
$$;

create function public.request_service_job_acceptance_help(
  p_job_id uuid,
  p_reason text
)
returns public.service_job_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_acceptance public.service_job_acceptances;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 10 and 1000 then
    raise exception 'Acceptance help reason required' using errcode = '22023';
  end if;

  select * into v_job from public.service_jobs
  where id = p_job_id and customer_id = v_actor_id
  for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  perform private.finalize_service_job_acceptance(p_job_id);
  select * into v_acceptance from public.service_job_acceptances
  where service_job_id = p_job_id for update;

  if not found then
    raise exception 'Acceptance window not found' using errcode = 'P0002';
  end if;
  if v_acceptance.status <> 'pending' or v_job.status <> 'awaiting_acceptance' then
    return v_acceptance;
  end if;

  update public.service_job_acceptances set
    status = 'help_requested',
    help_requested_at = now(),
    help_reason = trim(p_reason)
  where service_job_id = p_job_id
  returning * into v_acceptance;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.acceptance_help_requested',
    'service_job', p_job_id,
    jsonb_build_object(
      'acceptance_status', 'help_requested',
      'payment_mode', v_acceptance.payment_mode,
      'real_money_moved', false
    )
  );

  return v_acceptance;
end;
$$;

create function public.process_due_service_job_acceptances(
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_processed integer := 0;
begin
  for v_job_id in
    select service_job_id
    from public.service_job_acceptances
    where status = 'pending' and review_deadline_at <= now()
    order by review_deadline_at, service_job_id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  loop
    perform private.finalize_service_job_acceptance(v_job_id);
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

revoke all on function public.get_service_job_acceptance(uuid)
  from public, anon;
revoke all on function public.confirm_service_job_acceptance(uuid)
  from public, anon;
revoke all on function public.request_service_job_acceptance_help(uuid, text)
  from public, anon;
revoke all on function public.process_due_service_job_acceptances(integer)
  from public, anon, authenticated;

grant execute on function public.get_service_job_acceptance(uuid)
  to authenticated;
grant execute on function public.confirm_service_job_acceptance(uuid)
  to authenticated;
grant execute on function public.request_service_job_acceptance_help(uuid, text)
  to authenticated;
grant execute on function public.process_due_service_job_acceptances(integer)
  to service_role;

-- Add the completed label to durable job-status notifications. Automatic
-- acceptance has no actor and is intentionally skipped by this trigger.
create or replace function private.enqueue_job_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.service_jobs;
  v_recipient_id uuid;
  v_status_label text;
begin
  select * into v_job from public.service_jobs where id = new.service_job_id;
  if not found or new.actor_user_id not in (v_job.customer_id, v_job.technician_id)
    or new.to_status = 'awaiting_additional_work_approval'
    or new.from_status = 'awaiting_additional_work_approval' then
    return new;
  end if;

  v_recipient_id := case when new.actor_user_id = v_job.customer_id
    then v_job.technician_id else v_job.customer_id end;
  v_status_label := case new.to_status::text
    when 'scheduled' then 'นัดหมายงานแล้ว'
    when 'technician_en_route' then 'ช่างกำลังเดินทาง'
    when 'technician_arrived' then 'ช่างถึงสถานที่แล้ว'
    when 'in_progress' then 'เริ่มดำเนินงานแล้ว'
    when 'awaiting_acceptance' then 'งานพร้อมให้ตรวจรับ'
    when 'completed' then 'ลูกค้าตรวจรับงานแล้ว'
    when 'cancelled' then 'งานถูกยกเลิก'
    else 'สถานะงานมีการอัปเดต'
  end;

  perform private.enqueue_job_notification(
    v_recipient_id, new.actor_user_id, v_job,
    'job.status.' || new.to_status::text, new.id,
    'สถานะงานบริการมีการอัปเดต', v_status_label, 'detail'
  );
  return new;
end;
$$;
