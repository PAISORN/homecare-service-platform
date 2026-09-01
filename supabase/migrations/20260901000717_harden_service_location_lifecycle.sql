-- Phase 2D exposes service-location mutations through authenticated RPCs so
-- ownership, default selection, validation, and audit writes share one
-- transaction. Exact addresses never enter audit metadata.

alter table public.service_locations
  add constraint service_locations_building_length
    check (building is null or char_length(trim(building)) between 1 and 160),
  add constraint service_locations_floor_length
    check (floor is null or char_length(trim(floor)) between 1 and 40),
  add constraint service_locations_unit_length
    check (unit is null or char_length(trim(unit)) between 1 and 40),
  add constraint service_locations_access_instructions_length
    check (
      access_instructions is null
      or char_length(trim(access_instructions)) between 1 and 500
    );

create or replace function private.normalize_service_location_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_internal_default_change boolean := coalesce(
    current_setting('homecare.service_location_default_change', true),
    '0'
  ) = '1';
begin
  if tg_op = 'UPDATE'
    and (new.id <> old.id or new.customer_id <> old.customer_id) then
    raise exception 'Service location identity is immutable' using errcode = '22023';
  end if;

  new.label := trim(new.label);
  new.address_line := trim(new.address_line);
  new.building := nullif(trim(new.building), '');
  new.floor := nullif(trim(new.floor), '');
  new.unit := nullif(trim(new.unit), '');
  new.access_instructions := nullif(trim(new.access_instructions), '');

  if tg_op = 'INSERT' and not exists (
    select 1
    from public.service_locations
    where customer_id = new.customer_id
  ) then
    new.is_default := true;
  end if;

  if new.is_default then
    perform set_config('homecare.service_location_default_change', '1', true);
    update public.service_locations
    set is_default = false
    where customer_id = new.customer_id
      and is_default
      and id <> new.id;
    perform set_config('homecare.service_location_default_change', '0', true);
  elsif tg_op = 'UPDATE' and old.is_default and not v_internal_default_change then
    new.is_default := true;
  end if;

  return new;
end;
$$;

create or replace function private.promote_service_location_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default
    and coalesce(
      current_setting('homecare.service_location_rpc', true),
      '0'
    ) <> '1' then
    update public.service_locations
    set is_default = true
    where id = (
      select id
      from public.service_locations
      where customer_id = old.customer_id
      order by created_at asc, id asc
      limit 1
    );
  end if;
  return old;
end;
$$;

create or replace function private.audit_service_location_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_location_id uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  v_is_default boolean := case
    when tg_op = 'DELETE' then old.is_default
    else new.is_default
  end;
begin
  if coalesce(
    current_setting('homecare.service_location_rpc', true),
    '0'
  ) = '1' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    auth.uid(),
    case tg_op
      when 'INSERT' then 'service_location.created'
      when 'UPDATE' then 'service_location.updated'
      else 'service_location.deleted'
    end,
    'service_location',
    v_location_id,
    pg_catalog.jsonb_build_object('is_default', v_is_default)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_service_location_write() from public;
revoke all on function private.promote_service_location_after_delete() from public;
revoke all on function private.audit_service_location_change() from public;

create trigger service_locations_normalize_before_write
before insert or update on public.service_locations
for each row execute function private.normalize_service_location_write();

create trigger service_locations_promote_after_delete
after delete on public.service_locations
for each row execute function private.promote_service_location_after_delete();

create trigger service_locations_audit_after_change
after insert or update or delete on public.service_locations
for each row execute function private.audit_service_location_change();

create or replace function public.save_service_location(
  p_label text,
  p_address_line text,
  p_building text default null,
  p_floor text default null,
  p_unit text default null,
  p_access_instructions text default null,
  p_is_default boolean default false,
  p_location_id uuid default null
)
returns public.service_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_location public.service_locations;
  v_is_first boolean;
  v_make_default boolean;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_label, ''))) not between 1 and 80 then
    raise exception 'Invalid service location label' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_address_line, ''))) not between 1 and 500 then
    raise exception 'Invalid service location address' using errcode = '22023';
  end if;
  if p_building is not null
    and trim(p_building) <> ''
    and char_length(trim(p_building)) not between 1 and 160 then
    raise exception 'Invalid service location building' using errcode = '22023';
  end if;
  if p_floor is not null
    and trim(p_floor) <> ''
    and char_length(trim(p_floor)) not between 1 and 40 then
    raise exception 'Invalid service location floor' using errcode = '22023';
  end if;
  if p_unit is not null
    and trim(p_unit) <> ''
    and char_length(trim(p_unit)) not between 1 and 40 then
    raise exception 'Invalid service location unit' using errcode = '22023';
  end if;
  if p_access_instructions is not null
    and trim(p_access_instructions) <> ''
    and char_length(trim(p_access_instructions)) not between 1 and 500 then
    raise exception 'Invalid service location access instructions' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text, 0)
  );

  select not exists (
    select 1
    from public.service_locations
    where customer_id = v_actor_id
  ) into v_is_first;

  if p_location_id is null then
    v_make_default := v_is_first or p_is_default;
  else
    select location.is_default
    into v_make_default
    from public.service_locations as location
    where location.id = p_location_id
      and location.customer_id = v_actor_id
    for update;

    if not found then
      raise exception 'Service location not found' using errcode = 'P0002';
    end if;
    v_make_default := v_make_default or p_is_default;
  end if;

  perform set_config('homecare.service_location_rpc', '1', true);

  if p_location_id is null then
    insert into public.service_locations (
      customer_id,
      label,
      address_line,
      building,
      floor,
      unit,
      access_instructions,
      is_default
    ) values (
      v_actor_id,
      trim(p_label),
      trim(p_address_line),
      nullif(trim(p_building), ''),
      nullif(trim(p_floor), ''),
      nullif(trim(p_unit), ''),
      nullif(trim(p_access_instructions), ''),
      v_make_default
    ) returning * into v_location;
  else
    update public.service_locations
    set
      label = trim(p_label),
      address_line = trim(p_address_line),
      building = nullif(trim(p_building), ''),
      floor = nullif(trim(p_floor), ''),
      unit = nullif(trim(p_unit), ''),
      access_instructions = nullif(trim(p_access_instructions), ''),
      is_default = v_make_default
    where id = p_location_id
      and customer_id = v_actor_id
    returning * into v_location;
  end if;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    case when p_location_id is null
      then 'service_location.created'
      else 'service_location.updated'
    end,
    'service_location',
    v_location.id,
    pg_catalog.jsonb_build_object('is_default', v_location.is_default)
  );

  perform set_config('homecare.service_location_rpc', '0', true);

  return v_location;
end;
$$;

create or replace function public.set_default_service_location(
  p_location_id uuid
)
returns public.service_locations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_location public.service_locations;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text, 0)
  );

  perform 1
  from public.service_locations
  where id = p_location_id
    and customer_id = v_actor_id
  for update;
  if not found then
    raise exception 'Service location not found' using errcode = 'P0002';
  end if;

  perform set_config('homecare.service_location_rpc', '1', true);
  perform set_config('homecare.service_location_default_change', '1', true);
  update public.service_locations
  set is_default = false
  where customer_id = v_actor_id
    and is_default
    and id <> p_location_id;
  perform set_config('homecare.service_location_default_change', '0', true);

  update public.service_locations
  set is_default = true
  where id = p_location_id;

  select *
  into v_location
  from public.service_locations
  where id = p_location_id;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'service_location.default_changed',
    'service_location',
    v_location.id,
    pg_catalog.jsonb_build_object('is_default', true)
  );

  perform set_config('homecare.service_location_rpc', '0', true);

  return v_location;
end;
$$;

create or replace function public.delete_service_location(
  p_location_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_was_default boolean;
  v_replacement_id uuid;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text, 0)
  );

  perform set_config('homecare.service_location_rpc', '1', true);
  delete from public.service_locations
  where id = p_location_id
    and customer_id = v_actor_id
  returning is_default into v_was_default;
  if not found then
    raise exception 'Service location not found' using errcode = 'P0002';
  end if;

  if v_was_default then
    select id
    into v_replacement_id
    from public.service_locations
    where customer_id = v_actor_id
    order by created_at asc, id asc
    limit 1
    for update;

    if v_replacement_id is not null then
      update public.service_locations
      set is_default = true
      where id = v_replacement_id;
    end if;
  end if;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor_id,
    'service_location.deleted',
    'service_location',
    p_location_id,
    pg_catalog.jsonb_build_object(
      'was_default', v_was_default,
      'replacement_location_id', v_replacement_id
    )
  );

  perform set_config('homecare.service_location_rpc', '0', true);

  return p_location_id;
end;
$$;

revoke all on function public.save_service_location(
  text, text, text, text, text, text, boolean, uuid
) from public, anon;
revoke all on function public.set_default_service_location(uuid)
  from public, anon;
revoke all on function public.delete_service_location(uuid)
  from public, anon;

grant execute on function public.save_service_location(
  text, text, text, text, text, text, boolean, uuid
) to authenticated;
grant execute on function public.set_default_service_location(uuid)
  to authenticated;
grant execute on function public.delete_service_location(uuid)
  to authenticated;
