-- Phase 3E captures a shared, revisioned agreement after technician selection.
-- Service jobs, appointments, chat, and payments remain deferred to Phase 4.

create table public.service_request_agreements (
  service_request_id uuid primary key
    references public.service_requests (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete restrict,
  scope_description text not null
    check (char_length(trim(scope_description)) between 1 and 2000),
  labor_amount numeric(12, 2) not null check (labor_amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  appointment_date date,
  appointment_time_window text
    check (
      appointment_time_window is null
      or char_length(trim(appointment_time_window)) between 1 and 80
    ),
  revision integer not null default 1 check (revision > 0),
  customer_confirmed_revision integer check (customer_confirmed_revision > 0),
  technician_confirmed_revision integer check (technician_confirmed_revision > 0),
  fully_confirmed_at timestamptz,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_agreement_schedule_complete check (
    (appointment_date is null and appointment_time_window is null)
    or (appointment_date is not null and appointment_time_window is not null)
  ),
  constraint service_request_agreement_confirmation_consistent check (
    fully_confirmed_at is null
    or (
      customer_confirmed_revision = revision
      and technician_confirmed_revision = revision
    )
  )
);

create index service_request_agreements_technician_updated_idx
  on public.service_request_agreements (technician_id, updated_at desc);
create index service_request_agreements_customer_updated_idx
  on public.service_request_agreements (customer_id, updated_at desc);

create trigger service_request_agreements_set_updated_at
before update on public.service_request_agreements
for each row execute function public.set_updated_at();

alter table public.service_request_agreements enable row level security;
revoke all on public.service_request_agreements from public, anon, authenticated;

create function private.create_service_request_agreement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text;
begin
  select coalesce(
    quotation.scope_description,
    item.description_th,
    item.name_th,
    request.problem_description
  )
  into v_scope
  from public.service_requests as request
  left join public.service_items as item on item.id = request.service_item_id
  left join public.quotations as quotation on quotation.id = new.quotation_id
  where request.id = new.service_request_id;

  insert into public.service_request_agreements (
    service_request_id,
    customer_id,
    technician_id,
    scope_description,
    labor_amount,
    currency,
    updated_by
  ) values (
    new.service_request_id,
    new.customer_id,
    new.technician_id,
    trim(v_scope),
    new.agreed_labor_amount,
    new.currency,
    new.customer_id
  ) on conflict (service_request_id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_service_request_agreement() from public;

create trigger service_request_selection_create_agreement
after insert on public.service_request_selections
for each row execute function private.create_service_request_agreement();

-- Preserve selections made during Phase 3D before this migration is applied.
insert into public.service_request_agreements (
  service_request_id,
  customer_id,
  technician_id,
  scope_description,
  labor_amount,
  currency,
  updated_by
)
select
  selection.service_request_id,
  selection.customer_id,
  selection.technician_id,
  trim(coalesce(
    quotation.scope_description,
    item.description_th,
    item.name_th,
    request.problem_description
  )),
  selection.agreed_labor_amount,
  selection.currency,
  selection.customer_id
from public.service_request_selections as selection
join public.service_requests as request on request.id = selection.service_request_id
left join public.service_items as item on item.id = request.service_item_id
left join public.quotations as quotation on quotation.id = selection.quotation_id
on conflict (service_request_id) do nothing;

create function public.get_service_request_agreement(p_request_id uuid)
returns table (
  request_id uuid,
  actor_role text,
  category_name_th text,
  item_name_th text,
  problem_description text,
  quantity smallint,
  location_label text,
  address_line text,
  building text,
  floor text,
  unit text,
  customer_display_name text,
  technician_display_name text,
  scope_description text,
  labor_amount numeric,
  currency character,
  appointment_date date,
  appointment_time_window text,
  revision integer,
  customer_confirmed boolean,
  technician_confirmed boolean,
  fully_confirmed_at timestamptz,
  updated_at timestamptz
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
    select 1 from public.service_request_agreements as agreement
    where agreement.service_request_id = p_request_id
      and v_actor_id in (agreement.customer_id, agreement.technician_id)
  ) then
    raise exception 'Selected service request agreement not found'
      using errcode = 'P0002';
  end if;

  return query
  select
    request.id,
    case when agreement.customer_id = v_actor_id then 'customer' else 'technician' end,
    category.name_th,
    item.name_th,
    request.problem_description,
    request.quantity,
    location.label,
    location.address_line,
    location.building,
    location.floor,
    location.unit,
    customer.display_name,
    technician.display_name,
    agreement.scope_description,
    agreement.labor_amount,
    agreement.currency,
    agreement.appointment_date,
    agreement.appointment_time_window,
    agreement.revision,
    coalesce(agreement.customer_confirmed_revision = agreement.revision, false),
    coalesce(agreement.technician_confirmed_revision = agreement.revision, false),
    agreement.fully_confirmed_at,
    agreement.updated_at
  from public.service_request_agreements as agreement
  join public.service_requests as request on request.id = agreement.service_request_id
  join public.service_categories as category on category.id = request.service_category_id
  left join public.service_items as item on item.id = request.service_item_id
  join public.service_locations as location on location.id = request.service_location_id
  join public.profiles as customer on customer.id = agreement.customer_id
  join public.profiles as technician on technician.id = agreement.technician_id
  where agreement.service_request_id = p_request_id;
end;
$$;

create function public.list_technician_selected_requests()
returns table (
  request_id uuid,
  category_name_th text,
  item_name_th text,
  customer_display_name text,
  appointment_date date,
  appointment_time_window text,
  customer_confirmed boolean,
  technician_confirmed boolean,
  fully_confirmed_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;

  return query
  select
    agreement.service_request_id,
    category.name_th,
    item.name_th,
    customer.display_name,
    agreement.appointment_date,
    agreement.appointment_time_window,
    coalesce(agreement.customer_confirmed_revision = agreement.revision, false),
    coalesce(agreement.technician_confirmed_revision = agreement.revision, false),
    agreement.fully_confirmed_at,
    agreement.updated_at
  from public.service_request_agreements as agreement
  join public.service_requests as request on request.id = agreement.service_request_id
  join public.service_categories as category on category.id = request.service_category_id
  left join public.service_items as item on item.id = request.service_item_id
  join public.profiles as customer on customer.id = agreement.customer_id
  where agreement.technician_id = v_actor_id
    and request.status = 'technician_selected'
  order by agreement.updated_at desc, agreement.service_request_id;
end;
$$;

create function public.propose_service_request_appointment(
  p_request_id uuid,
  p_appointment_date date,
  p_appointment_time_window text
)
returns public.service_request_agreements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_agreement public.service_request_agreements;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_appointment_date is null or p_appointment_date < current_date then
    raise exception 'Appointment date must be today or later' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_appointment_time_window, ''))) not between 1 and 80 then
    raise exception 'Appointment time window required' using errcode = '22023';
  end if;

  select * into v_agreement
  from public.service_request_agreements
  where service_request_id = p_request_id
    and v_actor_id in (customer_id, technician_id)
  for update;
  if not found then
    raise exception 'Selected service request agreement not found'
      using errcode = 'P0002';
  end if;
  if v_agreement.fully_confirmed_at is not null then
    raise exception 'Confirmed agreement cannot be changed' using errcode = '55000';
  end if;

  if v_agreement.appointment_date is distinct from p_appointment_date
    or v_agreement.appointment_time_window is distinct from trim(p_appointment_time_window) then
    update public.service_request_agreements
    set appointment_date = p_appointment_date,
      appointment_time_window = trim(p_appointment_time_window),
      revision = revision + 1,
      customer_confirmed_revision = null,
      technician_confirmed_revision = null,
      fully_confirmed_at = null,
      updated_by = v_actor_id
    where service_request_id = p_request_id
    returning * into v_agreement;

    insert into public.audit_log (
      actor_user_id, action, entity_type, entity_id, metadata
    ) values (
      v_actor_id,
      'service_request.appointment_proposed',
      'service_request',
      p_request_id,
      jsonb_build_object(
        'appointment_date', p_appointment_date,
        'appointment_time_window', trim(p_appointment_time_window),
        'revision', v_agreement.revision
      )
    );
  end if;

  return v_agreement;
end;
$$;

create function public.confirm_service_request_agreement(p_request_id uuid)
returns public.service_request_agreements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_agreement public.service_request_agreements;
  v_actor_role text;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select * into v_agreement
  from public.service_request_agreements
  where service_request_id = p_request_id
    and v_actor_id in (customer_id, technician_id)
  for update;
  if not found then
    raise exception 'Selected service request agreement not found'
      using errcode = 'P0002';
  end if;
  if v_agreement.appointment_date is null
    or v_agreement.appointment_time_window is null then
    raise exception 'Appointment proposal required' using errcode = '22023';
  end if;
  if v_agreement.appointment_date < current_date then
    raise exception 'Appointment date is in the past' using errcode = '22023';
  end if;

  v_actor_role := case
    when v_actor_id = v_agreement.customer_id then 'customer'
    else 'technician'
  end;

  if (v_actor_role = 'customer'
      and v_agreement.customer_confirmed_revision = v_agreement.revision)
    or (v_actor_role = 'technician'
      and v_agreement.technician_confirmed_revision = v_agreement.revision) then
    return v_agreement;
  end if;

  update public.service_request_agreements
  set customer_confirmed_revision = case
        when v_actor_role = 'customer' then revision
        else customer_confirmed_revision
      end,
      technician_confirmed_revision = case
        when v_actor_role = 'technician' then revision
        else technician_confirmed_revision
      end,
      fully_confirmed_at = case
        when (
          (v_actor_role = 'customer' or customer_confirmed_revision = revision)
          and (v_actor_role = 'technician' or technician_confirmed_revision = revision)
        ) then coalesce(fully_confirmed_at, now())
        else null
      end,
      updated_by = v_actor_id
  where service_request_id = p_request_id
  returning * into v_agreement;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id,
    'service_request.agreement_confirmed',
    'service_request',
    p_request_id,
    jsonb_build_object(
      'actor_role', v_actor_role,
      'revision', v_agreement.revision,
      'fully_confirmed', v_agreement.fully_confirmed_at is not null
    )
  );

  return v_agreement;
end;
$$;

revoke execute on function public.get_service_request_agreement(uuid)
  from public, anon;
revoke execute on function public.list_technician_selected_requests()
  from public, anon;
revoke execute on function public.propose_service_request_appointment(uuid, date, text)
  from public, anon;
revoke execute on function public.confirm_service_request_agreement(uuid)
  from public, anon;

grant execute on function public.get_service_request_agreement(uuid)
  to authenticated;
grant execute on function public.list_technician_selected_requests()
  to authenticated;
grant execute on function public.propose_service_request_appointment(uuid, date, text)
  to authenticated;
grant execute on function public.confirm_service_request_agreement(uuid)
  to authenticated;
