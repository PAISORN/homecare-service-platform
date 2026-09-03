begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, email)
values
  ('a0000000-0000-0000-0000-000000000101', 'shortlist-customer@example.test'),
  ('a0000000-0000-0000-0000-000000000102', 'other-shortlist-customer@example.test'),
  ('a0000000-0000-0000-0000-000000000201', 'shortlist-tech-1@example.test'),
  ('a0000000-0000-0000-0000-000000000202', 'shortlist-tech-2@example.test'),
  ('a0000000-0000-0000-0000-000000000203', 'shortlist-tech-3@example.test'),
  ('a0000000-0000-0000-0000-000000000204', 'shortlist-tech-4@example.test'),
  ('a0000000-0000-0000-0000-000000000301', 'shortlist-admin@example.test');

insert into public.account_roles (user_id, role)
select id, 'technician'::public.account_role
from auth.users
where id in (
  'a0000000-0000-0000-0000-000000000201',
  'a0000000-0000-0000-0000-000000000202',
  'a0000000-0000-0000-0000-000000000203',
  'a0000000-0000-0000-0000-000000000204'
)
union all
select 'a0000000-0000-0000-0000-000000000301'::uuid,
       'administrator'::public.account_role;

insert into public.technician_profiles (
  user_id, bio, verification_status, submitted_at, verified_at, verified_by
)
select
  id,
  'ช่างที่ผ่านการตรวจสอบสำหรับทดสอบรายชื่อและใบเสนอราคา',
  'verified',
  now(),
  now(),
  'a0000000-0000-0000-0000-000000000301'
from auth.users
where id in (
  'a0000000-0000-0000-0000-000000000201',
  'a0000000-0000-0000-0000-000000000202',
  'a0000000-0000-0000-0000-000000000203',
  'a0000000-0000-0000-0000-000000000204'
);

update public.profiles
set display_name = case id
  when 'a0000000-0000-0000-0000-000000000201' then 'ช่างหนึ่ง'
  when 'a0000000-0000-0000-0000-000000000202' then 'ช่างสอง'
  when 'a0000000-0000-0000-0000-000000000203' then 'ช่างสาม'
  when 'a0000000-0000-0000-0000-000000000204' then 'ช่างสี่'
  else display_name
end
where id in (
  'a0000000-0000-0000-0000-000000000201',
  'a0000000-0000-0000-0000-000000000202',
  'a0000000-0000-0000-0000-000000000203',
  'a0000000-0000-0000-0000-000000000204'
);

insert into public.technician_skills (
  technician_id, service_category_id, years_experience
)
select technician_id, category.id, years_experience
from (
  values
    ('a0000000-0000-0000-0000-000000000201'::uuid, 8::smallint),
    ('a0000000-0000-0000-0000-000000000202'::uuid, 7::smallint),
    ('a0000000-0000-0000-0000-000000000203'::uuid, 6::smallint),
    ('a0000000-0000-0000-0000-000000000204'::uuid, 1::smallint)
) as technician(technician_id, years_experience)
cross join public.service_categories as category
where category.code = 'AIR-CONDITIONING';

insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'a1000000-0000-0000-0000-000000000101',
  'a0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบรายชื่อ',
  'ที่อยู่ปิดบังสำหรับทดสอบ',
  true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);

select lives_ok(
  $$select public.save_service_request_draft(
    'a1000000-0000-0000-0000-000000000101',
    (select id from public.service_categories where code = 'AIR-CONDITIONING'),
    null,
    'symptom',
    'แอร์มีกลิ่นอับและต้องการให้ช่างประเมินจากข้อมูลที่ส่งให้',
    1, 'flexible', null, null, '{}', '{}'
  )$$,
  'customer can create an evidence-quotation request'
);

reset role;
create temporary table shortlist_request_fixture (id uuid primary key) on commit drop;
insert into shortlist_request_fixture
select id from public.service_requests
where customer_id = 'a0000000-0000-0000-0000-000000000101';
grant select on shortlist_request_fixture to authenticated, anon;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select is(
  (select status::text from public.submit_service_request(
    (select id from shortlist_request_fixture)
  )),
  'matching',
  'customer submits the request for matching'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000201', true);
select lives_ok(
  $$select public.express_technician_interest((select id from shortlist_request_fixture))$$,
  'first verified technician expresses interest'
);
select lives_ok(
  $$select public.submit_technician_quotation(
    (select id from shortlist_request_fixture),
    'ล้างชุดคอยล์และตรวจระบบระบายน้ำตามข้อมูลที่ลูกค้าส่ง', 800
  )$$,
  'interested technician submits a sealed quotation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000202', true);
select public.express_technician_interest((select id from shortlist_request_fixture));
select public.submit_technician_quotation(
  (select id from shortlist_request_fixture),
  'ล้างระบบเครื่องปรับอากาศและตรวจการทำงานเบื้องต้น', 700
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000203', true);
select public.express_technician_interest((select id from shortlist_request_fixture));
select public.submit_technician_quotation(
  (select id from shortlist_request_fixture),
  'ล้างเครื่องปรับอากาศและตรวจจุดที่มีกลิ่นอับตามข้อมูล', 600
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000204', true);
select public.express_technician_interest((select id from shortlist_request_fixture));
select public.submit_technician_quotation(
  (select id from shortlist_request_fixture),
  'ล้างและตรวจสภาพเครื่องปรับอากาศหนึ่งเครื่องตามข้อมูล', 500
);

select is(
  (select quotation_labor_amount::integer
   from public.list_matching_service_requests()
   where request_id = (select id from shortlist_request_fixture)),
  500,
  'matching feed exposes only the calling technician own quotation'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);

select is(
  (select count(*)::integer from public.list_customer_request_shortlist(
    (select id from shortlist_request_fixture)
  )),
  3,
  'customer shortlist is capped at three verified technicians'
);

select is(
  (select count(*)::integer
   from public.list_customer_request_shortlist((select id from shortlist_request_fixture))
   where technician_id = 'a0000000-0000-0000-0000-000000000204'),
  0,
  'the lower-ranked fourth technician is not exposed'
);

select throws_ok(
  $$select public.select_technician_for_request(
    (select id from shortlist_request_fixture),
    'a0000000-0000-0000-0000-000000000204'
  )$$,
  'Technician is not in the current shortlist',
  'customer cannot select a technician outside the current top three'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000102', true);
select throws_ok(
  $$select * from public.list_customer_request_shortlist(
    (select id from shortlist_request_fixture)
  )$$,
  'Customer service request not found',
  'another customer cannot read the shortlist'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select lives_ok(
  $$select public.select_technician_for_request(
    (select id from shortlist_request_fixture),
    'a0000000-0000-0000-0000-000000000202'
  )$$,
  'customer selects one shortlisted technician'
);

reset role;
select is(
  (select status::text from public.service_requests
   where id = (select id from shortlist_request_fixture)),
  'technician_selected',
  'request records the technician-selected state'
);
select is(
  (select agreed_labor_amount::integer from public.service_request_selections
   where service_request_id = (select id from shortlist_request_fixture)),
  700,
  'selection stores an immutable price snapshot'
);
select is(
  (select count(*)::integer from public.technician_interests
   where service_request_id = (select id from shortlist_request_fixture)
     and technician_id <> 'a0000000-0000-0000-0000-000000000202'
     and status = 'withdrawn'),
  3,
  'selecting one technician closes every other active interest'
);
select is(
  (select status::text from public.quotations
   where service_request_id = (select id from shortlist_request_fixture)
     and technician_id = 'a0000000-0000-0000-0000-000000000202'),
  'accepted',
  'selected technician quotation becomes accepted'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000101', true);
select throws_ok(
  $$select * from public.quotations$$,
  'permission denied for table quotations',
  'clients cannot bypass the sealed-quotation RPC contract'
);
select throws_ok(
  $$select * from public.service_request_selections$$,
  'permission denied for table service_request_selections',
  'clients cannot read selection snapshots directly'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.list_customer_request_shortlist(
    (select id from shortlist_request_fixture)
  )$$,
  'permission denied for function list_customer_request_shortlist',
  'anonymous users cannot call the shortlist RPC'
);

reset role;
select is(
  (select count(*)::integer from public.audit_log
   where action in ('quotation.submitted', 'service_request.technician_selected')
     and metadata ? 'scope_description'),
  0,
  'audit metadata never stores quotation free text'
);

select * from finish();
rollback;
