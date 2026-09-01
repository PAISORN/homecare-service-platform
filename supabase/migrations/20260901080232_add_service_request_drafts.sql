-- Phase 3A customer request drafts. Catalog entries are visible to authenticated
-- pilot users, but no request can be submitted and no unapproved price is shown.

create type public.service_request_status as enum ('draft', 'cancelled');
create type public.request_entry_point as enum ('service_catalog', 'symptom');
create type public.request_urgency as enum (
  'flexible',
  'within_3_days',
  'as_soon_as_possible'
);
create type public.request_safety_status as enum ('clear', 'stopped');

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete restrict,
  service_location_id uuid not null references public.service_locations (id) on delete restrict,
  service_category_id uuid not null references public.service_categories (id) on delete restrict,
  service_item_id uuid references public.service_items (id) on delete restrict,
  entry_point public.request_entry_point not null,
  status public.service_request_status not null default 'draft',
  problem_description text not null
    check (char_length(trim(problem_description)) between 1 and 2000),
  quantity smallint not null default 1 check (quantity between 1 and 50),
  urgency public.request_urgency not null default 'flexible',
  preferred_date date,
  preferred_time_window text
    check (
      preferred_time_window is null
      or char_length(trim(preferred_time_window)) between 1 and 80
    ),
  intake_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(intake_answers) = 'object'),
  safety_answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(safety_answers) = 'object'),
  safety_status public.request_safety_status not null default 'clear',
  safety_stop_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_request_catalog_entry check (
    (entry_point = 'service_catalog' and service_item_id is not null)
    or entry_point = 'symptom'
  ),
  constraint service_request_safety_metadata check (
    (safety_status = 'clear' and safety_stop_code is null)
    or (safety_status = 'stopped' and safety_stop_code is not null)
  )
);

create table public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  storage_path text not null unique check (storage_path !~ '^https?://'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png')),
  size_bytes integer not null check (size_bytes between 1 and 8388608),
  created_at timestamptz not null default now()
);

create index service_requests_customer_status_updated_idx
  on public.service_requests (customer_id, status, updated_at desc);
create index service_requests_catalog_idx
  on public.service_requests (service_category_id, service_item_id);
create index request_attachments_request_created_idx
  on public.request_attachments (service_request_id, created_at);

create trigger service_requests_set_updated_at
before update on public.service_requests
for each row execute function public.set_updated_at();

alter table public.service_requests enable row level security;
alter table public.request_attachments enable row level security;

create policy "service_requests_owner_read"
on public.service_requests for select to authenticated
using (
  customer_id = (select auth.uid())
  and private.is_active_account((select auth.uid()))
  and private.user_has_account_role((select auth.uid()), 'customer')
);

create policy "request_attachments_owner_read"
on public.request_attachments for select to authenticated
using (
  customer_id = (select auth.uid())
  and private.is_active_account((select auth.uid()))
  and private.user_has_account_role((select auth.uid()), 'customer')
);

create or replace function private.request_safety_stop_code(p_answers jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce((p_answers ->> 'fire_smoke')::boolean, false)
      then 'FIRE_SMOKE'
    when coalesce((p_answers ->> 'water_near_electricity')::boolean, false)
      then 'WATER_NEAR_ELECTRICITY'
    when coalesce((p_answers ->> 'external_power_hazard')::boolean, false)
      then 'EXTERNAL_POWER_HAZARD'
    when coalesce((p_answers ->> 'uncontrolled_water')::boolean, false)
      then 'UNCONTROLLED_WATER'
    when coalesce((p_answers ->> 'out_of_scope_access')::boolean, false)
      then 'OUT_OF_SCOPE_ACCESS'
    else null
  end
$$;

revoke all on function private.request_safety_stop_code(jsonb) from public;

create or replace function public.save_service_request_draft(
  p_service_location_id uuid,
  p_service_category_id uuid,
  p_service_item_id uuid,
  p_entry_point public.request_entry_point,
  p_problem_description text,
  p_quantity integer,
  p_urgency public.request_urgency,
  p_preferred_date date,
  p_preferred_time_window text,
  p_intake_answers jsonb,
  p_safety_answers jsonb,
  p_request_id uuid default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request public.service_requests;
  v_stop_code text;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.service_locations
    where id = p_service_location_id and customer_id = v_actor_id
  ) then
    raise exception 'Service location not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.service_categories
    where id = p_service_category_id and status in ('pilot', 'active')
  ) then
    raise exception 'Service category unavailable' using errcode = '22023';
  end if;
  if p_entry_point = 'service_catalog' and p_service_item_id is null then
    raise exception 'Service item required' using errcode = '22023';
  end if;
  if p_service_item_id is not null and not exists (
    select 1 from public.service_items
    where id = p_service_item_id
      and service_category_id = p_service_category_id
      and status in ('pilot', 'active')
  ) then
    raise exception 'Service item unavailable' using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_problem_description, ''))) not between 1 and 2000 then
    raise exception 'Invalid problem description' using errcode = '22023';
  end if;
  if p_quantity not between 1 and 50 then
    raise exception 'Invalid quantity' using errcode = '22023';
  end if;
  if p_preferred_date is not null and p_preferred_date < current_date then
    raise exception 'Preferred date cannot be in the past' using errcode = '22023';
  end if;
  if p_preferred_time_window is not null
    and char_length(trim(p_preferred_time_window)) not between 1 and 80 then
    raise exception 'Invalid preferred time window' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_intake_answers, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_safety_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'Answers must be JSON objects' using errcode = '22023';
  end if;

  v_stop_code := private.request_safety_stop_code(coalesce(p_safety_answers, '{}'::jsonb));
  if v_stop_code is not null then
    raise exception 'Safety stop prevents request creation' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor_id::text, 1)
  );

  if p_request_id is null then
    insert into public.service_requests (
      customer_id, service_location_id, service_category_id, service_item_id,
      entry_point, problem_description, quantity, urgency, preferred_date,
      preferred_time_window, intake_answers, safety_answers, safety_status,
      safety_stop_code
    ) values (
      v_actor_id, p_service_location_id, p_service_category_id, p_service_item_id,
      p_entry_point, trim(p_problem_description), p_quantity, p_urgency,
      p_preferred_date, nullif(trim(p_preferred_time_window), ''),
      coalesce(p_intake_answers, '{}'::jsonb),
      coalesce(p_safety_answers, '{}'::jsonb),
      case when v_stop_code is null
        then 'clear'::public.request_safety_status
        else 'stopped'::public.request_safety_status
      end,
      v_stop_code
    ) returning * into v_request;
  else
    update public.service_requests
    set service_location_id = p_service_location_id,
      service_category_id = p_service_category_id,
      service_item_id = p_service_item_id,
      entry_point = p_entry_point,
      problem_description = trim(p_problem_description),
      quantity = p_quantity,
      urgency = p_urgency,
      preferred_date = p_preferred_date,
      preferred_time_window = nullif(trim(p_preferred_time_window), ''),
      intake_answers = coalesce(p_intake_answers, '{}'::jsonb),
      safety_answers = coalesce(p_safety_answers, '{}'::jsonb),
      safety_status = case when v_stop_code is null
        then 'clear'::public.request_safety_status
        else 'stopped'::public.request_safety_status
      end,
      safety_stop_code = v_stop_code
    where id = p_request_id and customer_id = v_actor_id and status = 'draft'
    returning * into v_request;
    if not found then
      raise exception 'Service request draft not found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id,
    case when p_request_id is null
      then 'service_request.draft_created'
      else 'service_request.draft_updated'
    end,
    'service_request',
    v_request.id,
    pg_catalog.jsonb_build_object(
      'entry_point', v_request.entry_point,
      'safety_status', v_request.safety_status,
      'has_service_item', v_request.service_item_id is not null
    )
  );

  return v_request;
end;
$$;

create or replace function public.cancel_service_request_draft(p_request_id uuid)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_request public.service_requests;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.request_attachments
    where service_request_id = p_request_id and customer_id = v_actor_id
  ) then
    raise exception 'Delete request attachments before cancelling' using errcode = '23503';
  end if;
  update public.service_requests set status = 'cancelled'
  where id = p_request_id and customer_id = v_actor_id and status = 'draft'
  returning * into v_request;
  if not found then
    raise exception 'Service request draft not found' using errcode = 'P0002';
  end if;
  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_actor_id, 'service_request.draft_cancelled', 'service_request',
    v_request.id, '{}'::jsonb
  );
  return v_request;
end;
$$;

create or replace function public.register_request_attachment(
  p_service_request_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_size_bytes integer
)
returns public.request_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_attachment public.request_attachments;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_service_request_id::text, 2)
  );
  if not exists (
    select 1 from public.service_requests
    where id = p_service_request_id
      and customer_id = v_actor_id
      and status = 'draft'
  ) then
    raise exception 'Service request draft not found' using errcode = 'P0002';
  end if;
  if p_storage_path !~ (
    '^' || v_actor_id::text || '/' || p_service_request_id::text
    || '/[0-9a-f-]{36}[.](jpg|png)$'
  ) then
    raise exception 'Invalid request attachment path' using errcode = '22023';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png') then
    raise exception 'Unsupported request attachment type' using errcode = '22023';
  end if;
  if p_size_bytes not between 1 and 8388608 then
    raise exception 'Invalid request attachment size' using errcode = '22023';
  end if;
  if (
    select count(*) from public.request_attachments
    where service_request_id = p_service_request_id
  ) >= 6 then
    raise exception 'Request attachment limit reached' using errcode = '23514';
  end if;
  insert into public.request_attachments (
    service_request_id, customer_id, storage_path, mime_type, size_bytes
  ) values (
    p_service_request_id, v_actor_id, p_storage_path, p_mime_type, p_size_bytes
  ) returning * into v_attachment;
  return v_attachment;
end;
$$;

create or replace function public.delete_request_attachment(p_attachment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_storage_path text;
begin
  if v_actor_id is null
    or not private.is_active_account(v_actor_id)
    or not private.user_has_account_role(v_actor_id, 'customer') then
    raise exception 'Active customer account required' using errcode = '42501';
  end if;
  delete from public.request_attachments as attachment
  using public.service_requests as request
  where attachment.id = p_attachment_id
    and attachment.customer_id = v_actor_id
    and request.id = attachment.service_request_id
    and request.status = 'draft'
  returning attachment.storage_path into v_storage_path;
  if not found then
    raise exception 'Request attachment not found' using errcode = 'P0002';
  end if;
  return v_storage_path;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'request-attachments', 'request-attachments', false, 8388608,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "request_attachment_files_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'request-attachments'
  and exists (
    select 1 from public.request_attachments as attachment
    where attachment.storage_path = name
      and attachment.customer_id = (select auth.uid())
  )
);
create policy "request_attachment_files_owner_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1 from public.request_attachments as attachment
    where attachment.storage_path = name
      and attachment.customer_id = (select auth.uid())
  )
);
create policy "request_attachment_files_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'request-attachments'
  and exists (
    select 1
    from public.request_attachments as attachment
    join public.service_requests as request
      on request.id = attachment.service_request_id
    where attachment.storage_path = name
      and attachment.customer_id = (select auth.uid())
      and request.status = 'draft'
  )
);

-- Authenticated pilot users can now browse the existing seed catalog. Prices
-- stay null until the explicit approval workflow supplies them.
update public.service_categories
set status = 'pilot'
where status = 'draft'
  and code in ('AIR-CONDITIONING', 'PLUMBING', 'ELECTRICAL');
update public.service_items
set status = 'pilot'
where status = 'draft'
  and code in (
    'AC-CLEAN-WALL', 'AC-CLEAN-FLOOR-CEILING', 'AC-CLEAN-CASSETTE',
    'AC-DRAIN-CLEAR', 'AC-FAULT-INSPECTION', 'PL-FAUCET-REPLACE',
    'PL-BIDET-REPLACE', 'PL-TOILET-INSTALL', 'PL-DRAIN-UNCLOG',
    'PL-LEAK-INSPECTION', 'EL-SOCKET-SWITCH-REPLACE',
    'EL-SOCKET-SWITCH-SURFACE', 'EL-LIGHT-INSTALL',
    'EL-CEILING-FAN-INSTALL', 'EL-FAULT-INSPECTION'
  );

grant select on public.service_requests, public.request_attachments to authenticated;
revoke insert, update, delete on public.service_requests, public.request_attachments
  from anon, authenticated;

revoke all on function public.save_service_request_draft(
  uuid, uuid, uuid, public.request_entry_point, text, integer,
  public.request_urgency, date, text, jsonb, jsonb, uuid
) from public, anon;
revoke all on function public.cancel_service_request_draft(uuid)
  from public, anon;
revoke all on function public.register_request_attachment(uuid, text, text, integer)
  from public, anon;
revoke all on function public.delete_request_attachment(uuid)
  from public, anon;

grant execute on function public.save_service_request_draft(
  uuid, uuid, uuid, public.request_entry_point, text, integer,
  public.request_urgency, date, text, jsonb, jsonb, uuid
) to authenticated;
grant execute on function public.cancel_service_request_draft(uuid)
  to authenticated;
grant execute on function public.register_request_attachment(uuid, text, text, integer)
  to authenticated;
grant execute on function public.delete_request_attachment(uuid)
  to authenticated;
