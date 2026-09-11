begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(43);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000101', 'quality-customer@example.test'),
  ('d0000000-0000-0000-0000-000000000102', 'quality-other@example.test'),
  ('d0000000-0000-0000-0000-000000000201', 'quality-tech@example.test'),
  ('d0000000-0000-0000-0000-000000000301', 'quality-admin@example.test');
insert into public.account_roles (user_id, role) values
  ('d0000000-0000-0000-0000-000000000201', 'technician'),
  ('d0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.admin_permissions (user_id, permission)
values ('d0000000-0000-0000-0000-000000000301', 'case_management');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'd0000000-0000-0000-0000-000000000201',
  'ช่างทดสอบระบบดูแลคุณภาพหลังงาน', 'verified', now(), now(),
  'd0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (id, customer_id, label, address_line, is_default)
values ('d1000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000101', 'บ้านทดสอบ',
  '99/99 ถนนทดสอบ กรุงเทพมหานคร 10110', true);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select 'd2000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000101',
  'd1000000-0000-0000-0000-000000000101', id,
  'symptom', 'technician_selected', 'แอร์ไม่เย็นและมีกลิ่นอับ', 1, 'flexible'
from public.service_categories where code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, materials_amount, currency, labor_commission_rate, warranty_days, status
)
select 'd3000000-0000-0000-0000-000000000101', 'HC-20260911-960001',
  'd2000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000201', id,
  1, 'evidence_quote', 'ล้างและตรวจเครื่องปรับอากาศหนึ่งเครื่อง',
  1000, 200, 'THB', 0.15, 30, 'awaiting_acceptance'
from public.service_categories where code = 'AIR-CONDITIONING';
update public.service_jobs set status = 'completed'
where id = 'd3000000-0000-0000-0000-000000000101';

select has_table('public', 'service_job_warranties', 'warranty table exists');
select has_table('public', 'service_quality_cases', 'quality case table exists');
select has_table('public', 'service_quality_case_attachments', 'case attachment table exists');
select has_table('public', 'service_quality_case_events', 'case event table exists');
select has_table('public', 'service_disputes', 'dispute table exists');
select has_table('public', 'service_job_reviews', 'review table exists');
select ok('case_management' = any(enum_range(null::public.admin_permission)::text[]),
  'case-management permission exists');
select ok((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.service_quality_cases'::regclass), 'quality cases enable RLS');
select isnt(has_table_privilege('authenticated', 'public.service_quality_cases', 'INSERT'), true,
  'clients cannot insert quality cases directly');
select isnt(has_function_privilege('anon',
  'public.open_service_quality_case(uuid,public.service_quality_case_kind,public.service_quality_case_category,text)', 'EXECUTE'), true,
  'anonymous users cannot open cases');
select is((select public from storage.buckets where id = 'service-quality-evidence'),
  false, 'quality evidence bucket is private');
select is((select file_size_limit from storage.buckets where id = 'service-quality-evidence'),
  6291456::bigint, 'quality evidence is limited to 6 MB');
select is((select count(*)::integer from public.service_job_warranties
  where service_job_id = 'd3000000-0000-0000-0000-000000000101'), 1,
  'completion creates one warranty');
select is((select warranty_days from public.service_job_warranties
  where service_job_id = 'd3000000-0000-0000-0000-000000000101'), 30,
  'warranty snapshots configured days');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.service_quality_cases), 0,
  'unrelated user cannot read cases');
select throws_ok($$select public.open_service_quality_case(
  'd3000000-0000-0000-0000-000000000101', 'complaint', 'work_quality',
  'บุคคลอื่นไม่ควรเปิดข้อร้องเรียนของงานนี้ได้')$$,
  'Service job not found', 'unrelated user cannot open a case');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select is((select count(*)::integer from public.service_job_warranties), 1,
  'assigned technician reads warranty');
select throws_ok($$select public.open_service_quality_case(
  'd3000000-0000-0000-0000-000000000101', 'complaint', 'work_quality',
  'ช่างไม่ควรเปิดข้อร้องเรียนแทนลูกค้าได้')$$,
  'Service job not found', 'technician cannot open a customer case');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select lives_ok($$select public.open_service_quality_case(
  'd3000000-0000-0000-0000-000000000101', 'complaint', 'work_quality',
  'หลังล้างแล้วยังมีกลิ่นอับและต้องการให้ HomeCare ช่วยตรวจสอบ')$$,
  'customer opens a complaint');
select is((select payment_hold_simulated from public.service_quality_cases
  where kind = 'complaint'), true, 'complaint records a simulated hold');
select is((select real_money_moved from public.service_quality_cases
  where kind = 'complaint'), false, 'complaint never moves real money');
select throws_ok($$select public.open_service_quality_case(
  'd3000000-0000-0000-0000-000000000101', 'complaint', 'other',
  'พยายามเปิดข้อร้องเรียนที่ยังไม่ปิดซ้ำอีกครั้งหนึ่ง')$$,
  'An active case already exists', 'duplicate active complaint is rejected');
select lives_ok($$select public.open_service_quality_case(
  'd3000000-0000-0000-0000-000000000101', 'warranty_claim', 'work_quality',
  'อาการเดิมกลับมาอีกครั้งภายในระยะรับประกันและต้องการให้แก้งาน')$$,
  'customer opens a claim inside warranty');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select lives_ok($$select public.respond_to_service_quality_case(
  (select id from public.service_quality_cases where kind = 'complaint'),
  'รับทราบและพร้อมเข้าตรวจสอบอาการเดิมอีกครั้ง')$$,
  'technician responds to the complaint');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select lives_ok($$select public.submit_service_job_review(
  'd3000000-0000-0000-0000-000000000101', 4::smallint, 4::smallint,
  5::smallint, 4::smallint, 5::smallint,
  array['ตรงเวลา'], 'ช่างสุภาพและตรงเวลา แต่ยังต้องติดตามกลิ่นอับ')$$,
  'customer submits a completed-job review');
select is((select status from public.service_job_reviews limit 1),
  'pending_moderation'::public.service_job_review_status,
  'new review waits for moderation');
select lives_ok($$select public.submit_service_job_review(
  'd3000000-0000-0000-0000-000000000101', 3::smallint, 3::smallint,
  5::smallint, 4::smallint, 5::smallint,
  array['ตรงเวลา'], 'แก้ไขคะแนนหลังเปิดข้อร้องเรียนเพื่อให้ตรงกับประสบการณ์')$$,
  'customer edits review while complaint is open');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select lives_ok($$select public.respond_to_service_job_review(
  (select id from public.service_job_reviews limit 1),
  'ขอบคุณสำหรับความคิดเห็นและพร้อมกลับไปตรวจสอบ')$$,
  'technician responds to review once');
select throws_ok($$select public.respond_to_service_job_review(
  (select id from public.service_job_reviews limit 1),
  'พยายามตอบกลับรีวิวซ้ำเป็นครั้งที่สอง')$$,
  'Review is not available for response', 'duplicate review response is rejected');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000301', true);
select is((select count(*)::integer from public.service_quality_cases), 2,
  'case manager reads the queue');
select lives_ok($$select public.admin_escalate_service_quality_case(
  (select id from public.service_quality_cases where kind = 'complaint'))$$,
  'case manager escalates complaint');
select is((select real_money_moved from public.service_disputes limit 1), false,
  'dispute explicitly moves no real money');
select lives_ok($$select public.admin_update_service_quality_case(
  (select id from public.service_quality_cases where kind = 'warranty_claim'),
  'resolved', 'partial_refund_simulated',
  'อนุมัติคืนเงินบางส่วนแบบจำลองหลังตรวจหลักฐาน', 300)$$,
  'case manager records a simulated resolution');
select is((select simulated_refund_amount from public.service_quality_cases
  where kind = 'warranty_claim'), 300::numeric,
  'simulated refund amount is recorded');
select is((select real_money_moved from public.service_quality_cases
  where kind = 'warranty_claim'), false, 'resolution cannot mark real money moved');
select throws_ok($$select public.admin_moderate_service_job_review(
  (select id from public.service_job_reviews limit 1), 'published',
  'ยังไม่ควรเผยแพร่ระหว่างมีข้อพิพาท')$$,
  'Review is hidden during an open dispute',
  'review cannot be published during an open dispute');
select lives_ok($$select public.admin_update_service_quality_case(
  (select id from public.service_quality_cases where kind = 'complaint'),
  'resolved', 'warranty_rework',
  'ให้ช่างเดิมกลับเข้าแก้งานตามการรับประกัน', null)$$,
  'case manager resolves the disputed complaint');
select is((select status from public.service_disputes limit 1),
  'resolved'::public.service_dispute_status,
  'resolving the case resolves its dispute');
select lives_ok($$select public.admin_moderate_service_job_review(
  (select id from public.service_job_reviews limit 1), 'published',
  'ตรวจข้อความแล้วไม่มีข้อมูลส่วนบุคคล')$$,
  'case manager publishes review after moderation');
reset role;

select is((select metadata->>'real_money_moved' from public.audit_log
  where action = 'service_quality.case_updated' order by created_at desc limit 1),
  'false', 'case decision audit confirms no real money moved');
select is((select count(*)::integer from public.service_quality_case_events
  where event_type = 'escalated_to_dispute'), 1,
  'dispute escalation is preserved in case history');
select is((select status from public.service_job_reviews limit 1),
  'published'::public.service_job_review_status,
  'moderated review becomes published');
select isnt(has_table_privilege('authenticated', 'public.service_job_reviews', 'UPDATE'), true,
  'clients cannot update reviews directly');

select * from finish();
rollback;
