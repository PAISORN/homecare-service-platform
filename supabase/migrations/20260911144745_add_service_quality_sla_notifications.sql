-- Phase 5B: configurable service-quality SLA tracking, durable participant
-- notifications, and a database scheduler that does not depend on a phone.

begin;

create type public.service_quality_sla_state as enum (
  'on_track', 'due_soon', 'overdue', 'closed'
);
create type public.service_quality_next_actor as enum (
  'homecare', 'customer', 'technician', 'none'
);

create table private.service_quality_sla_policies (
  case_status public.service_quality_case_status primary key,
  next_action_by public.service_quality_next_actor not null,
  target_minutes integer not null check (target_minutes between 5 and 43200),
  warning_minutes integer not null check (
    warning_minutes between 1 and 10080 and warning_minutes < target_minutes
  ),
  updated_at timestamptz not null default now()
);

insert into private.service_quality_sla_policies (
  case_status, next_action_by, target_minutes, warning_minutes
) values
  ('submitted', 'homecare', 240, 60),
  ('under_review', 'homecare', 1440, 240),
  ('awaiting_customer', 'customer', 1440, 240),
  ('awaiting_technician', 'technician', 1440, 240),
  ('escalated', 'homecare', 2880, 480);

revoke all on private.service_quality_sla_policies from public, anon, authenticated;

alter table public.service_quality_cases
  add column next_action_by public.service_quality_next_actor not null default 'homecare',
  add column sla_due_at timestamptz,
  add column sla_warning_at timestamptz,
  add column sla_state public.service_quality_sla_state not null default 'on_track',
  add constraint service_quality_sla_timestamps check (
    (sla_due_at is null and sla_warning_at is null)
    or (sla_due_at is not null and sla_warning_at is not null and sla_warning_at < sla_due_at)
  ),
  add constraint service_quality_closed_sla_shape check (
    (status in ('resolved', 'dismissed') and next_action_by = 'none'
      and sla_due_at is null and sla_warning_at is null and sla_state = 'closed')
    or status not in ('resolved', 'dismissed')
  );

create index service_quality_cases_sla_queue_idx
  on public.service_quality_cases (sla_state, sla_due_at)
  where status not in ('resolved', 'dismissed');

create function private.apply_service_quality_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy private.service_quality_sla_policies;
  v_anchor timestamptz := now();
begin
  if new.status in ('resolved', 'dismissed') then
    new.next_action_by := 'none';
    new.sla_due_at := null;
    new.sla_warning_at := null;
    new.sla_state := 'closed';
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is not distinct from old.status
    and new.sla_due_at is not null then
    return new;
  end if;

  select * into v_policy
  from private.service_quality_sla_policies
  where case_status = new.status;
  if not found then
    raise exception 'SLA policy missing for status %', new.status
      using errcode = 'P0001';
  end if;

  new.next_action_by := v_policy.next_action_by;
  new.sla_due_at := v_anchor + make_interval(mins => v_policy.target_minutes);
  new.sla_warning_at := new.sla_due_at - make_interval(mins => v_policy.warning_minutes);
  new.sla_state := 'on_track';
  return new;
end;
$$;

revoke all on function private.apply_service_quality_sla() from public;

create trigger service_quality_cases_apply_sla
before insert or update of status on public.service_quality_cases
for each row execute function private.apply_service_quality_sla();

update public.service_quality_cases as quality_case set
  next_action_by = case
    when quality_case.status in ('resolved', 'dismissed') then 'none'::public.service_quality_next_actor
    else policy.next_action_by
  end,
  sla_due_at = case
    when quality_case.status in ('resolved', 'dismissed') then null
    else quality_case.updated_at + make_interval(mins => policy.target_minutes)
  end,
  sla_warning_at = case
    when quality_case.status in ('resolved', 'dismissed') then null
    else quality_case.updated_at + make_interval(mins => policy.target_minutes - policy.warning_minutes)
  end,
  sla_state = case
    when quality_case.status in ('resolved', 'dismissed') then 'closed'::public.service_quality_sla_state
    when quality_case.updated_at + make_interval(mins => policy.target_minutes) <= now()
      then 'overdue'::public.service_quality_sla_state
    when quality_case.updated_at + make_interval(mins => policy.target_minutes - policy.warning_minutes) <= now()
      then 'due_soon'::public.service_quality_sla_state
    else 'on_track'::public.service_quality_sla_state
  end
from private.service_quality_sla_policies as policy
where policy.case_status = quality_case.status;

alter table public.notifications
  alter column actor_user_id drop not null,
  add column service_quality_case_id uuid
    references public.service_quality_cases (id) on delete cascade;

alter table public.notifications
  drop constraint notifications_actor_is_not_recipient,
  add constraint notifications_actor_is_not_recipient check (
    actor_user_id is null or actor_user_id <> recipient_user_id
  ),
  drop constraint notifications_deep_link_check,
  add constraint notifications_deep_link_check check (
    deep_link ~ '^/(jobs|technician/jobs)/(detail|chat|work)[?]jobId=[0-9a-f-]{36}$'
    or deep_link ~ '^/(jobs|technician/jobs)/quality[?]jobId=[0-9a-f-]{36}(&caseId=[0-9a-f-]{36})?$'
  );

create index notifications_quality_case_idx
  on public.notifications (service_quality_case_id, created_at desc)
  where service_quality_case_id is not null;

create function private.service_quality_deep_link(
  p_recipient_id uuid,
  p_job public.service_jobs,
  p_case_id uuid default null
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_recipient_id = p_job.customer_id then '/jobs/quality?jobId='
    else '/technician/jobs/quality?jobId='
  end || p_job.id::text
  || case when p_case_id is null then '' else '&caseId=' || p_case_id::text end;
$$;

revoke all on function private.service_quality_deep_link(
  uuid, public.service_jobs, uuid
) from public;

create function private.enqueue_service_quality_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_job public.service_jobs,
  p_case_id uuid,
  p_event_key text,
  p_source_record_id uuid,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deep_link text;
begin
  if p_recipient_id is null
    or (p_actor_id is not null and p_recipient_id = p_actor_id) then
    return;
  end if;

  v_deep_link := private.service_quality_deep_link(
    p_recipient_id, p_job, p_case_id
  );
  insert into public.notifications (
    recipient_user_id, actor_user_id, service_job_id,
    service_quality_case_id, event_key, source_record_id,
    title, body, deep_link, data
  ) values (
    p_recipient_id, p_actor_id, p_job.id,
    p_case_id, p_event_key, p_source_record_id,
    p_title, p_body, v_deep_link,
    jsonb_build_object(
      'url', v_deep_link,
      'jobId', p_job.id,
      'caseId', p_case_id,
      'event', p_event_key
    )
  ) on conflict (event_key, source_record_id, recipient_user_id) do nothing;
end;
$$;

revoke all on function private.enqueue_service_quality_notification(
  uuid, uuid, public.service_jobs, uuid, text, uuid, text, text
) from public;

create function private.enqueue_service_quality_case_event_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.service_quality_cases;
  v_job public.service_jobs;
  v_title text;
  v_body text;
  v_recipient uuid;
begin
  select * into v_case from public.service_quality_cases where id = new.case_id;
  if not found then return new; end if;
  select * into v_job from public.service_jobs where id = v_case.service_job_id;
  if not found then return new; end if;

  if new.event_type = 'submitted' then
    v_recipient := v_case.technician_id;
    v_title := 'มีเคสคุณภาพงานใหม่';
    v_body := 'เปิดงานบริการเพื่อตรวจสอบเรื่องที่ลูกค้าส่งมา';
  elsif new.event_type = 'customer_responded' then
    v_recipient := v_case.technician_id;
    v_title := 'ลูกค้าเพิ่มข้อมูลในเคส';
    v_body := 'เปิดเคสคุณภาพงานเพื่อดูข้อมูลล่าสุด';
  elsif new.event_type = 'technician_responded' then
    v_recipient := v_case.customer_id;
    v_title := 'ช่างเพิ่มคำชี้แจงในเคส';
    v_body := 'เปิดเคสคุณภาพงานเพื่อดูข้อมูลล่าสุด';
  elsif new.event_type = 'admin_awaiting_customer' then
    v_recipient := v_case.customer_id;
    v_title := 'HomeCare ขอข้อมูลเพิ่มเติม';
    v_body := 'กรุณาเปิดเคสและส่งข้อมูลภายในเวลาที่กำหนด';
  elsif new.event_type = 'admin_awaiting_technician' then
    v_recipient := v_case.technician_id;
    v_title := 'HomeCare ขอคำชี้แจงเพิ่มเติม';
    v_body := 'กรุณาเปิดเคสและส่งข้อมูลภายในเวลาที่กำหนด';
  elsif new.event_type in ('admin_resolved', 'dispute_resolved') then
    v_title := 'เคสคุณภาพงานได้รับการตัดสินแล้ว';
    v_body := 'เปิดเคสเพื่อดูผลและประวัติการพิจารณา';
  elsif new.event_type = 'admin_dismissed' then
    v_title := 'HomeCare ยุติการพิจารณาเคส';
    v_body := 'เปิดเคสเพื่อดูเหตุผลและประวัติการพิจารณา';
  elsif new.event_type = 'escalated_to_dispute' then
    v_title := 'เคสถูกยกระดับเป็นข้อพิพาท';
    v_body := 'HomeCare กำลังตรวจหลักฐานและจะบันทึกผลในเคส';
  elsif new.event_type = 'sla_due_soon' then
    v_recipient := case v_case.next_action_by
      when 'customer' then v_case.customer_id
      when 'technician' then v_case.technician_id
      else null
    end;
    v_title := 'เคสใกล้ถึงกำหนดตอบกลับ';
    v_body := 'กรุณาเปิดเคสและดำเนินการก่อนครบกำหนด';
  elsif new.event_type = 'sla_overdue' then
    v_recipient := case v_case.next_action_by
      when 'customer' then v_case.customer_id
      when 'technician' then v_case.technician_id
      else null
    end;
    v_title := 'เคสเกินกำหนดตอบกลับ';
    v_body := 'กรุณาเปิดเคสเพื่อตรวจสอบสิ่งที่ต้องดำเนินการ';
  else
    return new;
  end if;

  if v_recipient is not null then
    perform private.enqueue_service_quality_notification(
      v_recipient, new.actor_user_id, v_job, v_case.id,
      'quality.case.' || new.event_type, new.id, v_title, v_body
    );
  elsif new.event_type in (
    'admin_resolved', 'admin_dismissed', 'escalated_to_dispute',
    'dispute_resolved'
  ) then
    perform private.enqueue_service_quality_notification(
      v_case.customer_id, new.actor_user_id, v_job, v_case.id,
      'quality.case.' || new.event_type, new.id, v_title, v_body
    );
    perform private.enqueue_service_quality_notification(
      v_case.technician_id, new.actor_user_id, v_job, v_case.id,
      'quality.case.' || new.event_type, new.id, v_title, v_body
    );
  end if;
  return new;
end;
$$;

revoke all on function private.enqueue_service_quality_case_event_notification()
  from public;

create trigger service_quality_case_events_enqueue_notification
after insert on public.service_quality_case_events
for each row execute function private.enqueue_service_quality_case_event_notification();

create function private.enqueue_service_job_review_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.service_jobs;
  v_recipient uuid;
  v_actor uuid;
  v_event_key text;
  v_title text;
  v_body text;
begin
  select * into v_job from public.service_jobs where id = new.service_job_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    v_actor := new.customer_id;
    v_recipient := new.technician_id;
    v_event_key := 'quality.review.submitted';
    v_title := 'ลูกค้าส่งรีวิวงานแล้ว';
    v_body := 'เปิดงานบริการเพื่อดูคะแนนหลังผ่านการตรวจข้อความ';
  elsif old.technician_response is null and new.technician_response is not null then
    v_actor := new.technician_id;
    v_recipient := new.customer_id;
    v_event_key := 'quality.review.responded';
    v_title := 'ช่างตอบกลับรีวิวแล้ว';
    v_body := 'เปิดงานบริการเพื่อดูคำตอบจากช่าง';
  else
    return new;
  end if;

  perform private.enqueue_service_quality_notification(
    v_recipient, v_actor, v_job, null, v_event_key, new.id,
    v_title, v_body
  );
  return new;
end;
$$;

revoke all on function private.enqueue_service_job_review_notification()
  from public;

create trigger service_job_reviews_enqueue_notification
after insert or update on public.service_job_reviews
for each row execute function private.enqueue_service_job_review_notification();

create function public.process_service_quality_sla(
  p_now timestamptz default now(),
  p_limit integer default 100
)
returns table (due_soon_count integer, overdue_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case record;
  v_due_soon integer := 0;
  v_overdue integer := 0;
  v_next_state public.service_quality_sla_state;
begin
  for v_case in
    select quality_case.id, quality_case.sla_state,
      quality_case.sla_warning_at, quality_case.sla_due_at
    from public.service_quality_cases as quality_case
    where quality_case.status not in ('resolved', 'dismissed')
      and quality_case.sla_due_at is not null
      and (
        (quality_case.sla_state = 'on_track' and quality_case.sla_warning_at <= p_now)
        or (quality_case.sla_state <> 'overdue' and quality_case.sla_due_at <= p_now)
      )
    order by quality_case.sla_due_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  loop
    v_next_state := case when v_case.sla_due_at <= p_now
      then 'overdue'::public.service_quality_sla_state
      else 'due_soon'::public.service_quality_sla_state end;
    update public.service_quality_cases set sla_state = v_next_state
    where id = v_case.id;
    insert into public.service_quality_case_events (
      case_id, actor_user_id, event_type, metadata
    ) values (
      v_case.id, null,
      case when v_next_state = 'overdue' then 'sla_overdue' else 'sla_due_soon' end,
      jsonb_build_object('evaluated_at', p_now, 'sla_due_at', v_case.sla_due_at)
    );
    if v_next_state = 'overdue' then
      v_overdue := v_overdue + 1;
    else
      v_due_soon := v_due_soon + 1;
    end if;
  end loop;
  return query select v_due_soon, v_overdue;
end;
$$;

revoke all on function public.process_service_quality_sla(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.process_service_quality_sla(timestamptz, integer)
  to service_role;

create function public.claim_pending_notifications(p_limit integer default 100)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select notification.id
    from public.notifications as notification
    where notification.delivery_status in ('pending', 'processing')
      and notification.next_attempt_at <= now()
      and (
        notification.delivery_status = 'pending'
        or notification.last_attempt_at < now() - interval '5 minutes'
      )
      and notification.attempt_count < 3
    order by notification.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  )
  update public.notifications as notification set
    delivery_status = 'processing',
    attempt_count = notification.attempt_count + 1,
    last_attempt_at = now(),
    last_error = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_pending_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.claim_pending_notifications(integer)
  to service_role;

create function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_count integer;
begin
  if v_actor is null or not private.is_active_account(v_actor) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where recipient_user_id = v_actor and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read()
  from public, anon;
grant execute on function public.mark_all_notifications_read()
  to authenticated;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'homecare-process-service-quality-sla',
  '*/5 * * * *',
  $schedule$select public.process_service_quality_sla(now(), 100);$schedule$
);

commit;
