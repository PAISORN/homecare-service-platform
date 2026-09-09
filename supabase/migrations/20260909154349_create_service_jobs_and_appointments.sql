-- Phase 4A turns a fully confirmed agreement into a durable service job.
-- Chat, work evidence, acceptance, and payment remain deferred.

create type public.service_job_status as enum ('scheduled', 'cancelled');
create type public.appointment_status as enum ('scheduled', 'cancelled');

create table private.service_job_configuration (
  singleton boolean primary key default true check (singleton),
  labor_commission_rate numeric(7, 6) not null
    check (labor_commission_rate between 0 and 1),
  updated_at timestamptz not null default now()
);

insert into private.service_job_configuration (singleton, labor_commission_rate)
values (true, 0.15);

revoke all on private.service_job_configuration from public, anon, authenticated;

create sequence private.service_job_number_seq;
revoke all on sequence private.service_job_number_seq from public, anon, authenticated;

create table public.service_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique
    check (job_number ~ '^HC-[0-9]{8}-[0-9]{6}$'),
  service_request_id uuid not null unique
    references public.service_requests (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete restrict,
  service_category_id uuid not null
    references public.service_categories (id) on delete restrict,
  service_item_id uuid references public.service_items (id) on delete restrict,
  agreement_revision integer not null check (agreement_revision > 0),
  price_model public.price_model not null,
  scope_description text not null
    check (char_length(trim(scope_description)) between 1 and 2000),
  labor_amount numeric(12, 2) not null check (labor_amount > 0),
  materials_amount numeric(12, 2) not null default 0
    check (materials_amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  labor_commission_rate numeric(7, 6) not null
    check (labor_commission_rate between 0 and 1),
  commission_amount numeric(12, 2) generated always as
    (round(labor_amount * labor_commission_rate, 2)) stored,
  technician_net_labor_amount numeric(12, 2) generated always as
    (labor_amount - round(labor_amount * labor_commission_rate, 2)) stored,
  total_amount numeric(12, 2) generated always as
    (labor_amount + materials_amount) stored,
  warranty_days integer check (warranty_days is null or warranty_days >= 0),
  status public.service_job_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null unique
    references public.service_jobs (id) on delete restrict,
  scheduled_date date not null,
  time_window text not null
    check (char_length(trim(time_window)) between 1 and 80),
  service_location_id uuid not null
    references public.service_locations (id) on delete restrict,
  location_label text not null
    check (char_length(trim(location_label)) between 1 and 80),
  address_line text not null
    check (char_length(trim(address_line)) between 1 and 500),
  building text,
  floor text,
  unit text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  access_instructions text,
  status public.appointment_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_coordinates_together check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create table public.job_status_events (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null
    references public.service_jobs (id) on delete restrict,
  from_status public.service_job_status,
  to_status public.service_job_status not null,
  actor_user_id uuid references public.profiles (id) on delete restrict,
  reason text check (
    reason is null or char_length(trim(reason)) between 10 and 500
  ),
  created_at timestamptz not null default now()
);

create index service_jobs_customer_created_idx
  on public.service_jobs (customer_id, created_at desc);
create index service_jobs_technician_created_idx
  on public.service_jobs (technician_id, created_at desc);
create index job_status_events_job_created_idx
  on public.job_status_events (service_job_id, created_at, id);
create unique index job_status_events_initial_status_unique
  on public.job_status_events (service_job_id)
  where from_status is null;

create trigger service_jobs_set_updated_at
before update on public.service_jobs
for each row execute function public.set_updated_at();

create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create function private.prevent_job_status_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Job status events are append-only' using errcode = '55000';
end;
$$;

revoke all on function private.prevent_job_status_event_mutation() from public;

create trigger job_status_events_prevent_update
before update on public.job_status_events
for each row execute function private.prevent_job_status_event_mutation();

create trigger job_status_events_prevent_delete
before delete on public.job_status_events
for each row execute function private.prevent_job_status_event_mutation();

alter table public.service_jobs enable row level security;
alter table public.appointments enable row level security;
alter table public.job_status_events enable row level security;

revoke all on public.service_jobs from public, anon, authenticated;
revoke all on public.appointments from public, anon, authenticated;
revoke all on public.job_status_events from public, anon, authenticated;

create function private.ensure_service_job_for_agreement(
  p_request_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job_id uuid;
  v_commission_rate numeric(7, 6);
begin
  select job.id into v_job_id
  from public.service_jobs as job
  where job.service_request_id = p_request_id;
  if found then
    return v_job_id;
  end if;

  select configuration.labor_commission_rate into v_commission_rate
  from private.service_job_configuration as configuration
  where configuration.singleton;
  if v_commission_rate is null then
    raise exception 'Service job commission configuration missing'
      using errcode = '55000';
  end if;

  insert into public.service_jobs (
    job_number,
    service_request_id,
    customer_id,
    technician_id,
    service_category_id,
    service_item_id,
    agreement_revision,
    price_model,
    scope_description,
    labor_amount,
    currency,
    labor_commission_rate,
    warranty_days
  )
  select
    'HC-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
      lpad(nextval('private.service_job_number_seq')::text, 6, '0'),
    agreement.service_request_id,
    agreement.customer_id,
    agreement.technician_id,
    request.service_category_id,
    request.service_item_id,
    agreement.revision,
    selection.price_model,
    agreement.scope_description,
    agreement.labor_amount,
    agreement.currency,
    v_commission_rate,
    item.warranty_days
  from public.service_request_agreements as agreement
  join public.service_requests as request
    on request.id = agreement.service_request_id
  join public.service_request_selections as selection
    on selection.service_request_id = agreement.service_request_id
  left join public.service_items as item on item.id = request.service_item_id
  where agreement.service_request_id = p_request_id
    and agreement.fully_confirmed_at is not null
    and agreement.appointment_date is not null
    and agreement.appointment_time_window is not null
  on conflict (service_request_id) do nothing
  returning id into v_job_id;

  if v_job_id is null then
    select job.id into v_job_id
    from public.service_jobs as job
    where job.service_request_id = p_request_id;
  end if;
  if v_job_id is null then
    raise exception 'Fully confirmed service agreement required'
      using errcode = '55000';
  end if;

  insert into public.appointments (
    service_job_id,
    scheduled_date,
    time_window,
    service_location_id,
    location_label,
    address_line,
    building,
    floor,
    unit,
    latitude,
    longitude,
    access_instructions
  )
  select
    v_job_id,
    agreement.appointment_date,
    agreement.appointment_time_window,
    location.id,
    location.label,
    location.address_line,
    location.building,
    location.floor,
    location.unit,
    location.latitude,
    location.longitude,
    location.access_instructions
  from public.service_request_agreements as agreement
  join public.service_requests as request
    on request.id = agreement.service_request_id
  join public.service_locations as location
    on location.id = request.service_location_id
  where agreement.service_request_id = p_request_id
  on conflict (service_job_id) do nothing;

  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id
  ) values (
    v_job_id, null, 'scheduled', p_actor_id
  ) on conflict do nothing;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  )
  select
    p_actor_id,
    'service_job.created',
    'service_job',
    v_job_id,
    jsonb_build_object(
      'service_request_id', job.service_request_id,
      'job_number', job.job_number,
      'agreement_revision', job.agreement_revision,
      'labor_commission_rate', job.labor_commission_rate
    )
  from public.service_jobs as job
  where job.id = v_job_id
    and not exists (
      select 1 from public.audit_log as audit
      where audit.action = 'service_job.created'
        and audit.entity_id = v_job_id
    );

  return v_job_id;
end;
$$;

revoke all on function private.ensure_service_job_for_agreement(uuid, uuid)
  from public;

create function private.create_service_job_after_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fully_confirmed_at is not null
    and old.fully_confirmed_at is null then
    perform private.ensure_service_job_for_agreement(
      new.service_request_id,
      new.updated_by
    );
  end if;
  return new;
end;
$$;

revoke all on function private.create_service_job_after_confirmation()
  from public;

create trigger service_request_agreement_create_job
after update of fully_confirmed_at on public.service_request_agreements
for each row execute function private.create_service_job_after_confirmation();

do $$
declare
  v_agreement record;
begin
  for v_agreement in
    select agreement.service_request_id, agreement.updated_by
    from public.service_request_agreements as agreement
    where agreement.fully_confirmed_at is not null
  loop
    perform private.ensure_service_job_for_agreement(
      v_agreement.service_request_id,
      v_agreement.updated_by
    );
  end loop;
end;
$$;

create function public.get_service_job_for_request(p_request_id uuid)
returns table (
  job_id uuid,
  job_number text,
  actor_role text,
  customer_display_name text,
  technician_display_name text,
  scope_description text,
  labor_amount numeric,
  materials_amount numeric,
  total_amount numeric,
  currency character,
  labor_commission_rate numeric,
  commission_amount numeric,
  technician_net_labor_amount numeric,
  warranty_days integer,
  job_status public.service_job_status,
  appointment_date date,
  appointment_time_window text,
  location_label text,
  address_line text,
  building text,
  floor text,
  unit text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.service_jobs as job
    where job.service_request_id = p_request_id
      and v_actor_id in (job.customer_id, job.technician_id)
  ) then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  return query
  select
    job.id,
    job.job_number,
    case when job.customer_id = v_actor_id then 'customer' else 'technician' end,
    customer.display_name,
    technician.display_name,
    job.scope_description,
    job.labor_amount,
    job.materials_amount,
    job.total_amount,
    job.currency,
    job.labor_commission_rate,
    job.commission_amount,
    job.technician_net_labor_amount,
    job.warranty_days,
    job.status,
    appointment.scheduled_date,
    appointment.time_window,
    appointment.location_label,
    appointment.address_line,
    appointment.building,
    appointment.floor,
    appointment.unit,
    job.created_at
  from public.service_jobs as job
  join public.appointments as appointment
    on appointment.service_job_id = job.id
  join public.profiles as customer on customer.id = job.customer_id
  join public.profiles as technician on technician.id = job.technician_id
  where job.service_request_id = p_request_id;
end;
$$;

create function public.transition_service_job(
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
  v_job public.service_jobs;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select * into v_job
  from public.service_jobs
  where id = p_job_id
    and v_actor_id in (customer_id, technician_id)
  for update;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;
  if v_job.status <> p_expected_status then
    raise exception 'Service job status changed' using errcode = '40001';
  end if;
  if not (p_expected_status = 'scheduled' and p_new_status = 'cancelled') then
    raise exception 'Service job status transition not allowed'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) not between 10 and 500 then
    raise exception 'Cancellation reason required' using errcode = '22023';
  end if;

  update public.service_jobs
  set status = p_new_status
  where id = p_job_id
  returning * into v_job;

  update public.appointments
  set status = 'cancelled'
  where service_job_id = p_job_id;

  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id, reason
  ) values (
    p_job_id, p_expected_status, p_new_status, v_actor_id, trim(p_reason)
  );

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id,
    'service_job.status_changed',
    'service_job',
    p_job_id,
    jsonb_build_object(
      'from_status', p_expected_status,
      'to_status', p_new_status
    )
  );

  return v_job;
end;
$$;

revoke execute on function public.get_service_job_for_request(uuid)
  from public, anon;
revoke execute on function public.transition_service_job(
  uuid, public.service_job_status, public.service_job_status, text
) from public, anon;

grant execute on function public.get_service_job_for_request(uuid)
  to authenticated;
grant execute on function public.transition_service_job(
  uuid, public.service_job_status, public.service_job_status, text
) to authenticated;
