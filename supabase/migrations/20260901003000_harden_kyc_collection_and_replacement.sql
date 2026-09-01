alter table public.technician_profiles
  add column kyc_notice_version text,
  add column kyc_notice_acknowledged_at timestamptz,
  add constraint technician_profile_kyc_notice_metadata check (
    (kyc_notice_version is null and kyc_notice_acknowledged_at is null)
    or (kyc_notice_version is not null and kyc_notice_acknowledged_at is not null)
  );

create or replace function private.current_kyc_notice_version()
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select '2026-08-31-v1'::text;
$$;

revoke all on function private.current_kyc_notice_version()
  from public, anon, authenticated;

-- The Phase 2B client accepts identity images only. Keep the bucket contract
-- aligned with the server boundary so a direct Storage client cannot bypass
-- the mobile MIME or size checks.
update storage.buckets
set file_size_limit = 6291456,
    allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'technician-documents';

create or replace function public.acknowledge_technician_kyc_notice()
returns public.technician_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.technician_profiles;
  v_notice_version text := private.current_kyc_notice_version();
begin
  if v_user_id is null or not private.is_active_account(v_user_id) then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if not public.has_account_role('technician') then
    raise exception 'Technician role required' using errcode = '42501';
  end if;

  select * into v_profile
  from public.technician_profiles
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Technician profile not found' using errcode = 'P0002';
  end if;
  if v_profile.verification_status <> 'draft' then
    raise exception 'Only a draft technician profile can acknowledge the KYC notice'
      using errcode = '22023';
  end if;

  if v_profile.kyc_notice_version is distinct from v_notice_version then
    perform set_config('homecare.kyc_workflow', 'on', true);
    update public.technician_profiles
    set kyc_notice_version = v_notice_version,
        kyc_notice_acknowledged_at = transaction_timestamp()
    where user_id = v_user_id
    returning * into v_profile;

    insert into public.audit_log (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      metadata
    ) values (
      v_user_id,
      'technician.kyc_notice_acknowledged',
      'technician_profile',
      v_user_id,
      jsonb_build_object('notice_version', v_notice_version)
    );
  end if;

  return v_profile;
end;
$$;

revoke all on function public.acknowledge_technician_kyc_notice()
  from public, anon;
grant execute on function public.acknowledge_technician_kyc_notice()
  to authenticated;

create or replace function private.can_register_technician_document(
  p_technician_id uuid,
  p_storage_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_technician_id is distinct from auth.uid()
    or not private.is_active_account(p_technician_id)
    or p_storage_path not like p_technician_id::text || '/%'
    or not exists (
      select 1
      from public.technician_profiles
      where user_id = p_technician_id
        and verification_status = 'draft'
        and kyc_notice_version = private.current_kyc_notice_version()
        and kyc_notice_acknowledged_at is not null
    ) then
    return false;
  end if;

  perform private.lock_technician_document_quota(p_technician_id);

  return (
    select count(*)
    from public.technician_documents
    where technician_id = p_technician_id
  ) < (
    select max_documents_per_technician
    from private.kyc_storage_configuration
    where singleton
  );
end;
$$;

create or replace function private.can_upload_technician_document(
  p_storage_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or not private.is_active_account(v_user_id)
    or p_storage_path not like v_user_id::text || '/%'
    or not exists (
      select 1
      from public.technician_profiles
      where user_id = v_user_id
        and verification_status = 'draft'
        and kyc_notice_version = private.current_kyc_notice_version()
        and kyc_notice_acknowledged_at is not null
    )
    or not exists (
      select 1
      from public.technician_documents
      where technician_id = v_user_id
        and storage_path = p_storage_path
        and review_status = 'pending'
    ) then
    return false;
  end if;

  perform private.lock_technician_document_quota(v_user_id);

  return (
    select count(*)
    from storage.objects
    where bucket_id = 'technician-documents'
      and (storage.foldername(name))[1] = v_user_id::text
  ) < (
    select max_documents_per_technician
    from private.kyc_storage_configuration
    where singleton
  );
end;
$$;

-- Storage deletion and profile submission take the same profile-row lock.
-- Whichever transaction wins forces the other to re-check committed state.
create or replace function public.can_delete_technician_document_file(
  p_storage_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status public.technician_verification_status;
begin
  if v_user_id is null
    or not private.is_active_account(v_user_id)
    or p_storage_path not like v_user_id::text || '/%' then
    return false;
  end if;

  if not exists (
    select 1
    from public.technician_documents
    where technician_id = v_user_id
      and storage_path = p_storage_path
  ) then
    return true;
  end if;

  select verification_status into v_status
  from public.technician_profiles
  where user_id = v_user_id
  for update;

  return v_status = 'draft'
    and exists (
      select 1
      from public.technician_documents
      where technician_id = v_user_id
        and storage_path = p_storage_path
        and review_status = 'pending'
    );
end;
$$;

create or replace function public.protect_technician_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.verification_status is distinct from old.verification_status
    or new.submitted_at is distinct from old.submitted_at
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.rejection_reason is distinct from old.rejection_reason
    or new.kyc_notice_version is distinct from old.kyc_notice_version
    or new.kyc_notice_acknowledged_at is distinct from old.kyc_notice_acknowledged_at then
    if current_setting('homecare.kyc_workflow', true) is distinct from 'on' then
      raise exception 'KYC workflow fields may only be changed through an audited workflow'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.protect_technician_document_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_status public.technician_verification_status;
begin
  if tg_op = 'DELETE' then
    select verification_status into v_profile_status
    from public.technician_profiles
    where user_id = old.technician_id;

    if old.review_status <> 'pending' or v_profile_status <> 'draft' then
      raise exception 'Submitted or reviewed technician documents are immutable';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
    or new.technician_id is distinct from old.technician_id
    or new.storage_path is distinct from old.storage_path
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Technician document identity fields are immutable';
  end if;

  if new.document_type is distinct from old.document_type then
    if current_setting('homecare.kyc_workflow', true) is distinct from 'on' then
      raise exception 'Document type may only be changed through an audited workflow'
        using errcode = '42501';
    end if;
  end if;

  if new.review_status is distinct from old.review_status
    or new.reviewed_at is distinct from old.reviewed_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.rejection_reason is distinct from old.rejection_reason then
    if current_setting('homecare.kyc_workflow', true) is distinct from 'on' then
      raise exception 'Document review fields may only be changed through an audited workflow'
        using errcode = '42501';
    end if;
  elsif not private.is_active_account(old.technician_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.promote_required_technician_document(
  p_current_document_id uuid,
  p_staged_document_id uuid,
  p_document_type public.technician_document_type
)
returns public.technician_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current public.technician_documents;
  v_staged public.technician_documents;
begin
  if v_user_id is null or not private.is_active_account(v_user_id) then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if p_document_type is null
    or p_document_type not in ('national_id', 'selfie') then
    raise exception 'Only a required document can be promoted' using errcode = '22023';
  end if;
  if p_current_document_id is not distinct from p_staged_document_id then
    raise exception 'Current and staged documents must differ' using errcode = '22023';
  end if;

  perform 1
  from public.technician_profiles
  where user_id = v_user_id
    and verification_status = 'draft'
    and kyc_notice_version = private.current_kyc_notice_version()
    and kyc_notice_acknowledged_at is not null
  for update;
  if not found then
    raise exception 'Acknowledged draft technician profile required' using errcode = '42501';
  end if;

  select * into v_current
  from public.technician_documents
  where id = p_current_document_id
    and technician_id = v_user_id
  for update;
  select * into v_staged
  from public.technician_documents
  where id = p_staged_document_id
    and technician_id = v_user_id
  for update;

  if v_current.id is null
    or v_current.document_type <> p_document_type
    or v_current.review_status <> 'pending' then
    raise exception 'Current required document is invalid' using errcode = '22023';
  end if;
  if v_staged.id is null
    or v_staged.document_type <> 'other'
    or v_staged.review_status <> 'pending' then
    raise exception 'Staged document is invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'technician-documents'
      and name = v_current.storage_path
  ) or not exists (
    select 1 from storage.objects
    where bucket_id = 'technician-documents'
      and name = v_staged.storage_path
  ) then
    raise exception 'Current and staged Storage objects are required' using errcode = '23514';
  end if;

  perform set_config('homecare.kyc_workflow', 'on', true);
  update public.technician_documents
  set document_type = 'other'
  where id = v_current.id;

  update public.technician_documents
  set document_type = p_document_type
  where id = v_staged.id
  returning * into v_staged;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_user_id,
    'technician.document_replaced',
    'technician_document',
    v_staged.id,
    jsonb_build_object(
      'replaced_document_id', v_current.id,
      'document_type', p_document_type
    )
  );

  return v_staged;
end;
$$;

revoke all on function public.promote_required_technician_document(
  uuid,
  uuid,
  public.technician_document_type
) from public, anon;
grant execute on function public.promote_required_technician_document(
  uuid,
  uuid,
  public.technician_document_type
) to authenticated;

revoke update on public.technician_documents from authenticated;

create or replace function public.submit_technician_profile()
returns public.technician_verification_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status public.technician_verification_status;
  v_notice_version text;
  v_notice_acknowledged_at timestamptz;
begin
  if v_user_id is null or not private.is_active_account(v_user_id) then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if not public.has_account_role('technician') then
    raise exception 'Technician role required' using errcode = '42501';
  end if;

  select verification_status, kyc_notice_version, kyc_notice_acknowledged_at
  into v_status, v_notice_version, v_notice_acknowledged_at
  from public.technician_profiles
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Technician profile not found' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft technician profile can be submitted' using errcode = '22023';
  end if;
  if v_notice_version is distinct from private.current_kyc_notice_version()
    or v_notice_acknowledged_at is null then
    raise exception 'Current KYC notice acknowledgement is required' using errcode = '23514';
  end if;
  if not public.has_required_technician_documents(v_user_id) then
    raise exception 'National ID and selfie documents are required' using errcode = '23514';
  end if;

  perform set_config('homecare.kyc_workflow', 'on', true);
  update public.technician_profiles
  set verification_status = 'pending_review',
      submitted_at = transaction_timestamp()
  where user_id = v_user_id
  returning verification_status into v_status;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_user_id,
    'technician.profile_submitted',
    'technician_profile',
    v_user_id,
    jsonb_build_object(
      'to', v_status,
      'kyc_notice_version', v_notice_version
    )
  );

  return v_status;
end;
$$;
