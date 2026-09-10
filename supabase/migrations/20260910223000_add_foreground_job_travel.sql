-- Phase 4F provides participant-only travel progress without retaining a route.
-- Technicians publish only while the app is foregrounded and the job is en route.

create table private.job_travel_configuration (
  singleton boolean primary key default true check (singleton),
  assumed_speed_kmh numeric(6, 2) not null check (assumed_speed_kmh > 0),
  stale_after_seconds integer not null check (stale_after_seconds between 30 and 900),
  minimum_publish_interval_seconds integer not null
    check (minimum_publish_interval_seconds between 5 and 300),
  refresh_interval_seconds integer not null
    check (refresh_interval_seconds between 5 and 300),
  updated_at timestamptz not null default now()
);

insert into private.job_travel_configuration (
  singleton,
  assumed_speed_kmh,
  stale_after_seconds,
  minimum_publish_interval_seconds,
  refresh_interval_seconds
) values (true, 25, 120, 15, 15);

revoke all on private.job_travel_configuration from public, anon, authenticated;

create table public.job_travel_locations (
  service_job_id uuid primary key
    references public.service_jobs (id) on delete cascade,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete restrict,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  accuracy_meters numeric(8, 2)
    check (accuracy_meters is null or accuracy_meters between 0 and 1000),
  captured_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.job_travel_locations enable row level security;
revoke all on public.job_travel_locations from public, anon, authenticated;

create function public.update_service_location_coordinates(
  p_location_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns public.service_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_location public.service_locations;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180 then
    raise exception 'Invalid service location coordinates' using errcode = '22023';
  end if;

  perform set_config('homecare.service_location_rpc', '1', true);
  update public.service_locations
  set latitude = round(p_latitude::numeric, 6),
      longitude = round(p_longitude::numeric, 6)
  where id = p_location_id
    and customer_id = v_actor_id
  returning * into v_location;

  if not found then
    raise exception 'Service location not found' using errcode = 'P0002';
  end if;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id,
    'service_location.coordinates_updated',
    'service_location',
    v_location.id,
    pg_catalog.jsonb_build_object('has_coordinates', true)
  );
  perform set_config('homecare.service_location_rpc', '0', true);

  return v_location;
end;
$$;

create function public.publish_service_job_travel_location(
  p_job_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_captured_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_minimum_interval integer;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or (p_accuracy_meters is not null and (
      p_accuracy_meters not between 0 and 1000
    )) then
    raise exception 'Invalid travel location' using errcode = '22023';
  end if;

  if p_captured_at is null
    or p_captured_at < pg_catalog.now() - interval '5 minutes'
    or p_captured_at > pg_catalog.now() + interval '1 minute' then
    raise exception 'Invalid travel location timestamp' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.service_jobs as job
    where job.id = p_job_id
      and job.technician_id = v_actor_id
      and job.status = 'technician_en_route'
  ) then
    raise exception 'En-route technician job required' using errcode = '42501';
  end if;

  select configuration.minimum_publish_interval_seconds
  into v_minimum_interval
  from private.job_travel_configuration as configuration
  where configuration.singleton;

  if v_minimum_interval is null then
    raise exception 'Travel configuration missing' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.job_travel_locations as location
    where location.service_job_id = p_job_id
      and location.updated_at > pg_catalog.now()
        - pg_catalog.make_interval(secs => v_minimum_interval)
  ) then
    return;
  end if;

  insert into public.job_travel_locations (
    service_job_id,
    technician_id,
    latitude,
    longitude,
    accuracy_meters,
    captured_at
  ) values (
    p_job_id,
    v_actor_id,
    round(p_latitude::numeric, 6),
    round(p_longitude::numeric, 6),
    case when p_accuracy_meters is null then null
      else round(p_accuracy_meters::numeric, 2)
    end,
    p_captured_at
  )
  on conflict (service_job_id) do update
  set technician_id = excluded.technician_id,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy_meters = excluded.accuracy_meters,
      captured_at = excluded.captured_at,
      updated_at = pg_catalog.now();
end;
$$;

create function public.get_service_job_travel_progress(p_job_id uuid)
returns table (
  job_status public.service_job_status,
  destination_ready boolean,
  sharing_active boolean,
  latitude double precision,
  longitude double precision,
  accuracy_meters double precision,
  captured_at timestamptz,
  is_stale boolean,
  straight_line_distance_km double precision,
  estimated_minutes integer,
  refresh_interval_seconds integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_speed_kmh double precision;
  v_stale_after integer;
  v_refresh_interval integer;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.service_jobs as job
    where job.id = p_job_id
      and v_actor_id in (job.customer_id, job.technician_id)
  ) then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  select
    configuration.assumed_speed_kmh::double precision,
    configuration.stale_after_seconds,
    configuration.refresh_interval_seconds
  into v_speed_kmh, v_stale_after, v_refresh_interval
  from private.job_travel_configuration as configuration
  where configuration.singleton;

  if v_speed_kmh is null then
    raise exception 'Travel configuration missing' using errcode = '55000';
  end if;

  return query
  with snapshot as (
    select
      job.status,
      appointment.latitude::double precision as destination_latitude,
      appointment.longitude::double precision as destination_longitude,
      location.latitude::double precision as technician_latitude,
      location.longitude::double precision as technician_longitude,
      location.accuracy_meters::double precision as technician_accuracy,
      location.captured_at as technician_captured_at
    from public.service_jobs as job
    join public.appointments as appointment on appointment.service_job_id = job.id
    left join public.job_travel_locations as location
      on location.service_job_id = job.id
    where job.id = p_job_id
  ), calculated as (
    select snapshot.*,
      snapshot.technician_captured_at is null
        or snapshot.technician_captured_at < pg_catalog.now()
          - pg_catalog.make_interval(secs => v_stale_after) as location_is_stale,
      case
        when snapshot.destination_latitude is null
          or snapshot.destination_longitude is null
          or snapshot.technician_latitude is null
          or snapshot.technician_longitude is null then null
        else 6371 * 2 * pg_catalog.asin(pg_catalog.sqrt(least(
          1.0::double precision,
          pg_catalog.power(pg_catalog.sin(pg_catalog.radians(
            snapshot.destination_latitude - snapshot.technician_latitude
          ) / 2), 2)
          + pg_catalog.cos(pg_catalog.radians(snapshot.technician_latitude))
          * pg_catalog.cos(pg_catalog.radians(snapshot.destination_latitude))
          * pg_catalog.power(pg_catalog.sin(pg_catalog.radians(
            snapshot.destination_longitude - snapshot.technician_longitude
          ) / 2), 2)
        )))
      end as distance_km
    from snapshot
  )
  select
    calculated.status,
    calculated.destination_latitude is not null
      and calculated.destination_longitude is not null,
    calculated.status = 'technician_en_route'
      and calculated.technician_captured_at is not null
      and not calculated.location_is_stale,
    calculated.technician_latitude,
    calculated.technician_longitude,
    calculated.technician_accuracy,
    calculated.technician_captured_at,
    calculated.location_is_stale,
    calculated.distance_km,
    case when calculated.distance_km is null then null
      else greatest(
        1,
        pg_catalog.ceil(calculated.distance_km / v_speed_kmh * 60)::integer
      )
    end,
    v_refresh_interval
  from calculated;
end;
$$;

create function public.stop_service_job_travel_sharing(p_job_id uuid)
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

  if not exists (
    select 1
    from public.service_jobs as job
    where job.id = p_job_id
      and job.technician_id = v_actor_id
  ) then
    raise exception 'Assigned technician job required' using errcode = '42501';
  end if;

  delete from public.job_travel_locations
  where service_job_id = p_job_id
    and technician_id = v_actor_id;
end;
$$;

create function private.clear_service_job_travel_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'technician_en_route'
    and new.status <> 'technician_en_route' then
    delete from public.job_travel_locations
    where service_job_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.clear_service_job_travel_location() from public;

create trigger service_jobs_clear_travel_location
after update of status on public.service_jobs
for each row execute function private.clear_service_job_travel_location();

revoke execute on function public.update_service_location_coordinates(
  uuid, double precision, double precision
) from public, anon;
revoke execute on function public.publish_service_job_travel_location(
  uuid, double precision, double precision, double precision, timestamptz
) from public, anon;
revoke execute on function public.get_service_job_travel_progress(uuid)
  from public, anon;
revoke execute on function public.stop_service_job_travel_sharing(uuid)
  from public, anon;

grant execute on function public.update_service_location_coordinates(
  uuid, double precision, double precision
) to authenticated;
grant execute on function public.publish_service_job_travel_location(
  uuid, double precision, double precision, double precision, timestamptz
) to authenticated;
grant execute on function public.get_service_job_travel_progress(uuid)
  to authenticated;
grant execute on function public.stop_service_job_travel_sharing(uuid)
  to authenticated;
