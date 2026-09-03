-- Phase 3C opens customer request submission and a privacy-preserving
-- technician discovery feed. Area and availability matching remain deferred.

create type public.technician_interest_status as enum ('active', 'withdrawn');

-- Split the prior FOR ALL owner policy so SELECT has only the dedicated read
-- policy. This keeps the same write boundary without duplicate SELECT checks.
drop policy "technician_skills_owner_manage_active" on public.technician_skills;
create policy "technician_skills_owner_insert_active"
on public.technician_skills for insert to authenticated
with check (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and public.has_account_role('technician')
);
create policy "technician_skills_owner_update_active"
on public.technician_skills for update to authenticated
using (
  technician_id = (select auth.uid())
  and private.is_active_account()
)
with check (
  technician_id = (select auth.uid())
  and private.is_active_account()
  and public.has_account_role('technician')
);
create policy "technician_skills_owner_delete_active"
on public.technician_skills for delete to authenticated
using (
  technician_id = (select auth.uid())
  and private.is_active_account()
);

alter table public.service_requests
  add column submitted_at timestamptz;

alter table public.service_requests
  add constraint service_requests_matching_submitted_at check (
    status <> 'matching' or submitted_at is not null
  );

create table public.technician_interests (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null
    references public.service_requests (id) on delete cascade,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete cascade,
  status public.technician_interest_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, technician_id)
);

create index service_requests_matching_category_submitted_idx
  on public.service_requests (service_category_id, submitted_at desc)
  where status = 'matching';
create index technician_interests_technician_status_updated_idx
  on public.technician_interests (technician_id, status, updated_at desc);
create index technician_interests_request_status_idx
  on public.technician_interests (service_request_id, status);

create trigger technician_interests_set_updated_at
before update on public.technician_interests
for each row execute function public.set_updated_at();

alter table public.technician_interests enable row level security;

create policy "technician_interests_owner_select"
on public.technician_interests for select to authenticated
using (
  technician_id = (select auth.uid())
  and private.is_active_account()
);

revoke all on public.technician_interests from public, anon, authenticated;
grant select on public.technician_interests to authenticated;

create or replace function private.is_verified_technician()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.account_roles as role
      on role.user_id = profile.id and role.role = 'technician'
    join public.technician_profiles as technician
      on technician.user_id = profile.id
    where profile.id = (select auth.uid())
      and profile.account_status = 'active'
      and technician.verification_status = 'verified'
  );
$$;

revoke execute on function private.is_verified_technician()
  from public, anon, authenticated, service_role;

create or replace function public.submit_service_request(
  p_request_id uuid
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_request public.service_requests;
begin
  if v_customer_id is null or not public.has_account_role('customer') then
    raise exception 'Customer role required';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
    and customer_id = v_customer_id
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Service request draft not found';
  end if;
  if v_request.safety_status <> 'clear' then
    raise exception 'Safety stop prevents request submission';
  end if;
  if v_request.preferred_date is not null
     and v_request.preferred_date < current_date then
    raise exception 'Preferred date cannot be in the past';
  end if;
  if not exists (
    select 1 from public.service_categories
    where id = v_request.service_category_id and status in ('pilot', 'active')
  ) then
    raise exception 'Service category unavailable';
  end if;
  if v_request.service_item_id is not null and not exists (
    select 1 from public.service_items
    where id = v_request.service_item_id
      and service_category_id = v_request.service_category_id
      and status in ('pilot', 'active')
  ) then
    raise exception 'Service item unavailable';
  end if;

  update public.service_requests
  set status = 'matching', submitted_at = now()
  where id = p_request_id
  returning * into v_request;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_customer_id,
    'service_request.submitted',
    'service_request',
    v_request.id,
    jsonb_build_object(
      'entry_point', v_request.entry_point,
      'urgency', v_request.urgency,
      'has_service_item', v_request.service_item_id is not null
    )
  );

  return v_request;
end;
$$;

create or replace function public.cancel_service_request(
  p_request_id uuid
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_request public.service_requests;
begin
  if v_customer_id is null or not public.has_account_role('customer') then
    raise exception 'Customer role required';
  end if;

  update public.service_requests
  set status = 'cancelled'
  where id = p_request_id
    and customer_id = v_customer_id
    and status = 'matching'
  returning * into v_request;

  if not found then
    raise exception 'Matching service request not found';
  end if;

  update public.technician_interests
  set status = 'withdrawn'
  where service_request_id = p_request_id and status = 'active';

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_customer_id,
    'service_request.cancelled',
    'service_request',
    v_request.id,
    jsonb_build_object('previous_status', 'matching')
  );

  return v_request;
end;
$$;

create or replace function public.list_matching_service_requests()
returns table (
  request_id uuid,
  category_name_th text,
  item_name_th text,
  quantity smallint,
  urgency public.request_urgency,
  preferred_date date,
  preferred_time_window text,
  price_model public.price_model,
  submitted_at timestamptz,
  interest_status public.technician_interest_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_verified_technician() then
    raise exception 'Verified technician required';
  end if;

  return query
  select
    request.id,
    category.name_th,
    item.name_th,
    request.quantity,
    request.urgency,
    request.preferred_date,
    request.preferred_time_window,
    item.price_model,
    request.submitted_at,
    interest.status
  from public.service_requests as request
  join public.service_categories as category
    on category.id = request.service_category_id
  join public.technician_skills as skill
    on skill.service_category_id = request.service_category_id
   and skill.technician_id = (select auth.uid())
   and skill.is_active
  left join public.service_items as item
    on item.id = request.service_item_id
  left join public.technician_interests as interest
    on interest.service_request_id = request.id
   and interest.technician_id = (select auth.uid())
  where request.status = 'matching'
    and request.safety_status = 'clear'
    and category.status in ('pilot', 'active')
    and (item.id is null or item.status in ('pilot', 'active'))
  order by request.submitted_at desc, request.id
  limit 50;
end;
$$;

create or replace function public.express_technician_interest(
  p_request_id uuid
)
returns public.technician_interests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician_id uuid := (select auth.uid());
  v_interest public.technician_interests;
begin
  if not private.is_verified_technician() then
    raise exception 'Verified technician required';
  end if;
  if not exists (
    select 1
    from public.service_requests as request
    join public.technician_skills as skill
      on skill.service_category_id = request.service_category_id
     and skill.technician_id = v_technician_id
     and skill.is_active
    where request.id = p_request_id
      and request.status = 'matching'
      and request.safety_status = 'clear'
  ) then
    raise exception 'Matching service request not found';
  end if;

  insert into public.technician_interests (
    service_request_id, technician_id, status
  ) values (p_request_id, v_technician_id, 'active')
  on conflict (service_request_id, technician_id)
  do update set status = 'active'
  returning * into v_interest;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_technician_id,
    'technician_interest.expressed',
    'technician_interest',
    v_interest.id,
    jsonb_build_object('service_request_id', p_request_id)
  );

  return v_interest;
end;
$$;

create or replace function public.withdraw_technician_interest(
  p_request_id uuid
)
returns public.technician_interests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician_id uuid := (select auth.uid());
  v_interest public.technician_interests;
begin
  if not private.is_verified_technician() then
    raise exception 'Verified technician required';
  end if;

  update public.technician_interests
  set status = 'withdrawn'
  where service_request_id = p_request_id
    and technician_id = v_technician_id
    and status = 'active'
  returning * into v_interest;

  if not found then
    raise exception 'Active technician interest not found';
  end if;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_technician_id,
    'technician_interest.withdrawn',
    'technician_interest',
    v_interest.id,
    jsonb_build_object('service_request_id', p_request_id)
  );

  return v_interest;
end;
$$;

revoke execute on function public.submit_service_request(uuid)
  from public, anon;
revoke execute on function public.cancel_service_request(uuid)
  from public, anon;
revoke execute on function public.list_matching_service_requests()
  from public, anon;
revoke execute on function public.express_technician_interest(uuid)
  from public, anon;
revoke execute on function public.withdraw_technician_interest(uuid)
  from public, anon;

grant execute on function public.submit_service_request(uuid)
  to authenticated;
grant execute on function public.cancel_service_request(uuid)
  to authenticated;
grant execute on function public.list_matching_service_requests()
  to authenticated;
grant execute on function public.express_technician_interest(uuid)
  to authenticated;
grant execute on function public.withdraw_technician_interest(uuid)
  to authenticated;
