-- A technician application has exactly one identity document and one selfie.
-- Optional evidence remains repeatable because a technician may hold multiple
-- professional certificates or provide more than one supporting document.
--
-- Do not silently discard retained KYC data if an existing environment already
-- contains duplicates. An operator must review and resolve those records before
-- rerunning this migration.
do $$
begin
  if exists (
    select 1
    from public.technician_documents
    where document_type in ('national_id', 'selfie')
    group by technician_id, document_type
    having count(*) > 1
  ) then
    raise exception
      'Duplicate required technician documents must be resolved before applying this migration'
      using errcode = '23505';
  end if;
end;
$$;

create unique index technician_documents_one_required_type_per_technician
  on public.technician_documents (technician_id, document_type)
  where document_type in ('national_id', 'selfie');
