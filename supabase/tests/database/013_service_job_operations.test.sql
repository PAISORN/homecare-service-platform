begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email)
values
  ('d0000000-0000-0000-0000-000000000101', 'operations-customer@example.test'),
  ('d0000000-0000-0000-0000-000000000102', 'operations-other@example.test'),
  ('d0000000-0000-0000-0000-000000000201', 'operations-tech@example.test'),
  ('d0000000-0000-0000-0000-000000000301', 'operations-admin@example.test');

update public.profiles
set display_name = case id
  when 'd0000000-0000-0000-0000-000000000101' then 'ลูกค้าทดสอบปฏิบัติงาน'
  when 'd0000000-0000-0000-0000-000000000201' then 'ช่างทดสอบปฏิบัติงาน'
  else display_name
end
where id in (
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000201'
);

insert into public.account_roles (user_id, role) values
  ('d0000000-0000-0000-0000-000000000201', 'technician'),
  ('d0000000-0000-0000-0000-000000000301', 'administrator');

insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'd0000000-0000-0000-0000-000000000201',
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบสถานะปฏิบัติงาน',
  'verified', now(), now(), 'd0000000-0000-0000-0000-000000000301'
);

insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'd1000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบปฏิบัติงาน', '55/55 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select
  request_id,
  'd0000000-0000-0000-0000-000000000101',
  'd1000000-0000-0000-0000-000000000101',
  category.id,
  'symptom', 'technician_selected', description, 1, 'flexible'
from public.service_categories as category
cross join (values
  ('d2000000-0000-0000-0000-000000000101'::uuid, 'แอร์ไม่เย็นสำหรับทดสอบสถานะงาน'),
  ('d2000000-0000-0000-0000-000000000102'::uuid, 'แอร์มีกลิ่นสำหรับทดสอบยกเลิกงาน')
) as fixture(request_id, description)
where category.code = 'AIR-CONDITIONING';

insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate
)
select
  fixture.job_id,
  fixture.job_number,
  fixture.request_id,
  'd0000000-0000-0000-0000-000000000101',
  'd0000000-0000-0000-0000-000000000201',
  category.id,
  1, 'evidence_quote', fixture.scope_description,
  fixture.labor_amount, 'THB', 0.15
from public.service_categories as category
cross join (values
  ('d3000000-0000-0000-0000-000000000101'::uuid, 'HC-20260909-900001', 'd2000000-0000-0000-0000-000000000101'::uuid, 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง', 800::numeric),
  ('d3000000-0000-0000-0000-000000000102'::uuid, 'HC-20260909-900002', 'd2000000-0000-0000-0000-000000000102'::uuid, 'ตรวจกลิ่นและล้างเครื่องปรับอากาศหนึ่งเครื่อง', 900::numeric)
) as fixture(job_id, job_number, request_id, scope_description, labor_amount)
where category.code = 'AIR-CONDITIONING';

insert into public.appointments (
  service_job_id, scheduled_date, time_window, service_location_id,
  location_label, address_line
) values
  ('d3000000-0000-0000-0000-000000000101', current_date + 1, '09:00–12:00',
   'd1000000-0000-0000-0000-000000000101', 'บ้านทดสอบปฏิบัติงาน',
   '55/55 ถนนทดสอบ กรุงเทพมหานคร 10110'),
  ('d3000000-0000-0000-0000-000000000102', current_date + 2, '13:00–16:00',
   'd1000000-0000-0000-0000-000000000101', 'บ้านทดสอบปฏิบัติงาน',
   '55/55 ถนนทดสอบ กรุงเทพมหานคร 10110');

insert into public.job_status_events (
  service_job_id, from_status, to_status, actor_user_id
) values
  ('d3000000-0000-0000-0000-000000000101', null, 'scheduled',
   'd0000000-0000-0000-0000-000000000101'),
  ('d3000000-0000-0000-0000-000000000102', null, 'scheduled',
   'd0000000-0000-0000-0000-000000000101');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);

select is((select count(*)::integer from public.list_service_jobs()), 2,
  'customer lists both service jobs');
select is((select actor_role from public.list_service_jobs() limit 1), 'customer',
  'customer list identifies the customer role');
select is((select counterpart_display_name from public.list_service_jobs() limit 1),
  'ช่างทดสอบปฏิบัติงาน', 'customer list exposes only the matched technician name');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.list_service_jobs()), 0,
  'unrelated customer lists no service jobs');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select is((select count(*)::integer from public.list_service_jobs()), 2,
  'technician lists both assigned service jobs');
select is((select actor_role from public.get_service_job(
  'd3000000-0000-0000-0000-000000000101')), 'technician',
  'technician detail identifies the technician role');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select is((select actor_role from public.get_service_job(
  'd3000000-0000-0000-0000-000000000101')), 'customer',
  'customer can read a participating job detail');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select * from public.get_service_job('d3000000-0000-0000-0000-000000000101')$$,
  'Service job not found', 'unrelated customer cannot read job detail');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select is((select count(*)::integer from public.list_service_job_status_events(
  'd3000000-0000-0000-0000-000000000101')), 1,
  'customer can read the initial status event');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select * from public.list_service_job_status_events('d3000000-0000-0000-0000-000000000101')$$,
  'Service job not found', 'unrelated customer cannot read status history');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'scheduled', 'technician_en_route')$$,
  'Service job status transition not allowed',
  'customer cannot advance the operational status');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'scheduled', 'technician_en_route')$$,
  'verified technician starts travelling');

reset role;
select is((select status from public.service_jobs where id =
  'd3000000-0000-0000-0000-000000000101'),
  'technician_en_route'::public.service_job_status, 'job is en route');
select is((select reason from public.job_status_events where service_job_id =
  'd3000000-0000-0000-0000-000000000101' order by created_at desc limit 1),
  null, 'operational event does not contain a reason');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'technician_en_route', 'cancelled', 'ลูกค้าขอยกเลิกหลังช่างเริ่มเดินทางแล้ว')$$,
  'Service job cancellation not allowed',
  'customer cannot cancel after the technician starts travelling');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'technician_en_route', 'technician_arrived')$$,
  'technician records arrival');
select lives_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'technician_arrived', 'in_progress')$$,
  'technician starts the work');
select throws_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000101', 'in_progress', 'cancelled', 'ช่างขอยกเลิกหลังเริ่มปฏิบัติงานแล้ว')$$,
  'Service job cancellation not allowed', 'technician cannot cancel after work starts');

select throws_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000102', 'scheduled', 'cancelled', 'สั้น')$$,
  'Cancellation reason required', 'technician cancellation requires a meaningful reason');
select lives_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000102', 'scheduled', 'cancelled', 'ช่างไม่สามารถเข้าบริการตามเวลานัดหมายได้')$$,
  'technician cancels before travelling');

reset role;
select is((select status from public.service_jobs where id =
  'd3000000-0000-0000-0000-000000000102'),
  'cancelled'::public.service_job_status, 'cancelled job stores the final status');
select is((select status from public.appointments where service_job_id =
  'd3000000-0000-0000-0000-000000000102'),
  'cancelled'::public.appointment_status, 'cancellation also cancels the appointment');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000101', true);
select is((select reason from public.list_service_job_status_events(
  'd3000000-0000-0000-0000-000000000102') where to_status = 'cancelled'),
  'ช่างไม่สามารถเข้าบริการตามเวลานัดหมายได้',
  'participant sees the recorded cancellation reason');

reset role;
select is((select count(*)::integer from public.audit_log
  where action = 'service_job.status_changed' and metadata ? 'reason'), 0,
  'audit metadata never copies free-text cancellation reasons');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000201', true);
select throws_ok(
  $$select public.transition_service_job('d3000000-0000-0000-0000-000000000102', 'scheduled', 'technician_en_route')$$,
  'Service job status changed', 'stale expected status is rejected');

select * from finish();
rollback;
