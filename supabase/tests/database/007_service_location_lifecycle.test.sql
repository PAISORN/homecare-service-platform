begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

insert into auth.users (id, email)
values
  ('70000000-0000-0000-0000-000000000101', 'location-one@example.test'),
  ('70000000-0000-0000-0000-000000000102', 'location-two@example.test'),
  ('70000000-0000-0000-0000-000000000103', 'location-no-role@example.test');

delete from public.account_roles
where user_id = '70000000-0000-0000-0000-000000000103';

set local role anon;

select throws_ok(
  $$select public.save_service_location('บ้าน', 'กรุงเทพฯ')$$,
  'permission denied for function save_service_location',
  'anon cannot call the service-location mutation contract'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000101',
  true
);

select results_eq(
  $$select label, address_line, is_default
    from public.save_service_location('  บ้าน  ', '  99 ถนนสุขุมวิท  ')$$,
  $$values ('บ้าน'::text, '99 ถนนสุขุมวิท'::text, true)$$,
  'the first location is trimmed and becomes the default automatically'
);

select results_eq(
  $$select is_default
    from public.save_service_location(
      'คอนโด',
      '88 ถนนสุขุมวิท',
      'อาคาร A',
      '12',
      '1204',
      'ฝากกุญแจกับนิติบุคคล',
      false,
      null
    )$$,
  $$values (false)$$,
  'a later location is not default unless the customer requests it'
);

reset role;
create temporary table test_service_location_ids (
  fixture text primary key,
  id uuid not null
) on commit drop;
insert into test_service_location_ids (fixture, id)
select case label when 'บ้าน' then 'home' else 'condo' end, id
from public.service_locations
where customer_id = '70000000-0000-0000-0000-000000000101';
grant select on test_service_location_ids to authenticated;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000101',
  true
);

select is(
  (select count(*)::integer from public.service_locations),
  2,
  'the customer can list both of their locations'
);

select lives_ok(
  $$insert into public.service_locations (id, customer_id, label, address_line)
    values (
      '72000000-0000-0000-0000-000000000003',
      '70000000-0000-0000-0000-000000000101',
      'จุดรับบริการชั่วคราว',
      'ที่อยู่ทดสอบ'
    )$$,
  'the existing direct insert contract remains available behind ownership RLS'
);

select throws_ok(
  $$insert into public.service_locations (customer_id, label, address_line)
    values (
      '70000000-0000-0000-0000-000000000102',
      'ปลอม',
      'ที่อยู่ปลอม'
    )$$,
  'new row violates row-level security policy for table "service_locations"',
  'direct insert still cannot cross the ownership boundary'
);

select lives_ok(
  $$delete from public.service_locations
    where id = '72000000-0000-0000-0000-000000000003'$$,
  'the existing direct delete contract remains available for an owned row'
);

select is(
  (
    select is_default
    from public.set_default_service_location(
      (select id from test_service_location_ids where fixture = 'condo')
    )
  ),
  true,
  'the customer can choose a new default location'
);

select results_eq(
  $$select id
    from public.service_locations
    where is_default$$,
  $$select id from test_service_location_ids where fixture = 'condo'$$,
  'changing the default leaves exactly the requested location selected'
);

select results_eq(
  $$select label, building, floor, unit, access_instructions, is_default
    from public.save_service_location(
      '  คอนโดหลัก  ',
      '88 ถนนสุขุมวิท',
      '',
      '',
      '',
      '',
      false,
      (select id from test_service_location_ids where fixture = 'condo')
    )$$,
  $$values (
      'คอนโดหลัก'::text,
      null::text,
      null::text,
      null::text,
      null::text,
      true
    )$$,
  'editing preserves the default and normalizes blank optional values to null'
);

select throws_ok(
  $$select public.save_service_location('', 'ที่อยู่')$$,
  'Invalid service location label',
  'blank labels are rejected by the server contract'
);

select throws_ok(
  $$select public.save_service_location('บ้าน', '')$$,
  'Invalid service location address',
  'blank addresses are rejected by the server contract'
);

select throws_ok(
  $$select public.save_service_location(
      'บ้าน',
      'ที่อยู่',
      repeat('ก', 161)
    )$$,
  'Invalid service location building',
  'oversized optional address details are rejected'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000102',
  true
);

select throws_ok(
  $$select public.save_service_location(
      'ปลอม',
      'ปลอม',
      null,
      null,
      null,
      null,
      false,
      (select id from test_service_location_ids where fixture = 'home')
    )$$,
  'Service location not found',
  'a customer cannot edit another customer location through the RPC'
);

select throws_ok(
  $$select public.set_default_service_location(
      (select id from test_service_location_ids where fixture = 'home')
    )$$,
  'Service location not found',
  'a customer cannot select another customer location as default'
);

select throws_ok(
  $$select public.delete_service_location(
      (select id from test_service_location_ids where fixture = 'home')
    )$$,
  'Service location not found',
  'a customer cannot delete another customer location'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000103',
  true
);

select throws_ok(
  $$select public.save_service_location('บ้าน', 'ที่อยู่')$$,
  'Active customer account required',
  'an active account without the customer role cannot manage locations'
);

reset role;
update public.profiles
set account_status = 'deactivated', deactivated_at = transaction_timestamp()
where id = '70000000-0000-0000-0000-000000000102';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000102',
  true
);

select throws_ok(
  $$select public.save_service_location('บ้าน', 'ที่อยู่')$$,
  'Active customer account required',
  'a deactivated customer cannot manage locations'
);

select set_config(
  'request.jwt.claim.sub',
  '70000000-0000-0000-0000-000000000101',
  true
);

select is(
  public.delete_service_location(
    (select id from test_service_location_ids where fixture = 'condo')
  ),
  (select id from test_service_location_ids where fixture = 'condo'),
  'the customer can delete their default location'
);

select results_eq(
  $$select id, is_default
    from public.service_locations$$,
  $$select id, true from test_service_location_ids where fixture = 'home'$$,
  'deleting the default promotes the oldest remaining location atomically'
);

reset role;

select results_eq(
  $$select action
    from public.audit_log
    where actor_user_id = '70000000-0000-0000-0000-000000000101'
      and entity_type = 'service_location'
    order by created_at, action$$,
  $$values
      ('service_location.created'::text),
      ('service_location.created'::text),
      ('service_location.created'::text),
      ('service_location.default_changed'::text),
      ('service_location.deleted'::text),
      ('service_location.deleted'::text),
      ('service_location.updated'::text)$$,
  'every successful location mutation appends an audit event'
);

select is(
  (
    select count(*)::integer
    from public.audit_log
    where actor_user_id = '70000000-0000-0000-0000-000000000101'
      and entity_type = 'service_location'
      and (
        metadata ? 'address_line'
        or metadata ? 'building'
        or metadata ? 'unit'
        or metadata ? 'access_instructions'
      )
  ),
  0,
  'audit metadata never stores exact address or access details'
);

select is(
  (
    select count(*)::integer
    from pg_proc as function
    where function.pronamespace = 'public'::regnamespace
      and function.proname = 'save_service_location'
      and function.proargnames @> array['customer_id']::text[]
  ),
  0,
  'the save RPC never accepts a caller-selected customer identity'
);

select is(
  (
    select count(*)::integer
    from public.service_locations
    where customer_id = '70000000-0000-0000-0000-000000000101'
      and is_default
  ),
  1,
  'the customer finishes with exactly one default while locations remain'
);

select * from finish();

rollback;
