begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('40000000-0000-0000-0000-000000000001', 'bootstrap-active@example.test', '{"display_name":"Bootstrap active"}'),
  ('40000000-0000-0000-0000-000000000002', 'bootstrap-existing@example.test', '{"display_name":"Bootstrap existing"}'),
  ('40000000-0000-0000-0000-000000000003', 'bootstrap-inactive@example.test', '{"display_name":"Bootstrap inactive"}');

insert into public.account_roles (user_id, role)
values ('40000000-0000-0000-0000-000000000002', 'technician');

insert into public.technician_profiles (
  user_id,
  verification_status,
  submitted_at,
  rejection_reason
)
values (
  '40000000-0000-0000-0000-000000000002',
  'rejected',
  transaction_timestamp(),
  'เอกสารไม่ครบ'
);

update public.profiles
set account_status = 'deactivated',
    deactivated_at = transaction_timestamp()
where id = '40000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);

select lives_ok(
  $$select public.bootstrap_technician_application()$$,
  'an active authenticated customer can bootstrap a technician application'
);

select throws_ok(
  $$update public.profiles
    set phone = '+66899999999'
    where id = auth.uid()$$,
  '42501',
  'permission denied for table profiles',
  'an authenticated account cannot directly change its verified phone projection'
);

select is(
  (select count(*)::integer from public.account_roles where user_id = auth.uid() and role = 'customer'),
  1,
  'bootstrap retains exactly one customer role'
);

select is(
  (select count(*)::integer from public.account_roles where user_id = auth.uid() and role = 'technician'),
  1,
  'bootstrap creates exactly one technician role'
);

select is(
  (select verification_status::text from public.technician_profiles where user_id = auth.uid()),
  'draft',
  'bootstrap creates a draft technician profile'
);

select lives_ok(
  $$select public.bootstrap_technician_application()$$,
  'retrying bootstrap succeeds'
);

select is(
  (select count(*)::integer from public.account_roles where user_id = auth.uid()),
  2,
  'retry does not duplicate account roles'
);

select is(
  (select count(*)::integer from public.technician_profiles where user_id = auth.uid()),
  1,
  'retry does not duplicate the technician profile'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$select public.bootstrap_technician_application()$$,
  'an existing application can safely retry bootstrap'
);

select is(
  (select verification_status::text from public.technician_profiles where user_id = auth.uid()),
  'rejected',
  'bootstrap never resets an existing review status'
);

select is(
  (select rejection_reason from public.technician_profiles where user_id = auth.uid()),
  'เอกสารไม่ครบ',
  'bootstrap preserves existing review metadata'
);

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);

select throws_ok(
  $$select public.bootstrap_technician_application()$$,
  '42501',
  'Account must be active',
  'a deactivated account cannot bootstrap a technician application'
);

reset role;

select is(
  (
    select count(*)::integer
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'bootstrap_technician_application'
      and grantee in ('PUBLIC', 'anon')
  ),
  0,
  'bootstrap RPC is not executable by PUBLIC or anon'
);

select * from finish();
rollback;
