begin;

create extension if not exists pgtap with schema extensions;

select plan(29);

insert into auth.users (id, email)
values
  ('e0000000-0000-0000-0000-000000000101', 'chat-customer@example.test'),
  ('e0000000-0000-0000-0000-000000000102', 'chat-other@example.test'),
  ('e0000000-0000-0000-0000-000000000201', 'chat-tech@example.test');

update public.profiles
set display_name = case id
  when 'e0000000-0000-0000-0000-000000000101' then 'ลูกค้าทดสอบแชต'
  when 'e0000000-0000-0000-0000-000000000201' then 'ช่างทดสอบแชต'
  else display_name
end
where id in (
  'e0000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000201'
);

insert into public.account_roles (user_id, role)
values ('e0000000-0000-0000-0000-000000000201', 'technician');

insert into public.technician_profiles (
  user_id, bio, verification_status
) values (
  'e0000000-0000-0000-0000-000000000201',
  'ช่างสำหรับทดสอบแชตในงานบริการ',
  'draft'
);

insert into public.service_locations (
  id, customer_id, label, address_line, is_default
) values (
  'e1000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'บ้านทดสอบแชต', '66/66 ถนนทดสอบ กรุงเทพมหานคร 10110', true
);

insert into public.service_requests (
  id, customer_id, service_location_id, service_category_id,
  entry_point, status, problem_description, quantity, urgency
)
select
  'e2000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'e1000000-0000-0000-0000-000000000101',
  category.id,
  'symptom', 'technician_selected', 'แอร์ไม่เย็นสำหรับทดสอบแชต', 1, 'flexible'
from public.service_categories as category
where category.code = 'AIR-CONDITIONING';

insert into public.service_jobs (
  id, job_number, service_request_id, customer_id, technician_id,
  service_category_id, agreement_revision, price_model, scope_description,
  labor_amount, currency, labor_commission_rate
)
select
  'e3000000-0000-0000-0000-000000000101',
  'HC-20260909-910001',
  'e2000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000101',
  'e0000000-0000-0000-0000-000000000201',
  category.id,
  1, 'evidence_quote', 'ตรวจและล้างเครื่องปรับอากาศหนึ่งเครื่อง',
  800, 'THB', 0.15
from public.service_categories as category
where category.code = 'AIR-CONDITIONING';

insert into public.appointments (
  service_job_id, scheduled_date, time_window, service_location_id,
  location_label, address_line
) values (
  'e3000000-0000-0000-0000-000000000101', current_date + 1, '09:00–12:00',
  'e1000000-0000-0000-0000-000000000101', 'บ้านทดสอบแชต',
  '66/66 ถนนทดสอบ กรุงเทพมหานคร 10110'
);

select is(
  (select count(*)::integer from public.chat_rooms
   where service_job_id = 'e3000000-0000-0000-0000-000000000101'),
  1,
  'creating a service job creates one chat room'
);

select is(
  (select count(*)::integer from public.chat_room_memberships),
  2,
  'creating a service job creates customer and technician memberships'
);

select is(
  (select count(*)::integer from public.chat_room_memberships
   where member_role = 'customer'),
  1,
  'chat room records the customer membership role'
);

select is(
  (select count(*)::integer from public.chat_room_memberships
   where member_role = 'technician'),
  1,
  'chat room records the technician membership role'
);

select is(
  (select count(*)::integer from pg_catalog.pg_class
   where oid in (
     'public.chat_rooms'::regclass,
     'public.chat_room_memberships'::regclass,
     'public.chat_messages'::regclass
   ) and relrowsecurity),
  3,
  'all public chat tables have row-level security enabled'
);

select is(
  (select count(*)::integer from pg_catalog.pg_policies
   where schemaname = 'realtime' and tablename = 'messages'
     and policyname = 'chat_members_receive_broadcast'),
  1,
  'private Broadcast has a member-only receive policy'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000101', true);

select is((select count(*)::integer from public.chat_rooms), 1,
  'customer reads the participating chat room');
select is((select count(*)::integer from public.chat_room_memberships), 1,
  'customer reads only their own membership');

select lives_ok(
  $$select public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000101',
    '  สวัสดีครับ ช่างจะเข้าตามเวลานัดไหมครับ  '
  )$$,
  'customer sends a durable message to the service job chat'
);

select is((select body from public.chat_messages limit 1),
  'สวัสดีครับ ช่างจะเข้าตามเวลานัดไหมครับ',
  'message body is trimmed before storage');
select is((select sender_user_id from public.chat_messages limit 1),
  'e0000000-0000-0000-0000-000000000101'::uuid,
  'sender identity always comes from the authenticated user');
select is((select count(*)::integer from public.chat_messages), 1,
  'customer reads the durable message from the participating room');

select is(
  (select id from public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000101',
    'สวัสดีครับ ช่างจะเข้าตามเวลานัดไหมครับ'
  )),
  (select id from public.chat_messages limit 1),
  'retrying the same client message ID returns the existing message'
);
select is((select count(*)::integer from public.chat_messages), 1,
  'an idempotent retry does not duplicate the message');

select throws_ok(
  $$select public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000101',
    'ข้อความอื่นที่ใช้รหัสเดิม'
  )$$,
  'Client message ID already used',
  'a client message ID cannot be reused for different content'
);
select throws_ok(
  $$select public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000102', '   '
  )$$,
  'Message body must contain 1 to 2000 characters',
  'blank messages are rejected'
);
select throws_ok(
  $$select public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000103', repeat('ก', 2001)
  )$$,
  'Message body must contain 1 to 2000 characters',
  'messages longer than 2000 characters are rejected'
);
select throws_ok(
  $$insert into public.chat_messages (
    chat_room_id, sender_user_id, client_message_id, body
  ) select id,
    'e0000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000104',
    'พยายามข้าม RPC'
  from public.chat_rooms$$,
  'permission denied for table chat_messages',
  'authenticated users cannot insert messages directly'
);

select ok(
  private.can_receive_chat_broadcast(
    'service-job-chat:e3000000-0000-0000-0000-000000000101'
  ),
  'customer is authorized for the private Broadcast topic'
);

reset role;
select is(
  (select count(*)::integer from realtime.messages
   where topic = 'service-job-chat:e3000000-0000-0000-0000-000000000101'
     and event = 'message_created'),
  1,
  'durable message insert emits one private Broadcast event'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000201', true);
select is((select count(*)::integer from public.chat_messages), 1,
  'assigned technician reads customer messages');
select is(
  (select body from public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000201',
    'เข้าตามเวลานัดครับ'
  )),
  'เข้าตามเวลานัดครับ',
  'assigned technician replies through the RPC'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000101', true);
select is((select count(*)::integer from public.chat_messages), 2,
  'customer reads both sides of the conversation');
select throws_ok(
  $$update public.chat_messages set body = 'แก้ไขย้อนหลัง'$$,
  'permission denied for table chat_messages',
  'messages cannot be edited directly'
);
select throws_ok(
  $$delete from public.chat_messages$$,
  'permission denied for table chat_messages',
  'messages cannot be deleted directly'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000102', true);
select is((select count(*)::integer from public.chat_messages), 0,
  'unrelated customer cannot read service job messages');
select is((select count(*)::integer from public.chat_rooms), 0,
  'unrelated customer cannot discover the chat room or private topic');
select throws_ok(
  $$select public.send_service_job_message(
    'e3000000-0000-0000-0000-000000000101',
    'e4000000-0000-0000-0000-000000000301',
    'พยายามส่งข้อความไปยังงานของผู้อื่น'
  )$$,
  'Service job not found',
  'unrelated customer cannot send to the service job'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.chat_messages$$,
  'permission denied for table chat_messages',
  'anonymous users cannot read durable chat messages'
);

select * from finish();
rollback;
