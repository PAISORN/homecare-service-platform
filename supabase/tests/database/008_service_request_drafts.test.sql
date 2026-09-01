begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email)
values
  ('80000000-0000-0000-0000-000000000101', 'request-one@example.test'),
  ('80000000-0000-0000-0000-000000000102', 'request-two@example.test');

insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values
  (
    '81000000-0000-0000-0000-000000000101',
    '80000000-0000-0000-0000-000000000101',
    'บ้าน', '99 ถนนสุขุมวิท', true
  ),
  (
    '81000000-0000-0000-0000-000000000102',
    '80000000-0000-0000-0000-000000000102',
    'คอนโด', '88 ถนนสุขุมวิท', true
  );

set local role anon;

select throws_ok(
  $$select public.save_service_request_draft(
    '81000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'AIR-CONDITIONING'),
    (select id from public.service_items where code = 'AC-CLEAN-WALL'),
    'service_catalog', 'ล้างแอร์', 1, 'flexible', null, null, '{}', '{}'
  )$$,
  'permission denied for function save_service_request_draft',
  'anonymous users cannot call the draft mutation contract'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-0000-0000-000000000101',
  true
);

select is(
  (select count(*)::integer from public.service_categories where status = 'pilot'),
  3,
  'all pilot service categories are visible to an authenticated customer'
);

select is(
  (select count(*)::integer from public.service_items where status = 'pilot'),
  15,
  'all pilot service items are visible to an authenticated customer'
);

select results_eq(
  $$select entry_point::text, problem_description, quantity::integer, safety_status::text
    from public.save_service_request_draft(
      '81000000-0000-0000-0000-000000000101',
      (select id from public.service_categories where code = 'AIR-CONDITIONING'),
      (select id from public.service_items where code = 'AC-CLEAN-WALL'),
      'service_catalog', '  ต้องการล้างแอร์หนึ่งเครื่อง  ', 1,
      'within_3_days', current_date + 1, 'ช่วงเช้า', '{}', '{}'
    )$$,
  $$values ('service_catalog'::text, 'ต้องการล้างแอร์หนึ่งเครื่อง'::text, 1, 'clear'::text)$$,
  'a customer can create a normalized catalog request draft'
);

reset role;
create temporary table test_request_ids (fixture text primary key, id uuid not null)
on commit drop;
insert into test_request_ids
select 'catalog', id from public.service_requests
where customer_id = '80000000-0000-0000-0000-000000000101';
grant select on test_request_ids to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-0000-0000-000000000101',
  true
);

select throws_ok(
  $$select public.save_service_request_draft(
      '81000000-0000-0000-0000-000000000101',
      (select id from public.service_categories where code = 'ELECTRICAL'),
      null, 'symptom', 'มีกลิ่นไหม้จากปลั๊ก', 1, 'as_soon_as_possible',
      null, null, '{}', '{"fire_smoke": true}'
    )$$,
  'Safety stop prevents request creation',
  'the database blocks request creation when a safety stop is detected'
);

select is(
  (select count(*)::integer from public.service_requests),
  1,
  'the owner can list the safe draft while the stopped request was not created'
);

select throws_ok(
  $$select public.save_service_request_draft(
    '81000000-0000-0000-0000-000000000102',
    (select id from public.service_categories where code = 'PLUMBING'),
    null, 'symptom', 'น้ำรั่ว', 1, 'flexible', null, null, '{}', '{}'
  )$$,
  'Service location not found',
  'a customer cannot use another customer service location'
);

select throws_ok(
  $$select public.save_service_request_draft(
    '81000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'PLUMBING'),
    (select id from public.service_items where code = 'AC-CLEAN-WALL'),
    'service_catalog', 'รายการผิดหมวด', 1, 'flexible', null, null, '{}', '{}'
  )$$,
  'Service item unavailable',
  'a service item must belong to the selected category'
);

select throws_ok(
  $$select public.save_service_request_draft(
    '81000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'PLUMBING'),
    null, 'service_catalog', 'ไม่มีรายการ', 1, 'flexible', null, null, '{}', '{}'
  )$$,
  'Service item required',
  'catalog entry requires a service item'
);

select throws_ok(
  $$select public.save_service_request_draft(
    '81000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'PLUMBING'),
    null, 'symptom', 'วันย้อนหลัง', 1, 'flexible', current_date - 1,
    null, '{}', '{}'
  )$$,
  'Preferred date cannot be in the past',
  'past preferred dates are rejected by the server'
);

select results_eq(
  $$select problem_description, quantity::integer
    from public.save_service_request_draft(
      '81000000-0000-0000-0000-000000000101',
      (select id from public.service_categories where code = 'AIR-CONDITIONING'),
      (select id from public.service_items where code = 'AC-CLEAN-WALL'),
      'service_catalog', 'แก้ไขรายละเอียด', 2, 'flexible', null, null,
      '{"building_type":"condo"}', '{}',
      (select id from test_request_ids where fixture = 'catalog')
    )$$,
  $$values ('แก้ไขรายละเอียด'::text, 2)$$,
  'the owner can reopen and update an existing draft'
);

select results_eq(
  $$select customer_id, mime_type, size_bytes
    from public.register_request_attachment(
      (select id from test_request_ids where fixture = 'catalog'),
      '80000000-0000-0000-0000-000000000101/'
        || (select id from test_request_ids where fixture = 'catalog')::text
        || '/82000000-0000-0000-0000-000000000101.jpg',
      'image/jpeg', 1200
    )$$,
  $$values (
    '80000000-0000-0000-0000-000000000101'::uuid,
    'image/jpeg'::text,
    1200
  )$$,
  'attachment metadata is reserved under the authenticated customer identity'
);

select throws_ok(
  $$select public.register_request_attachment(
    (select id from test_request_ids where fixture = 'catalog'),
    '80000000-0000-0000-0000-000000000102/fake.jpg',
    'image/jpeg', 1200
  )$$,
  'Invalid request attachment path',
  'attachment paths cannot spoof another customer or omit the request folder'
);

select throws_ok(
  $$select public.register_request_attachment(
    (select id from test_request_ids where fixture = 'catalog'),
    '80000000-0000-0000-0000-000000000101/'
      || (select id from test_request_ids where fixture = 'catalog')::text
      || '/82000000-0000-0000-0000-000000000102.pdf',
    'application/pdf', 1200
  )$$,
  'Invalid request attachment path',
  'non-image request attachments are rejected'
);

select throws_ok(
  $$select public.cancel_service_request_draft(
    (select id from test_request_ids where fixture = 'catalog')
  )$$,
  'Delete request attachments before cancelling',
  'a draft with retained private images cannot be cancelled into an undeletable state'
);

select is(
  (
    select public.delete_request_attachment(id)
    from public.request_attachments
    where customer_id = '80000000-0000-0000-0000-000000000101'
  ),
  '80000000-0000-0000-0000-000000000101/'
    || (select id from test_request_ids where fixture = 'catalog')::text
    || '/82000000-0000-0000-0000-000000000101.jpg',
  'the owner can delete attachment metadata from a draft'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-0000-0000-000000000102',
  true
);

select is(
  (select count(*)::integer from public.service_requests),
  0,
  'another customer cannot read request drafts through RLS'
);

select throws_ok(
  $$select public.cancel_service_request_draft(
    (select id from test_request_ids where fixture = 'catalog')
  )$$,
  'Service request draft not found',
  'another customer cannot cancel the owner request draft'
);

select set_config(
  'request.jwt.claim.sub',
  '80000000-0000-0000-0000-000000000101',
  true
);

select is(
  (
    select status::text from public.cancel_service_request_draft(
      (select id from test_request_ids where fixture = 'catalog')
    )
  ),
  'cancelled',
  'the owner can cancel an active draft'
);

select throws_ok(
  $$select public.register_request_attachment(
    (select id from test_request_ids where fixture = 'catalog'),
    '80000000-0000-0000-0000-000000000101/'
      || (select id from test_request_ids where fixture = 'catalog')::text
      || '/82000000-0000-0000-0000-000000000103.jpg',
    'image/jpeg', 1200
  )$$,
  'Service request draft not found',
  'cancelled drafts cannot accept new attachments'
);

reset role;

select is(
  (
    select count(*)::integer from public.audit_log
    where actor_user_id = '80000000-0000-0000-0000-000000000101'
      and entity_type = 'service_request'
  ),
  3,
  'create, update, and cancel each append an audit event'
);

select is(
  (
    select count(*)::integer from public.audit_log
    where actor_user_id = '80000000-0000-0000-0000-000000000101'
      and entity_type = 'service_request'
      and (metadata ? 'problem_description' or metadata ? 'safety_answers')
  ),
  0,
  'request audit metadata excludes free text and safety answers'
);

select is(
  (select public from storage.buckets where id = 'request-attachments'),
  false,
  'request attachments use a private storage bucket'
);

select is(
  (
    select count(*)::integer from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'request_attachment_files_%'
  ),
  3,
  'request attachment storage has explicit insert, read, and delete policies'
);

select is(
  (
    select count(*)::integer from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in (
        'save_service_request_draft',
        'cancel_service_request_draft',
        'register_request_attachment',
        'delete_request_attachment'
      )
      and proargnames @> array['customer_id']::text[]
  ),
  0,
  'request RPCs never accept a caller-selected customer identity'
);

select * from finish();

rollback;
