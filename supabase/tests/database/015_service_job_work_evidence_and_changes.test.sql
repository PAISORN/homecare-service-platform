begin;

create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000101', 'work-customer@example.test'),
  ('f0000000-0000-0000-0000-000000000102', 'work-other@example.test'),
  ('f0000000-0000-0000-0000-000000000201', 'work-tech@example.test'),
  ('f0000000-0000-0000-0000-000000000301', 'work-admin@example.test');

insert into public.account_roles (user_id, role) values
  ('f0000000-0000-0000-0000-000000000201', 'technician'),
  ('f0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'f0000000-0000-0000-0000-000000000201',
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบหลักฐานและ PIN',
  'verified', now(), now(), 'f0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'f1000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบงาน', '77/77 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select 'f2000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000101',
  'f1000000-0000-0000-0000-000000000101', category.id,
  'symptom', 'technician_selected', 'แอร์ไม่เย็นสำหรับทดสอบหลักฐาน', 1, 'flexible'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate, status
)
select 'f3000000-0000-0000-0000-000000000101', 'HC-20260910-920001',
  'f2000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000101',
  'f0000000-0000-0000-0000-000000000201', category.id,
  1, 'evidence_quote', 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  800, 'THB', 0.15, 'technician_arrived'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';
insert into public.appointments (
  service_job_id, scheduled_date, time_window, service_location_id,
  location_label, address_line
) values (
  'f3000000-0000-0000-0000-000000000101', current_date, '09:00–12:00',
  'f1000000-0000-0000-0000-000000000101', 'บ้านทดสอบงาน',
  '77/77 ถนนทดสอบ กรุงเทพมหานคร 10110'
);

select is((select count(*)::integer from pg_catalog.pg_class where oid in (
  'public.service_job_evidence'::regclass,
  'public.service_job_pins'::regclass,
  'public.service_job_additional_work_requests'::regclass
) and relrowsecurity), 3, 'all Phase 4D public tables enable RLS');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.issue_service_job_pin('f3000000-0000-0000-0000-000000000101', 'start')$$,
  'Required work evidence missing', 'customer cannot issue a start PIN before uploaded evidence');
select throws_ok(
  $$select public.register_service_job_evidence(
    'f3000000-0000-0000-0000-000000000101', 'before',
    'f0000000-0000-0000-0000-000000000101/f3000000-0000-0000-0000-000000000101/before/f4000000-0000-0000-0000-000000000101.jpg',
    'image/jpeg', 100
  )$$, 'Verified technician required', 'customer cannot register work evidence');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.register_service_job_evidence(
    'f3000000-0000-0000-0000-000000000101', 'before',
    'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/before/f4000000-0000-0000-0000-000000000101.jpg',
    'image/jpeg', 100
  )$$, 'assigned technician registers before-work evidence');
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('service-job-evidence',
  'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/before/f4000000-0000-0000-0000-000000000101.jpg',
  'f0000000-0000-0000-0000-000000000201', '{"mimetype":"image/jpeg","size":100}');
select is((select count(*)::integer from public.service_job_evidence), 1,
  'technician reads registered evidence');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.service_job_evidence), 0,
  'unrelated user cannot read evidence');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select is((select count(*)::integer from public.service_job_evidence), 1,
  'customer reads evidence attached to their job');
create temporary table issued_pin as
select public.issue_service_job_pin(
  'f3000000-0000-0000-0000-000000000101', 'start'
) as pin;
select matches((select pin from issued_pin), '^[0-9]{6}$',
  'customer receives a six-digit start PIN');
select isnt(
  has_table_privilege('authenticated', 'public.service_job_pins', 'SELECT'),
  true, 'PIN rows are not directly readable'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000201', true);
create temporary table failed_pin_result as
select public.verify_service_job_pin(
  'f3000000-0000-0000-0000-000000000101', 'start', '999999'
) as result;
select is((select (result->>'verified')::boolean from failed_pin_result), false,
  'incorrect PIN is rejected');
select is((select (result->>'attempts_remaining')::integer from failed_pin_result), 4,
  'failed PIN attempt is durably counted without exposing the PIN row');
select is((public.verify_service_job_pin(
  'f3000000-0000-0000-0000-000000000101', 'start',
  (select pin from issued_pin)
)->>'verified')::boolean, true, 'correct PIN starts the work');
select is((select job_status from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 'in_progress'::public.service_job_status,
  'verified start PIN moves the job to in progress');

select lives_ok(
  $$select public.register_service_job_evidence(
    'f3000000-0000-0000-0000-000000000101', 'additional_work',
    'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/additional_work/f4000000-0000-0000-0000-000000000102.jpg',
    'image/jpeg', 120
  )$$, 'technician registers additional-work evidence');
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('service-job-evidence',
  'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/additional_work/f4000000-0000-0000-0000-000000000102.jpg',
  'f0000000-0000-0000-0000-000000000201', '{"mimetype":"image/jpeg","size":120}');
select lives_ok(
  $$select public.create_service_job_additional_work_request(
    'f3000000-0000-0000-0000-000000000101',
    (select id from public.service_job_evidence where evidence_type = 'additional_work'),
    'เปลี่ยนท่อน้ำทิ้งที่แตกระหว่างตรวจ',
    'พบท่อน้ำทิ้งเดิมแตกและมีน้ำรั่ว', 200, 150
  )$$, 'technician submits priced additional work with evidence');
select is((select job_status from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')),
  'awaiting_additional_work_approval'::public.service_job_status,
  'job waits for customer approval');
select is((select labor_amount from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 800::numeric,
  'unapproved work does not change the job price');
select throws_ok(
  $$select public.create_service_job_additional_work_request(
    'f3000000-0000-0000-0000-000000000101',
    (select id from public.service_job_evidence where evidence_type = 'additional_work'),
    'เพิ่มงานอีกหนึ่งรายการซ้ำกัน', 'ขอเพิ่มงานขณะที่ยังรออนุมัติ', 100, 0
  )$$, 'Additional work requires an active job',
  'technician cannot create another request while one is pending');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select public.respond_to_service_job_additional_work(
    (select id from public.service_job_additional_work_requests), true
  )$$, 'Additional work request not found', 'unrelated user cannot approve additional work');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.respond_to_service_job_additional_work(
    (select id from public.service_job_additional_work_requests), true
  )$$, 'customer approves additional work');
select is((select labor_amount from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 1000::numeric,
  'approved labor is added to the job');
select is((select materials_amount from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 150::numeric,
  'approved materials are added to the job');
select is((select commission_amount from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 150::numeric,
  'commission is recalculated from approved labor only');
select is((select job_status from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')), 'in_progress'::public.service_job_status,
  'approved job resumes in progress');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.register_service_job_evidence(
    'f3000000-0000-0000-0000-000000000101', 'after',
    'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/after/f4000000-0000-0000-0000-000000000103.jpg',
    'image/jpeg', 140
  )$$, 'technician registers after-work evidence');
insert into storage.objects (bucket_id, name, owner_id, metadata)
values ('service-job-evidence',
  'f0000000-0000-0000-0000-000000000201/f3000000-0000-0000-0000-000000000101/after/f4000000-0000-0000-0000-000000000103.jpg',
  'f0000000-0000-0000-0000-000000000201', '{"mimetype":"image/jpeg","size":140}');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000101', true);
create temporary table completion_pin as
select public.issue_service_job_pin(
  'f3000000-0000-0000-0000-000000000101', 'completion'
) as pin;
select matches((select pin from completion_pin), '^[0-9]{6}$',
  'customer receives a six-digit completion PIN');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000201', true);
select is((public.verify_service_job_pin(
  'f3000000-0000-0000-0000-000000000101', 'completion',
  (select pin from completion_pin)
)->>'verified')::boolean, true, 'correct completion PIN submits the job');
select is((select job_status from public.get_service_job(
  'f3000000-0000-0000-0000-000000000101')),
  'awaiting_acceptance'::public.service_job_status, 'job now waits for acceptance');
select is((select count(*)::integer from public.list_service_job_status_events(
  'f3000000-0000-0000-0000-000000000101')), 4,
  'PIN and additional-work transitions are appended to status history');
reset role;
select is((select count(*)::integer from public.audit_log where action like
  'service_job.additional_work_%'), 2, 'request and approval are both audited');
select is((select count(*)::integer from public.audit_log
  where action = 'service_job.pin_verified'), 2, 'both PIN verifications are audited');

select * from finish();
rollback;
