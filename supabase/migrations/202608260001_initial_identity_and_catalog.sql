create type public.account_role as enum ('customer', 'technician', 'administrator');
create type public.technician_verification_status as enum (
  'draft',
  'pending_review',
  'verified',
  'rejected',
  'suspended'
);
create type public.technician_document_type as enum (
  'national_id',
  'selfie',
  'professional_certificate',
  'criminal_record',
  'other'
);
create type public.document_review_status as enum ('pending', 'approved', 'rejected');
create type public.price_model as enum ('fixed', 'evidence_quote', 'onsite_inspection');
create type public.catalog_status as enum ('draft', 'pilot', 'active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.account_role not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id) on delete set null,
  primary key (user_id, role)
);

create table public.service_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  address_line text not null check (char_length(trim(address_line)) between 1 and 500),
  building text,
  floor text,
  unit text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  access_instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_location_coordinates_together check (
    (latitude is null and longitude is null)
    or (latitude is not null and longitude is not null)
  )
);

create table public.technician_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text,
  verification_status public.technician_verification_status not null default 'draft',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_verification_metadata check (
    (verification_status = 'verified' and verified_at is not null and verified_by is not null)
    or verification_status <> 'verified'
  )
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  name_th text not null check (char_length(trim(name_th)) between 1 and 120),
  description_th text,
  status public.catalog_status not null default 'draft',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.technician_skills (
  technician_id uuid not null references public.technician_profiles (user_id) on delete cascade,
  service_category_id uuid not null references public.service_categories (id) on delete restrict,
  years_experience smallint check (years_experience between 0 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (technician_id, service_category_id)
);

create table public.technician_documents (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles (user_id) on delete cascade,
  document_type public.technician_document_type not null,
  storage_path text not null unique check (storage_path !~ '^https?://'),
  review_status public.document_review_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_document_review_metadata check (
    (review_status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (review_status <> 'pending' and reviewed_at is not null and reviewed_by is not null)
  )
);

create table public.service_items (
  id uuid primary key default gen_random_uuid(),
  service_category_id uuid not null references public.service_categories (id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  name_th text not null check (char_length(trim(name_th)) between 1 and 160),
  description_th text,
  price_model public.price_model not null,
  base_labor_price numeric(12, 2) check (base_labor_price is null or base_labor_price >= 0),
  currency char(3) not null default 'THB' check (currency ~ '^[A-Z]{3}$'),
  pricing_config jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing_config) = 'object'),
  intake_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(intake_schema) = 'object'),
  warranty_days integer check (warranty_days is null or warranty_days >= 0),
  status public.catalog_status not null default 'draft',
  effective_from timestamptz,
  effective_until timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_item_effective_window check (
    effective_until is null or effective_from is null or effective_until > effective_from
  )
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(trim(action)) between 1 and 120),
  entity_type text not null check (char_length(trim(entity_type)) between 1 and 120),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index service_locations_one_default_per_customer
  on public.service_locations (customer_id)
  where is_default;
create index service_locations_customer_id_idx on public.service_locations (customer_id);
create index account_roles_role_user_idx on public.account_roles (role, user_id);
create index technician_profiles_verification_status_idx on public.technician_profiles (verification_status);
create index technician_skills_category_active_idx on public.technician_skills (service_category_id, is_active);
create index technician_documents_technician_review_idx on public.technician_documents (technician_id, review_status);
create index service_categories_status_sort_idx on public.service_categories (status, sort_order);
create index service_items_category_status_idx on public.service_items (service_category_id, status);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_user_id, created_at desc);

create or replace function public.has_account_role(required_role public.account_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.account_roles
    where user_id = (select auth.uid())
      and role = required_role
  );
$$;

revoke all on function public.has_account_role(public.account_role) from public;
grant execute on function public.has_account_role(public.account_role) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger service_locations_set_updated_at before update on public.service_locations
for each row execute function public.set_updated_at();
create trigger technician_profiles_set_updated_at before update on public.technician_profiles
for each row execute function public.set_updated_at();
create trigger technician_skills_set_updated_at before update on public.technician_skills
for each row execute function public.set_updated_at();
create trigger technician_documents_set_updated_at before update on public.technician_documents
for each row execute function public.set_updated_at();
create trigger service_categories_set_updated_at before update on public.service_categories
for each row execute function public.set_updated_at();
create trigger service_items_set_updated_at before update on public.service_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'สมาชิก HomeCare'),
    new.phone
  );

  insert into public.account_roles (user_id, role)
  values (new.id, 'customer');

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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

  if new.verification_status is distinct from old.verification_status
    or new.verified_at is distinct from old.verified_at
    or new.verified_by is distinct from old.verified_by
    or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Only an administrator can change verification fields';
  end if;

  return new;
end;
$$;

create trigger technician_profiles_protect_verification
before update on public.technician_profiles
for each row execute function public.protect_technician_verification_fields();

create or replace function public.audit_technician_verification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.verification_status is distinct from new.verification_status then
    insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'technician.verification_status_changed',
      'technician_profile',
      new.user_id,
      jsonb_build_object('from', old.verification_status, 'to', new.verification_status)
    );
  end if;
  return new;
end;
$$;

create trigger technician_profiles_audit_verification
after update on public.technician_profiles
for each row execute function public.audit_technician_verification_change();

alter table public.profiles enable row level security;
alter table public.account_roles enable row level security;
alter table public.service_locations enable row level security;
alter table public.technician_profiles enable row level security;
alter table public.technician_skills enable row level security;
alter table public.technician_documents enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_items enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles_select_own_or_admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_account_role('administrator'));
create policy "profiles_update_own_or_admin"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.has_account_role('administrator'))
with check (id = (select auth.uid()) or public.has_account_role('administrator'));

create policy "account_roles_select_own_or_admin"
on public.account_roles for select to authenticated
using (user_id = (select auth.uid()) or public.has_account_role('administrator'));
create policy "account_roles_self_enroll_non_privileged"
on public.account_roles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role in ('customer', 'technician')
  and assigned_by is null
);
create policy "account_roles_admin_manage"
on public.account_roles for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "service_locations_owner_or_admin_select"
on public.service_locations for select to authenticated
using (customer_id = (select auth.uid()) or public.has_account_role('administrator'));
create policy "service_locations_owner_insert"
on public.service_locations for insert to authenticated
with check (customer_id = (select auth.uid()));
create policy "service_locations_owner_update"
on public.service_locations for update to authenticated
using (customer_id = (select auth.uid()))
with check (customer_id = (select auth.uid()));
create policy "service_locations_owner_delete"
on public.service_locations for delete to authenticated
using (customer_id = (select auth.uid()));

create policy "technician_profiles_select_relevant"
on public.technician_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  or verification_status = 'verified'
  or public.has_account_role('administrator')
);
create policy "technician_profiles_owner_insert_draft"
on public.technician_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.has_account_role('technician')
  and verification_status = 'draft'
  and verified_at is null
  and verified_by is null
  and rejection_reason is null
);
create policy "technician_profiles_owner_update"
on public.technician_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "technician_profiles_admin_manage"
on public.technician_profiles for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "technician_skills_select_relevant"
on public.technician_skills for select to authenticated
using (
  technician_id = (select auth.uid())
  or exists (
    select 1 from public.technician_profiles
    where user_id = technician_id and verification_status = 'verified'
  )
  or public.has_account_role('administrator')
);
create policy "technician_skills_owner_manage"
on public.technician_skills for all to authenticated
using (technician_id = (select auth.uid()))
with check (technician_id = (select auth.uid()) and public.has_account_role('technician'));
create policy "technician_skills_admin_manage"
on public.technician_skills for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "technician_documents_owner_or_admin_select"
on public.technician_documents for select to authenticated
using (technician_id = (select auth.uid()) or public.has_account_role('administrator'));
create policy "technician_documents_owner_insert_pending"
on public.technician_documents for insert to authenticated
with check (
  technician_id = (select auth.uid())
  and public.has_account_role('technician')
  and review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
);
create policy "technician_documents_owner_update_pending"
on public.technician_documents for update to authenticated
using (technician_id = (select auth.uid()) and review_status = 'pending')
with check (
  technician_id = (select auth.uid())
  and review_status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and rejection_reason is null
);
create policy "technician_documents_owner_delete_pending"
on public.technician_documents for delete to authenticated
using (technician_id = (select auth.uid()) and review_status = 'pending');
create policy "technician_documents_admin_manage"
on public.technician_documents for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "service_categories_anon_read_active"
on public.service_categories for select to anon
using (status = 'active');
create policy "service_categories_authenticated_read_available"
on public.service_categories for select to authenticated
using (status in ('pilot', 'active') or public.has_account_role('administrator'));
create policy "service_categories_admin_manage"
on public.service_categories for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "service_items_anon_read_active"
on public.service_items for select to anon
using (status = 'active');
create policy "service_items_authenticated_read_available"
on public.service_items for select to authenticated
using (status in ('pilot', 'active') or public.has_account_role('administrator'));
create policy "service_items_admin_manage"
on public.service_items for all to authenticated
using (public.has_account_role('administrator'))
with check (public.has_account_role('administrator'));

create policy "audit_log_admin_read"
on public.audit_log for select to authenticated
using (public.has_account_role('administrator'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technician-documents',
  'technician-documents',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do nothing;

create policy "technician_document_files_owner_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_account_role('technician')
);
create policy "technician_document_files_owner_or_admin_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.has_account_role('administrator')
  )
);
create policy "technician_document_files_owner_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "technician_document_files_owner_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

grant usage on schema public to anon, authenticated;
grant select on public.service_categories, public.service_items to anon;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.account_roles to authenticated;
grant select, insert, update, delete on public.service_locations to authenticated;
grant select, insert, update, delete on public.technician_profiles to authenticated;
grant select, insert, update, delete on public.technician_skills to authenticated;
grant select, insert, update, delete on public.technician_documents to authenticated;
grant select, insert, update, delete on public.service_categories to authenticated;
grant select, insert, update, delete on public.service_items to authenticated;
grant select on public.audit_log to authenticated;
