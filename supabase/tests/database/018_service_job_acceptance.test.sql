begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(32);

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000101', 'acceptance-customer@example.test'),
  ('c0000000-0000-0000-0000-000000000102', 'acceptance-other@example.test'),
  ('c0000000-0000-0000-0000-000000000201', 'acceptance-tech@example.test'),
  ('c0000000-0000-0000-0000-000000000301', 'acceptance-admin@example.test');

insert into public.account_roles (user_id, role) values
  ('c0000000-0000-0000-0000-000000000201', 'technician'),
  ('c0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'c0000000-0000-0000-0000-000000000201',
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบการตรวจรับงาน',
  'verified', now(), now(), 'c0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'c1000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบตรวจรับ', '55/55 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select request_id, 'c0000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101', category.id,
  'symptom', 'technician_selected', description, 1, 'flexible'
from public.service_categories as category
cross join (values
  ('c2000000-0000-0000-0000-000000000101'::uuid, 'ทดสอบขอความช่วยเหลือระหว่างตรวจรับ'),
  ('c2000000-0000-0000-0000-000000000102'::uuid, 'ทดสอบลูกค้ายืนยันตรวจรับงาน'),
  ('c2000000-0000-0000-0000-000000000103'::uuid, 'ทดสอบระบบตรวจรับเมื่อครบกำหนด')
) as input(request_id, description)
where category.code = 'AIR-CONDITIONING';

insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, materials_amount, currency, labor_commission_rate, status
)
select job_id, job_number, request_id,
  'c0000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000201', category.id,
  1, 'evidence_quote', 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  labor_amount, materials_amount, 'THB', 0.15, 'awaiting_acceptance'
from public.service_categories as category
cross join (values
  ('c3000000-0000-0000-0000-000000000101'::uuid, 'HC-20260911-950001',
    'c2000000-0000-0000-0000-000000000101'::uuid, 800::numeric, 100::numeric),
  ('c3000000-0000-0000-0000-000000000102'::uuid, 'HC-20260911-950002',
    'c2000000-0000-0000-0000-000000000102'::uuid, 900::numeric, 0::numeric),
  ('c3000000-0000-0000-0000-000000000103'::uuid, 'HC-20260911-950003',
    'c2000000-0000-0000-0000-000000000103'::uuid, 1000::numeric, 200::numeric)
) as input(job_id, job_number, request_id, labor_amount, materials_amount)
where category.code = 'AIR-CONDITIONING';

select ok((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.service_job_acceptances'::regclass),
  'service-job acceptance enables RLS');
select isnt(has_table_privilege('authenticated',
  'private.service_job_acceptance_configuration', 'SELECT'), true,
  'acceptance configuration is private');
select ok(has_table_privilege('authenticated',
  'public.service_job_acceptances', 'SELECT'),
  'authenticated participants may read through RLS');
select isnt(has_table_privilege('authenticated',
  'public.service_job_acceptances', 'UPDATE'), true,
  'authenticated clients cannot mutate acceptance rows directly');
select isnt(has_function_privilege('anon',
  'public.confirm_service_job_acceptance(uuid)', 'EXECUTE'), true,
  'anonymous clients cannot confirm acceptance');
select is((select count(*)::integer from public.service_job_acceptances), 3,
  'entering awaiting acceptance opens one durable window per job');
select is((select extract(epoch from (review_deadline_at - review_started_at))::integer
  from public.service_job_acceptances limit 1), 172800,
  'the configured acceptance window is 48 hours');
select is((select payment_mode from public.service_job_acceptances limit 1),
  'fake_sandbox', 'acceptance explicitly uses the fake sandbox');
select is((select count(*)::integer from cron.job
  where jobname = 'homecare-process-due-service-job-acceptances'), 1,
  'a single database schedule processes due acceptance windows');
select is((select total_amount_snapshot from public.service_job_acceptances
  where service_job_id = 'c3000000-0000-0000-0000-000000000101'),
  900::numeric, 'the agreed total is snapshotted for review');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.service_job_acceptances), 0,
  'an unrelated account cannot read acceptance rows');
select throws_ok(
  $$select * from public.get_service_job_acceptance(
    'c3000000-0000-0000-0000-000000000101')$$,
  'Service job not found', 'an unrelated account cannot use the acceptance RPC');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000201', true);
select is((select count(*)::integer from public.service_job_acceptances), 3,
  'the assigned technician can read acceptance progress');
select throws_ok(
  $$select public.confirm_service_job_acceptance(
    'c3000000-0000-0000-0000-000000000101')$$,
  'Service job not found', 'the technician cannot confirm for the customer');
select throws_ok(
  $$select public.request_service_job_acceptance_help(
    'c3000000-0000-0000-0000-000000000101',
    'ช่างไม่สามารถส่งคำขอแทนลูกค้าได้')$$,
  'Service job not found', 'the technician cannot request help for the customer');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.request_service_job_acceptance_help(
    'c3000000-0000-0000-0000-000000000101', 'สั้น')$$,
  'Acceptance help reason required', 'a short help reason is rejected');
select lives_ok(
  $$select public.request_service_job_acceptance_help(
    'c3000000-0000-0000-0000-000000000101',
    'ยังมีน้ำรั่วบริเวณเดิมและต้องการให้ HomeCare ช่วยตรวจสอบ')$$,
  'the customer pauses automatic acceptance by requesting help');
select is((select status from public.service_job_acceptances
  where service_job_id = 'c3000000-0000-0000-0000-000000000101'),
  'help_requested'::public.service_job_acceptance_status,
  'the help request is durable');
reset role;
select is((select status from public.service_jobs
  where id = 'c3000000-0000-0000-0000-000000000101'),
  'awaiting_acceptance'::public.service_job_status,
  'a help request keeps the job in acceptance');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.confirm_service_job_acceptance(
    'c3000000-0000-0000-0000-000000000101')$$,
  'Acceptance is on hold for HomeCare help',
  'a held acceptance cannot be bypassed');
reset role;

update public.service_job_acceptances
set review_started_at = now() - interval '49 hours',
  review_deadline_at = now() - interval '1 hour'
where service_job_id in (
  'c3000000-0000-0000-0000-000000000101',
  'c3000000-0000-0000-0000-000000000103'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.confirm_service_job_acceptance(
    'c3000000-0000-0000-0000-000000000102')$$,
  'the customer confirms an eligible acceptance');
select is((select status from public.service_job_acceptances
  where service_job_id = 'c3000000-0000-0000-0000-000000000102'),
  'customer_accepted'::public.service_job_acceptance_status,
  'customer confirmation is recorded');
reset role;
select is((select status from public.service_jobs
  where id = 'c3000000-0000-0000-0000-000000000102'),
  'completed'::public.service_job_status,
  'customer confirmation completes the job');
select is((select actor_user_id from public.job_status_events
  where service_job_id = 'c3000000-0000-0000-0000-000000000102'
  order by created_at desc limit 1),
  'c0000000-0000-0000-0000-000000000101'::uuid,
  'customer acceptance records the actor');
select is((select metadata->>'real_money_moved' from public.audit_log
  where action = 'service_job.acceptance_confirmed'
  order by created_at desc limit 1), 'false',
  'the audit proves no real money moved');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.confirm_service_job_acceptance(
    'c3000000-0000-0000-0000-000000000102')$$,
  'repeated customer confirmation is idempotent');
reset role;
select is((select count(*)::integer from public.job_status_events
  where service_job_id = 'c3000000-0000-0000-0000-000000000102'
    and to_status = 'completed'), 1,
  'idempotent confirmation does not duplicate status history');

set local role service_role;
select is(public.process_due_service_job_acceptances(), 1,
  'the server worker processes only due pending acceptances');
reset role;
select is((select status from public.service_job_acceptances
  where service_job_id = 'c3000000-0000-0000-0000-000000000103'),
  'automatic_accepted'::public.service_job_acceptance_status,
  'a due acceptance completes automatically');
select is((select status from public.service_jobs
  where id = 'c3000000-0000-0000-0000-000000000103'),
  'completed'::public.service_job_status,
  'automatic acceptance completes the job');
select is((select actor_user_id from public.job_status_events
  where service_job_id = 'c3000000-0000-0000-0000-000000000103'
  order by created_at desc limit 1), null::uuid,
  'automatic acceptance is recorded as a system transition');
select is((select status from public.service_job_acceptances
  where service_job_id = 'c3000000-0000-0000-0000-000000000101'),
  'help_requested'::public.service_job_acceptance_status,
  'a help request remains held after the deadline');

select * from finish();
rollback;
