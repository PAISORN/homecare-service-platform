begin;

create extension if not exists pgtap with schema extensions;

select plan(56);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000101', 'customer-one@example.test'),
  ('00000000-0000-0000-0000-000000000102', 'customer-two@example.test'),
  ('00000000-0000-0000-0000-000000000201', 'technician-one@example.test'),
  ('00000000-0000-0000-0000-000000000202', 'technician-two@example.test'),
  ('00000000-0000-0000-0000-000000000301', 'admin@example.test');

insert into public.account_roles (user_id, role)
values
  ('00000000-0000-0000-0000-000000000201', 'technician'),
  ('00000000-0000-0000-0000-000000000202', 'technician'),
  ('00000000-0000-0000-0000-000000000301', 'administrator');

insert into public.admin_permissions (user_id, permission)
select '00000000-0000-0000-0000-000000000301', permission
from unnest(enum_range(null::public.admin_permission)) as permission;

insert into public.technician_profiles (
  user_id,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values
  ('00000000-0000-0000-0000-000000000201', '2026-08-31-v1', transaction_timestamp()),
  ('00000000-0000-0000-0000-000000000202', '2026-08-31-v1', transaction_timestamp());

insert into public.service_categories (id, code, name_th, status)
values
  ('00000000-0000-0000-0000-000000000401', 'TEST-ACTIVE', 'หมวดเปิดใช้งาน', 'active'),
  ('00000000-0000-0000-0000-000000000402', 'TEST-DRAFT', 'หมวดฉบับร่าง', 'draft');

insert into public.service_items (
  id,
  service_category_id,
  code,
  name_th,
  price_model,
  base_labor_price,
  status
)
values (
  '00000000-0000-0000-0000-000000000403',
  '00000000-0000-0000-0000-000000000401',
  'TEST-FIXED',
  'บริการทดสอบราคาคงที่',
  'fixed',
  500,
  'draft'
);

insert into public.service_locations (
  id,
  customer_id,
  label,
  address_line
)
values (
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000102',
  'บ้านลูกค้าสอง',
  'ที่อยู่ที่ลูกค้าหนึ่งต้องมองไม่เห็น'
);

set local role anon;

select results_eq(
  $$select code from public.service_categories where code like 'TEST-%' order by code$$,
  $$values ('TEST-ACTIVE'::text)$$,
  'anon can read only active catalog categories'
);

select throws_ok(
  $$select public.submit_technician_profile()$$,
  'permission denied for function submit_technician_profile',
  'anon cannot execute technician submission RPC'
);

select throws_ok(
  $$insert into public.service_categories (code, name_th, status)
    values ('ANON-SPOOF', 'ห้ามสร้าง', 'active')$$,
  'permission denied for table service_categories',
  'anon cannot create catalog categories'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);

select is(
  (select count(*)::integer from public.profiles),
  1,
  'customer can read only their own profile'
);

select lives_ok(
  $$update public.profiles
    set display_name = 'ลูกค้าหนึ่ง'
    where id = '00000000-0000-0000-0000-000000000101'$$,
  'customer can update their own profile'
);

select results_eq(
  $$with changed as (
    update public.profiles
    set display_name = 'cross-user'
    where id = '00000000-0000-0000-0000-000000000102'
    returning 1
  ) select count(*)::integer from changed$$,
  $$values (0::integer)$$,
  'customer cannot update another customer profile'
);

select lives_ok(
  $$insert into public.service_locations
      (id, customer_id, label, address_line)
    values
      ('00000000-0000-0000-0000-000000000501',
       '00000000-0000-0000-0000-000000000101',
       'บ้าน', 'ที่อยู่ทดสอบ')$$,
  'customer can create their own service location'
);

select is(
  (select count(*)::integer from public.service_locations),
  1,
  'customer can read their own service location'
);

select throws_ok(
  $$insert into public.service_locations
      (customer_id, label, address_line)
    values
      ('00000000-0000-0000-0000-000000000102', 'ปลอม', 'ที่อยู่ปลอม')$$,
  'new row violates row-level security policy for table "service_locations"',
  'customer cannot create a service location for another customer'
);

select lives_ok(
  $$update public.service_locations
    set label = 'บ้านหลัก'
    where id = '00000000-0000-0000-0000-000000000501'$$,
  'customer can update their own service location'
);

select results_eq(
  $$with changed as (
    update public.service_locations
    set label = 'cross-user'
    where id = '00000000-0000-0000-0000-000000000502'
    returning 1
  ) select count(*)::integer from changed$$,
  $$values (0::integer)$$,
  'customer cannot update another customer service location'
);

select results_eq(
  $$with removed as (
    delete from public.service_locations
    where id = '00000000-0000-0000-0000-000000000502'
    returning 1
  ) select count(*)::integer from removed$$,
  $$values (0::integer)$$,
  'customer cannot delete another customer service location'
);

select lives_ok(
  $$delete from public.service_locations
    where id = '00000000-0000-0000-0000-000000000501'$$,
  'customer can delete their own service location'
);

select throws_ok(
  $$insert into public.account_roles (user_id, role) values
    ('00000000-0000-0000-0000-000000000101', 'administrator')$$,
  'new row violates row-level security policy for table "account_roles"',
  'customer cannot escalate to administrator'
);

select throws_ok(
  $$select public.submit_technician_profile()$$,
  'Technician role required',
  'customer cannot submit a technician profile'
);

select throws_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'national_id',
       '00000000-0000-0000-0000-000000000201/customer-spoof.jpg')$$,
  'new row violates row-level security policy for table "technician_documents"',
  'customer cannot create KYC documents for a technician'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('technician-documents',
      '00000000-0000-0000-0000-000000000202/cross-user.jpg',
      '00000000-0000-0000-0000-000000000201')$$,
  'new row violates row-level security policy for table "objects"',
  'technician cannot upload into another technician prefix'
);

select lives_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'national_id',
       '00000000-0000-0000-0000-000000000201/national-id.jpg')$$,
  'technician can register a pending document with their own path'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('technician-documents',
      '00000000-0000-0000-0000-000000000201/national-id.jpg',
      '00000000-0000-0000-0000-000000000201')$$,
  'technician can upload a pre-registered draft document'
);

select lives_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'other',
       '00000000-0000-0000-0000-000000000201/optional.pdf')$$,
  'technician can register an optional draft document'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('technician-documents',
      '00000000-0000-0000-0000-000000000201/optional.pdf',
      '00000000-0000-0000-0000-000000000201')$$,
  'technician can upload the registered optional draft document'
);

select throws_ok(
  $$update public.technician_documents
    set document_type = 'professional_certificate'
    where storage_path =
      '00000000-0000-0000-0000-000000000201/optional.pdf'$$,
  'permission denied for table technician_documents',
  'technician cannot bypass the audited document replacement workflow'
);

select lives_ok(
  $$delete from public.technician_documents
    where storage_path =
      '00000000-0000-0000-0000-000000000201/optional.pdf'$$,
  'technician can delete a pending draft document record'
);

select throws_ok(
  $$delete from storage.objects
    where bucket_id = 'technician-documents'
      and name = '00000000-0000-0000-0000-000000000201/optional.pdf'$$,
  'Direct deletion from storage tables is not allowed. Use the Storage API instead.',
  'database tests preserve orphaned draft files because deletion must use the Storage API'
);

select throws_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'selfie',
       '00000000-0000-0000-0000-000000000202/spoofed-selfie.jpg')$$,
  'new row violates row-level security policy for table "technician_documents"',
  'database rejects a KYC path whose prefix spoofs another user'
);

select throws_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000202', 'selfie',
       '00000000-0000-0000-0000-000000000202/cross-user-selfie.jpg')$$,
  'new row violates row-level security policy for table "technician_documents"',
  'technician cannot register a document for another technician'
);

select throws_ok(
  $$select public.submit_technician_profile()$$,
  'National ID and selfie documents are required',
  'submission fails atomically while a required document is missing'
);

select is(
  (select verification_status::text
   from public.technician_profiles
   where user_id = '00000000-0000-0000-0000-000000000201'),
  'draft',
  'failed submission leaves technician profile in draft'
);

select lives_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'selfie',
       '00000000-0000-0000-0000-000000000201/selfie.jpg')$$,
  'technician can register the second required document'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('technician-documents',
      '00000000-0000-0000-0000-000000000201/selfie.jpg',
      '00000000-0000-0000-0000-000000000201')$$,
  'technician can upload the registered second required document'
);

select is(
  public.submit_technician_profile()::text,
  'pending_review',
  'technician can atomically submit a complete draft profile'
);

select ok(
  (select submitted_at is not null
   from public.technician_profiles
   where user_id = '00000000-0000-0000-0000-000000000201'),
  'successful submission records submitted_at'
);

select throws_ok(
  $$select public.submit_technician_profile()$$,
  'Only a draft technician profile can be submitted',
  'pending profile cannot be submitted twice'
);

select throws_ok(
  $$update public.technician_documents
    set document_type = 'other'
    where storage_path =
      '00000000-0000-0000-0000-000000000201/selfie.jpg'$$,
  'permission denied for table technician_documents',
  'technician cannot directly update a submitted document'
);

select results_eq(
  $$with removed as (
    delete from public.technician_documents
    where storage_path =
      '00000000-0000-0000-0000-000000000201/selfie.jpg'
    returning 1
  ) select count(*)::integer from removed$$,
  $$values (0::integer)$$,
  'technician cannot delete a document record after profile submission'
);

select is(
  public.can_delete_technician_document_file(
    '00000000-0000-0000-0000-000000000201/selfie.jpg'
  ),
  false,
  'Storage delete policy freezes files after profile submission'
);

select throws_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000201', 'other',
       '00000000-0000-0000-0000-000000000201/late-file.jpg')$$,
  'new row violates row-level security policy for table "technician_documents"',
  'technician cannot add documents after profile submission'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);

select is(
  (select count(*)::integer from public.technician_documents),
  0,
  'technician cannot read another technician KYC documents'
);

select lives_ok(
  $$insert into public.technician_documents
      (technician_id, document_type, storage_path)
    values
      ('00000000-0000-0000-0000-000000000202', 'national_id',
       '00000000-0000-0000-0000-000000000202/missing-national-id.jpg'),
      ('00000000-0000-0000-0000-000000000202', 'selfie',
       '00000000-0000-0000-0000-000000000202/missing-selfie.jpg')$$,
  'technician can draft document records under their own prefix'
);

select throws_ok(
  $$select public.submit_technician_profile()$$,
  'National ID and selfie documents are required',
  'submission rejects document records whose storage objects do not exist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);

select is(
  (select count(*)::integer from public.technician_documents
   where technician_id = '00000000-0000-0000-0000-000000000201'),
  2,
  'administrator can read all technician documents'
);

select lives_ok(
  $$insert into public.service_categories (code, name_th, status)
    values ('ADMIN-CRUD', 'ทดสอบผู้ดูแล', 'draft')$$,
  'administrator can create a catalog category'
);

select lives_ok(
  $$update public.service_categories
    set name_th = 'ทดสอบผู้ดูแลแก้ไข'
    where code = 'ADMIN-CRUD'$$,
  'administrator can update a catalog category'
);

select lives_ok(
  $$delete from public.service_categories where code = 'ADMIN-CRUD'$$,
  'administrator can delete a catalog category'
);

select lives_ok(
  $$select public.review_technician_document(
      (select id from public.technician_documents
       where storage_path =
         '00000000-0000-0000-0000-000000000201/national-id.jpg'),
      'approved',
      null
    )$$,
  'administrator can approve a pending KYC document'
);

select throws_ok(
  $$update public.technician_profiles
    set verification_status = 'rejected',
        rejection_reason = null
    where user_id = '00000000-0000-0000-0000-000000000201'$$,
  'permission denied for table technician_profiles',
  'direct technician verification mutation is not granted'
);

select throws_ok(
  $$update public.technician_profiles
    set verification_status = 'pending_review',
        submitted_at = null
    where user_id = '00000000-0000-0000-0000-000000000202'$$,
  'permission denied for table technician_profiles',
  'direct technician submission metadata mutation is not granted'
);

select throws_ok(
  $$update public.technician_documents
    set review_status = 'rejected',
        reviewed_at = now(),
        reviewed_by = '00000000-0000-0000-0000-000000000301',
        rejection_reason = null
    where storage_path =
      '00000000-0000-0000-0000-000000000201/selfie.jpg'$$,
  'permission denied for table technician_documents',
  'direct document review mutation is not granted'
);

select lives_ok(
  $$select public.review_technician_document(
      (select id from public.technician_documents
       where storage_path =
         '00000000-0000-0000-0000-000000000201/selfie.jpg'),
      'rejected',
      'ภาพไม่ชัดเจน'
    )$$,
  'administrator can reject a pending KYC document with a reason'
);

select lives_ok(
  $$select public.decide_technician_profile(
      '00000000-0000-0000-0000-000000000201',
      'rejected',
      'เอกสารไม่ชัดเจน'
    )$$,
  'administrator can reject a submitted technician profile with a reason'
);

select throws_ok(
  $$update public.service_items
    set status = 'active', base_labor_price = null
    where id = '00000000-0000-0000-0000-000000000403'$$,
  'new row for relation "service_items" violates check constraint "active_fixed_price_requires_base_labor_price"',
  'active fixed-price catalog items require a base price'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000201', true);

select results_eq(
  $$with changed as (
    update storage.objects
    set metadata = '{"attempted":true}'::jsonb
    where bucket_id = 'technician-documents'
      and name = '00000000-0000-0000-0000-000000000201/national-id.jpg'
    returning 1
  ) select count(*)::integer from changed$$,
  $$values (0::integer)$$,
  'technician cannot update an uploaded KYC object'
);

select is(
  public.can_delete_technician_document_file(
    '00000000-0000-0000-0000-000000000201/national-id.jpg'
  ),
  false,
  'Storage delete policy freezes an approved KYC object'
);

select results_eq(
  $$with removed as (
    delete from public.technician_documents
    where storage_path =
      '00000000-0000-0000-0000-000000000201/national-id.jpg'
    returning 1
  ) select count(*)::integer from removed$$,
  $$values (0::integer)$$,
  'technician cannot delete an approved KYC database record'
);

select is(
  public.can_delete_technician_document_file(
    '00000000-0000-0000-0000-000000000201/selfie.jpg'
  ),
  false,
  'Storage delete policy freezes a rejected KYC object'
);

select results_eq(
  $$with removed as (
    delete from public.technician_documents
    where storage_path =
      '00000000-0000-0000-0000-000000000201/selfie.jpg'
    returning 1
  ) select count(*)::integer from removed$$,
  $$values (0::integer)$$,
  'technician cannot delete a rejected KYC database record'
);

select * from finish();
rollback;
