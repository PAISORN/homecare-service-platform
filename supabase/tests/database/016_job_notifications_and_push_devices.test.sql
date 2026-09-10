begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000101', 'notify-customer@example.test'),
  ('a0000000-0000-0000-0000-000000000102', 'notify-other@example.test'),
  ('a0000000-0000-0000-0000-000000000201', 'notify-tech@example.test'),
  ('a0000000-0000-0000-0000-000000000301', 'notify-admin@example.test');

insert into public.account_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000201', 'technician'),
  ('a0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'a0000000-0000-0000-0000-000000000201',
  'ช่างสำหรับทดสอบการแจ้งเตือนงานบริการ',
  'verified', now(), now(), 'a0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'a1000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบแจ้งเตือน', '11/11 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select 'a2000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000101',
  'a1000000-0000-0000-0000-000000000101', category.id,
  'symptom', 'technician_selected', 'แอร์ไม่เย็นสำหรับทดสอบแจ้งเตือน', 1, 'flexible'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate, status
)
select 'a3000000-0000-0000-0000-000000000101', 'HC-20260910-930001',
  'a2000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000201', category.id,
  1, 'evidence_quote', 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  800, 'THB', 0.15, 'scheduled'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';

select is((select count(*)::integer from pg_catalog.pg_class where oid in (
  'public.push_devices'::regclass,
  'public.notifications'::regclass
) and relrowsecurity), 2, 'all Phase 4E public tables enable RLS');
select isnt(has_table_privilege('authenticated', 'public.push_devices', 'SELECT'),
  true, 'authenticated clients cannot read push tokens directly');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.register_push_device(
    'a4000000-0000-4000-8000-000000000101',
    'ExponentPushToken[customer-test-token]', 'ios'
  )$$, 'customer registers an Expo push token through the RPC');
select throws_ok(
  $$select public.register_push_device(
    'a4000000-0000-4000-8000-000000000102', 'raw-device-token', 'ios'
  )$$, 'Invalid push device registration', 'invalid push tokens are rejected');
select throws_ok(
  $$select * from public.claim_job_notifications_for_actor(
    'a0000000-0000-0000-0000-000000000101', 25
  )$$, 'permission denied for function claim_job_notifications_for_actor',
  'authenticated clients cannot claim the delivery queue');

reset role;
select is((select count(*)::integer from public.push_devices), 1,
  'one private device registration is stored');

insert into public.job_status_events (
  id, service_job_id, from_status, to_status, actor_user_id
) values (
  'a5000000-0000-0000-0000-000000000101',
  'a3000000-0000-0000-0000-000000000101',
  'scheduled', 'technician_en_route',
  'a0000000-0000-0000-0000-000000000201'
);
select is((select count(*)::integer from public.notifications), 1,
  'status event enqueues one durable notification');
select is((select recipient_user_id from public.notifications),
  'a0000000-0000-0000-0000-000000000101'::uuid,
  'status notification targets the other job participant');
select is((select deep_link from public.notifications),
  '/jobs/detail?jobId=a3000000-0000-0000-0000-000000000101',
  'customer status notification contains the customer job deep link');
select is((select data->>'url' from public.notifications),
  '/jobs/detail?jobId=a3000000-0000-0000-0000-000000000101',
  'notification payload repeats the allowlisted URL for Expo navigation');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000201', true);
select is((select count(*)::integer from public.notifications), 0,
  'notification actor cannot read the recipient notification');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select is((select count(*)::integer from public.notifications), 1,
  'notification recipient can read their notification');
select ok(public.mark_notification_read((select id from public.notifications)),
  'recipient marks their notification as read');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.send_service_job_message(
    'a3000000-0000-0000-0000-000000000101',
    'a6000000-0000-4000-8000-000000000101',
    'ข้อมูลหน้างานที่ต้องไม่ปรากฏใน Push Notification'
  )$$, 'technician sends a durable chat message');
reset role;
select is((select count(*)::integer from public.notifications
  where event_key = 'job.chat.message'), 1,
  'chat message enqueues one notification');
select ok(position('ข้อมูลหน้างาน' in (select body from public.notifications
  where event_key = 'job.chat.message')) = 0,
  'push body does not expose chat message content');
select is((select deep_link from public.notifications
  where event_key = 'job.chat.message'),
  '/jobs/chat?jobId=a3000000-0000-0000-0000-000000000101',
  'chat notification deep-links to the customer chat screen');

insert into public.service_job_evidence (
  id, service_job_id, evidence_type, storage_path, mime_type,
  size_bytes, created_by
) values (
  'a7000000-0000-0000-0000-000000000101',
  'a3000000-0000-0000-0000-000000000101', 'additional_work',
  'a0000000-0000-0000-0000-000000000201/a3000000-0000-0000-0000-000000000101/additional_work/a7000000-0000-0000-0000-000000000101.jpg',
  'image/jpeg', 100, 'a0000000-0000-0000-0000-000000000201'
);
insert into public.service_job_additional_work_requests (
  id, service_job_id, technician_id, evidence_id, scope_description,
  reason, labor_amount, materials_amount, currency
) values (
  'a8000000-0000-0000-0000-000000000101',
  'a3000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000201',
  'a7000000-0000-0000-0000-000000000101',
  'เปลี่ยนท่อน้ำทิ้งที่ชำรุด', 'พบท่อน้ำทิ้งเดิมแตกระหว่างตรวจ',
  200, 150, 'THB'
);
select is((select count(*)::integer from public.notifications
  where event_key = 'job.additional_work.requested'), 1,
  'additional-work request enqueues a customer notification');
select is((select deep_link from public.notifications
  where event_key = 'job.additional_work.requested'),
  '/jobs/work?jobId=a3000000-0000-0000-0000-000000000101',
  'additional-work request opens the customer work screen');

update public.service_job_additional_work_requests set
  status = 'approved', responded_by = 'a0000000-0000-0000-0000-000000000101',
  responded_at = now()
where id = 'a8000000-0000-0000-0000-000000000101';
select is((select count(*)::integer from public.notifications
  where event_key = 'job.additional_work.approved'), 1,
  'additional-work approval enqueues a technician notification');
select is((select deep_link from public.notifications
  where event_key = 'job.additional_work.approved'),
  '/technician/jobs/work?jobId=a3000000-0000-0000-0000-000000000101',
  'additional-work approval opens the technician work screen');

set local role service_role;
create temporary table claimed_notifications as
select * from public.claim_job_notifications_for_actor(
  'a0000000-0000-0000-0000-000000000201', 25
);
select is((select count(*)::integer from claimed_notifications), 3,
  'server claims only notifications caused by the selected actor');
select is((select count(*)::integer from claimed_notifications
  where delivery_status = 'processing' and attempt_count = 1), 3,
  'claim atomically marks each delivery attempt as processing');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select ok(public.disable_push_device('a4000000-0000-4000-8000-000000000101'),
  'customer disables their current device through the RPC');
reset role;
select isnt((select enabled from public.push_devices), true,
  'disabled device is excluded from future push delivery');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000102', true);
select isnt(public.mark_notification_read(
  (select id from public.notifications limit 1)
), true, 'unrelated account cannot mark another notification as read');
reset role;

select * from finish();
rollback;
