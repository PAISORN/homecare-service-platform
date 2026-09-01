begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

select is(
  (select file_size_limit from storage.buckets where id = 'technician-documents'),
  6291456::bigint,
  'KYC bucket enforces the six MiB server limit'
);

select results_eq(
  $$select mime_type
    from unnest(
      (select allowed_mime_types from storage.buckets where id = 'technician-documents')
    ) as mime_type
    order by mime_type$$,
  $$values ('image/jpeg'::text), ('image/png'::text)$$,
  'KYC bucket accepts only the Phase 2B image MIME types'
);

insert into auth.users (id, email, raw_user_meta_data)
values (
  '50000000-0000-0000-0000-000000000201',
  'kyc-contract@example.test',
  '{"display_name":"KYC contract technician"}'
);

insert into public.account_roles (user_id, role)
values ('50000000-0000-0000-0000-000000000201', 'technician');

insert into public.technician_profiles (user_id)
values ('50000000-0000-0000-0000-000000000201');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '50000000-0000-0000-0000-000000000201',
  true
);

select throws_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values (
      '50000000-0000-0000-0000-000000000201',
      'national_id',
      '50000000-0000-0000-0000-000000000201/before-notice.jpg'
    )$$,
  'new row violates row-level security policy for table "technician_documents"',
  'a technician cannot reserve KYC storage before acknowledging the current notice'
);

select lives_ok(
  $$select public.acknowledge_technician_kyc_notice()$$,
  'a draft technician can acknowledge the server-versioned KYC notice'
);

select is(
  (
    select kyc_notice_version
    from public.technician_profiles
    where user_id = '50000000-0000-0000-0000-000000000201'
  ),
  '2026-08-31-v1',
  'the server records the current KYC notice version'
);

select ok(
  (
    select kyc_notice_acknowledged_at is not null
    from public.technician_profiles
    where user_id = '50000000-0000-0000-0000-000000000201'
  ),
  'the server records when the current KYC notice was acknowledged'
);

select throws_ok(
  $$update public.technician_profiles
    set kyc_notice_version = 'client-forged'
    where user_id = '50000000-0000-0000-0000-000000000201'$$,
  'permission denied for table technician_profiles',
  'the mobile role cannot forge KYC notice metadata'
);

select lives_ok(
  $$insert into public.technician_documents (
      id, technician_id, document_type, storage_path
    ) values
      (
        '51000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000201',
        'national_id',
        '50000000-0000-0000-0000-000000000201/current-national-id.jpg'
      ),
      (
        '51000000-0000-0000-0000-000000000002',
        '50000000-0000-0000-0000-000000000201',
        'other',
        '50000000-0000-0000-0000-000000000201/staged-national-id.jpg'
      )$$,
  'the acknowledged technician can reserve current and staged document paths'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values
      (
        'technician-documents',
        '50000000-0000-0000-0000-000000000201/current-national-id.jpg',
        '50000000-0000-0000-0000-000000000201'
      ),
      (
        'technician-documents',
        '50000000-0000-0000-0000-000000000201/staged-national-id.jpg',
        '50000000-0000-0000-0000-000000000201'
      )$$,
  'Storage accepts only the acknowledged registered paths'
);

select lives_ok(
  $$select public.promote_required_technician_document(
      '51000000-0000-0000-0000-000000000001',
      '51000000-0000-0000-0000-000000000002',
      'national_id'
    )$$,
  'the audited RPC promotes a fully uploaded staged document atomically'
);

select is(
  (
    select document_type::text
    from public.technician_documents
    where id = '51000000-0000-0000-0000-000000000001'
  ),
  'other',
  'the replaced document remains an owned optional row until Storage cleanup'
);

select is(
  (
    select document_type::text
    from public.technician_documents
    where id = '51000000-0000-0000-0000-000000000002'
  ),
  'national_id',
  'the staged document becomes the sole required document'
);

select throws_ok(
  $$update public.technician_documents
    set document_type = 'selfie'
    where id = '51000000-0000-0000-0000-000000000002'$$,
  'permission denied for table technician_documents',
  'the mobile role cannot bypass the audited replacement RPC'
);

select throws_ok(
  $$select public.promote_required_technician_document(
      '51000000-0000-0000-0000-000000000002',
      '51000000-0000-0000-0000-000000000001',
      'professional_certificate'
    )$$,
  'Only a required document can be promoted',
  'the replacement RPC rejects optional target types'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.audit_log
    where actor_user_id = '50000000-0000-0000-0000-000000000201'
      and action = 'technician.kyc_notice_acknowledged'
      and metadata ->> 'notice_version' = '2026-08-31-v1'
  ),
  1,
  'KYC notice acknowledgement creates a versioned audit event'
);

select is(
  (
    select count(*)::integer
    from public.audit_log
    where actor_user_id = '50000000-0000-0000-0000-000000000201'
      and action = 'technician.document_replaced'
      and metadata ->> 'document_type' = 'national_id'
  ),
  1,
  'document replacement creates a non-sensitive audit event'
);

select * from finish();
rollback;
