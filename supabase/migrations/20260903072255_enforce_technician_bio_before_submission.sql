create or replace function public.submit_technician_profile()
returns public.technician_verification_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status public.technician_verification_status;
  v_bio text;
  v_notice_version text;
  v_notice_acknowledged_at timestamptz;
begin
  if v_user_id is null or not private.is_active_account(v_user_id) then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if not public.has_account_role('technician') then
    raise exception 'Technician role required' using errcode = '42501';
  end if;

  select verification_status, bio, kyc_notice_version, kyc_notice_acknowledged_at
  into v_status, v_bio, v_notice_version, v_notice_acknowledged_at
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
  if char_length(btrim(coalesce(v_bio, ''))) not between 20 and 500 then
    raise exception 'Technician bio must contain 20 to 500 characters' using errcode = '23514';
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
