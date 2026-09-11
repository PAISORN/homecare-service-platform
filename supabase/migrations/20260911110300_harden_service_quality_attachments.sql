begin;

create or replace function public.register_service_quality_case_attachment(
  p_case_id uuid, p_storage_path text, p_mime_type text, p_size_bytes integer
)
returns public.service_quality_case_attachments language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := (select auth.uid());
  v_row public.service_quality_case_attachments;
begin
  if not exists (
    select 1 from public.service_quality_cases
    where id = p_case_id and v_actor in (customer_id, technician_id)
      and status not in ('resolved', 'dismissed')
  ) or not private.is_active_account(v_actor) then
    raise exception 'Quality case not found' using errcode = 'P0002';
  end if;
  if p_storage_path not like v_actor::text || '/' || p_case_id::text || '/%'
    or p_mime_type not in ('image/jpeg', 'image/png')
    or p_size_bytes not between 1 and 6291456 then
    raise exception 'Invalid attachment' using errcode = '22023';
  end if;
  if (select count(*) from public.service_quality_case_attachments where case_id = p_case_id) >= 10 then
    raise exception 'Attachment limit reached' using errcode = '22023';
  end if;
  insert into public.service_quality_case_attachments (
    case_id, uploaded_by, storage_path, mime_type, size_bytes
  ) values (p_case_id, v_actor, p_storage_path, p_mime_type, p_size_bytes)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.delete_unuploaded_service_quality_case_attachment(p_attachment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  delete from public.service_quality_case_attachments a
  using public.service_quality_cases c
  where a.id = p_attachment_id and c.id = a.case_id
    and a.uploaded_by = v_actor and private.is_active_account(v_actor)
    and c.status not in ('resolved', 'dismissed')
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'service-quality-evidence' and o.name = a.storage_path
    );
  if not found then
    raise exception 'Unuploaded attachment not found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.delete_unuploaded_service_quality_case_attachment(uuid) from public, anon;
grant execute on function public.delete_unuploaded_service_quality_case_attachment(uuid) to authenticated;

commit;
