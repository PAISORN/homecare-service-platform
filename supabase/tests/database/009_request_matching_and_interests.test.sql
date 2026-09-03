begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email)
values
  ('90000000-0000-0000-0000-000000000101', 'matching-customer@example.test'),
  ('90000000-0000-0000-0000-000000000102', 'other-customer@example.test'),
  ('90000000-0000-0000-0000-000000000201', 'verified-tech@example.test'),
  ('90000000-0000-0000-0000-000000000202', 'unverified-tech@example.test'),
  ('90000000-0000-0000-0000-000000000203', 'other-skill-tech@example.test'),
  ('90000000-0000-0000-0000-000000000301', 'matching-admin@example.test');

insert into public.account_roles (user_id, role)
values
  ('90000000-0000-0000-0000-000000000201', 'technician'),
  ('90000000-0000-0000-0000-000000000202', 'technician'),
  ('90000000-0000-0000-0000-000000000203', 'technician'),
  ('90000000-0000-0000-0000-000000000301', 'administrator');

insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
) values
  (
    '90000000-0000-0000-0000-000000000201',
    'ช่างแอร์ที่ผ่านการตรวจสอบสำหรับทดสอบระบบ',
    'verified', now(), now(), '90000000-0000-0000-0000-000000000301'
  ),
  (
    '90000000-0000-0000-0000-000000000202',
    'ช่างที่ยังไม่ผ่านการตรวจสอบสำหรับทดสอบระบบ',
    'pending_review', now(), null, null
  ),
  (
    '90000000-0000-0000-0000-000000000203',
    'ช่างประปาที่ผ่านการตรวจสอบสำหรับทดสอบระบบ',
    'verified', now(), now(), '90000000-0000-0000-0000-000000000301'
  );

insert into public.technician_skills (
  technician_id, service_category_id, years_experience
)
select '90000000-0000-0000-0000-000000000201'::uuid, id, 5
from public.service_categories where code = 'AIR-CONDITIONING'
union all
select '90000000-0000-0000-0000-000000000202'::uuid, id, 2
from public.service_categories where code = 'AIR-CONDITIONING'
union all
select '90000000-0000-0000-0000-000000000203'::uuid, id, 4
from public.service_categories where code = 'PLUMBING';

insert into public.service_locations (
  id, customer_id, label, address_line, building, floor, unit, is_default
) values (
  '91000000-0000-0000-0000-000000000101',
  '90000000-0000-0000-0000-000000000101',
  'บ้านลับของลูกค้า', '99/99 ถนนข้อมูลลับ', 'อาคารลับ', '5', '502', true
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000101',
  true
);

select lives_ok(
  $$select public.save_service_request_draft(
    '91000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'AIR-CONDITIONING'),
    (select id from public.service_items where code = 'AC-CLEAN-WALL'),
    'service_catalog', 'ข้อความส่วนตัวที่ไม่ควรออกไปในฟีด 0812345678', 1,
    'within_3_days', current_date + 1, '09:00-12:00', '{}', '{}'
  )$$,
  'a customer can prepare a request before submission'
);

reset role;
create temporary table matching_request_fixture (id uuid primary key) on commit drop;
insert into matching_request_fixture
select id from public.service_requests
where customer_id = '90000000-0000-0000-0000-000000000101';
grant select on matching_request_fixture to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000101',
  true
);

select is(
  (select status::text from public.submit_service_request(
    (select id from matching_request_fixture)
  )),
  'matching',
  'the owner can submit a safe draft for matching'
);

select ok(
  (select submitted_at is not null from public.service_requests
   where id = (select id from matching_request_fixture)),
  'request submission records its timestamp'
);

select throws_ok(
  $$select public.submit_service_request((select id from matching_request_fixture))$$,
  'Service request draft not found',
  'a matching request cannot be submitted twice'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000102',
  true
);

select throws_ok(
  $$select public.submit_service_request((select id from matching_request_fixture))$$,
  'Service request draft not found',
  'another customer cannot submit someone else request'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000201',
  true
);

select lives_ok(
  $$insert into public.technician_skills (
      technician_id, service_category_id, is_active
    )
    select
      '90000000-0000-0000-0000-000000000201'::uuid,
      id,
      true
    from public.service_categories
    where code = 'ELECTRICAL'
    on conflict (technician_id, service_category_id)
    do update set is_active = excluded.is_active$$,
  'a technician can configure an owned skill category'
);

update public.technician_skills
set is_active = false
where technician_id = '90000000-0000-0000-0000-000000000203';

select is(
  (
    select is_active
    from public.technician_skills
    where technician_id = '90000000-0000-0000-0000-000000000203'
  ),
  true,
  'a technician cannot change another technician skill category'
);

select is(
  (select count(*)::integer from public.service_requests),
  0,
  'a technician cannot read raw customer request rows'
);

select is(
  (select count(*)::integer from public.request_attachments),
  0,
  'a technician cannot read customer request attachment rows'
);

select results_eq(
  $$select category_name_th, item_name_th, quantity::integer,
           urgency::text, interest_status::text
    from public.list_matching_service_requests()$$,
  $$values ('เครื่องปรับอากาศ'::text, 'ล้างแอร์ติดผนัง'::text, 1,
            'within_3_days'::text, null::text)$$,
  'a verified technician sees a structured request in an active skill category'
);

select ok(
  position(
    'customer_id' in
    pg_get_function_result('public.list_matching_service_requests()'::regprocedure)
  ) = 0,
  'the feed contract does not return customer identity'
);

select ok(
  position(
    'service_location' in
    pg_get_function_result('public.list_matching_service_requests()'::regprocedure)
  ) = 0,
  'the feed contract does not return a service location identifier or address'
);

select ok(
  position(
    'problem_description' in
    pg_get_function_result('public.list_matching_service_requests()'::regprocedure)
  ) = 0,
  'the feed contract does not return free text that may contain contact data'
);

select is(
  (select status::text from public.express_technician_interest(
    (select id from matching_request_fixture)
  )),
  'active',
  'a matching verified technician can express interest'
);

select is(
  (select interest_status::text
   from public.list_matching_service_requests()
   where request_id = (select id from matching_request_fixture)),
  'active',
  'the feed marks the calling technician own interest only'
);

select throws_ok(
  $$insert into public.technician_interests (service_request_id, technician_id)
    values (
      (select id from matching_request_fixture),
      '90000000-0000-0000-0000-000000000201'
    )$$,
  'permission denied for table technician_interests',
  'direct interest mutations are denied'
);

select is(
  (select status::text from public.withdraw_technician_interest(
    (select id from matching_request_fixture)
  )),
  'withdrawn',
  'a technician can withdraw their own active interest'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000202',
  true
);

select throws_ok(
  $$select * from public.list_matching_service_requests()$$,
  'Verified technician required',
  'an unverified technician cannot open the feed'
);

select throws_ok(
  $$select public.express_technician_interest(
    (select id from matching_request_fixture)
  )$$,
  'Verified technician required',
  'an unverified technician cannot express interest'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000203',
  true
);

select is(
  (select count(*)::integer from public.list_matching_service_requests()),
  0,
  'a verified technician does not see requests outside active skills'
);

select throws_ok(
  $$select public.express_technician_interest(
    (select id from matching_request_fixture)
  )$$,
  'Matching service request not found',
  'a technician cannot express interest outside active skills'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000101',
  true
);

select throws_ok(
  $$select * from public.list_matching_service_requests()$$,
  'Verified technician required',
  'a customer cannot open the technician feed'
);

select is(
  (select status::text from public.cancel_service_request(
    (select id from matching_request_fixture)
  )),
  'cancelled',
  'the customer can cancel a request before technician selection'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '90000000-0000-0000-0000-000000000201',
  true
);

select throws_ok(
  $$select public.express_technician_interest(
    (select id from matching_request_fixture)
  )$$,
  'Matching service request not found',
  'a cancelled request cannot receive new interest'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.list_matching_service_requests()$$,
  'permission denied for function list_matching_service_requests',
  'anonymous users cannot call the matching feed'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.audit_log
    where action in (
      'service_request.submitted',
      'service_request.cancelled',
      'technician_interest.expressed',
      'technician_interest.withdrawn'
    )
      and (
        metadata ? 'problem_description'
        or metadata ? 'address_line'
        or metadata ? 'phone'
      )
  ),
  0,
  'matching audit metadata excludes customer free text, address, and phone'
);

select * from finish();

rollback;
