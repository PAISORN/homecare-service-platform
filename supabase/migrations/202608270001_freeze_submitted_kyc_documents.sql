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
      from public.technician_documents as document
      join storage.objects as object
        on object.bucket_id = 'technician-documents'
       and object.name = document.storage_path
      where document.technician_id = p_technician_id
        and document.document_type = 'national_id'
        and document.review_status = 'pending'
    )
    and exists (
      select 1
      from public.technician_documents as document
      join storage.objects as object
        on object.bucket_id = 'technician-documents'
       and object.name = document.storage_path
      where document.technician_id = p_technician_id
        and document.document_type = 'selfie'
        and document.review_status = 'pending'
    );
$$;

revoke all on function public.has_required_technician_documents(uuid) from public;

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
    select verification_status
    into v_profile_status
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

  if not public.has_account_role('administrator') then
    select verification_status
    into v_profile_status
    from public.technician_profiles
    where user_id = old.technician_id;

    if v_profile_status <> 'draft' then
      raise exception 'Submitted technician documents are immutable';
    end if;
  end if;

  return new;
end;
$$;

drop policy "technician_documents_owner_insert_pending"
  on public.technician_documents;
drop policy "technician_documents_owner_update_pending"
  on public.technician_documents;
drop policy "technician_documents_owner_delete_pending"
  on public.technician_documents;

create policy "technician_documents_owner_insert_pending_draft"
on public.technician_documents for insert to authenticated
with check (
  technician_id = (select auth.uid())
  and public.has_account_role('technician')
  and review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
  and exists (
    select 1
    from public.technician_profiles
    where user_id = technician_id
      and verification_status = 'draft'
  )
);

create policy "technician_documents_owner_update_pending_draft"
on public.technician_documents for update to authenticated
using (
  technician_id = (select auth.uid())
  and review_status = 'pending'
  and exists (
    select 1
    from public.technician_profiles
    where user_id = technician_id
      and verification_status = 'draft'
  )
)
with check (
  technician_id = (select auth.uid())
  and review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
  and exists (
    select 1
    from public.technician_profiles
    where user_id = technician_id
      and verification_status = 'draft'
  )
);

create policy "technician_documents_owner_delete_pending_draft"
on public.technician_documents for delete to authenticated
using (
  technician_id = (select auth.uid())
  and review_status = 'pending'
  and exists (
    select 1
    from public.technician_profiles
    where user_id = technician_id
      and verification_status = 'draft'
  )
);

drop policy "technician_document_files_owner_delete_pending_or_orphan"
  on storage.objects;

create or replace function public.can_delete_technician_document_file(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and p_storage_path like (select auth.uid())::text || '/%'
    and (
      not exists (
        select 1
        from public.technician_documents
        where technician_id = (select auth.uid())
          and storage_path = p_storage_path
      )
      or exists (
        select 1
        from public.technician_documents as document
        join public.technician_profiles as profile
          on profile.user_id = document.technician_id
        where document.technician_id = (select auth.uid())
          and document.storage_path = p_storage_path
          and document.review_status = 'pending'
          and profile.verification_status = 'draft'
      )
    );
$$;

revoke all on function public.can_delete_technician_document_file(text) from public;
grant execute on function public.can_delete_technician_document_file(text) to authenticated;

create policy "technician_document_files_owner_delete_draft_or_orphan"
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.can_delete_technician_document_file(name)
);
