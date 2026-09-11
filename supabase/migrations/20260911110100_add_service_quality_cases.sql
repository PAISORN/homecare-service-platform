begin;

create type public.service_quality_case_kind as enum ('warranty_claim', 'complaint');
create type public.service_quality_case_status as enum (
  'submitted', 'under_review', 'awaiting_customer', 'awaiting_technician',
  'resolved', 'dismissed', 'escalated'
);
create type public.service_quality_case_category as enum (
  'work_quality', 'behavior', 'price_scope', 'safety', 'other'
);
create type public.service_quality_resolution as enum (
  'no_action', 'warranty_rework', 'assign_other_technician',
  'partial_refund_simulated', 'full_refund_simulated', 'other'
);
create type public.service_job_review_status as enum (
  'pending_moderation', 'published', 'hidden'
);
create type public.service_dispute_status as enum ('opened', 'under_review', 'resolved');

create table public.service_job_warranties (
  service_job_id uuid primary key references public.service_jobs (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null references public.profiles (id) on delete restrict,
  warranty_days integer not null check (warranty_days between 1 and 365),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint service_job_warranty_window check (ends_at > starts_at)
);

create table public.service_quality_cases (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  kind public.service_quality_case_kind not null,
  category public.service_quality_case_category not null,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null references public.profiles (id) on delete restrict,
  opened_by uuid not null references public.profiles (id) on delete restrict,
  details text not null check (char_length(details) between 20 and 2000),
  status public.service_quality_case_status not null default 'submitted',
  customer_response text check (customer_response is null or char_length(customer_response) between 10 and 2000),
  technician_response text check (technician_response is null or char_length(technician_response) between 10 and 2000),
  payment_hold_simulated boolean not null default false,
  payment_mode text not null default 'fake_sandbox' check (payment_mode = 'fake_sandbox'),
  decision public.service_quality_resolution,
  decision_note text check (decision_note is null or char_length(decision_note) between 10 and 2000),
  simulated_refund_amount numeric(12,2) check (simulated_refund_amount is null or simulated_refund_amount >= 0),
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  real_money_moved boolean not null default false check (real_money_moved = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_quality_decision_metadata check (
    (status not in ('resolved', 'dismissed') and decision is null and decided_by is null and decided_at is null)
    or (status in ('resolved', 'dismissed') and decision is not null and decided_by is not null and decided_at is not null)
  )
);

create unique index service_quality_cases_one_active_kind_per_job
  on public.service_quality_cases (service_job_id, kind)
  where status not in ('resolved', 'dismissed');
create index service_quality_cases_admin_queue_idx
  on public.service_quality_cases (status, created_at);
create index service_quality_cases_participant_idx
  on public.service_quality_cases (customer_id, technician_id, created_at desc);

create table public.service_quality_case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.service_quality_cases (id) on delete restrict,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique check (storage_path = trim(storage_path) and char_length(storage_path) between 40 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 6291456),
  created_at timestamptz not null default now()
);

create table public.service_quality_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.service_quality_cases (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete restrict,
  event_type text not null check (event_type = trim(event_type) and char_length(event_type) between 3 and 80),
  note text check (note is null or char_length(note) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index service_quality_case_events_case_idx
  on public.service_quality_case_events (case_id, created_at);

create table public.service_disputes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.service_quality_cases (id) on delete restrict,
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null references public.profiles (id) on delete restrict,
  status public.service_dispute_status not null default 'opened',
  opened_by uuid not null references public.profiles (id) on delete restrict,
  decision_note text check (decision_note is null or char_length(decision_note) between 10 and 2000),
  decided_by uuid references public.profiles (id) on delete restrict,
  decided_at timestamptz,
  real_money_moved boolean not null default false check (real_money_moved = false),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_job_reviews (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null unique references public.service_jobs (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null references public.profiles (id) on delete restrict,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  quality_rating smallint not null check (quality_rating between 1 and 5),
  punctuality_rating smallint not null check (punctuality_rating between 1 and 5),
  price_clarity_rating smallint not null check (price_clarity_rating between 1 and 5),
  manners_rating smallint not null check (manners_rating between 1 and 5),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 8),
  review_text text check (review_text is null or char_length(review_text) between 10 and 1000),
  status public.service_job_review_status not null default 'pending_moderation',
  editable_until timestamptz not null default (now() + interval '7 days'),
  technician_response text check (technician_response is null or char_length(technician_response) between 10 and 1000),
  technician_responded_at timestamptz,
  moderated_by uuid references public.profiles (id) on delete restrict,
  moderated_at timestamptz,
  moderation_note text check (moderation_note is null or char_length(moderation_note) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_job_review_response_metadata check (
    (technician_response is null and technician_responded_at is null)
    or (technician_response is not null and technician_responded_at is not null)
  )
);

alter table public.service_job_warranties enable row level security;
alter table public.service_quality_cases enable row level security;
alter table public.service_quality_case_attachments enable row level security;
alter table public.service_quality_case_events enable row level security;
alter table public.service_disputes enable row level security;
alter table public.service_job_reviews enable row level security;

create function private.can_access_service_quality_job(p_job_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_account(p_user_id) and exists (
    select 1 from public.service_jobs
    where id = p_job_id and (
      p_user_id in (customer_id, technician_id)
      or private.has_admin_permission('case_management', p_user_id)
    )
  );
$$;
revoke all on function private.can_access_service_quality_job(uuid, uuid) from public, anon;
grant execute on function private.can_access_service_quality_job(uuid, uuid) to authenticated;

create policy "service_job_warranties_authorized_read" on public.service_job_warranties
for select to authenticated using (private.can_access_service_quality_job(service_job_id));
create policy "service_quality_cases_authorized_read" on public.service_quality_cases
for select to authenticated using (private.can_access_service_quality_job(service_job_id));
create policy "service_quality_case_attachments_authorized_read" on public.service_quality_case_attachments
for select to authenticated using (exists (
  select 1 from public.service_quality_cases c
  where c.id = case_id and private.can_access_service_quality_job(c.service_job_id)
));
create policy "service_quality_case_events_authorized_read" on public.service_quality_case_events
for select to authenticated using (exists (
  select 1 from public.service_quality_cases c
  where c.id = case_id and private.can_access_service_quality_job(c.service_job_id)
));
create policy "service_disputes_authorized_read" on public.service_disputes
for select to authenticated using (private.can_access_service_quality_job(service_job_id));
create policy "service_job_reviews_authorized_read" on public.service_job_reviews
for select to authenticated using (
  private.can_access_service_quality_job(service_job_id)
  or (status = 'published' and private.is_active_account())
);

create function public.create_service_job_warranty_on_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed'
    and coalesce(new.warranty_days, 0) > 0 then
    insert into public.service_job_warranties (
      service_job_id, customer_id, technician_id, warranty_days, starts_at, ends_at
    ) values (
      new.id, new.customer_id, new.technician_id, new.warranty_days, now(),
      now() + make_interval(days => new.warranty_days)
    ) on conflict (service_job_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger service_jobs_create_warranty_after_completion
after update of status on public.service_jobs for each row
execute function public.create_service_job_warranty_on_completion();

insert into public.service_job_warranties (
  service_job_id, customer_id, technician_id, warranty_days, starts_at, ends_at
)
select j.id, j.customer_id, j.technician_id, j.warranty_days,
  coalesce(a.accepted_at, j.updated_at),
  coalesce(a.accepted_at, j.updated_at) + make_interval(days => j.warranty_days)
from public.service_jobs j
left join public.service_job_acceptances a on a.service_job_id = j.id
where j.status = 'completed' and coalesce(j.warranty_days, 0) > 0
on conflict (service_job_id) do nothing;

create function public.open_service_quality_case(
  p_job_id uuid, p_kind public.service_quality_case_kind,
  p_category public.service_quality_case_category, p_details text
)
returns public.service_quality_cases language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_job public.service_jobs;
  v_case public.service_quality_cases;
begin
  if v_actor is null or not private.is_active_account(v_actor) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and customer_id = v_actor for update;
  if not found then raise exception 'Service job not found' using errcode = 'P0002'; end if;
  if v_job.status not in ('awaiting_acceptance', 'completed') then
    raise exception 'Quality case is not available for this job' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_details, ''))) not between 20 and 2000 then
    raise exception 'Case details required' using errcode = '22023';
  end if;
  if p_kind = 'warranty_claim' and not exists (
    select 1 from public.service_job_warranties
    where service_job_id = p_job_id and ends_at >= now()
  ) then
    raise exception 'Active warranty required' using errcode = '22023';
  end if;
  insert into public.service_quality_cases (
    service_job_id, kind, category, customer_id, technician_id, opened_by,
    details, payment_hold_simulated
  ) values (
    p_job_id, p_kind, p_category, v_job.customer_id, v_job.technician_id,
    v_actor, trim(p_details), p_kind = 'complaint'
  ) returning * into v_case;
  insert into public.service_quality_case_events (case_id, actor_user_id, event_type)
  values (v_case.id, v_actor, 'submitted');
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.case_opened', 'service_quality_case', v_case.id,
    jsonb_build_object('service_job_id', p_job_id, 'kind', p_kind,
      'payment_hold_simulated', v_case.payment_hold_simulated,
      'real_money_moved', false));
  return v_case;
exception when unique_violation then
  raise exception 'An active case already exists' using errcode = '23505';
end;
$$;

create function public.respond_to_service_quality_case(p_case_id uuid, p_response text)
returns public.service_quality_cases language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_case public.service_quality_cases;
  v_role text;
begin
  if char_length(trim(coalesce(p_response, ''))) not between 10 and 2000 then
    raise exception 'Response required' using errcode = '22023';
  end if;
  select * into v_case from public.service_quality_cases
  where id = p_case_id and v_actor in (customer_id, technician_id) for update;
  if not found or not private.is_active_account(v_actor) then
    raise exception 'Quality case not found' using errcode = 'P0002';
  end if;
  if v_case.status in ('resolved', 'dismissed') then
    raise exception 'Quality case is closed' using errcode = '22023';
  end if;
  v_role := case when v_actor = v_case.customer_id then 'customer' else 'technician' end;
  update public.service_quality_cases set
    customer_response = case when v_role = 'customer' then trim(p_response) else customer_response end,
    technician_response = case when v_role = 'technician' then trim(p_response) else technician_response end,
    status = 'under_review', updated_at = now()
  where id = p_case_id returning * into v_case;
  insert into public.service_quality_case_events (case_id, actor_user_id, event_type, note)
  values (p_case_id, v_actor, v_role || '_responded', trim(p_response));
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.case_response_added', 'service_quality_case', p_case_id,
    jsonb_build_object('actor_role', v_role, 'real_money_moved', false));
  return v_case;
end;
$$;

create function public.register_service_quality_case_attachment(
  p_case_id uuid, p_storage_path text, p_mime_type text, p_size_bytes integer
)
returns public.service_quality_case_attachments language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.service_quality_case_attachments;
begin
  if not exists (
    select 1 from public.service_quality_cases
    where id = p_case_id and v_actor in (customer_id, technician_id)
      and status not in ('resolved', 'dismissed')
  ) or not private.is_active_account(v_actor) then
    raise exception 'Quality case not found' using errcode = 'P0002';
  end if;
  if p_storage_path not like v_actor::text || '/' || p_case_id::text || '/%'
    or p_mime_type not in ('image/jpeg', 'image/png')
    or p_size_bytes not between 1 and 6291456 then
    raise exception 'Invalid attachment' using errcode = '22023';
  end if;
  insert into public.service_quality_case_attachments (
    case_id, uploaded_by, storage_path, mime_type, size_bytes
  ) values (p_case_id, v_actor, p_storage_path, p_mime_type, p_size_bytes)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.submit_service_job_review(
  p_job_id uuid, p_overall smallint, p_quality smallint, p_punctuality smallint,
  p_price_clarity smallint, p_manners smallint, p_tags text[], p_review_text text default null
)
returns public.service_job_reviews language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_job public.service_jobs;
  v_review public.service_job_reviews;
begin
  select * into v_job from public.service_jobs
  where id = p_job_id and customer_id = v_actor and status = 'completed';
  if not found or not private.is_active_account(v_actor) then
    raise exception 'Completed service job not found' using errcode = 'P0002';
  end if;
  if least(p_overall, p_quality, p_punctuality, p_price_clarity, p_manners) < 1
    or greatest(p_overall, p_quality, p_punctuality, p_price_clarity, p_manners) > 5
    or cardinality(coalesce(p_tags, '{}'::text[])) > 8
    or exists (select 1 from unnest(coalesce(p_tags, '{}'::text[])) tag where char_length(trim(tag)) not between 2 and 40)
    or (p_review_text is not null and char_length(trim(p_review_text)) not between 10 and 1000) then
    raise exception 'Invalid review' using errcode = '22023';
  end if;
  insert into public.service_job_reviews (
    service_job_id, customer_id, technician_id, overall_rating, quality_rating,
    punctuality_rating, price_clarity_rating, manners_rating, tags, review_text
  ) values (
    p_job_id, v_job.customer_id, v_job.technician_id, p_overall, p_quality,
    p_punctuality, p_price_clarity, p_manners,
    coalesce(p_tags, '{}'::text[]), nullif(trim(p_review_text), '')
  ) on conflict (service_job_id) do update set
    overall_rating = excluded.overall_rating, quality_rating = excluded.quality_rating,
    punctuality_rating = excluded.punctuality_rating,
    price_clarity_rating = excluded.price_clarity_rating,
    manners_rating = excluded.manners_rating, tags = excluded.tags,
    review_text = excluded.review_text, status = 'pending_moderation',
    moderated_by = null, moderated_at = null, moderation_note = null, updated_at = now()
  where service_job_reviews.customer_id = v_actor
    and (now() <= service_job_reviews.editable_until or exists (
      select 1 from public.service_quality_cases c
      where c.service_job_id = p_job_id and c.status not in ('resolved', 'dismissed')
    ))
  returning * into v_review;
  if not found then raise exception 'Review is no longer editable' using errcode = '22023'; end if;
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.review_submitted', 'service_job_review', v_review.id,
    jsonb_build_object('service_job_id', p_job_id, 'status', v_review.status,
      'real_money_moved', false));
  return v_review;
end;
$$;

create function public.respond_to_service_job_review(p_review_id uuid, p_response text)
returns public.service_job_reviews language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_review public.service_job_reviews;
begin
  if char_length(trim(coalesce(p_response, ''))) not between 10 and 1000 then
    raise exception 'Review response required' using errcode = '22023';
  end if;
  update public.service_job_reviews set technician_response = trim(p_response),
    technician_responded_at = now(), updated_at = now()
  where id = p_review_id and technician_id = v_actor and technician_response is null
    and private.is_active_account(v_actor)
  returning * into v_review;
  if not found then raise exception 'Review is not available for response' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.review_responded', 'service_job_review', p_review_id,
    jsonb_build_object('real_money_moved', false));
  return v_review;
end;
$$;

create function public.admin_update_service_quality_case(
  p_case_id uuid, p_status public.service_quality_case_status,
  p_decision public.service_quality_resolution default null,
  p_decision_note text default null, p_simulated_refund_amount numeric default null
)
returns public.service_quality_cases language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_case public.service_quality_cases;
begin
  if not private.has_admin_permission('case_management', v_actor) then
    raise exception 'Case management permission required' using errcode = '42501';
  end if;
  select * into v_case from public.service_quality_cases where id = p_case_id for update;
  if not found then raise exception 'Quality case not found' using errcode = 'P0002'; end if;
  if p_status in ('resolved', 'dismissed') then
    if p_decision is null or char_length(trim(coalesce(p_decision_note, ''))) not between 10 and 2000 then
      raise exception 'Decision and note required' using errcode = '22023';
    end if;
    if p_decision in ('partial_refund_simulated', 'full_refund_simulated')
      and coalesce(p_simulated_refund_amount, 0) <= 0 then
      raise exception 'Simulated refund amount required' using errcode = '22023';
    end if;
  elsif p_decision is not null or p_decision_note is not null or p_simulated_refund_amount is not null then
    raise exception 'Decision metadata is only allowed when closing a case' using errcode = '22023';
  end if;
  update public.service_quality_cases set status = p_status,
    decision = case when p_status in ('resolved', 'dismissed') then p_decision else null end,
    decision_note = case when p_status in ('resolved', 'dismissed') then trim(p_decision_note) else null end,
    simulated_refund_amount = case when p_status in ('resolved', 'dismissed') then p_simulated_refund_amount else null end,
    decided_by = case when p_status in ('resolved', 'dismissed') then v_actor else null end,
    decided_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
    updated_at = now() where id = p_case_id returning * into v_case;
  insert into public.service_quality_case_events (case_id, actor_user_id, event_type, note, metadata)
  values (p_case_id, v_actor, 'admin_' || p_status, nullif(trim(p_decision_note), ''),
    jsonb_build_object('decision', p_decision, 'simulated_refund_amount', p_simulated_refund_amount,
      'real_money_moved', false));
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.case_updated', 'service_quality_case', p_case_id,
    jsonb_build_object('status', p_status, 'decision', p_decision,
      'simulated_refund_amount', p_simulated_refund_amount, 'real_money_moved', false));
  return v_case;
end;
$$;

create function public.admin_escalate_service_quality_case(p_case_id uuid)
returns public.service_disputes language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_case public.service_quality_cases; v_dispute public.service_disputes;
begin
  if not private.has_admin_permission('case_management', v_actor) then
    raise exception 'Case management permission required' using errcode = '42501';
  end if;
  select * into v_case from public.service_quality_cases where id = p_case_id for update;
  if not found or v_case.status in ('resolved', 'dismissed') then
    raise exception 'Open quality case not found' using errcode = 'P0002';
  end if;
  update public.service_quality_cases set status = 'escalated', updated_at = now() where id = p_case_id;
  insert into public.service_disputes (
    case_id, service_job_id, customer_id, technician_id, opened_by
  ) values (p_case_id, v_case.service_job_id, v_case.customer_id, v_case.technician_id, v_actor)
  on conflict (case_id) do update set updated_at = now()
  returning * into v_dispute;
  insert into public.service_quality_case_events (case_id, actor_user_id, event_type)
  values (p_case_id, v_actor, 'escalated_to_dispute');
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.dispute_opened', 'service_dispute', v_dispute.id,
    jsonb_build_object('case_id', p_case_id, 'real_money_moved', false));
  return v_dispute;
end;
$$;

create function public.admin_moderate_service_job_review(
  p_review_id uuid, p_status public.service_job_review_status, p_note text
)
returns public.service_job_reviews language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_review public.service_job_reviews;
begin
  if not private.has_admin_permission('case_management', v_actor) then
    raise exception 'Case management permission required' using errcode = '42501';
  end if;
  if p_status not in ('published', 'hidden')
    or char_length(trim(coalesce(p_note, ''))) not between 10 and 1000 then
    raise exception 'Moderation decision and note required' using errcode = '22023';
  end if;
  update public.service_job_reviews set status = p_status, moderated_by = v_actor,
    moderated_at = now(), moderation_note = trim(p_note), updated_at = now()
  where id = p_review_id returning * into v_review;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.review_moderated', 'service_job_review', p_review_id,
    jsonb_build_object('status', p_status, 'real_money_moved', false));
  return v_review;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-quality-evidence', 'service-quality-evidence', false, 6291456,
  array['image/jpeg', 'image/png'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function private.can_insert_service_quality_evidence_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.service_quality_case_attachments a
    join public.service_quality_cases c on c.id = a.case_id
    where a.storage_path = p_name and a.uploaded_by = (select auth.uid())
      and (select auth.uid()) in (c.customer_id, c.technician_id)
  );
$$;
create function private.can_select_service_quality_evidence_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.service_quality_case_attachments a
    join public.service_quality_cases c on c.id = a.case_id
    where a.storage_path = p_name and (
      (select auth.uid()) in (c.customer_id, c.technician_id)
      or private.has_admin_permission('case_management')
    )
  );
$$;
revoke all on function private.can_insert_service_quality_evidence_object(text) from public, anon;
revoke all on function private.can_select_service_quality_evidence_object(text) from public, anon;
grant execute on function private.can_insert_service_quality_evidence_object(text) to authenticated;
grant execute on function private.can_select_service_quality_evidence_object(text) to authenticated;

create policy "service_quality_evidence_participant_insert" on storage.objects
for insert to authenticated with check (
  bucket_id = 'service-quality-evidence'
  and private.can_insert_service_quality_evidence_object(name)
);
create policy "service_quality_evidence_authorized_select" on storage.objects
for select to authenticated using (
  bucket_id = 'service-quality-evidence'
  and private.can_select_service_quality_evidence_object(name)
);

revoke all on public.service_job_warranties, public.service_quality_cases,
  public.service_quality_case_attachments, public.service_quality_case_events,
  public.service_disputes, public.service_job_reviews from anon, authenticated;
grant select on public.service_job_warranties, public.service_quality_cases,
  public.service_quality_case_attachments, public.service_quality_case_events,
  public.service_disputes, public.service_job_reviews to authenticated;

revoke all on function public.open_service_quality_case(uuid, public.service_quality_case_kind, public.service_quality_case_category, text) from public, anon;
revoke all on function public.respond_to_service_quality_case(uuid, text) from public, anon;
revoke all on function public.register_service_quality_case_attachment(uuid, text, text, integer) from public, anon;
revoke all on function public.submit_service_job_review(uuid, smallint, smallint, smallint, smallint, smallint, text[], text) from public, anon;
revoke all on function public.respond_to_service_job_review(uuid, text) from public, anon;
revoke all on function public.admin_update_service_quality_case(uuid, public.service_quality_case_status, public.service_quality_resolution, text, numeric) from public, anon;
revoke all on function public.admin_escalate_service_quality_case(uuid) from public, anon;
revoke all on function public.admin_moderate_service_job_review(uuid, public.service_job_review_status, text) from public, anon;
grant execute on function public.open_service_quality_case(uuid, public.service_quality_case_kind, public.service_quality_case_category, text) to authenticated;
grant execute on function public.respond_to_service_quality_case(uuid, text) to authenticated;
grant execute on function public.register_service_quality_case_attachment(uuid, text, text, integer) to authenticated;
grant execute on function public.submit_service_job_review(uuid, smallint, smallint, smallint, smallint, smallint, text[], text) to authenticated;
grant execute on function public.respond_to_service_job_review(uuid, text) to authenticated;
grant execute on function public.admin_update_service_quality_case(uuid, public.service_quality_case_status, public.service_quality_resolution, text, numeric) to authenticated;
grant execute on function public.admin_escalate_service_quality_case(uuid) to authenticated;
grant execute on function public.admin_moderate_service_job_review(uuid, public.service_job_review_status, text) to authenticated;

insert into public.admin_permissions (user_id, permission, assigned_by)
select user_id, 'case_management', null from public.account_roles
where role = 'administrator'
on conflict (user_id, permission) do nothing;

commit;
