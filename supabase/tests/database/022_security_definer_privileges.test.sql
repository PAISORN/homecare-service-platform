begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(15);

select isnt(has_function_privilege('anon',
  'public.bootstrap_technician_application()', 'EXECUTE'), true,
  'anonymous callers cannot bootstrap a technician application');
select ok(has_function_privilege('authenticated',
  'public.bootstrap_technician_application()', 'EXECUTE'),
  'authenticated callers retain technician bootstrap access');

select isnt(has_function_privilege('anon',
  'public.can_delete_technician_document_file(text)', 'EXECUTE'), true,
  'anonymous callers cannot evaluate technician document deletion');
select ok(has_function_privilege('authenticated',
  'public.can_delete_technician_document_file(text)', 'EXECUTE'),
  'authenticated storage policies retain document deletion checks');

select isnt(has_function_privilege('anon',
  'public.has_account_role(public.account_role)', 'EXECUTE'), true,
  'anonymous callers cannot evaluate account roles');
select ok(has_function_privilege('authenticated',
  'public.has_account_role(public.account_role)', 'EXECUTE'),
  'authenticated policies retain account role checks');

select isnt(has_function_privilege('anon',
  'public.has_required_technician_documents(uuid)', 'EXECUTE'), true,
  'anonymous callers cannot execute the internal document validator');
select isnt(has_function_privilege('authenticated',
  'public.has_required_technician_documents(uuid)', 'EXECUTE'), true,
  'authenticated callers cannot execute the internal document validator');
select isnt(has_function_privilege('service_role',
  'public.has_required_technician_documents(uuid)', 'EXECUTE'), true,
  'service role cannot directly execute the internal document validator');

select results_eq(
  $$select p.proname::text collate "C"
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by p.proname$$,
  $$values ('list_public_technicians'::text collate "C")$$,
  'only the reviewed technician projection is anonymously callable');

select ok(has_function_privilege('authenticated',
  'public.list_public_technicians()', 'EXECUTE'),
  'authenticated callers retain public technician discovery');

select isnt(has_function_privilege('anon',
  'public.list_public_technicians()', 'EXECUTE'), false,
  'anonymous callers retain public technician discovery');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'audit_account_role_change',
      'audit_admin_permission_change',
      'block_profile_hard_delete_with_kyc',
      'create_service_job_warranty_on_completion',
      'handle_new_user',
      'protect_technician_document_identity',
      'protect_technician_verification_fields',
      'rls_auto_enable'
    ])
    and has_function_privilege('anon', p.oid, 'EXECUTE')
), 0, 'anonymous callers cannot directly execute trigger helpers');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'audit_account_role_change',
      'audit_admin_permission_change',
      'block_profile_hard_delete_with_kyc',
      'create_service_job_warranty_on_completion',
      'handle_new_user',
      'protect_technician_document_identity',
      'protect_technician_verification_fields',
      'rls_auto_enable'
    ])
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
), 0, 'authenticated callers cannot directly execute trigger helpers');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(array[
      'audit_account_role_change',
      'audit_admin_permission_change',
      'block_profile_hard_delete_with_kyc',
      'create_service_job_warranty_on_completion',
      'handle_new_user',
      'protect_technician_document_identity',
      'protect_technician_verification_fields',
      'rls_auto_enable'
    ])
    and has_function_privilege('service_role', p.oid, 'EXECUTE')
), 0, 'service role cannot directly execute trigger helpers');

select * from finish();
rollback;
