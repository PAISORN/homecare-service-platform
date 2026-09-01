begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000101', 'permission-customer@example.test'),
  ('10000000-0000-0000-0000-000000000201', 'permission-technician@example.test'),
  ('10000000-0000-0000-0000-000000000301', 'permission-reviewer@example.test'),
  ('10000000-0000-0000-0000-000000000302', 'permission-catalog@example.test'),
  ('10000000-0000-0000-0000-000000000303', 'permission-role-manager@example.test');

insert into public.account_roles (user_id, role)
values
  ('10000000-0000-0000-0000-000000000201', 'technician'),
  ('10000000-0000-0000-0000-000000000301', 'administrator'),
  ('10000000-0000-0000-0000-000000000302', 'administrator'),
  ('10000000-0000-0000-0000-000000000303', 'administrator');

insert into public.admin_permissions (user_id, permission)
values
  ('10000000-0000-0000-0000-000000000301', 'technician_review'),
  ('10000000-0000-0000-0000-000000000301', 'audit_view'),
  ('10000000-0000-0000-0000-000000000302', 'catalog_management'),
  ('10000000-0000-0000-0000-000000000303', 'role_management');

insert into public.technician_profiles (
  user_id,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values (
  '10000000-0000-0000-0000-000000000201',
  '2026-08-31-v1',
  transaction_timestamp()
);

update private.kyc_storage_configuration
set max_documents_per_technician = 2,
    updated_at = transaction_timestamp()
where singleton;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000101', true);

select throws_ok(
  $$select public.review_technician_document(
      '20000000-0000-0000-0000-000000000001', 'approved', null
    )$$,
  'Technician review permission required',
  'customer cannot call the document review workflow'
);

select throws_ok(
  $$select public.decide_technician_profile(
      '10000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'Technician review permission required',
  'customer cannot call the technician decision workflow'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000302', true);

select is(
  (select count(*)::integer from public.technician_documents),
  0,
  'catalog manager cannot read KYC documents'
);

select throws_ok(
  $$select public.decide_technician_profile(
      '10000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'Technician review permission required',
  'catalog manager cannot review technicians'
);

select lives_ok(
  $$insert into public.service_categories (code, name_th, status)
    values ('PERMISSION-CATALOG', 'หมวดสิทธิ์แคตตาล็อก', 'draft')$$,
  'catalog manager can manage the catalog'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000301', true);

select throws_ok(
  $$insert into public.service_categories (code, name_th, status)
    values ('REVIEWER-CATALOG', 'ห้ามสร้าง', 'draft')$$,
  'new row violates row-level security policy for table "service_categories"',
  'technician reviewer cannot manage catalog data'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000303', true);

select lives_ok(
  $$insert into public.admin_permissions (user_id, permission, assigned_by)
    values (
      '10000000-0000-0000-0000-000000000302',
      'audit_view',
      '10000000-0000-0000-0000-000000000303'
    )$$,
  'role manager can grant a granular permission'
);

reset role;

select ok(
  exists (
    select 1 from public.audit_log
    where action = 'admin.permission_granted'
      and actor_user_id = '10000000-0000-0000-0000-000000000303'
  ),
  'permission grant is audited with the authenticated actor'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000201', true);

select lives_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values
      ('20000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000201',
       'national_id',
       '10000000-0000-0000-0000-000000000201/national-id.jpg'),
      ('20000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000201',
       'selfie',
       '10000000-0000-0000-0000-000000000201/selfie.jpg')$$,
  'technician registers required draft document paths before upload'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'technician-documents',
      '10000000-0000-0000-0000-000000000201/orphan.jpg',
      '10000000-0000-0000-0000-000000000201'
    )$$,
  'new row violates row-level security policy for table "objects"',
  'unregistered orphan upload is denied'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values
      ('technician-documents',
       '10000000-0000-0000-0000-000000000201/national-id.jpg',
       '10000000-0000-0000-0000-000000000201'),
      ('technician-documents',
       '10000000-0000-0000-0000-000000000201/selfie.jpg',
       '10000000-0000-0000-0000-000000000201')$$,
  'registered draft KYC uploads are allowed'
);

select throws_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values (
      '20000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000201',
      'other',
      '10000000-0000-0000-0000-000000000201/quota-exceeded.jpg'
    )$$,
  'Technician document quota exceeded',
  'technician cannot register more KYC documents than the configured quota'
);

reset role;
update private.kyc_storage_configuration
set max_documents_per_technician = 3,
    updated_at = transaction_timestamp()
where singleton;

insert into public.technician_documents (
  id, technician_id, document_type, storage_path
) values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000201',
  'other',
  '10000000-0000-0000-0000-000000000201/quota-exceeded.jpg'
);

update private.kyc_storage_configuration
set max_documents_per_technician = 2,
    updated_at = transaction_timestamp()
where singleton;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000201', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'technician-documents',
      '10000000-0000-0000-0000-000000000201/quota-exceeded.jpg',
      '10000000-0000-0000-0000-000000000201'
    )$$,
  'new row violates row-level security policy for table "objects"',
  'technician cannot upload more KYC objects than the configured quota'
);

delete from public.technician_documents
where id = '20000000-0000-0000-0000-000000000003';

select is(
  public.submit_technician_profile()::text,
  'pending_review',
  'technician submits the complete KYC profile'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000301', true);

select throws_ok(
  $$select public.decide_technician_profile(
      '10000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'All technician documents must be reviewed',
  'technician cannot be verified before required documents are approved'
);

select lives_ok(
  $$select public.review_technician_document(
      '20000000-0000-0000-0000-000000000001', 'approved', null
    )$$,
  'reviewer approves the national ID through the audited RPC'
);

select lives_ok(
  $$select public.review_technician_document(
      '20000000-0000-0000-0000-000000000002', 'approved', null
    )$$,
  'reviewer approves the selfie through the audited RPC'
);

select is(
  (select reviewed_by from public.technician_documents
   where id = '20000000-0000-0000-0000-000000000001'),
  '10000000-0000-0000-0000-000000000301'::uuid,
  'review actor is derived from auth.uid'
);

select is(
  (select count(*)::integer
   from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname = 'review_technician_document'
     and pronargs = 4),
  0,
  'review RPC exposes no actor parameter that a caller could spoof'
);

select is(
  (select count(*)::integer from public.audit_log
   where action = 'technician.document_reviewed'
     and actor_user_id = '10000000-0000-0000-0000-000000000301'),
  2,
  'both document decisions are audited in their transactions'
);

select lives_ok(
  $$select public.decide_technician_profile(
      '10000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'reviewer verifies a technician only after both required approvals'
);

select ok(
  exists (
    select 1 from public.audit_log
    where action = 'technician.profile_decided'
      and actor_user_id = '10000000-0000-0000-0000-000000000301'
      and entity_id = '10000000-0000-0000-0000-000000000201'
  ),
  'technician verification is audited with the authenticated actor'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000201', true);

select is(
  public.deactivate_own_account()::text,
  'deactivated',
  'technician can soft-deactivate their own account'
);

select is(
  (select count(*)::integer from public.technician_profiles),
  0,
  'deactivated account loses authenticated access through RLS'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'technician-documents',
      '10000000-0000-0000-0000-000000000201/after-deactivation.jpg',
      '10000000-0000-0000-0000-000000000201'
    )$$,
  'new row violates row-level security policy for table "objects"',
  'deactivated technician cannot upload KYC documents'
);

reset role;

select throws_ok(
  $$delete from auth.users
    where id = '10000000-0000-0000-0000-000000000201'$$,
  'Hard delete blocked: KYC retention policy is not approved',
  'hard deletion is explicitly blocked while retained KYC exists'
);

select * from finish();
rollback;
