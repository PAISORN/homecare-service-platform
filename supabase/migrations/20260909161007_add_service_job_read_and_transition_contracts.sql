-- Phase 4B exposes participant-only job lists/details and a guarded operational
-- transition matrix. Durable chat and work evidence remain deferred.

create function public.list_service_jobs()
returns table (
  job_id uuid,
  service_request_id uuid,
  job_number text,
  actor_role text,
  category_name_th text,
  item_name_th text,
  counterpart_display_name text,
  job_status public.service_job_status,
  appointment_date date,
  appointment_time_window text,
  location_label text,
  total_amount numeric,
  currency character,
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

  return query
  select
    job.id,
    job.service_request_id,
    job.job_number,
    case when job.customer_id = v_actor_id then 'customer' else 'technician' end,
    category.name_th,
    item.name_th,
    case
      when job.customer_id = v_actor_id then technician.display_name
      else customer.display_name
    end,
    job.status,
    appointment.scheduled_date,
    appointment.time_window,
    appointment.location_label,
    job.total_amount,
    job.currency,
    job.updated_at
  from public.service_jobs as job
  join public.appointments as appointment on appointment.service_job_id = job.id
  join public.service_categories as category on category.id = job.service_category_id
  left join public.service_items as item on item.id = job.service_item_id
  join public.profiles as customer on customer.id = job.customer_id
  join public.profiles as technician on technician.id = job.technician_id
  where v_actor_id in (job.customer_id, job.technician_id)
  order by
    case when job.status = 'cancelled' then 1 else 0 end,
    appointment.scheduled_date,
    job.created_at desc;
end;
$$;

create function public.get_service_job(p_job_id uuid)
returns table (
  job_id uuid,
  service_request_id uuid,
  job_number text,
  actor_role text,
  customer_display_name text,
  technician_display_name text,
  category_name_th text,
  item_name_th text,
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
  access_instructions text,
  created_at timestamptz,
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
    select 1 from public.service_jobs as job
    where job.id = p_job_id
      and v_actor_id in (job.customer_id, job.technician_id)
  ) then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  return query
  select
    job.id,
    job.service_request_id,
    job.job_number,
    case when job.customer_id = v_actor_id then 'customer' else 'technician' end,
    customer.display_name,
    technician.display_name,
    category.name_th,
    item.name_th,
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
    appointment.access_instructions,
    job.created_at,
    job.updated_at
  from public.service_jobs as job
  join public.appointments as appointment on appointment.service_job_id = job.id
  join public.service_categories as category on category.id = job.service_category_id
  left join public.service_items as item on item.id = job.service_item_id
  join public.profiles as customer on customer.id = job.customer_id
  join public.profiles as technician on technician.id = job.technician_id
  where job.id = p_job_id;
end;
$$;

create function public.list_service_job_status_events(p_job_id uuid)
returns table (
  event_id uuid,
  from_status public.service_job_status,
  to_status public.service_job_status,
  actor_display_name text,
  reason text,
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
    where job.id = p_job_id
      and v_actor_id in (job.customer_id, job.technician_id)
  ) then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  return query
  select
    event.id,
    event.from_status,
    event.to_status,
    actor.display_name,
    event.reason,
    event.created_at
  from public.job_status_events as event
  left join public.profiles as actor on actor.id = event.actor_user_id
  where event.service_job_id = p_job_id
  order by event.created_at, event.id;
end;
$$;

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

  v_actor_role := case
    when v_actor_id = v_job.customer_id then 'customer'
    else 'technician'
  end;
  if v_actor_role = 'technician' and not private.is_verified_technician() then
    raise exception 'Verified technician required' using errcode = '42501';
  end if;

  if p_new_status = 'cancelled' then
    if not (
      (v_actor_role = 'customer' and p_expected_status = 'scheduled')
      or (
        v_actor_role = 'technician'
        and p_expected_status in ('scheduled', 'technician_en_route')
      )
    ) then
      raise exception 'Service job cancellation not allowed'
        using errcode = '22023';
    end if;
    if char_length(trim(coalesce(p_reason, ''))) not between 10 and 500 then
      raise exception 'Cancellation reason required' using errcode = '22023';
    end if;
  elsif v_actor_role <> 'technician'
    or not (
      (p_expected_status = 'scheduled' and p_new_status = 'technician_en_route')
      or (
        p_expected_status = 'technician_en_route'
        and p_new_status = 'technician_arrived'
      )
      or (
        p_expected_status = 'technician_arrived'
        and p_new_status = 'in_progress'
      )
    ) then
    raise exception 'Service job status transition not allowed'
      using errcode = '22023';
  elsif p_reason is not null then
    raise exception 'Reason is only supported for cancellation'
      using errcode = '22023';
  end if;

  update public.service_jobs
  set status = p_new_status
  where id = p_job_id
  returning * into v_job;

  if p_new_status = 'cancelled' then
    update public.appointments
    set status = 'cancelled'
    where service_job_id = p_job_id;
  end if;

  insert into public.job_status_events (
    service_job_id, from_status, to_status, actor_user_id, reason
  ) values (
    p_job_id,
    p_expected_status,
    p_new_status,
    v_actor_id,
    case when p_new_status = 'cancelled' then trim(p_reason) else null end
  );

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id,
    'service_job.status_changed',
    'service_job',
    p_job_id,
    jsonb_build_object(
      'actor_role', v_actor_role,
      'from_status', p_expected_status,
      'to_status', p_new_status
    )
  );

  return v_job;
end;
$$;

revoke execute on function public.list_service_jobs() from public, anon;
revoke execute on function public.get_service_job(uuid) from public, anon;
revoke execute on function public.list_service_job_status_events(uuid)
  from public, anon;
revoke execute on function public.transition_service_job(
  uuid, public.service_job_status, public.service_job_status, text
) from public, anon;

grant execute on function public.list_service_jobs() to authenticated;
grant execute on function public.get_service_job(uuid) to authenticated;
grant execute on function public.list_service_job_status_events(uuid)
  to authenticated;
grant execute on function public.transition_service_job(
  uuid, public.service_job_status, public.service_job_status, text
) to authenticated;
