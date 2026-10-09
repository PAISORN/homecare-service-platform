begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(35);

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000101', 'ops-customer@example.test'),
  ('f0000000-0000-0000-0000-000000000201', 'ops-tech@example.test'),
  ('f0000000-0000-0000-0000-000000000301', 'ops-admin@example.test'),
  ('f0000000-0000-0000-0000-000000000302', 'ops-other-admin@example.test');
insert into public.account_roles (user_id, role) values
  ('f0000000-0000-0000-0000-000000000201', 'technician'),
  ('f0000000-0000-0000-0000-000000000301', 'administrator'),
  ('f0000000-0000-0000-0000-000000000302', 'administrator');
insert into public.admin_permissions (user_id, permission) values
  ('f0000000-0000-0000-0000-000000000301', 'operations_management');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'f0000000-0000-0000-0000-000000000201',
  'ช่างทดสอบการควบคุมระบบปฏิบัติการ',
  'verified', now(), now(), 'f0000000-0000-0000-0000-000000000301'
);
insert into public.technician_skills (technician_id, service_category_id)
select 'f0000000-0000-0000-0000-000000000201', id
from public.service_categories where code = 'AIR-CONDITIONING';
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'f1000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบ Operations', '10/10 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, safety_status, problem_description, quantity, urgency
)
select
  'f2000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000101',
  'f1000000-0000-0000-0000-000000000101',
  id, 'symptom', 'draft', 'clear', 'แอร์ไม่เย็น', 1, 'flexible'
from public.service_categories where code = 'AIR-CONDITIONING';

select has_table('public', 'operational_controls',
  'operational controls table exists');
select is((select count(*)::integer from public.operational_controls), 3,
  'three pilot controls are configured');
select is((select enabled from public.operational_controls where control_key = 'matching'),
  true, 'matching starts enabled');
select is((select enabled from public.operational_controls where control_key = 'content'),
  true, 'content starts enabled');
select is((select enabled from public.operational_controls where control_key = 'payment'),
  false, 'real payment starts disabled');
select isnt(has_table_privilege('anon', 'public.operational_controls', 'SELECT'),
  true, 'anonymous callers cannot read controls directly');
select isnt(has_table_privilege('authenticated', 'public.operational_controls', 'UPDATE'),
  true, 'authenticated callers cannot update controls directly');
select ok(has_function_privilege('authenticated',
  'public.get_operational_controls()', 'EXECUTE'),
  'authenticated callers can read the sanitized control contract');
select ok(has_function_privilege('authenticated',
  'public.set_operational_control(public.operational_control_key,boolean,text)', 'EXECUTE'),
  'authenticated callers can invoke the permission-checked writer');

set local role anon;
select throws_ok($$select * from public.get_operational_controls()$$,
  '42501', 'permission denied for function get_operational_controls',
  'anonymous caller cannot read operational controls');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select is((select count(*)::integer from public.get_operational_controls()), 3,
  'active customer can read control status for safe UI handling');
select is((select count(*)::integer from public.operational_controls), 0,
  'customer cannot select the protected control table');
select throws_ok($$select public.set_operational_control(
  'matching', false, 'หยุดรับคำขอชั่วคราวเพื่อทดสอบระบบ')$$,
  '42501', 'Operations management permission required',
  'customer cannot change a control');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000302', true);
select throws_ok($$select public.set_operational_control(
  'matching', false, 'หยุดรับคำขอชั่วคราวเพื่อทดสอบระบบ')$$,
  '42501', 'Operations management permission required',
  'administrator without operations permission cannot change a control');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000301', true);
select is((select count(*)::integer from public.operational_controls), 3,
  'operations manager can read the protected table');
select throws_ok($$select public.set_operational_control(
  'matching', false, 'สั้น')$$,
  '22023', 'Operational reason must contain 10 to 500 characters',
  'control changes require an operational reason');
select lives_ok($$select public.set_operational_control(
  'matching', false, 'หยุดรับคำขอชั่วคราวระหว่างตรวจสอบเหตุการณ์')$$,
  'operations manager disables matching');
select throws_ok($$select public.set_operational_control(
  'payment', true, 'เปิดระบบชำระเงินจริงสำหรับรอบนำร่อง')$$,
  '55000', 'Real payment is not available in the pilot sandbox',
  'payment cannot be enabled before the real provider is implemented');
reset role;

select is((select enabled from public.operational_controls where control_key = 'matching'),
  false, 'matching control is disabled');
select is((select revision from public.operational_controls where control_key = 'matching'),
  2::bigint, 'control revision increases');
select is((select count(*)::integer from public.audit_log
  where action = 'operational_control.updated'
    and metadata ->> 'control_key' = 'matching'), 1,
  'control change is audited once');
select is((select metadata ? 'reason' from public.audit_log
  where action = 'operational_control.updated'
    and metadata ->> 'control_key' = 'matching'), false,
  'free-text operational reason is not copied into audit metadata');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select throws_ok($$select public.submit_service_request(
  'f2000000-0000-0000-0000-000000000101')$$,
  '55000', 'Operational control matching is disabled',
  'disabled matching blocks new request submission');
reset role;
select is((select status from public.service_requests
  where id = 'f2000000-0000-0000-0000-000000000101'),
  'draft'::public.service_request_status,
  'blocked submission leaves the request draft unchanged');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000301', true);
select lives_ok($$select public.set_operational_control(
  'matching', true, 'เปิดรับคำขออีกครั้งหลังตรวจสอบเหตุการณ์แล้ว')$$,
  'operations manager re-enables matching');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select lives_ok($$select public.submit_service_request(
  'f2000000-0000-0000-0000-000000000101')$$,
  'request submission resumes after matching is enabled');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000201', true);
select lives_ok($$select public.express_technician_interest(
  'f2000000-0000-0000-0000-000000000101')$$,
  'technician can express interest while matching is enabled');
select lives_ok($$select public.withdraw_technician_interest(
  'f2000000-0000-0000-0000-000000000101')$$,
  'technician can withdraw to recover from matching');
reset role;

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, safety_status, problem_description, quantity, urgency,
  submitted_at
)
select fixture.id, 'f0000000-0000-0000-0000-000000000101',
  'f1000000-0000-0000-0000-000000000101', category.id,
  'symptom', 'matching', 'clear', 'คำขอทดสอบ rate limit', 1, 'flexible', now()
from public.service_categories as category
cross join (values
  ('f2000000-0000-0000-0000-000000000110'::uuid),
  ('f2000000-0000-0000-0000-000000000111'::uuid),
  ('f2000000-0000-0000-0000-000000000112'::uuid),
  ('f2000000-0000-0000-0000-000000000113'::uuid)
) as fixture(id)
where category.code = 'AIR-CONDITIONING';
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, safety_status, problem_description, quantity, urgency
)
select 'f2000000-0000-0000-0000-000000000114',
  'f0000000-0000-0000-0000-000000000101',
  'f1000000-0000-0000-0000-000000000101', id,
  'symptom', 'draft', 'clear', 'คำขอที่เกิน rate limit', 1, 'flexible'
from public.service_categories where code = 'AIR-CONDITIONING';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select throws_ok($$select public.submit_service_request(
  'f2000000-0000-0000-0000-000000000114')$$,
  '54000', 'Matching request rate limit exceeded',
  'customer cannot submit more than five matching requests in ten minutes');
reset role;
select is((select status from public.service_requests
  where id = 'f2000000-0000-0000-0000-000000000114'),
  'draft'::public.service_request_status,
  'rate-limited request remains a draft');

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, safety_status, problem_description, quantity, urgency
)
select
  'f2000000-0000-0000-0000-000000000102',
  'f0000000-0000-0000-0000-000000000101',
  'f1000000-0000-0000-0000-000000000101',
  id, 'symptom', 'technician_selected', 'clear', 'แอร์ไม่เย็น', 1, 'flexible'
from public.service_categories where code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate, warranty_days, status
)
select
  'f3000000-0000-0000-0000-000000000101', 'HC-20261010-980001',
  'f2000000-0000-0000-0000-000000000102',
  'f0000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000201', id,
  1, 'evidence_quote', 'ตรวจระบบแอร์', 500, 'THB', 0.15, 30,
  'scheduled'
from public.service_categories where code = 'AIR-CONDITIONING';

insert into public.chat_messages (
  chat_room_id, sender_user_id, client_message_id, body
)
select room.id, 'f0000000-0000-0000-0000-000000000101', gen_random_uuid(),
  'ข้อความทดสอบ rate limit ' || series.value
from public.chat_rooms as room
cross join generate_series(1, 20) as series(value)
where room.service_job_id = 'f3000000-0000-0000-0000-000000000101';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select throws_ok($$select public.send_service_job_message(
  'f3000000-0000-0000-0000-000000000101',
  'f4000000-0000-0000-0000-000000000100', 'ข้อความที่เกิน rate limit')$$,
  '54000', 'Chat message rate limit exceeded',
  'sender cannot create more than twenty chat messages per minute');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000301', true);
select lives_ok($$select public.set_operational_control(
  'content', false, 'หยุดส่งข้อความชั่วคราวระหว่างตรวจสอบเนื้อหา')$$,
  'operations manager disables content writes');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select throws_ok($$select public.send_service_job_message(
  'f3000000-0000-0000-0000-000000000101',
  'f4000000-0000-0000-0000-000000000101', 'ข้อความที่ต้องถูกหยุด')$$,
  '55000', 'Operational control content is disabled',
  'disabled content blocks a new chat message');
select is((select count(*)::integer from public.chat_rooms), 1,
  'existing chat room remains readable while content writes are disabled');
reset role;

select is((select enabled from public.operational_controls where control_key = 'payment'),
  false, 'payment remains safely disabled throughout the drill');

select * from finish();
rollback;
