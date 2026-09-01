-- Serialize both database registration and Storage upload quota decisions by
-- technician. This closes the read-count/write race without changing the
-- Supabase-managed storage schema.
create or replace function private.lock_technician_document_quota(
  p_technician_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(
    hashtextextended(
      'homecare:technician-document-quota:' || p_technician_id::text,
      0
    )
  );
$$;

revoke all on function private.lock_technician_document_quota(uuid)
  from public, anon, authenticated;

create or replace function private.enforce_technician_document_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  perform private.lock_technician_document_quota(new.technician_id);

  select max_documents_per_technician
  into strict v_limit
  from private.kyc_storage_configuration
  where singleton;

  select count(*)::integer
  into v_count
  from public.technician_documents
  where technician_id = new.technician_id;

  if v_count >= v_limit then
    raise exception 'Technician document quota exceeded'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_technician_document_quota()
  from public, anon, authenticated;

create trigger technician_documents_enforce_quota
before insert on public.technician_documents
for each row execute function private.enforce_technician_document_quota();

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

-- Reviewers may resolve a profile only for an active target account. A
-- verification decision additionally requires every submitted document to be
-- resolved and both required document types to be approved. Rejected optional
-- documents are deliberately allowed.
create or replace function public.review_technician_document(
  p_document_id uuid,
  p_decision public.document_review_status,
  p_reason text default null
)
returns public.technician_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_technician_id uuid;
  v_profile_status public.technician_verification_status;
  v_document public.technician_documents;
begin
  if v_actor is null or not private.has_admin_permission('technician_review', v_actor) then
    raise exception 'Technician review permission required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_decision = 'approved' and nullif(trim(p_reason), '') is not null then
    raise exception 'Approval reason must be empty' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(trim(p_reason), '') is null then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;

  select technician_id
  into v_technician_id
  from public.technician_documents
  where id = p_document_id;

  if not found then
    raise exception 'Technician document not found' using errcode = 'P0002';
  end if;

  select verification_status
  into v_profile_status
  from public.technician_profiles
  where user_id = v_technician_id
  for update;

  if not private.is_active_account(v_technician_id) then
    raise exception 'Target technician account must be active' using errcode = '42501';
  end if;

  select *
  into v_document
  from public.technician_documents
  where id = p_document_id
    and technician_id = v_technician_id
  for update;

  if v_profile_status <> 'pending_review' then
    raise exception 'Technician profile must be pending review' using errcode = '22023';
  end if;
  if v_document.review_status <> 'pending' then
    raise exception 'Only a pending document can be reviewed' using errcode = '22023';
  end if;

  perform set_config('homecare.kyc_workflow', 'on', true);
  update public.technician_documents
  set review_status = p_decision,
      reviewed_at = transaction_timestamp(),
      reviewed_by = v_actor,
      rejection_reason = case when p_decision = 'rejected' then trim(p_reason) else null end
  where id = p_document_id
  returning * into v_document;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'technician.document_reviewed',
    'technician_document',
    p_document_id,
    jsonb_build_object(
      'technician_id', v_technician_id,
      'decision', p_decision,
      'reason', case when p_decision = 'rejected' then trim(p_reason) else null end
    )
  );

  return v_document;
end;
$$;

create or replace function public.decide_technician_profile(
  p_technician_id uuid,
  p_decision public.technician_verification_status,
  p_reason text default null
)
returns public.technician_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.technician_profiles;
begin
  if v_actor is null or not private.has_admin_permission('technician_review', v_actor) then
    raise exception 'Technician review permission required' using errcode = '42501';
  end if;
  if p_decision not in ('verified', 'rejected') then
    raise exception 'Decision must be verified or rejected' using errcode = '22023';
  end if;
  if p_decision = 'verified' and nullif(trim(p_reason), '') is not null then
    raise exception 'Verification reason must be empty' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(trim(p_reason), '') is null then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;

  select *
  into v_profile
  from public.technician_profiles
  where user_id = p_technician_id
  for update;

  if not found then
    raise exception 'Technician profile not found' using errcode = 'P0002';
  end if;
  if not private.is_active_account(p_technician_id) then
    raise exception 'Target technician account must be active' using errcode = '42501';
  end if;
  if v_profile.verification_status <> 'pending_review' then
    raise exception 'Technician profile must be pending review' using errcode = '22023';
  end if;
  if p_decision = 'verified' and exists (
    select 1
    from public.technician_documents
    where technician_id = p_technician_id
      and review_status = 'pending'
  ) then
    raise exception 'All technician documents must be reviewed'
      using errcode = '23514';
  end if;
  if p_decision = 'verified' and not (
    exists (
      select 1
      from public.technician_documents
      where technician_id = p_technician_id
        and document_type = 'national_id'
        and review_status = 'approved'
    )
    and exists (
      select 1
      from public.technician_documents
      where technician_id = p_technician_id
        and document_type = 'selfie'
        and review_status = 'approved'
    )
  ) then
    raise exception 'Approved national ID and selfie documents are required'
      using errcode = '23514';
  end if;

  perform set_config('homecare.kyc_workflow', 'on', true);
  update public.technician_profiles
  set verification_status = p_decision,
      verified_at = case when p_decision = 'verified' then transaction_timestamp() else null end,
      verified_by = case when p_decision = 'verified' then v_actor else null end,
      rejection_reason = case when p_decision = 'rejected' then trim(p_reason) else null end
  where user_id = p_technician_id
  returning * into v_profile;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'technician.profile_decided',
    'technician_profile',
    p_technician_id,
    jsonb_build_object(
      'decision', p_decision,
      'reason', case when p_decision = 'rejected' then trim(p_reason) else null end
    )
  );

  return v_profile;
end;
$$;

-- A technician is discoverable only while both verified and active. Reviewers
-- retain access to technician targets, including retained/deactivated records,
-- but no longer receive blanket access to customer profiles.
create or replace function private.user_has_account_role(
  p_user_id uuid,
  p_role public.account_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_roles
    where user_id = p_user_id
      and role = p_role
  );
$$;

revoke all on function private.user_has_account_role(uuid, public.account_role)
  from public, anon, authenticated;
grant execute on function private.user_has_account_role(uuid, public.account_role)
  to authenticated;

drop policy "profiles_select_authorized" on public.profiles;
create policy "profiles_select_authorized"
on public.profiles for select to authenticated
using (
  private.is_active_account()
  and (
    id = (select auth.uid())
    or private.has_admin_permission('role_management')
    or (
      private.has_admin_permission('technician_review')
      and private.user_has_account_role(profiles.id, 'technician')
    )
  )
);

drop policy "technician_profiles_select_authorized" on public.technician_profiles;
create policy "technician_profiles_select_authorized"
on public.technician_profiles for select to authenticated
using (
  private.is_active_account()
  and (
    user_id = (select auth.uid())
    or private.has_admin_permission('technician_review')
    or (
      verification_status = 'verified'
      and private.is_active_account(user_id)
    )
  )
);

drop policy "technician_skills_select_authorized" on public.technician_skills;
create policy "technician_skills_select_authorized"
on public.technician_skills for select to authenticated
using (
  private.is_active_account()
  and (
    technician_id = (select auth.uid())
    or private.has_admin_permission('technician_review')
    or exists (
      select 1
      from public.technician_profiles
      where user_id = technician_id
        and verification_status = 'verified'
        and private.is_active_account(user_id)
    )
  )
);

create or replace function public.list_public_technicians()
returns table (
  technician_id uuid,
  display_name text,
  avatar_path text,
  bio text,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    profile.avatar_path,
    technician.bio,
    technician.verified_at
  from public.profiles as profile
  join public.technician_profiles as technician
    on technician.user_id = profile.id
  where profile.account_status = 'active'
    and technician.verification_status = 'verified';
$$;

revoke all on function public.list_public_technicians() from public;
grant execute on function public.list_public_technicians() to anon, authenticated;

-- Role lifecycle changes are security-sensitive, including self-enrolment.
-- Record both trusted and user-initiated operations; actor_user_id is null only
-- for system/bootstrap activity with no authenticated actor.
create or replace function public.audit_account_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := case when tg_op = 'INSERT' then new.user_id else old.user_id end;
  v_role public.account_role := case when tg_op = 'INSERT' then new.role else old.role end;
  v_operation text := case when tg_op = 'INSERT' then 'insert' else 'delete' end;
begin
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'account.role_assigned' else 'account.role_removed' end,
    'account_role',
    v_target,
    jsonb_build_object(
      'target_user_id', v_target,
      'role', v_role,
      'operation', v_operation
    )
  );

  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

create trigger account_roles_audit_change
after insert or delete on public.account_roles
for each row execute function public.audit_account_role_change();

create or replace function public.block_profile_hard_delete_with_kyc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.technician_documents
    where technician_id = old.id
  ) or exists (
    select 1
    from storage.objects
    where bucket_id = 'technician-documents'
      and (storage.foldername(name))[1] = old.id::text
  ) then
    raise exception 'Hard delete blocked: KYC retention policy is not approved'
      using errcode = '55000';
  end if;
  return old;
end;
$$;
