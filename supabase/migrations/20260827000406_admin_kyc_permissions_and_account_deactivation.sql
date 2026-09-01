create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.admin_permission as enum (
  'technician_review',
  'role_management',
  'catalog_management',
  'audit_view'
);

create type public.account_status as enum ('active', 'deactivated');

alter table public.profiles
  add column account_status public.account_status not null default 'active',
  add column deactivated_at timestamptz,
  add constraint profile_account_status_metadata check (
    (account_status = 'active' and deactivated_at is null)
    or (account_status = 'deactivated' and deactivated_at is not null)
  );

create index profiles_account_status_idx on public.profiles (account_status);

create table public.admin_permissions (
  user_id uuid not null references public.profiles (id) on delete restrict,
  permission public.admin_permission not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete restrict,
  primary key (user_id, permission)
);

create index admin_permissions_permission_user_idx
  on public.admin_permissions (permission, user_id);

alter table public.admin_permissions enable row level security;

create table private.kyc_storage_configuration (
  singleton boolean primary key default true check (singleton),
  max_documents_per_technician integer not null
    check (max_documents_per_technician between 2 and 100),
  updated_at timestamptz not null default now()
);

insert into private.kyc_storage_configuration (
  singleton,
  max_documents_per_technician
)
values (true, 10)
on conflict (singleton) do nothing;

create or replace function private.is_active_account(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.profiles
      where id = p_user_id
        and account_status = 'active'
    );
$$;

create or replace function private.has_admin_permission(
  p_permission public.admin_permission,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_account(p_user_id)
    and exists (
      select 1
      from public.account_roles
      where user_id = p_user_id
        and role = 'administrator'
    )
    and exists (
      select 1
      from public.admin_permissions
      where user_id = p_user_id
        and permission = p_permission
    );
$$;

revoke all on function private.is_active_account(uuid) from public, anon, authenticated;
revoke all on function private.has_admin_permission(public.admin_permission, uuid)
  from public, anon, authenticated;

insert into public.admin_permissions (user_id, permission)
select role.user_id, permission.permission
from public.account_roles as role
cross join unnest(enum_range(null::public.admin_permission)) as permission(permission)
where role.role = 'administrator'
on conflict (user_id, permission) do nothing;

create or replace function private.can_register_technician_document(
  p_technician_id uuid,
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_technician_id = (select auth.uid())
    and private.is_active_account(p_technician_id)
    and p_storage_path like p_technician_id::text || '/%'
    and exists (
      select 1
      from public.technician_profiles
      where user_id = p_technician_id
        and verification_status = 'draft'
    )
    and (
      select count(*)
      from public.technician_documents
      where technician_id = p_technician_id
    ) < (
      select max_documents_per_technician
      from private.kyc_storage_configuration
      where singleton
    );
$$;

create or replace function private.can_upload_technician_document(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_account((select auth.uid()))
    and p_storage_path like (select auth.uid())::text || '/%'
    and exists (
      select 1
      from public.technician_profiles
      where user_id = (select auth.uid())
        and verification_status = 'draft'
    )
    and exists (
      select 1
      from public.technician_documents
      where technician_id = (select auth.uid())
        and storage_path = p_storage_path
        and review_status = 'pending'
    )
    and (
      select count(*)
      from storage.objects
      where bucket_id = 'technician-documents'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    ) < (
      select max_documents_per_technician
      from private.kyc_storage_configuration
      where singleton
    );
$$;

revoke all on function private.can_register_technician_document(uuid, text)
  from public, anon, authenticated;
revoke all on function private.can_upload_technician_document(text)
  from public, anon, authenticated;

-- The schema is not exposed by PostgREST, but authenticated policy evaluation
-- still needs USAGE/EXECUTE on the narrowly scoped boolean helpers.
grant usage on schema private to authenticated;
grant execute on function private.is_active_account(uuid) to authenticated;
grant execute on function private.has_admin_permission(public.admin_permission, uuid)
  to authenticated;
grant execute on function private.can_register_technician_document(uuid, text)
  to authenticated;
grant execute on function private.can_upload_technician_document(text)
  to authenticated;

drop policy "profiles_select_own_or_admin" on public.profiles;
drop policy "profiles_update_own_or_admin" on public.profiles;
drop policy "account_roles_select_own_or_admin" on public.account_roles;
drop policy "account_roles_self_enroll_non_privileged" on public.account_roles;
drop policy "account_roles_admin_manage" on public.account_roles;
drop policy "service_locations_owner_or_admin_select" on public.service_locations;
drop policy "service_locations_owner_insert" on public.service_locations;
drop policy "service_locations_owner_update" on public.service_locations;
drop policy "service_locations_owner_delete" on public.service_locations;
drop policy "technician_profiles_select_relevant" on public.technician_profiles;
drop policy "technician_profiles_owner_insert_draft" on public.technician_profiles;
drop policy "technician_profiles_owner_update" on public.technician_profiles;
drop policy "technician_profiles_admin_manage" on public.technician_profiles;
drop policy "technician_skills_select_relevant" on public.technician_skills;
drop policy "technician_skills_owner_manage" on public.technician_skills;
drop policy "technician_skills_admin_manage" on public.technician_skills;
drop policy "technician_documents_owner_or_admin_select" on public.technician_documents;
drop policy "technician_documents_owner_insert_pending_draft" on public.technician_documents;
drop policy "technician_documents_owner_update_pending_draft" on public.technician_documents;
drop policy "technician_documents_owner_delete_pending_draft" on public.technician_documents;
drop policy "technician_documents_admin_manage" on public.technician_documents;
drop policy "service_categories_authenticated_read_available" on public.service_categories;
drop policy "service_categories_admin_manage" on public.service_categories;
drop policy "service_items_authenticated_read_available" on public.service_items;
drop policy "service_items_admin_manage" on public.service_items;
drop policy "audit_log_admin_read" on public.audit_log;
drop policy "technician_document_files_owner_insert" on storage.objects;
drop policy "technician_document_files_owner_or_admin_select" on storage.objects;

create policy "profiles_select_authorized"
on public.profiles for select to authenticated
using (
  private.is_active_account()
  and (
    id = (select auth.uid())
    or private.has_admin_permission('technician_review')
    or private.has_admin_permission('role_management')
  )
);

create policy "profiles_update_own_active"
on public.profiles for update to authenticated
using (id = (select auth.uid()) and private.is_active_account())
with check (id = (select auth.uid()) and private.is_active_account());

create policy "account_roles_select_authorized"
on public.account_roles for select to authenticated
using (
  private.is_active_account()
  and (
    user_id = (select auth.uid())
    or private.has_admin_permission('role_management')
  )
);

create policy "account_roles_self_enroll_non_privileged_active"
on public.account_roles for insert to authenticated
with check (
  private.is_active_account()
  and user_id = (select auth.uid())
  and role in ('customer', 'technician')
  and assigned_by is null
);

create policy "account_roles_role_manager_insert"
on public.account_roles for insert to authenticated
with check (
  private.has_admin_permission('role_management')
  and assigned_by = (select auth.uid())
);

create policy "account_roles_role_manager_delete"
on public.account_roles for delete to authenticated
using (private.has_admin_permission('role_management'));

create policy "admin_permissions_select_authorized"
on public.admin_permissions for select to authenticated
using (
  private.is_active_account()
  and (
    user_id = (select auth.uid())
    or private.has_admin_permission('role_management')
  )
);

create policy "admin_permissions_role_manager_insert"
on public.admin_permissions for insert to authenticated
with check (
  private.has_admin_permission('role_management')
  and assigned_by = (select auth.uid())
  and exists (
    select 1
    from public.account_roles
    where user_id = admin_permissions.user_id
      and role = 'administrator'
  )
);

create policy "admin_permissions_role_manager_delete"
on public.admin_permissions for delete to authenticated
using (private.has_admin_permission('role_management'));

create policy "service_locations_owner_select_active"
on public.service_locations for select to authenticated
using (customer_id = (select auth.uid()) and private.is_active_account());
create policy "service_locations_owner_insert_active"
on public.service_locations for insert to authenticated
with check (customer_id = (select auth.uid()) and private.is_active_account());
create policy "service_locations_owner_update_active"
on public.service_locations for update to authenticated
using (customer_id = (select auth.uid()) and private.is_active_account())
with check (customer_id = (select auth.uid()) and private.is_active_account());
create policy "service_locations_owner_delete_active"
on public.service_locations for delete to authenticated
using (customer_id = (select auth.uid()) and private.is_active_account());

create policy "technician_profiles_select_authorized"
on public.technician_profiles for select to authenticated
using (
  private.is_active_account()
  and (
    user_id = (select auth.uid())
    or verification_status = 'verified'
    or private.has_admin_permission('technician_review')
  )
);

create policy "technician_profiles_owner_insert_draft_active"
on public.technician_profiles for insert to authenticated
with check (
  private.is_active_account()
  and user_id = (select auth.uid())
  and public.has_account_role('technician')
  and verification_status = 'draft'
  and submitted_at is null
  and verified_at is null
  and verified_by is null
  and rejection_reason is null
);

create policy "technician_profiles_owner_update_active"
on public.technician_profiles for update to authenticated
using (user_id = (select auth.uid()) and private.is_active_account())
with check (user_id = (select auth.uid()) and private.is_active_account());

create policy "technician_skills_select_authorized"
on public.technician_skills for select to authenticated
using (
  private.is_active_account()
  and (
    technician_id = (select auth.uid())
    or exists (
      select 1
      from public.technician_profiles
      where user_id = technician_id
        and verification_status = 'verified'
    )
    or private.has_admin_permission('technician_review')
  )
);

create policy "technician_skills_owner_manage_active"
on public.technician_skills for all to authenticated
using (technician_id = (select auth.uid()) and private.is_active_account())
with check (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and public.has_account_role('technician')
);

create policy "technician_documents_select_authorized"
on public.technician_documents for select to authenticated
using (
  private.is_active_account()
  and (
    technician_id = (select auth.uid())
    or private.has_admin_permission('technician_review')
  )
);

create policy "technician_documents_owner_insert_pending_draft_active"
on public.technician_documents for insert to authenticated
with check (
  review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
  and public.has_account_role('technician')
  and private.can_register_technician_document(technician_id, storage_path)
);

create policy "technician_documents_owner_update_pending_draft_active"
on public.technician_documents for update to authenticated
using (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and review_status = 'pending'
  and exists (
    select 1 from public.technician_profiles
    where user_id = technician_id and verification_status = 'draft'
  )
)
with check (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
);

create policy "technician_documents_owner_delete_pending_draft_active"
on public.technician_documents for delete to authenticated
using (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and review_status = 'pending'
  and exists (
    select 1 from public.technician_profiles
    where user_id = technician_id and verification_status = 'draft'
  )
);

create policy "service_categories_authenticated_read_authorized"
on public.service_categories for select to authenticated
using (
  private.is_active_account()
  and (
    status in ('pilot', 'active')
    or private.has_admin_permission('catalog_management')
  )
);
create policy "service_categories_catalog_manager_insert"
on public.service_categories for insert to authenticated
with check (private.has_admin_permission('catalog_management'));
create policy "service_categories_catalog_manager_update"
on public.service_categories for update to authenticated
using (private.has_admin_permission('catalog_management'))
with check (private.has_admin_permission('catalog_management'));
create policy "service_categories_catalog_manager_delete"
on public.service_categories for delete to authenticated
using (private.has_admin_permission('catalog_management'));

create policy "service_items_authenticated_read_authorized"
on public.service_items for select to authenticated
using (
  private.is_active_account()
  and (
    status in ('pilot', 'active')
    or private.has_admin_permission('catalog_management')
  )
);
create policy "service_items_catalog_manager_insert"
on public.service_items for insert to authenticated
with check (private.has_admin_permission('catalog_management'));
create policy "service_items_catalog_manager_update"
on public.service_items for update to authenticated
using (private.has_admin_permission('catalog_management'))
with check (private.has_admin_permission('catalog_management'));
create policy "service_items_catalog_manager_delete"
on public.service_items for delete to authenticated
using (private.has_admin_permission('catalog_management'));

create policy "audit_log_auditor_read"
on public.audit_log for select to authenticated
using (private.has_admin_permission('audit_view'));

create policy "technician_document_files_owner_insert_registered_draft"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_account_role('technician')
  and private.can_upload_technician_document(name)
);

create policy "technician_document_files_select_authorized"
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and private.is_active_account()
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.has_admin_permission('technician_review')
  )
);

drop policy "technician_document_files_owner_delete_draft_or_orphan"
  on storage.objects;

create policy "technician_document_files_owner_delete_draft_registered"
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and private.is_active_account()
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.can_delete_technician_document_file(name)
);

revoke update on public.profiles from authenticated;
grant update (display_name, phone, avatar_path) on public.profiles to authenticated;

revoke update on public.technician_profiles from authenticated;
grant update (bio) on public.technician_profiles to authenticated;

revoke update on public.technician_documents from authenticated;
grant update (document_type) on public.technician_documents to authenticated;

revoke all on public.admin_permissions from anon, authenticated;
grant select, insert, delete on public.admin_permissions to authenticated;

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
    or new.rejection_reason is distinct from old.rejection_reason then
    if current_setting('homecare.kyc_workflow', true) is distinct from 'on' then
      raise exception 'Verification fields may only be changed through an audited workflow'
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

drop trigger technician_profiles_audit_verification
  on public.technician_profiles;
drop function public.audit_technician_verification_change();

create or replace function public.submit_technician_profile()
returns public.technician_verification_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_status public.technician_verification_status;
begin
  if v_user_id is null or not private.is_active_account(v_user_id) then
    raise exception 'Active authenticated account required' using errcode = '42501';
  end if;
  if not public.has_account_role('technician') then
    raise exception 'Technician role required' using errcode = '42501';
  end if;

  select verification_status into v_status
  from public.technician_profiles
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'Technician profile not found' using errcode = 'P0002';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft technician profile can be submitted' using errcode = '22023';
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
    jsonb_build_object('to', v_status)
  );

  return v_status;
end;
$$;

revoke all on function public.submit_technician_profile() from public, anon;
grant execute on function public.submit_technician_profile() to authenticated;

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

  select technician_id into v_technician_id
  from public.technician_documents
  where id = p_document_id;
  if not found then
    raise exception 'Technician document not found' using errcode = 'P0002';
  end if;

  select verification_status into v_profile_status
  from public.technician_profiles
  where user_id = v_technician_id
  for update;

  select * into v_document
  from public.technician_documents
  where id = p_document_id and technician_id = v_technician_id
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

revoke all on function public.review_technician_document(
  uuid, public.document_review_status, text
) from public, anon;
grant execute on function public.review_technician_document(
  uuid, public.document_review_status, text
) to authenticated;

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

  select * into v_profile
  from public.technician_profiles
  where user_id = p_technician_id
  for update;

  if not found then
    raise exception 'Technician profile not found' using errcode = 'P0002';
  end if;
  if v_profile.verification_status <> 'pending_review' then
    raise exception 'Technician profile must be pending review' using errcode = '22023';
  end if;
  if p_decision = 'verified' and not (
    exists (
      select 1 from public.technician_documents
      where technician_id = p_technician_id
        and document_type = 'national_id'
        and review_status = 'approved'
    )
    and exists (
      select 1 from public.technician_documents
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

revoke all on function public.decide_technician_profile(
  uuid, public.technician_verification_status, text
) from public, anon;
grant execute on function public.decide_technician_profile(
  uuid, public.technician_verification_status, text
) to authenticated;

create or replace function public.deactivate_own_account()
returns public.account_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status public.account_status;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select account_status into v_status
  from public.profiles
  where id = v_actor
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  if v_status <> 'active' then
    raise exception 'Account is already deactivated' using errcode = '22023';
  end if;

  update public.profiles
  set account_status = 'deactivated',
      deactivated_at = transaction_timestamp()
  where id = v_actor
  returning account_status into v_status;

  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'account.deactivated',
    'profile',
    v_actor,
    jsonb_build_object(
      'retention', 'data retained pending approved retention policy',
      'hard_delete_blocked_when_kyc_exists', true
    )
  );

  return v_status;
end;
$$;

revoke all on function public.deactivate_own_account() from public, anon;
grant execute on function public.deactivate_own_account() to authenticated;

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
  ) then
    raise exception 'Hard delete blocked: KYC retention policy is not approved'
      using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger profiles_block_hard_delete_with_kyc
before delete on public.profiles
for each row execute function public.block_profile_hard_delete_with_kyc();

create or replace function public.audit_admin_permission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      case when tg_op = 'INSERT' then 'admin.permission_granted' else 'admin.permission_revoked' end,
      'admin_permission',
      case when tg_op = 'INSERT' then new.user_id else old.user_id end,
      jsonb_build_object(
        'permission', case when tg_op = 'INSERT' then new.permission else old.permission end
      )
    );
  end if;
  return case when tg_op = 'INSERT' then new else old end;
end;
$$;

create trigger admin_permissions_audit_change
after insert or delete on public.admin_permissions
for each row execute function public.audit_admin_permission_change();
