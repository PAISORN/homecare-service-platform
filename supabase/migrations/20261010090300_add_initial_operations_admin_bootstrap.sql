create or replace function public.bootstrap_initial_operations_admin(
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('homecare:initial-operations-admin', 0)
  );

  if exists (
    select 1
    from public.account_roles as role
    where role.role = 'administrator'
  ) or exists (
    select 1
    from public.admin_permissions as permission
    where permission.permission = 'operations_management'
  ) then
    raise exception 'Initial operations admin is already provisioned'
      using errcode = '55000';
  end if;

  select profile.* into v_profile
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  where profile.id = p_user_id
    and profile.account_status = 'active'
    and auth_user.email_confirmed_at is not null
    and auth_user.raw_app_meta_data ->> 'provider' = 'email';

  if not found then
    raise exception 'Active confirmed email account required'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.account_roles as role
    where role.user_id = p_user_id
      and role.role <> 'customer'
  ) or exists (
    select 1
    from public.admin_permissions as permission
    where permission.user_id = p_user_id
  ) or exists (
    select 1
    from public.technician_profiles as technician
    where technician.user_id = p_user_id
  ) or exists (
    select 1
    from public.service_locations as location
    where location.customer_id = p_user_id
  ) or exists (
    select 1
    from public.service_requests as request
    where request.customer_id = p_user_id
  ) then
    raise exception 'Dedicated unused account required'
      using errcode = '22023';
  end if;

  delete from public.account_roles
  where user_id = p_user_id
    and role = 'customer';

  insert into public.account_roles (user_id, role, assigned_by)
  values (p_user_id, 'administrator', null);

  insert into public.admin_permissions (user_id, permission, assigned_by)
  values (p_user_id, 'operations_management', null);

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    null,
    'operations_admin.bootstrapped',
    'profile',
    p_user_id,
    jsonb_build_object(
      'role', 'administrator',
      'permission', 'operations_management',
      'bootstrap', true
    )
  );

  return p_user_id;
end;
$$;

comment on function public.bootstrap_initial_operations_admin(uuid) is
  'One-time trusted bootstrap for the first dedicated Operations Admin. Permanently refuses once any administrator or operations manager exists.';

revoke execute on function public.bootstrap_initial_operations_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.bootstrap_initial_operations_admin(uuid)
  to service_role;
