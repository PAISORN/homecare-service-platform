begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000101', 'travel-customer@example.test'),
  ('b0000000-0000-0000-0000-000000000102', 'travel-other@example.test'),
  ('b0000000-0000-0000-0000-000000000201', 'travel-tech@example.test'),
  ('b0000000-0000-0000-0000-000000000301', 'travel-admin@example.test');

insert into public.account_roles (user_id, role) values
  ('b0000000-0000-0000-0000-000000000201', 'technician'),
  ('b0000000-0000-0000-0000-000000000301', 'administrator');
insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values (
  'b0000000-0000-0000-0000-000000000201',
  'ช่างสำหรับทดสอบตำแหน่งระหว่างเดินทาง',
  'verified', now(), now(), 'b0000000-0000-0000-0000-000000000301'
);
insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'b1000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบเดินทาง', '11/11 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);
insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select 'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'b1000000-0000-0000-0000-000000000101', category.id,
  'symptom', 'technician_selected', 'แอร์ไม่เย็นสำหรับทดสอบตำแหน่ง', 1, 'flexible'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';
insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate, status
)
select 'b3000000-0000-0000-0000-000000000101', 'HC-20260910-940001',
  'b2000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000101',
  'b0000000-0000-0000-0000-000000000201', category.id,
  1, 'evidence_quote', 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  800, 'THB', 0.15, 'scheduled'
from public.service_categories as category where category.code = 'AIR-CONDITIONING';
insert into public.appointments (
  service_job_id, scheduled_date, time_window, service_location_id,
  location_label, address_line, latitude, longitude
) values (
  'b3000000-0000-0000-0000-000000000101', current_date, '09:00-12:00',
  'b1000000-0000-0000-0000-000000000101', 'บ้านทดสอบเดินทาง',
  '11/11 ถนนทดสอบ กรุงเทพมหานคร 10110', 13.756331, 100.501762
);

select ok((select relrowsecurity from pg_catalog.pg_class
  where oid = 'public.job_travel_locations'::regclass),
  'travel-location snapshot enables RLS');
select isnt(has_table_privilege('authenticated', 'public.job_travel_locations', 'SELECT'),
  true, 'authenticated clients cannot read snapshots directly');
select isnt(has_table_privilege('authenticated', 'private.job_travel_configuration', 'SELECT'),
  true, 'travel configuration is private');
select ok(has_function_privilege('authenticated',
  'public.get_service_job_travel_progress(uuid)', 'EXECUTE'),
  'authenticated participants can call the travel progress RPC');
select isnt(has_function_privilege('anon',
  'public.get_service_job_travel_progress(uuid)', 'EXECUTE'),
  true, 'anonymous clients cannot call the travel progress RPC');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.update_service_location_coordinates(
    'b1000000-0000-0000-0000-000000000101', 13.756331, 100.501762
  )$$, 'customer pins their own service location through the RPC');
reset role;
select is((select latitude from public.service_locations
  where id = 'b1000000-0000-0000-0000-000000000101'), 13.756331::numeric,
  'service-location latitude is stored at six decimal places');
select is((select metadata from public.audit_log
  where action = 'service_location.coordinates_updated'
  order by created_at desc limit 1), '{"has_coordinates": true}'::jsonb,
  'coordinate audit metadata does not contain the exact position');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select public.update_service_location_coordinates(
    'b1000000-0000-0000-0000-000000000101', 13.7, 100.5
  )$$, 'Service location not found', 'another customer cannot move the pin');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000201', true);
select throws_ok(
  $$select public.publish_service_job_travel_location(
    'b3000000-0000-0000-0000-000000000101', 13.736717, 100.523186, 20, now()
  )$$, 'En-route technician job required',
  'technician cannot publish before the job is en route');
reset role;

update public.service_jobs set status = 'technician_en_route'
where id = 'b3000000-0000-0000-0000-000000000101';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.publish_service_job_travel_location(
    'b3000000-0000-0000-0000-000000000101', 13.736717, 100.523186, 20, now()
  )$$, 'assigned technician publishes a foreground location');
select throws_ok(
  $$select public.publish_service_job_travel_location(
    'b3000000-0000-0000-0000-000000000101', 95, 100.523186, 20, now()
  )$$, 'Invalid travel location', 'out-of-range travel coordinates are rejected');
reset role;
select is((select count(*)::integer from public.job_travel_locations), 1,
  'only the current travel snapshot is retained');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000101', true);
select ok((select destination_ready from public.get_service_job_travel_progress(
  'b3000000-0000-0000-0000-000000000101')),
  'customer sees that the appointment destination is ready');
select ok((select sharing_active from public.get_service_job_travel_progress(
  'b3000000-0000-0000-0000-000000000101')),
  'customer sees a fresh foreground share as active');
select ok((select estimated_minutes > 0 from public.get_service_job_travel_progress(
  'b3000000-0000-0000-0000-000000000101')),
  'customer receives a server-computed ETA');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.stop_service_job_travel_sharing(
    'b3000000-0000-0000-0000-000000000101'
  )$$, 'technician explicitly stops sharing');
reset role;
select is((select count(*)::integer from public.job_travel_locations), 0,
  'stopping sharing deletes the current snapshot immediately');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000201', true);
select public.publish_service_job_travel_location(
  'b3000000-0000-0000-0000-000000000101', 13.736717, 100.523186, 20, now()
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select * from public.get_service_job_travel_progress(
    'b3000000-0000-0000-0000-000000000101'
  )$$, 'Service job not found', 'unrelated account cannot read travel progress');
reset role;

update public.service_jobs set status = 'technician_arrived'
where id = 'b3000000-0000-0000-0000-000000000101';
select is((select count(*)::integer from public.job_travel_locations), 0,
  'current travel location is deleted when travel ends');

select * from finish();
rollback;
