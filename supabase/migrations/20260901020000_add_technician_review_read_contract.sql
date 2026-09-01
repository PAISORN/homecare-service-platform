-- Phase 2C gives technician reviewers a purpose-built, least-privilege read
-- contract. The existing audited decision RPCs remain authoritative.

create or replace function private.can_review_technician_application(
  p_technician_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_admin_permission('technician_review', auth.uid())
    and private.is_active_account(p_technician_id)
    and exists (
      select 1
      from public.technician_profiles
      where user_id = p_technician_id
        and verification_status = 'pending_review'
    );
$$;

create or replace function private.can_review_technician_document_file(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_admin_permission('technician_review', auth.uid())
    and exists (
      select 1
      from public.technician_documents as document
      join public.technician_profiles as technician
        on technician.user_id = document.technician_id
      join public.profiles as profile
        on profile.id = technician.user_id
      where document.storage_path = p_storage_path
        and technician.verification_status = 'pending_review'
        and profile.account_status = 'active'
    );
$$;

revoke all on function private.can_review_technician_application(uuid)
  from public, anon, authenticated;
revoke all on function private.can_review_technician_document_file(text)
  from public, anon, authenticated;
grant execute on function private.can_review_technician_application(uuid)
  to authenticated;
grant execute on function private.can_review_technician_document_file(text)
  to authenticated;

drop policy "profiles_select_authorized" on public.profiles;
create policy "profiles_select_authorized"
on public.profiles for select to authenticated
using (
  private.is_active_account()
  and (
    id = (select auth.uid())
    or private.has_admin_permission('role_management')
    or private.can_review_technician_application(profiles.id)
  )
);

drop policy "technician_profiles_select_authorized" on public.technician_profiles;
create policy "technician_profiles_select_authorized"
on public.technician_profiles for select to authenticated
using (
  private.is_active_account()
  and (
    user_id = (select auth.uid())
    or private.can_review_technician_application(user_id)
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
    or private.can_review_technician_application(technician_id)
    or exists (
      select 1
      from public.technician_profiles
      where user_id = technician_id
        and verification_status = 'verified'
        and private.is_active_account(user_id)
    )
  )
);

drop policy "technician_documents_select_authorized" on public.technician_documents;
create policy "technician_documents_select_authorized"
on public.technician_documents for select to authenticated
using (
  private.is_active_account()
  and (
    technician_id = (select auth.uid())
    or private.can_review_technician_application(technician_id)
  )
);

drop policy "technician_document_files_select_authorized" on storage.objects;
create policy "technician_document_files_select_authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and private.is_active_account()
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.can_review_technician_document_file(name)
  )
);

create or replace function public.list_pending_technician_applications()
returns table (
  technician_id uuid,
  display_name text,
  bio text,
  submitted_at timestamptz,
  document_count bigint,
  pending_document_count bigint,
  reviewed_document_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.has_admin_permission('technician_review', auth.uid()) then
    raise exception 'Technician review permission required' using errcode = '42501';
  end if;

  return query
  select
    technician.user_id,
    profile.display_name,
    technician.bio,
    technician.submitted_at,
    count(document.id),
    count(document.id) filter (where document.review_status = 'pending'),
    count(document.id) filter (where document.review_status <> 'pending')
  from public.technician_profiles as technician
  join public.profiles as profile
    on profile.id = technician.user_id
  left join public.technician_documents as document
    on document.technician_id = technician.user_id
  where technician.verification_status = 'pending_review'
    and profile.account_status = 'active'
  group by
    technician.user_id,
    profile.display_name,
    technician.bio,
    technician.submitted_at
  order by technician.submitted_at asc, technician.user_id asc;
end;
$$;

create or replace function public.get_technician_review_application(
  p_technician_id uuid
)
returns table (
  technician_id uuid,
  display_name text,
  bio text,
  verification_status public.technician_verification_status,
  submitted_at timestamptz,
  kyc_notice_version text,
  kyc_notice_acknowledged_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_review_technician_application(p_technician_id) then
    raise exception 'Pending technician review access required' using errcode = '42501';
  end if;

  return query
  select
    technician.user_id,
    profile.display_name,
    technician.bio,
    technician.verification_status,
    technician.submitted_at,
    technician.kyc_notice_version,
    technician.kyc_notice_acknowledged_at
  from public.technician_profiles as technician
  join public.profiles as profile
    on profile.id = technician.user_id
  where technician.user_id = p_technician_id;
end;
$$;

create or replace function public.list_technician_review_documents(
  p_technician_id uuid
)
returns table (
  document_id uuid,
  document_type public.technician_document_type,
  storage_path text,
  review_status public.document_review_status,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  rejection_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_review_technician_application(p_technician_id) then
    raise exception 'Pending technician review access required' using errcode = '42501';
  end if;

  return query
  select
    document.id,
    document.document_type,
    document.storage_path,
    document.review_status,
    document.submitted_at,
    document.reviewed_at,
    document.rejection_reason
  from public.technician_documents as document
  where document.technician_id = p_technician_id
  order by
    case document.document_type
      when 'national_id' then 1
      when 'selfie' then 2
      else 3
    end,
    document.submitted_at asc,
    document.id asc;
end;
$$;

create or replace function public.list_technician_review_history(
  p_technician_id uuid
)
returns table (
  event_id uuid,
  action text,
  entity_type text,
  decision text,
  reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not private.has_admin_permission('technician_review', auth.uid())
    or not private.user_has_account_role(p_technician_id, 'technician') then
    raise exception 'Technician review permission required' using errcode = '42501';
  end if;

  return query
  select
    audit.id,
    audit.action,
    audit.entity_type,
    audit.metadata ->> 'decision',
    audit.metadata ->> 'reason',
    audit.created_at
  from public.audit_log as audit
  where (
      audit.entity_type = 'technician_profile'
      and audit.entity_id = p_technician_id
      and audit.action in (
        'technician.kyc_notice_acknowledged',
        'technician.profile_submitted',
        'technician.profile_decided'
      )
    )
    or (
      audit.entity_type = 'technician_document'
      and audit.action in (
        'technician.document_replaced',
        'technician.document_reviewed'
      )
      and (
        audit.metadata ->> 'technician_id' = p_technician_id::text
        or exists (
          select 1
          from public.technician_documents as document
          where document.id = audit.entity_id
            and document.technician_id = p_technician_id
        )
      )
    )
  order by audit.created_at asc, audit.id asc;
end;
$$;

revoke all on function public.list_pending_technician_applications()
  from public, anon;
revoke all on function public.get_technician_review_application(uuid)
  from public, anon;
revoke all on function public.list_technician_review_documents(uuid)
  from public, anon;
revoke all on function public.list_technician_review_history(uuid)
  from public, anon;

grant execute on function public.list_pending_technician_applications()
  to authenticated;
grant execute on function public.get_technician_review_application(uuid)
  to authenticated;
grant execute on function public.list_technician_review_documents(uuid)
  to authenticated;
grant execute on function public.list_technician_review_history(uuid)
  to authenticated;
