begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(14);

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data
) values (
  'f3000000-0000-0000-0000-000000000001',
  'initial-operations@example.test',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Initial operations admin"}'
);

select isnt(has_function_privilege('anon',
  'public.bootstrap_initial_operations_admin(uuid)', 'EXECUTE'), true,
  'anonymous callers cannot bootstrap an operations admin');
select isnt(has_function_privilege('authenticated',
  'public.bootstrap_initial_operations_admin(uuid)', 'EXECUTE'), true,
  'authenticated callers cannot bootstrap an operations admin');
select ok(has_function_privilege('service_role',
  'public.bootstrap_initial_operations_admin(uuid)', 'EXECUTE'),
  'trusted service role can invoke the one-time bootstrap');

select ok(exists (
  select 1 from public.profiles
  where id = 'f3000000-0000-0000-0000-000000000001'
    and account_status = 'active'
), 'new Auth identity has an active profile');
select ok(exists (
  select 1 from public.account_roles
  where user_id = 'f3000000-0000-0000-0000-000000000001'
    and role = 'customer'
), 'new Auth identity starts with the customer role');

set local role service_role;
select is(
  public.bootstrap_initial_operations_admin(
    'f3000000-0000-0000-0000-000000000001'
  ),
  'f3000000-0000-0000-0000-000000000001'::uuid,
  'service role bootstraps the dedicated account'
);
reset role;

select isnt(exists (
  select 1 from public.account_roles
  where user_id = 'f3000000-0000-0000-0000-000000000001'
    and role = 'customer'
), true, 'bootstrap removes the default customer role');
select ok(exists (
  select 1 from public.account_roles
  where user_id = 'f3000000-0000-0000-0000-000000000001'
    and role = 'administrator'
), 'bootstrap assigns only the administrator role');
select is((
  select count(*)::integer from public.account_roles
  where user_id = 'f3000000-0000-0000-0000-000000000001'
), 1, 'bootstrap leaves exactly one account role');
select ok(exists (
  select 1 from public.admin_permissions
  where user_id = 'f3000000-0000-0000-0000-000000000001'
    and permission = 'operations_management'
), 'bootstrap grants operations management');
select ok(exists (
  select 1 from public.audit_log
  where entity_id = 'f3000000-0000-0000-0000-000000000001'
    and action = 'operations_admin.bootstrapped'
    and metadata ->> 'bootstrap' = 'true'
), 'bootstrap writes an explicit audit event');

set local role service_role;
select throws_ok(
  $$select public.bootstrap_initial_operations_admin(
      'f3000000-0000-0000-0000-000000000001'
    )$$,
  '55000',
  'Initial operations admin is already provisioned',
  'bootstrap permanently refuses a second provisioning'
);
reset role;

select is((
  select count(*)::integer from public.admin_permissions
  where permission = 'operations_management'
), 1, 'failed replay creates no duplicate operations permission');
select is((
  select count(*)::integer from public.audit_log
  where action = 'operations_admin.bootstrapped'
), 1, 'failed replay creates no duplicate bootstrap audit event');

select * from finish();
rollback;
