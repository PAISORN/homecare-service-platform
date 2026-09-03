begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
values
  ('30000000-0000-0000-0000-000000000101', 'lifecycle-customer@example.test', '{"display_name":"Lifecycle customer"}'),
  ('30000000-0000-0000-0000-000000000102', 'lifecycle-role-target@example.test', '{"display_name":"Role target"}'),
  ('30000000-0000-0000-0000-000000000201', 'lifecycle-technician@example.test', '{"display_name":"Public technician"}'),
  ('30000000-0000-0000-0000-000000000202', 'lifecycle-pending-deactivated@example.test', '{"display_name":"Pending deactivated"}'),
  ('30000000-0000-0000-0000-000000000203', 'lifecycle-verified-deactivated@example.test', '{"display_name":"Verified deactivated"}'),
  ('30000000-0000-0000-0000-000000000204', 'lifecycle-orphan@example.test', '{"display_name":"Orphan retained"}'),
  ('30000000-0000-0000-0000-000000000301', 'lifecycle-reviewer@example.test', '{"display_name":"Lifecycle reviewer"}'),
  ('30000000-0000-0000-0000-000000000302', 'lifecycle-role-manager@example.test', '{"display_name":"Lifecycle role manager"}');

insert into public.account_roles (user_id, role)
values
  ('30000000-0000-0000-0000-000000000201', 'technician'),
  ('30000000-0000-0000-0000-000000000202', 'technician'),
  ('30000000-0000-0000-0000-000000000203', 'technician'),
  ('30000000-0000-0000-0000-000000000204', 'technician'),
  ('30000000-0000-0000-0000-000000000301', 'administrator'),
  ('30000000-0000-0000-0000-000000000302', 'administrator');

insert into public.admin_permissions (user_id, permission)
values
  ('30000000-0000-0000-0000-000000000301', 'technician_review'),
  ('30000000-0000-0000-0000-000000000302', 'role_management');

insert into public.technician_profiles (
  user_id,
  bio,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values
  ('30000000-0000-0000-0000-000000000201', 'ช่างที่ผ่านการตรวจสอบและมีประสบการณ์ดูแลบ้าน', '2026-08-31-v1', transaction_timestamp()),
  ('30000000-0000-0000-0000-000000000202', 'ช่างที่ปิดบัญชีก่อนตรวจและมีประสบการณ์ดูแลบ้าน', '2026-08-31-v1', transaction_timestamp()),
  ('30000000-0000-0000-0000-000000000204', 'ช่างที่เหลือไฟล์กำพร้าและมีประสบการณ์ดูแลบ้าน', '2026-08-31-v1', transaction_timestamp());

insert into public.technician_profiles (
  user_id,
  bio,
  verification_status,
  submitted_at,
  verified_at,
  verified_by,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values (
  '30000000-0000-0000-0000-000000000203',
  'ช่างที่เคยผ่านการตรวจสอบและมีประสบการณ์ดูแลบ้าน',
  'verified',
  transaction_timestamp(),
  transaction_timestamp(),
  '30000000-0000-0000-0000-000000000301',
  '2026-08-31-v1',
  transaction_timestamp()
);

insert into public.service_categories (id, code, name_th, status)
values (
  '30000000-0000-0000-0000-000000000401',
  'LIFECYCLE-ACTIVE',
  'หมวดทดสอบวงจรบัญชี',
  'active'
);

insert into public.technician_skills (
  technician_id,
  service_category_id,
  years_experience
)
values (
  '30000000-0000-0000-0000-000000000203',
  '30000000-0000-0000-0000-000000000401',
  5
);

update private.kyc_storage_configuration
set max_documents_per_technician = 5,
    updated_at = transaction_timestamp()
where singleton;

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000201', true);

select lives_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values
      ('31000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000201',
       'national_id',
       '30000000-0000-0000-0000-000000000201/national-id.jpg'),
      ('31000000-0000-0000-0000-000000000002',
       '30000000-0000-0000-0000-000000000201',
       'selfie',
       '30000000-0000-0000-0000-000000000201/selfie.jpg'),
      ('31000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000201',
       'professional_certificate',
       '30000000-0000-0000-0000-000000000201/optional.jpg')$$,
  'technician registers required and optional documents'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values
      ('technician-documents', '30000000-0000-0000-0000-000000000201/national-id.jpg', '30000000-0000-0000-0000-000000000201'),
      ('technician-documents', '30000000-0000-0000-0000-000000000201/selfie.jpg', '30000000-0000-0000-0000-000000000201'),
      ('technician-documents', '30000000-0000-0000-0000-000000000201/optional.jpg', '30000000-0000-0000-0000-000000000201')$$,
  'technician uploads every registered document'
);

select is(
  public.submit_technician_profile()::text,
  'pending_review',
  'complete technician profile enters review'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000301', true);

select lives_ok(
  $$select public.review_technician_document(
      '31000000-0000-0000-0000-000000000001', 'approved', null
    )$$,
  'reviewer approves national ID'
);

select lives_ok(
  $$select public.review_technician_document(
      '31000000-0000-0000-0000-000000000002', 'approved', null
    )$$,
  'reviewer approves selfie'
);

select throws_ok(
  $$select public.decide_technician_profile(
      '30000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'All technician documents must be reviewed',
  'verification is blocked while any optional document is pending'
);

select lives_ok(
  $$select public.review_technician_document(
      '31000000-0000-0000-0000-000000000003',
      'rejected',
      'ใบรับรองไม่ตรงกับหมวดงาน'
    )$$,
  'reviewer may reject an optional document'
);

select lives_ok(
  $$select public.decide_technician_profile(
      '30000000-0000-0000-0000-000000000201', 'verified', null
    )$$,
  'required approvals plus a rejected optional document permit verification'
);

select is(
  (select verification_status::text
   from public.technician_profiles
   where user_id = '30000000-0000-0000-0000-000000000201'),
  'verified',
  'verification decision is persisted'
);

select is(
  (select count(*)::integer
   from public.profiles
   where id = '30000000-0000-0000-0000-000000000101'),
  0,
  'technician reviewer cannot read customer profiles'
);

select is(
  (select count(*)::integer
   from public.profiles
   where id = '30000000-0000-0000-0000-000000000202'),
  0,
  'technician reviewer cannot read a draft technician outside the review queue'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000202', true);

select lives_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values
      ('32000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000202',
       'national_id',
       '30000000-0000-0000-0000-000000000202/national-id.jpg'),
      ('32000000-0000-0000-0000-000000000002',
       '30000000-0000-0000-0000-000000000202',
       'selfie',
       '30000000-0000-0000-0000-000000000202/selfie.jpg')$$,
  'second technician registers required documents'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values
      ('technician-documents', '30000000-0000-0000-0000-000000000202/national-id.jpg', '30000000-0000-0000-0000-000000000202'),
      ('technician-documents', '30000000-0000-0000-0000-000000000202/selfie.jpg', '30000000-0000-0000-0000-000000000202')$$,
  'second technician uploads required documents'
);

select is(
  public.submit_technician_profile()::text,
  'pending_review',
  'second technician submits before deactivation'
);

select is(
  public.deactivate_own_account()::text,
  'deactivated',
  'technician deactivates before review'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000301', true);

select throws_ok(
  $$select public.review_technician_document(
      '32000000-0000-0000-0000-000000000001', 'approved', null
    )$$,
  'Target technician account must be active',
  'review RPC rejects a deactivated target'
);

select throws_ok(
  $$select public.decide_technician_profile(
      '30000000-0000-0000-0000-000000000202', 'rejected', 'ปิดบัญชีก่อนตรวจ'
    )$$,
  'Target technician account must be active',
  'profile decision RPC rejects a deactivated target'
);

reset role;

update public.profiles
set account_status = 'deactivated',
    deactivated_at = transaction_timestamp()
where id = '30000000-0000-0000-0000-000000000203';

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000101', true);

select is(
  (select count(*)::integer
   from public.technician_profiles
   where user_id = '30000000-0000-0000-0000-000000000203'),
  0,
  'inactive verified technician is excluded from profile discovery'
);

select is(
  (select count(*)::integer
   from public.technician_skills
   where technician_id = '30000000-0000-0000-0000-000000000203'),
  0,
  'inactive verified technician skills are excluded from discovery'
);

reset role;
set local role anon;

select results_eq(
  $$select technician_id
    from public.list_public_technicians()
    order by technician_id$$,
  $$values ('30000000-0000-0000-0000-000000000201'::uuid)$$,
  'public projection returns only active verified technicians'
);

select results_eq(
  $$select parameter_name::text collate "C"
    from information_schema.parameters
    where specific_schema = 'public'
      and specific_name like 'list_public_technicians_%'
      and parameter_mode = 'OUT'
    order by ordinal_position$$,
  $$values
      ('technician_id'::text collate "C"),
      ('display_name'::text collate "C"),
      ('avatar_path'::text collate "C"),
      ('bio'::text collate "C"),
      ('verified_at'::text collate "C")$$,
  'public projection exposes only approved non-PII columns'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000302', true);

select lives_ok(
  $$insert into public.account_roles (user_id, role, assigned_by)
    values (
      '30000000-0000-0000-0000-000000000102',
      'technician',
      '30000000-0000-0000-0000-000000000302'
    )$$,
  'role manager assigns a role'
);

select lives_ok(
  $$delete from public.account_roles
    where user_id = '30000000-0000-0000-0000-000000000102'
      and role = 'technician'$$,
  'role manager removes a role'
);

reset role;

select is(
  (select count(*)::integer
   from public.audit_log
   where actor_user_id = '30000000-0000-0000-0000-000000000302'
     and entity_id = '30000000-0000-0000-0000-000000000102'
     and action in ('account.role_assigned', 'account.role_removed')
     and metadata ->> 'target_user_id' = '30000000-0000-0000-0000-000000000102'
     and metadata ->> 'role' = 'technician'
     and metadata ->> 'operation' in ('insert', 'delete')),
  2,
  'role assignment and removal audits include actor, target, role, and action'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000204', true);

select lives_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values (
      '34000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000204',
      'other',
      '30000000-0000-0000-0000-000000000204/orphan.jpg'
    )$$,
  'draft technician registers a document'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'technician-documents',
      '30000000-0000-0000-0000-000000000204/orphan.jpg',
      '30000000-0000-0000-0000-000000000204'
    )$$,
  'draft technician uploads the registered object'
);

select lives_ok(
  $$delete from public.technician_documents
    where id = '34000000-0000-0000-0000-000000000001'$$,
  'draft technician deletes the database row while the file remains'
);

reset role;

select throws_ok(
  $$delete from auth.users
    where id = '30000000-0000-0000-0000-000000000204'$$,
  'Hard delete blocked: KYC retention policy is not approved',
  'orphaned Storage prefix blocks Auth hard deletion after draft row deletion'
);

select * from finish();
rollback;
