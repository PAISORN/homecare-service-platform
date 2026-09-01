alter table public.technician_profiles
  drop constraint technician_verification_metadata,
  add constraint technician_verification_metadata check (
    (verification_status = 'draft'
      and submitted_at is null
      and verified_at is null
      and verified_by is null
      and rejection_reason is null)
    or (verification_status = 'pending_review'
      and submitted_at is not null
      and verified_at is null
      and verified_by is null
      and rejection_reason is null)
    or (verification_status = 'verified'
      and submitted_at is not null
      and verified_at is not null
      and verified_by is not null
      and rejection_reason is null)
    or (verification_status = 'rejected'
      and submitted_at is not null
      and verified_at is null
      and verified_by is null
      and nullif(trim(rejection_reason), '') is not null)
    or (verification_status = 'suspended'
      and submitted_at is not null
      and ((verified_at is null and verified_by is null)
        or (verified_at is not null and verified_by is not null)))
  );

alter table public.technician_documents
  drop constraint technician_document_review_metadata,
  add constraint technician_document_review_metadata check (
    (review_status = 'pending'
      and reviewed_at is null
      and reviewed_by is null
      and rejection_reason is null)
    or (review_status = 'approved'
      and reviewed_at is not null
      and reviewed_by is not null
      and rejection_reason is null)
    or (review_status = 'rejected'
      and reviewed_at is not null
      and reviewed_by is not null
      and nullif(trim(rejection_reason), '') is not null)
  ),
  add constraint technician_document_storage_path_owned check (
    storage_path like technician_id::text || '/%'
    and char_length(storage_path) > char_length(technician_id::text) + 1
    and char_length(storage_path) <= 1024
    and storage_path !~ '(^|/)\.{1,2}(/|$)'
    and storage_path !~ '//'
    and storage_path !~ '\\'
  );

alter table public.service_items
  add constraint active_fixed_price_requires_base_labor_price check (
    status <> 'active'
    or price_model <> 'fixed'
    or base_labor_price is not null
  );

create or replace function public.has_required_technician_documents(p_technician_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.technician_documents
      where technician_id = p_technician_id
        and document_type = 'national_id'
        and review_status = 'pending'
    )
    and exists (
      select 1
      from public.technician_documents
      where technician_id = p_technician_id
        and document_type = 'selfie'
        and review_status = 'pending'
    );
$$;

revoke all on function public.has_required_technician_documents(uuid) from public;

create or replace function public.protect_technician_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.has_account_role('administrator') then
    return new;
  end if;

  if old.verification_status = 'draft'
    and new.verification_status = 'pending_review'
    and old.user_id = (select auth.uid())
    and new.user_id = old.user_id
    and new.submitted_at is not null
    and new.verified_at is null
    and new.verified_by is null
    and new.rejection_reason is null
    and public.has_required_technician_documents(old.user_id) then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status
    or new.submitted_at is distinct from old.submitted_at
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Verification fields may only be changed through an allowed workflow';
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
begin
  if tg_op = 'DELETE' then
    if old.review_status <> 'pending' then
      raise exception 'Reviewed technician documents are immutable';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
    or new.technician_id is distinct from old.technician_id
    or new.storage_path is distinct from old.storage_path
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Technician document identity fields are immutable';
  end if;

  return new;
end;
$$;

create trigger technician_documents_protect_identity
before update or delete on public.technician_documents
for each row execute function public.protect_technician_document_identity();

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
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.account_roles
    where user_id = v_user_id
      and role = 'technician'
  ) then
    raise exception 'Technician role required' using errcode = '42501';
  end if;

  select verification_status
  into v_status
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

  update public.technician_profiles
  set verification_status = 'pending_review',
      submitted_at = transaction_timestamp()
  where user_id = v_user_id
  returning verification_status into v_status;

  return v_status;
end;
$$;

revoke all on function public.submit_technician_profile() from public;
grant execute on function public.submit_technician_profile() to authenticated;

drop policy "technician_document_files_owner_update" on storage.objects;
drop policy "technician_document_files_owner_delete" on storage.objects;

create policy "technician_document_files_owner_delete_pending_or_orphan"
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1
    from public.technician_documents
    where technician_id = (select auth.uid())
      and storage_path = name
      and review_status <> 'pending'
  )
);
