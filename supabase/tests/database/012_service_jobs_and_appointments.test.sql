begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email)
values
  ('c0000000-0000-0000-0000-000000000101', 'job-customer@example.test'),
  ('c0000000-0000-0000-0000-000000000102', 'job-other@example.test'),
  ('c0000000-0000-0000-0000-000000000201', 'job-tech@example.test'),
  ('c0000000-0000-0000-0000-000000000301', 'job-admin@example.test');

update public.profiles
set display_name = case id
  when 'c0000000-0000-0000-0000-000000000101' then 'ลูกค้าทดสอบงานบริการ'
  when 'c0000000-0000-0000-0000-000000000201' then 'ช่างทดสอบงานบริการ'
  else display_name
end
where id in (
  'c0000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000201'
);

insert into public.account_roles (user_id, role) values
  ('c0000000-0000-0000-0000-000000000201', 'technician'),
  ('c0000000-0000-0000-0000-000000000301', 'administrator');

insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'c0000000-0000-0000-0000-000000000201',
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบการเปิดงานบริการ',
  'verified', now(), now(), 'c0000000-0000-0000-0000-000000000301'
);

insert into public.service_locations (
  id, customer_id, label, address_line, building, floor, unit,
  access_instructions, is_default
) values (
  'c1000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบงานบริการ', '77/77 ถนนทดสอบ กรุงเทพมหานคร 10110',
  'HomeCare Job Residence', '7', '707', 'แจ้ง รปภ. ก่อนขึ้นอาคาร', true
);

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id, service_item_id,
  entry_point, status, problem_description, quantity, urgency
)
select
  'c2000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000101',
  'c1000000-0000-0000-0000-000000000101',
  category.id, item.id, 'service_catalog', 'technician_selected',
  'แอร์มีกลิ่นอับและต้องการล้างทำความสะอาดหนึ่งเครื่อง', 1, 'flexible'
from public.service_categories as category
join public.service_items as item on item.service_category_id = category.id
where category.code = 'AIR-CONDITIONING'
order by item.created_at
limit 1;

insert into public.technician_interests (
  id, service_request_id, technician_id, status
) values (
  'c3000000-0000-0000-0000-000000000101',
  'c2000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000201', 'active'
);

insert into public.quotations (
  id, service_request_id, technician_id, scope_description,
  labor_amount, currency, status
) values (
  'c4000000-0000-0000-0000-000000000101',
  'c2000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000201',
  'ล้างคอยล์เย็น คอยล์ร้อน และตรวจระบบระบายน้ำหนึ่งเครื่อง',
  800, 'THB', 'accepted'
);

insert into public.service_request_selections (
  service_request_id, customer_id, technician_id, technician_interest_id,
  quotation_id, price_model, agreed_labor_amount, currency
) values (
  'c2000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000101',
  'c0000000-0000-0000-0000-000000000201',
  'c3000000-0000-0000-0000-000000000101',
  'c4000000-0000-0000-0000-000000000101',
  'evidence_quote', 800, 'THB'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.propose_service_request_appointment(
    'c2000000-0000-0000-0000-000000000101', current_date + 2, '09:00–12:00'
  )$$,
  'customer proposes the appointment before confirmation'
);

select public.confirm_service_request_agreement(
  'c2000000-0000-0000-0000-000000000101'
);

reset role;
select is(
  (select count(*)::integer from public.service_jobs),
  0,
  'one-sided confirmation does not create a service job'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000201', true);

select lives_ok(
  $$select public.confirm_service_request_agreement(
    'c2000000-0000-0000-0000-000000000101'
  )$$,
  'second-party confirmation atomically creates the service job'
);

reset role;
select is(
  (select count(*)::integer from public.service_jobs),
  1,
  'exactly one service job is created'
);

select matches(
  (select job_number from public.service_jobs limit 1),
  '^HC-[0-9]{8}-[0-9]{6}$',
  'service job receives a human-readable unique number'
);

select is(
  (select labor_amount::integer from public.service_jobs limit 1),
  800,
  'confirmed labor amount is snapshotted'
);

select is(
  (select labor_commission_rate from public.service_jobs limit 1),
  0.150000::numeric,
  'new job snapshots the configured 15 percent commission rate'
);

update private.service_job_configuration
set labor_commission_rate = 0.20
where singleton;

select is(
  (select labor_commission_rate from public.service_jobs limit 1),
  0.150000::numeric,
  'changing configuration does not alter an existing job snapshot'
);

select is(
  (select commission_amount::integer from public.service_jobs limit 1),
  120,
  'commission is calculated from labor only'
);

select is(
  (select technician_net_labor_amount::integer from public.service_jobs limit 1),
  680,
  'technician net labor amount is available as a snapshot calculation'
);

select is(
  (select appointment.scheduled_date
   from public.appointments as appointment limit 1),
  current_date + 2,
  'confirmed appointment date is copied to the job'
);

select is(
  (select appointment.unit from public.appointments as appointment limit 1),
  '707',
  'service location details are snapshotted for the appointment'
);

select is(
  (select count(*)::integer from public.job_status_events),
  1,
  'job creation appends the initial scheduled status event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000201', true);

select is(
  (select job_status from public.get_service_job_for_request(
    'c2000000-0000-0000-0000-000000000101'
  )),
  'scheduled'::public.service_job_status,
  'selected technician reads the created job through the RPC'
);

select throws_ok(
  $$select * from public.service_jobs$$,
  'permission denied for table service_jobs',
  'technician cannot bypass the service-job RPC contract'
);

select throws_ok(
  $$update public.job_status_events set reason = 'แก้ไขย้อนหลังไม่ได้'$$,
  'permission denied for table job_status_events',
  'client cannot modify append-only status events'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000102', true);

select throws_ok(
  $$select * from public.get_service_job_for_request(
    'c2000000-0000-0000-0000-000000000101'
  )$$,
  'Service job not found',
  'unrelated customer cannot read the service job'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000101', true);

select throws_ok(
  $$select public.transition_service_job(
    (select job_id from public.get_service_job_for_request(
      'c2000000-0000-0000-0000-000000000101'
    )),
    'cancelled', 'scheduled', 'สถานะที่ส่งมาไม่ตรงกับข้อมูลปัจจุบัน'
  )$$,
  'Service job status changed',
  'transition requires the expected current status'
);

select throws_ok(
  $$select public.transition_service_job(
    (select job_id from public.get_service_job_for_request(
      'c2000000-0000-0000-0000-000000000101'
    )),
    'scheduled', 'cancelled', 'สั้น'
  )$$,
  'Cancellation reason required',
  'cancellation requires a meaningful reason'
);

select lives_ok(
  $$select public.transition_service_job(
    (select job_id from public.get_service_job_for_request(
      'c2000000-0000-0000-0000-000000000101'
    )),
    'scheduled', 'cancelled', 'ลูกค้าขอยกเลิกเนื่องจากไม่สะดวกตามเวลานัดหมาย'
  )$$,
  'customer can cancel a scheduled service job'
);

reset role;
select is(
  (select status from public.service_jobs limit 1),
  'cancelled'::public.service_job_status,
  'service job status changes to cancelled'
);

select is(
  (select status from public.appointments limit 1),
  'cancelled'::public.appointment_status,
  'appointment is cancelled atomically with the job'
);

select is(
  (select count(*)::integer from public.job_status_events),
  2,
  'cancellation appends a second status event'
);

select throws_ok(
  $$delete from public.job_status_events$$,
  'Job status events are append-only',
  'database trigger prevents status history deletion'
);

select is(
  (select count(*)::integer from public.audit_log
   where action = 'service_job.status_changed'
     and metadata ? 'reason'),
  0,
  'audit metadata excludes free-text cancellation reasons'
);

select is(
  (select count(*)::integer from public.audit_log
   where action = 'service_job.created'),
  1,
  'service-job creation is audited exactly once'
);

select * from finish();
rollback;
