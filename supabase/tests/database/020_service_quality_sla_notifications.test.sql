begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(36);

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000101', 'sla-customer@example.test'),
  ('e0000000-0000-0000-0000-000000000102', 'sla-other@example.test'),
  ('e0000000-0000-0000-0000-000000000201', 'sla-tech@example.test'),
  ('e0000000-0000-0000-0000-000000000301', 'sla-admin@example.test');
insert into public.account_roles (user_id, role) values
  ('e0000000-0000-0000-0000-000000000201', 'technician'),
  ('e0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.admin_permissions (user_id, permission)
values ('e0000000-0000-0000-0000-000000000301', 'case_management');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'e0000000-0000-0000-0000-000000000201',
  'ช่างทดสอบ SLA และการแจ้งเตือนเคสคุณภาพงาน',
  'verified', now(), now(), 'e0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'e1000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบ SLA', '10/10 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select 'e2000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'e1000000-0000-0000-0000-000000000101', id,
  'symptom', 'technician_selected', 'แอร์ยังมีกลิ่นหลังล้าง', 1, 'flexible'
from public.service_categories where code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate, warranty_days, status
)
select 'e3000000-0000-0000-0000-000000000101', 'HC-20260911-970001',
  'e2000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000201', id,
  1, 'evidence_quote', 'ล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  900, 'THB', 0.15, 30, 'awaiting_acceptance'
from public.service_categories where code = 'AIR-CONDITIONING';
update public.service_jobs set status = 'completed'
where id = 'e3000000-0000-0000-0000-000000000101';

select has_column('public', 'service_quality_cases', 'next_action_by',
  'quality cases expose the responsible party');
select has_column('public', 'service_quality_cases', 'sla_due_at',
  'quality cases expose the SLA deadline');
select has_column('public', 'service_quality_cases', 'sla_state',
  'quality cases expose the SLA state');
select has_column('public', 'notifications', 'service_quality_case_id',
  'notifications can reference a quality case');
select is((select count(*)::integer from private.service_quality_sla_policies), 5,
  'active quality statuses have configurable SLA policies');
select ok((select count(*) = 1 from cron.job
  where jobname = 'homecare-process-service-quality-sla'),
  'database scheduler runs the quality SLA worker');
select isnt(has_function_privilege('authenticated',
  'public.process_service_quality_sla(timestamp with time zone,integer)', 'EXECUTE'),
  true, 'authenticated users cannot run the SLA worker');
select ok(has_function_privilege('service_role',
  'public.process_service_quality_sla(timestamp with time zone,integer)', 'EXECUTE'),
  'service role can run the SLA worker');
select isnt(has_function_privilege('authenticated',
  'public.claim_pending_notifications(integer)', 'EXECUTE'), true,
  'authenticated users cannot claim the global delivery queue');
select ok(has_function_privilege('service_role',
  'public.claim_pending_notifications(integer)', 'EXECUTE'),
  'service role can claim the global delivery queue for scheduled Push');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000101', true);
select lives_ok($$select public.open_service_quality_case(
  'e3000000-0000-0000-0000-000000000101', 'complaint', 'work_quality',
  'หลังล้างแล้วยังมีกลิ่นและต้องการให้ HomeCare ช่วยตรวจสอบ')$$,
  'customer opens a quality case with SLA tracking');
reset role;

select is((select next_action_by from public.service_quality_cases limit 1),
  'homecare'::public.service_quality_next_actor,
  'new case waits for HomeCare');
select is((select sla_state from public.service_quality_cases limit 1),
  'on_track'::public.service_quality_sla_state,
  'new case starts on track');
select ok((select sla_warning_at < sla_due_at
  from public.service_quality_cases limit 1),
  'warning time is before the SLA deadline');
select is((select count(*)::integer from public.notifications
  where event_key = 'quality.case.submitted'), 1,
  'case submission creates one durable notification');
select is((select recipient_user_id from public.notifications
  where event_key = 'quality.case.submitted'),
  'e0000000-0000-0000-0000-000000000201'::uuid,
  'case submission notifies the assigned technician');
select matches((select deep_link from public.notifications
  where event_key = 'quality.case.submitted'),
  '^/technician/jobs/quality[?]jobId=.*&caseId=.*$',
  'quality notification contains an allowlisted case deep link');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000301', true);
select lives_ok($$select public.admin_update_service_quality_case(
  (select id from public.service_quality_cases limit 1),
  'awaiting_technician', null, null, null)$$,
  'case manager requests a technician response');
reset role;

select is((select next_action_by from public.service_quality_cases limit 1),
  'technician'::public.service_quality_next_actor,
  'awaiting-technician status assigns the next action correctly');
select is((select sla_state from public.service_quality_cases limit 1),
  'on_track'::public.service_quality_sla_state,
  'status transition resets SLA state');
select is((select count(*)::integer from public.notifications
  where event_key = 'quality.case.admin_awaiting_technician'), 1,
  'request for information notifies the technician');

update public.service_quality_cases set
  sla_warning_at = '2026-09-11 01:00:00+00',
  sla_due_at = '2026-09-11 03:00:00+00',
  sla_state = 'on_track';
set local role service_role;
select lives_ok($$select * from public.process_service_quality_sla(
  '2026-09-11 02:00:00+00', 100)$$,
  'scheduled worker marks a case due soon');
reset role;
select is((select sla_state from public.service_quality_cases limit 1),
  'due_soon'::public.service_quality_sla_state,
  'case becomes due soon');
select is((select count(*)::integer from public.service_quality_case_events
  where event_type = 'sla_due_soon'), 1,
  'due-soon transition is append-only history');
select is((select count(*)::integer from public.notifications
  where event_key = 'quality.case.sla_due_soon'), 1,
  'due-soon transition notifies the responsible participant');

set local role service_role;
select lives_ok($$select * from public.process_service_quality_sla(
  '2026-09-11 04:00:00+00', 100)$$,
  'scheduled worker marks a case overdue');
reset role;
select is((select sla_state from public.service_quality_cases limit 1),
  'overdue'::public.service_quality_sla_state,
  'case becomes overdue');
select is((select count(*)::integer from public.service_quality_case_events
  where event_type = 'sla_overdue'), 1,
  'overdue transition is recorded once');
select is((select count(*)::integer from public.notifications
  where event_key = 'quality.case.sla_overdue'), 1,
  'overdue transition creates a durable notification');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.notifications), 0,
  'unrelated account cannot read quality notifications');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000201', true);
select cmp_ok((select count(*)::integer from public.notifications), '>=', 3,
  'recipient sees their quality notification history');
select cmp_ok(public.mark_all_notifications_read(), '>=', 3,
  'recipient marks all notifications as read');
select is((select count(*)::integer from public.notifications where read_at is null), 0,
  'recipient has no unread notifications after marking all');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000301', true);
select lives_ok($$select public.admin_update_service_quality_case(
  (select id from public.service_quality_cases limit 1),
  'resolved', 'warranty_rework',
  'ให้ช่างเดิมกลับเข้าแก้งานตามเงื่อนไขรับประกัน', null)$$,
  'case manager closes the case');
reset role;
select is((select sla_state from public.service_quality_cases limit 1),
  'closed'::public.service_quality_sla_state,
  'closed case stops its SLA clock');
select is((select next_action_by from public.service_quality_cases limit 1),
  'none'::public.service_quality_next_actor,
  'closed case has no next actor');

select * from finish();
rollback;
