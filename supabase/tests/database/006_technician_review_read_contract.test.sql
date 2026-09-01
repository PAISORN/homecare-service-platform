begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
values
  ('60000000-0000-0000-0000-000000000101', 'review-contract-customer@example.test', '{"display_name":"Review customer"}'),
  ('60000000-0000-0000-0000-000000000201', 'review-contract-pending@example.test', '{"display_name":"Pending technician"}'),
  ('60000000-0000-0000-0000-000000000202', 'review-contract-draft@example.test', '{"display_name":"Draft technician"}'),
  ('60000000-0000-0000-0000-000000000203', 'review-contract-other@example.test', '{"display_name":"Other technician"}'),
  ('60000000-0000-0000-0000-000000000301', 'review-contract-reviewer@example.test', '{"display_name":"Technician reviewer"}'),
  ('60000000-0000-0000-0000-000000000302', 'review-contract-catalog@example.test', '{"display_name":"Catalog administrator"}');

insert into public.account_roles (user_id, role)
values
  ('60000000-0000-0000-0000-000000000201', 'technician'),
  ('60000000-0000-0000-0000-000000000202', 'technician'),
  ('60000000-0000-0000-0000-000000000203', 'technician'),
  ('60000000-0000-0000-0000-000000000301', 'administrator'),
  ('60000000-0000-0000-0000-000000000302', 'administrator');

insert into public.admin_permissions (user_id, permission)
values
  ('60000000-0000-0000-0000-000000000301', 'technician_review'),
  ('60000000-0000-0000-0000-000000000302', 'catalog_management');

insert into public.technician_profiles (
  user_id,
  bio,
  verification_status,
  submitted_at,
  rejection_reason,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values
  (
    '60000000-0000-0000-0000-000000000201',
    'รอตรวจสอบ',
    'pending_review',
    transaction_timestamp() - interval '1 hour',
    null,
    '2026-08-31-v1',
    transaction_timestamp() - interval '2 hours'
  ),
  (
    '60000000-0000-0000-0000-000000000202',
    'ยังเป็นแบบร่าง',
    'draft',
    null,
    null,
    '2026-08-31-v1',
    transaction_timestamp()
  ),
  (
    '60000000-0000-0000-0000-000000000203',
    'ประวัติของช่างอื่น',
    'rejected',
    transaction_timestamp() - interval '2 days',
    'เอกสารไม่ผ่าน',
    '2026-08-31-v1',
    transaction_timestamp() - interval '3 days'
  );

insert into public.technician_documents (
  id,
  technician_id,
  document_type,
  storage_path
)
values
  (
    '61000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000201',
    'national_id',
    '60000000-0000-0000-0000-000000000201/national-id.jpg'
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000201',
    'selfie',
    '60000000-0000-0000-0000-000000000201/selfie.jpg'
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    '60000000-0000-0000-0000-000000000202',
    'other',
    '60000000-0000-0000-0000-000000000202/draft.jpg'
  );

insert into storage.objects (bucket_id, name, owner_id)
values
  (
    'technician-documents',
    '60000000-0000-0000-0000-000000000201/national-id.jpg',
    '60000000-0000-0000-0000-000000000201'
  ),
  (
    'technician-documents',
    '60000000-0000-0000-0000-000000000201/selfie.jpg',
    '60000000-0000-0000-0000-000000000201'
  ),
  (
    'technician-documents',
    '60000000-0000-0000-0000-000000000202/draft.jpg',
    '60000000-0000-0000-0000-000000000202'
  );

insert into public.audit_log (
  id,
  actor_user_id,
  action,
  entity_type,
  entity_id,
  metadata,
  created_at
)
values
  (
    '62000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000201',
    'technician.profile_submitted',
    'technician_profile',
    '60000000-0000-0000-0000-000000000201',
    '{"to":"pending_review","secret":"must-not-be-returned"}',
    transaction_timestamp() - interval '1 hour'
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000301',
    'technician.document_reviewed',
    'technician_document',
    '61000000-0000-0000-0000-000000000001',
    '{"technician_id":"60000000-0000-0000-0000-000000000201","decision":"rejected","reason":"ภาพไม่ชัด","secret":"must-not-be-returned"}',
    transaction_timestamp()
  ),
  (
    '62000000-0000-0000-0000-000000000003',
    '60000000-0000-0000-0000-000000000203',
    'technician.profile_submitted',
    'technician_profile',
    '60000000-0000-0000-0000-000000000203',
    '{"to":"pending_review"}',
    transaction_timestamp()
  ),
  (
    '62000000-0000-0000-0000-000000000004',
    '60000000-0000-0000-0000-000000000201',
    'unrelated.sensitive_event',
    'technician_profile',
    '60000000-0000-0000-0000-000000000201',
    '{"secret":"must-not-be-returned"}',
    transaction_timestamp()
  );

select ok(
  not has_function_privilege(
    'anon',
    'public.list_pending_technician_applications()',
    'EXECUTE'
  ),
  'anonymous callers cannot execute the review queue RPC'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000101', true);

select throws_ok(
  $$select * from public.list_pending_technician_applications()$$,
  'Technician review permission required',
  'a customer cannot list pending technician applications'
);

select throws_ok(
  $$select * from public.list_technician_review_history(
      '60000000-0000-0000-0000-000000000201'
    )$$,
  'Technician review permission required',
  'a customer cannot read scoped review history'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000302', true);

select throws_ok(
  $$select * from public.get_technician_review_application(
      '60000000-0000-0000-0000-000000000201'
    )$$,
  'Pending technician review access required',
  'an administrator without technician_review cannot inspect the application'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-000000000301', true);

select results_eq(
  $$select
      technician_id,
      display_name,
      document_count,
      pending_document_count,
      reviewed_document_count
    from public.list_pending_technician_applications()$$,
  $$values (
      '60000000-0000-0000-0000-000000000201'::uuid,
      'Pending technician'::text,
      2::bigint,
      2::bigint,
      0::bigint
    )$$,
  'the review queue returns only active pending applications and safe counts'
);

select results_eq(
  $$select
      technician_id,
      display_name,
      bio,
      verification_status::text,
      kyc_notice_version
    from public.get_technician_review_application(
      '60000000-0000-0000-0000-000000000201'
    )$$,
  $$values (
      '60000000-0000-0000-0000-000000000201'::uuid,
      'Pending technician'::text,
      'รอตรวจสอบ'::text,
      'pending_review'::text,
      '2026-08-31-v1'::text
    )$$,
  'the application RPC returns the minimal pending-review profile shape'
);

select throws_ok(
  $$select * from public.get_technician_review_application(
      '60000000-0000-0000-0000-000000000202'
    )$$,
  'Pending technician review access required',
  'a reviewer cannot inspect a draft application through the review RPC'
);

select results_eq(
  $$select document_id, document_type::text, storage_path
    from public.list_technician_review_documents(
      '60000000-0000-0000-0000-000000000201'
    )$$,
  $$values
      (
        '61000000-0000-0000-0000-000000000001'::uuid,
        'national_id'::text,
        '60000000-0000-0000-0000-000000000201/national-id.jpg'::text
      ),
      (
        '61000000-0000-0000-0000-000000000002'::uuid,
        'selfie'::text,
        '60000000-0000-0000-0000-000000000201/selfie.jpg'::text
      )$$,
  'the document RPC returns only documents for the selected pending application'
);

select is(
  (select count(*)::integer from public.profiles
   where id in (
     '60000000-0000-0000-0000-000000000201',
     '60000000-0000-0000-0000-000000000202'
   )),
  1,
  'raw profile RLS exposes the pending target but not an unrelated draft technician'
);

select is(
  (select count(*)::integer from public.technician_documents),
  2,
  'raw document RLS exposes only documents for pending review targets'
);

select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'technician-documents'),
  2,
  'Storage SELECT permits only registered objects for pending review targets'
);

select is(
  (select count(*)::integer from public.audit_log),
  0,
  'technician_review does not grant global audit_log access'
);

select results_eq(
  $$select action, decision, reason
    from public.list_technician_review_history(
      '60000000-0000-0000-0000-000000000201'
    )$$,
  $$values
      ('technician.profile_submitted'::text, null::text, null::text),
      ('technician.document_reviewed'::text, 'rejected'::text, 'ภาพไม่ชัด'::text)$$,
  'scoped history returns only allowlisted events and safe metadata fields'
);

select is(
  (
    select array_agg(argument.name::text order by argument.ordinality)
    from pg_proc as function
    cross join unnest(function.proargnames, function.proargmodes)
      with ordinality as argument(name, mode, ordinality)
    where function.pronamespace = 'public'::regnamespace
      and function.proname = 'list_technician_review_history'
      and argument.mode = 't'
  ),
  array[
    'event_id',
    'action',
    'entity_type',
    'decision',
    'reason',
    'created_at'
  ]::text[],
  'the history RPC omits actor identifiers and raw audit metadata'
);

select throws_ok(
  $$select * from public.list_technician_review_history(
      '60000000-0000-0000-0000-000000000101'
    )$$,
  'Technician review permission required',
  'scoped history rejects a non-technician target'
);

select * from finish();
rollback;
