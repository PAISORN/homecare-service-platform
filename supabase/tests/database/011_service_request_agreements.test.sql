begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email)
values
  ('b0000000-0000-0000-0000-000000000101', 'agreement-customer@example.test'),
  ('b0000000-0000-0000-0000-000000000102', 'agreement-other@example.test'),
  ('b0000000-0000-0000-0000-000000000201', 'agreement-tech@example.test'),
  ('b0000000-0000-0000-0000-000000000301', 'agreement-admin@example.test');

update public.profiles
set display_name = case id
  when 'b0000000-0000-0000-0000-000000000101' then 'ลูกค้าทดสอบข้อตกลง'
  when 'b0000000-0000-0000-0000-000000000201' then 'ช่างทดสอบข้อตกลง'
  else display_name
end
where id in (
  'b0000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000201'
);

insert into public.account_roles (user_id, role) values
  ('b0000000-0000-0000-0000-000000000201', 'technician'),
  ('b0000000-0000-0000-0000-000000000301', 'administrator');

insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'b0000000-0000-0000-0000-000000000201',
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบข้อตกลงก่อนเปิดงาน',
  'verified', now(), now(), 'b0000000-0000-0000-0000-000000000301'
);

insert into public.service_locations (
  id, customer_id, label, address_line, building, floor, unit, is_default
) values (
  'b1000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบข้อตกลง', '99/99 ถนนทดสอบ กรุงเทพมหานคร 10110',
  'HomeCare Test Residence', '5', '502', true
);

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id, entry_point,
  status, problem_description, quantity, urgency
)
select
  'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101',
  category.id, 'symptom', 'technician_selected',
  'แอร์มีกลิ่นอับและต้องการล้างทำความสะอาดหนึ่งเครื่อง', 1, 'flexible'
from public.service_categories as category
where category.code = 'AIR-CONDITIONING';

insert into public.technician_interests (
  id, service_request_id, technician_id, status
) values (
  'b3000000-0000-0000-0000-000000000101',
  'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000201', 'active'
);

insert into public.quotations (
  id, service_request_id, technician_id, scope_description,
  labor_amount, currency, status
) values (
  'b4000000-0000-0000-0000-000000000101',
  'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000201',
  'ล้างคอยล์เย็น คอยล์ร้อน และตรวจระบบระบายน้ำหนึ่งเครื่อง',
  700, 'THB', 'accepted'
);

insert into public.service_request_selections (
  service_request_id, customer_id, technician_id, technician_interest_id,
  quotation_id, price_model, agreed_labor_amount, currency
) values (
  'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000201',
  'b3000000-0000-0000-0000-000000000101',
  'b4000000-0000-0000-0000-000000000101',
  'evidence_quote', 700, 'THB'
);

select is(
  (select labor_amount::integer from public.service_request_agreements
   where service_request_id = 'b2000000-0000-0000-0000-000000000101'),
  700,
  'technician selection creates the immutable agreement price snapshot'
);

select is(
  (select scope_description from public.service_request_agreements
   where service_request_id = 'b2000000-0000-0000-0000-000000000101'),
  'ล้างคอยล์เย็น คอยล์ร้อน และตรวจระบบระบายน้ำหนึ่งเครื่อง',
  'agreement copies scope from the accepted quotation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000101', true);

select is(
  (select actor_role from public.get_service_request_agreement(
    'b2000000-0000-0000-0000-000000000101'
  )),
  'customer',
  'customer reads the selected request agreement'
);

select throws_ok(
  $$select * from public.service_request_agreements$$,
  'permission denied for table service_request_agreements',
  'customer cannot bypass the agreement RPC contract'
);

select throws_ok(
  $$select public.confirm_service_request_agreement(
    'b2000000-0000-0000-0000-000000000101'
  )$$,
  'Appointment proposal required',
  'agreement cannot be confirmed before an appointment is proposed'
);

select lives_ok(
  $$select public.propose_service_request_appointment(
    'b2000000-0000-0000-0000-000000000101', current_date + 2, '09:00–12:00'
  )$$,
  'customer proposes an appointment'
);

select lives_ok(
  $$select public.confirm_service_request_agreement(
    'b2000000-0000-0000-0000-000000000101'
  )$$,
  'customer confirms the current agreement revision'
);

select ok(
  (select customer_confirmed and not technician_confirmed
   from public.get_service_request_agreement(
     'b2000000-0000-0000-0000-000000000101'
   )),
  'only the customer confirmation is recorded'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000102', true);

select throws_ok(
  $$select * from public.get_service_request_agreement(
    'b2000000-0000-0000-0000-000000000101'
  )$$,
  'Selected service request agreement not found',
  'unrelated customer cannot read the post-selection agreement'
);

select throws_ok(
  $$select public.propose_service_request_appointment(
    'b2000000-0000-0000-0000-000000000101', current_date + 3, '13:00–16:00'
  )$$,
  'Selected service request agreement not found',
  'unrelated customer cannot change the appointment'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000201', true);

select is(
  (select count(*)::integer from public.list_technician_selected_requests()
   where request_id = 'b2000000-0000-0000-0000-000000000101'),
  1,
  'selected technician sees the request in the agreement inbox'
);

select lives_ok(
  $$select public.propose_service_request_appointment(
    'b2000000-0000-0000-0000-000000000101', current_date + 2, '13:00–16:00'
  )$$,
  'technician can counter-propose the appointment'
);

select ok(
  (select not customer_confirmed and not technician_confirmed
   from public.get_service_request_agreement(
     'b2000000-0000-0000-0000-000000000101'
   )),
  'changing the appointment invalidates confirmations from the previous revision'
);

select public.confirm_service_request_agreement(
  'b2000000-0000-0000-0000-000000000101'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000101', true);
select public.confirm_service_request_agreement(
  'b2000000-0000-0000-0000-000000000101'
);

select ok(
  (select customer_confirmed and technician_confirmed
     and fully_confirmed_at is not null
   from public.get_service_request_agreement(
     'b2000000-0000-0000-0000-000000000101'
   )),
  'both parties confirming one revision completes the agreement'
);

select throws_ok(
  $$select public.propose_service_request_appointment(
    'b2000000-0000-0000-0000-000000000101', current_date + 4, '10:00–11:00'
  )$$,
  'Confirmed agreement cannot be changed',
  'a completed agreement is immutable before service-job creation'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.get_service_request_agreement(
    'b2000000-0000-0000-0000-000000000101'
  )$$,
  'permission denied for function get_service_request_agreement',
  'anonymous users cannot call the agreement RPC'
);

reset role;
select is(
  (select count(*)::integer from public.audit_log
   where action in (
     'service_request.appointment_proposed',
     'service_request.agreement_confirmed'
   ) and metadata ? 'scope_description'),
  0,
  'agreement audit metadata excludes free-text scope and address data'
);

select is(
  (select count(*)::integer from public.audit_log
   where action = 'service_request.appointment_proposed'
     and entity_id = 'b2000000-0000-0000-0000-000000000101'),
  2,
  'each effective appointment proposal is audited'
);

select * from finish();
rollback;
