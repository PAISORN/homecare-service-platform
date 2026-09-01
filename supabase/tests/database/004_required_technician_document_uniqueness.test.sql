begin;

create extension if not exists pgtap with schema extensions;

select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
values (
  '40000000-0000-0000-0000-000000000201',
  'required-document-uniqueness@example.test',
  '{"display_name":"Required document uniqueness"}'
);

insert into public.account_roles (user_id, role)
values ('40000000-0000-0000-0000-000000000201', 'technician');

insert into public.technician_profiles (
  user_id,
  kyc_notice_version,
  kyc_notice_acknowledged_at
)
values (
  '40000000-0000-0000-0000-000000000201',
  '2026-08-31-v1',
  transaction_timestamp()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '40000000-0000-0000-0000-000000000201',
  true
);

select lives_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values (
      '40000000-0000-0000-0000-000000000201',
      'national_id',
      '40000000-0000-0000-0000-000000000201/national-id-front.jpg'
    )$$,
  'technician can register the first national ID'
);

select throws_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values (
      '40000000-0000-0000-0000-000000000201',
      'national_id',
      '40000000-0000-0000-0000-000000000201/national-id-duplicate.jpg'
    )$$,
  '23505',
  null,
  'technician cannot register a second national ID'
);

select lives_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values (
      '40000000-0000-0000-0000-000000000201',
      'selfie',
      '40000000-0000-0000-0000-000000000201/selfie.jpg'
    )$$,
  'technician can register the first selfie'
);

select throws_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values (
      '40000000-0000-0000-0000-000000000201',
      'selfie',
      '40000000-0000-0000-0000-000000000201/selfie-duplicate.jpg'
    )$$,
  '23505',
  null,
  'technician cannot register a second selfie'
);

select lives_ok(
  $$insert into public.technician_documents (
      technician_id, document_type, storage_path
    ) values
      (
        '40000000-0000-0000-0000-000000000201',
        'professional_certificate',
        '40000000-0000-0000-0000-000000000201/certificate-one.pdf'
      ),
      (
        '40000000-0000-0000-0000-000000000201',
        'professional_certificate',
        '40000000-0000-0000-0000-000000000201/certificate-two.pdf'
      )$$,
  'technician can register multiple professional certificates'
);

select is(
  (
    select count(*)::integer
    from public.technician_documents
    where technician_id = '40000000-0000-0000-0000-000000000201'
      and document_type = 'professional_certificate'
  ),
  2,
  'both professional certificates are retained'
);

select * from finish();
rollback;
