-- Phase 4D: immutable work evidence, start/completion PINs, and customer-
-- approved additional work. Acceptance and payment remain deferred.

create type public.service_job_evidence_type as enum (
  'before', 'during', 'after', 'additional_work'
);
create type public.service_job_pin_purpose as enum ('start', 'completion');
create type public.additional_work_request_status as enum (
  'pending', 'approved', 'rejected'
);

create table public.service_job_evidence (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  evidence_type public.service_job_evidence_type not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.service_job_pins (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  purpose public.service_job_pin_purpose not null,
  pin_hash text not null,
  expires_at timestamptz not null,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  consumed_at timestamptz,
  invalidated_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.service_job_additional_work_requests (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  technician_id uuid not null references public.technician_profiles (user_id) on delete restrict,
  evidence_id uuid not null unique references public.service_job_evidence (id) on delete restrict,
  scope_description text not null
    check (char_length(trim(scope_description)) between 10 and 1000),
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  labor_amount numeric(12, 2) not null default 0 check (labor_amount >= 0),
  materials_amount numeric(12, 2) not null default 0 check (materials_amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  status public.additional_work_request_status not null default 'pending',
  responded_by uuid references public.profiles (id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint additional_work_positive_total check (labor_amount + materials_amount > 0),
  constraint additional_work_response_together check (
    (status = 'pending' and responded_by is null and responded_at is null)
    or (status <> 'pending' and responded_by is not null and responded_at is not null)
  )
);

create index service_job_evidence_job_created_idx
  on public.service_job_evidence (service_job_id, created_at, id);
create index additional_work_job_created_idx
  on public.service_job_additional_work_requests (service_job_id, created_at desc);
create unique index additional_work_one_pending_per_job
  on public.service_job_additional_work_requests (service_job_id)
  where status = 'pending';
create unique index service_job_one_active_pin_per_purpose
  on public.service_job_pins (service_job_id, purpose)
  where consumed_at is null and invalidated_at is null;

alter table public.service_job_evidence enable row level security;
alter table public.service_job_pins enable row level security;
alter table public.service_job_additional_work_requests enable row level security;

revoke all on public.service_job_evidence from public, anon, authenticated;
revoke all on public.service_job_pins from public, anon, authenticated;
revoke all on public.service_job_additional_work_requests from public, anon, authenticated;

create function private.is_service_job_participant(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_jobs as job
    where job.id = p_job_id
      and (select auth.uid()) in (job.customer_id, job.technician_id)
  );
$$;
revoke all on function private.is_service_job_participant(uuid) from public;
grant execute on function private.is_service_job_participant(uuid) to authenticated;

create policy "service_job_evidence_participant_select"
on public.service_job_evidence for select to authenticated
using (private.is_service_job_participant(service_job_id));

create policy "additional_work_participant_select"
on public.service_job_additional_work_requests for select to authenticated
using (private.is_service_job_participant(service_job_id));

grant select on public.service_job_evidence,
  public.service_job_additional_work_requests to authenticated;

create function private.prevent_service_job_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.service_job_evidence_cleanup', true) = 'on'
    and not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'service-job-evidence'
        and object.name = old.storage_path
    ) then
    return old;
  end if;
  raise exception 'Service job evidence is append-only' using errcode = '55000';
end;
$$;
revoke all on function private.prevent_service_job_evidence_mutation() from public;

create trigger service_job_evidence_prevent_update
before update on public.service_job_evidence
for each row execute function private.prevent_service_job_evidence_mutation();
create trigger service_job_evidence_prevent_delete
before delete on public.service_job_evidence
for each row execute function private.prevent_service_job_evidence_mutation();

create function public.register_service_job_evidence(
  p_job_id uuid,
  p_evidence_type public.service_job_evidence_type,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
returns public.service_job_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_evidence public.service_job_evidence;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id)
    or not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and technician_id = v_actor_id for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;
  if v_job.status not in (
    'technician_arrived', 'in_progress', 'awaiting_additional_work_approval'
  ) then
    raise exception 'Evidence is not allowed for this job status' using errcode = '22023';
  end if;
  if p_evidence_type = 'before' and v_job.status <> 'technician_arrived' then
    raise exception 'Before evidence requires technician arrival' using errcode = '22023';
  end if;
  if p_evidence_type in ('during', 'after', 'additional_work')
    and v_job.status <> 'in_progress' then
    raise exception 'Work evidence requires an active job' using errcode = '22023';
  end if;
  if p_storage_path !~ (
    '^' || v_actor_id::text || '/' || p_job_id::text
    || '/(before|during|after|additional_work)/[0-9a-f-]{36}[.](jpg|png)$'
  ) then
    raise exception 'Invalid service job evidence path' using errcode = '22023';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png') then
    raise exception 'Unsupported service job evidence type' using errcode = '22023';
  end if;
  if p_size_bytes not between 1 and 8388608 then
    raise exception 'Invalid service job evidence size' using errcode = '22023';
  end if;
  if (select count(*) from public.service_job_evidence
      where service_job_id = p_job_id and evidence_type = p_evidence_type) >= 12 then
    raise exception 'Service job evidence limit reached' using errcode = '23514';
  end if;

  insert into public.service_job_evidence (
    service_job_id, evidence_type, storage_path, mime_type, size_bytes, created_by
  ) values (
    p_job_id, p_evidence_type, p_storage_path, p_mime_type, p_size_bytes, v_actor_id
  ) returning * into v_evidence;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.evidence_registered', 'service_job_evidence',
    v_evidence.id, jsonb_build_object('service_job_id', p_job_id,
      'evidence_type', p_evidence_type)
  );
  return v_evidence;
end;
$$;

create function public.issue_service_job_pin(
  p_job_id uuid,
  p_purpose public.service_job_pin_purpose
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_pin text;
  v_required_type public.service_job_evidence_type;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and customer_id = v_actor_id for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;
  if not (
    (p_purpose = 'start' and v_job.status = 'technician_arrived')
    or (p_purpose = 'completion' and v_job.status = 'in_progress')
  ) then
    raise exception 'PIN is not available for this job status' using errcode = '22023';
  end if;
  if p_purpose = 'completion' and exists (
    select 1 from public.service_job_additional_work_requests
    where service_job_id = p_job_id and status = 'pending'
  ) then
    raise exception 'Resolve additional work before completion' using errcode = '55000';
  end if;
  v_required_type := case when p_purpose = 'start' then 'before' else 'after' end;
  if not exists (
    select 1
    from public.service_job_evidence as evidence
    join storage.objects as object
      on object.bucket_id = 'service-job-evidence'
     and object.name = evidence.storage_path
    where evidence.service_job_id = p_job_id
      and evidence.evidence_type = v_required_type
  ) then
    raise exception 'Required work evidence missing' using errcode = '55000';
  end if;

  update public.service_job_pins set invalidated_at = now()
  where service_job_id = p_job_id and purpose = p_purpose
    and consumed_at is null and invalidated_at is null;
  v_pin := lpad((((('x' || encode(extensions.gen_random_bytes(3), 'hex'))
    ::bit(24)::integer) % 1000000))::text, 6, '0');
  insert into public.service_job_pins (
    service_job_id, purpose, pin_hash, expires_at, created_by
  ) values (
    p_job_id, p_purpose, extensions.crypt(v_pin, extensions.gen_salt('bf')),
    now() + interval '15 minutes', v_actor_id
  );
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.pin_issued', 'service_job', p_job_id,
    jsonb_build_object('purpose', p_purpose)
  );
  return v_pin;
end;
$$;

create function public.delete_unuploaded_service_job_evidence(p_evidence_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  perform set_config('app.service_job_evidence_cleanup', 'on', true);
  delete from public.service_job_evidence as evidence
  where evidence.id = p_evidence_id
    and evidence.created_by = v_actor_id
    and not exists (
      select 1 from storage.objects as object
      where object.bucket_id = 'service-job-evidence'
        and object.name = evidence.storage_path
    );
  if not found then
    raise exception 'Unuploaded service job evidence not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.verify_service_job_pin(
  p_job_id uuid,
  p_purpose public.service_job_pin_purpose,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_pin public.service_job_pins;
  v_new_status public.service_job_status;
  v_attempts integer;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id)
    or not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('verified', false, 'attempts_remaining', 5);
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and technician_id = v_actor_id for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;
  if not (
    (p_purpose = 'start' and v_job.status = 'technician_arrived')
    or (p_purpose = 'completion' and v_job.status = 'in_progress')
  ) then
    raise exception 'PIN is not valid for this job status' using errcode = '22023';
  end if;
  select * into v_pin from public.service_job_pins
  where service_job_id = p_job_id and purpose = p_purpose
    and consumed_at is null and invalidated_at is null and expires_at > now()
  order by created_at desc limit 1 for update;
  if not found then
    raise exception 'Active PIN not found' using errcode = 'P0002';
  end if;

  if extensions.crypt(p_pin, v_pin.pin_hash) <> v_pin.pin_hash then
    v_attempts := least(v_pin.failed_attempts + 1, 5);
    update public.service_job_pins set
      failed_attempts = v_attempts,
      invalidated_at = case when v_attempts >= 5 then now() else null end
    where id = v_pin.id;
    return jsonb_build_object(
      'verified', false, 'attempts_remaining', greatest(5 - v_attempts, 0)
    );
  end if;

  if p_purpose = 'completion' and exists (
    select 1 from public.service_job_additional_work_requests
    where service_job_id = p_job_id and status = 'pending'
  ) then
    raise exception 'Resolve additional work before completion' using errcode = '55000';
  end if;
  v_new_status := case when p_purpose = 'start'
    then 'in_progress' else 'awaiting_acceptance' end;
  update public.service_job_pins set consumed_at = now() where id = v_pin.id;
  update public.service_jobs set status = v_new_status where id = p_job_id;
  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id
  ) values (p_job_id, v_job.status, v_new_status, v_actor_id);
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.pin_verified', 'service_job', p_job_id,
    jsonb_build_object('purpose', p_purpose, 'to_status', v_new_status)
  );
  return jsonb_build_object('verified', true, 'new_status', v_new_status);
end;
$$;

create function public.create_service_job_additional_work_request(
  p_job_id uuid,
  p_evidence_id uuid,
  p_scope_description text,
  p_reason text,
  p_labor_amount numeric,
  p_materials_amount numeric
)
returns public.service_job_additional_work_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_job public.service_jobs;
  v_request public.service_job_additional_work_requests;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id)
    or not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and technician_id = v_actor_id for update;
  if not found then raise exception 'Service job not found' using errcode = 'P0002'; end if;
  if v_job.status <> 'in_progress' then
    raise exception 'Additional work requires an active job' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_scope_description, ''))) not between 10 and 1000
    or char_length(trim(coalesce(p_reason, ''))) not between 10 and 1000
    or coalesce(p_labor_amount, -1) < 0 or coalesce(p_materials_amount, -1) < 0
    or coalesce(p_labor_amount, 0) + coalesce(p_materials_amount, 0) <= 0 then
    raise exception 'Invalid additional work request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.service_job_evidence as evidence
    join storage.objects as object
      on object.bucket_id = 'service-job-evidence' and object.name = evidence.storage_path
    where evidence.id = p_evidence_id and evidence.service_job_id = p_job_id
      and evidence.created_by = v_actor_id and evidence.evidence_type = 'additional_work'
  ) then
    raise exception 'Additional work evidence required' using errcode = '22023';
  end if;
  insert into public.service_job_additional_work_requests (
    service_job_id, technician_id, evidence_id, scope_description, reason,
    labor_amount, materials_amount, currency
  ) values (
    p_job_id, v_actor_id, p_evidence_id, trim(p_scope_description), trim(p_reason),
    p_labor_amount, p_materials_amount, v_job.currency
  ) returning * into v_request;
  update public.service_jobs set status = 'awaiting_additional_work_approval'
  where id = p_job_id;
  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id
  ) values (p_job_id, 'in_progress', 'awaiting_additional_work_approval', v_actor_id);
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.additional_work_requested', 'service_job_additional_work_request',
    v_request.id, jsonb_build_object('service_job_id', p_job_id,
      'labor_amount', p_labor_amount, 'materials_amount', p_materials_amount)
  );
  return v_request;
end;
$$;

create function public.respond_to_service_job_additional_work(
  p_request_id uuid,
  p_approve boolean
)
returns public.service_job_additional_work_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_request public.service_job_additional_work_requests;
  v_job public.service_jobs;
  v_response public.additional_work_request_status;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  select request.* into v_request
  from public.service_job_additional_work_requests as request
  join public.service_jobs as job on job.id = request.service_job_id
  where request.id = p_request_id and job.customer_id = v_actor_id
  for update of request;
  if not found then raise exception 'Additional work request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then
    raise exception 'Additional work request already resolved' using errcode = '40001';
  end if;
  select * into v_job from public.service_jobs
  where id = v_request.service_job_id for update;
  if v_job.status <> 'awaiting_additional_work_approval' then
    raise exception 'Service job status changed' using errcode = '40001';
  end if;
  v_response := case when p_approve then 'approved' else 'rejected' end;
  update public.service_job_additional_work_requests set
    status = v_response, responded_by = v_actor_id, responded_at = now()
  where id = p_request_id returning * into v_request;
  if p_approve then
    update public.service_jobs set
      labor_amount = labor_amount + v_request.labor_amount,
      materials_amount = materials_amount + v_request.materials_amount,
      status = 'in_progress'
    where id = v_request.service_job_id;
  else
    update public.service_jobs set status = 'in_progress'
    where id = v_request.service_job_id;
  end if;
  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id
  ) values (
    v_request.service_job_id, 'awaiting_additional_work_approval', 'in_progress', v_actor_id
  );
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.additional_work_' || v_response,
    'service_job_additional_work_request', v_request.id,
    jsonb_build_object('service_job_id', v_request.service_job_id,
      'labor_amount', v_request.labor_amount,
      'materials_amount', v_request.materials_amount)
  );
  return v_request;
end;
$$;

-- Starting work is now possible only by verifying the customer-issued PIN.
create or replace function public.transition_service_job(
  p_job_id uuid,
  p_expected_status public.service_job_status,
  p_new_status public.service_job_status,
  p_reason text default null
)
returns public.service_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_job public.service_jobs;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  select * into v_job from public.service_jobs
  where id = p_job_id and v_actor_id in (customer_id, technician_id) for update;
  if not found then raise exception 'Service job not found' using errcode = 'P0002'; end if;
  if v_job.status <> p_expected_status then
    raise exception 'Service job status changed' using errcode = '40001';
  end if;
  v_actor_role := case when v_actor_id = v_job.customer_id then 'customer' else 'technician' end;
  if v_actor_role = 'technician' and not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;
  if p_new_status = 'cancelled' then
    if not ((v_actor_role = 'customer' and p_expected_status = 'scheduled')
      or (v_actor_role = 'technician'
        and p_expected_status in ('scheduled', 'technician_en_route'))) then
      raise exception 'Service job cancellation not allowed' using errcode = '22023';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) not between 10 and 500 then
      raise exception 'Cancellation reason required' using errcode = '22023';
    end if;
  elsif v_actor_role <> 'technician' or not (
    (p_expected_status = 'scheduled' and p_new_status = 'technician_en_route')
    or (p_expected_status = 'technician_en_route' and p_new_status = 'technician_arrived')
  ) then
    raise exception 'Service job status transition not allowed' using errcode = '22023';
  elsif p_reason is not null then
    raise exception 'Reason is only supported for cancellation' using errcode = '22023';
  end if;
  update public.service_jobs set status = p_new_status where id = p_job_id returning * into v_job;
  if p_new_status = 'cancelled' then
    update public.appointments set status = 'cancelled' where service_job_id = p_job_id;
  end if;
  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id, reason
  ) values (
    p_job_id, p_expected_status, p_new_status, v_actor_id,
    case when p_new_status = 'cancelled' then trim(p_reason) else null end
  );
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_job.status_changed', 'service_job', p_job_id,
    jsonb_build_object('actor_role', v_actor_role,
      'from_status', p_expected_status, 'to_status', p_new_status)
  );
  return v_job;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-job-evidence', 'service-job-evidence', false, 8388608,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.can_insert_service_job_evidence_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_job_evidence as evidence
    join public.service_jobs as job on job.id = evidence.service_job_id
    where evidence.storage_path = p_name
      and evidence.created_by = (select auth.uid())
      and job.technician_id = (select auth.uid())
  );
$$;
create function private.can_select_service_job_evidence_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.service_job_evidence as evidence
    join public.service_jobs as job on job.id = evidence.service_job_id
    where evidence.storage_path = p_name
      and (select auth.uid()) in (job.customer_id, job.technician_id)
  );
$$;
revoke all on function private.can_insert_service_job_evidence_object(text) from public;
revoke all on function private.can_select_service_job_evidence_object(text) from public;
grant execute on function private.can_insert_service_job_evidence_object(text) to authenticated;
grant execute on function private.can_select_service_job_evidence_object(text) to authenticated;

create policy "service_job_evidence_files_technician_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'service-job-evidence'
  and private.can_insert_service_job_evidence_object(name)
);
create policy "service_job_evidence_files_participant_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'service-job-evidence'
  and private.can_select_service_job_evidence_object(name)
);

revoke all on function public.register_service_job_evidence(
  uuid, public.service_job_evidence_type, text, text, integer
) from public, anon;
revoke all on function public.issue_service_job_pin(
  uuid, public.service_job_pin_purpose
) from public, anon;
revoke all on function public.delete_unuploaded_service_job_evidence(uuid)
  from public, anon;
revoke all on function public.verify_service_job_pin(
  uuid, public.service_job_pin_purpose, text
) from public, anon;
revoke all on function public.create_service_job_additional_work_request(
  uuid, uuid, text, text, numeric, numeric
) from public, anon;
revoke all on function public.respond_to_service_job_additional_work(
  uuid, boolean
) from public, anon;

grant execute on function public.register_service_job_evidence(
  uuid, public.service_job_evidence_type, text, text, integer
) to authenticated;
grant execute on function public.issue_service_job_pin(
  uuid, public.service_job_pin_purpose
) to authenticated;
grant execute on function public.delete_unuploaded_service_job_evidence(uuid)
  to authenticated;
grant execute on function public.verify_service_job_pin(
  uuid, public.service_job_pin_purpose, text
) to authenticated;
grant execute on function public.create_service_job_additional_work_request(
  uuid, uuid, text, text, numeric, numeric
) to authenticated;
grant execute on function public.respond_to_service_job_additional_work(
  uuid, boolean
) to authenticated;
