-- Phase 3D lets customers compare at most three interested technicians,
-- receive a sealed evidence-based quotation, and select one technician.
-- Creating the service job, appointments, chat, and payments remains deferred.

create type public.quotation_status as enum (
  'submitted',
  'withdrawn',
  'accepted',
  'declined'
);

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  service_request_id uuid not null
    references public.service_requests (id) on delete restrict,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete restrict,
  scope_description text not null
    check (char_length(trim(scope_description)) between 10 and 2000),
  labor_amount numeric(12, 2) not null
    check (labor_amount > 0),
  currency char(3) not null default 'THB'
    check (currency ~ '^[A-Z]{3}$'),
  status public.quotation_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_request_id, technician_id)
);

create table public.service_request_selections (
  service_request_id uuid primary key
    references public.service_requests (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  technician_id uuid not null
    references public.technician_profiles (user_id) on delete restrict,
  technician_interest_id uuid not null unique
    references public.technician_interests (id) on delete restrict,
  quotation_id uuid unique references public.quotations (id) on delete restrict,
  price_model public.price_model not null,
  agreed_labor_amount numeric(12, 2) not null
    check (agreed_labor_amount > 0),
  currency char(3) not null default 'THB'
    check (currency ~ '^[A-Z]{3}$'),
  selected_at timestamptz not null default now()
);

create index quotations_technician_status_updated_idx
  on public.quotations (technician_id, status, updated_at desc);
create index quotations_request_status_idx
  on public.quotations (service_request_id, status);
create index service_request_selections_customer_selected_idx
  on public.service_request_selections (customer_id, selected_at desc);
create index service_request_selections_technician_selected_idx
  on public.service_request_selections (technician_id, selected_at desc);

create trigger quotations_set_updated_at
before update on public.quotations
for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;
alter table public.service_request_selections enable row level security;

revoke all on public.quotations from public, anon, authenticated;
revoke all on public.service_request_selections from public, anon, authenticated;

-- The returned row type grows in this phase, so PostgreSQL requires the
-- previous function to be dropped before it can be recreated.
drop function public.list_matching_service_requests();

create function public.list_matching_service_requests()
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
  interest_status public.technician_interest_status,
  quotation_status public.quotation_status,
  quotation_scope_description text,
  quotation_labor_amount numeric,
  quotation_submitted_at timestamptz
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
    coalesce(item.price_model, 'evidence_quote'::public.price_model),
    request.submitted_at,
    interest.status,
    quotation.status,
    quotation.scope_description,
    quotation.labor_amount,
    quotation.submitted_at
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
  left join public.quotations as quotation
    on quotation.service_request_id = request.id
   and quotation.technician_id = (select auth.uid())
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

  perform 1
  from public.service_requests as request
  join public.technician_skills as skill
    on skill.service_category_id = request.service_category_id
   and skill.technician_id = v_technician_id
   and skill.is_active
  where request.id = p_request_id
    and request.status = 'matching'
    and request.safety_status = 'clear'
  for update of request;

  if not found then
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

  perform 1
  from public.service_requests
  where id = p_request_id and status = 'matching'
  for update;
  if not found then
    raise exception 'Matching service request not found';
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

  update public.quotations
  set status = 'withdrawn'
  where service_request_id = p_request_id
    and technician_id = v_technician_id
    and status = 'submitted';

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

create or replace function public.submit_technician_quotation(
  p_request_id uuid,
  p_scope_description text,
  p_labor_amount numeric
)
returns public.quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician_id uuid := (select auth.uid());
  v_scope text := trim(coalesce(p_scope_description, ''));
  v_currency char(3);
  v_quotation public.quotations;
begin
  if not private.is_verified_technician() then
    raise exception 'Verified technician required';
  end if;
  if char_length(v_scope) not between 10 and 2000 then
    raise exception 'Quotation scope must be between 10 and 2000 characters';
  end if;
  if p_labor_amount is null or p_labor_amount <= 0 then
    raise exception 'Quotation labor amount must be positive';
  end if;

  select coalesce(item.currency, 'THB'::bpchar)
  into v_currency
  from public.service_requests as request
  left join public.service_items as item on item.id = request.service_item_id
  join public.technician_interests as interest
    on interest.service_request_id = request.id
   and interest.technician_id = v_technician_id
   and interest.status = 'active'
  where request.id = p_request_id
    and request.status = 'matching'
    and coalesce(item.price_model, 'evidence_quote'::public.price_model) = 'evidence_quote'
  for update of request;

  if not found then
    raise exception 'Active evidence quotation request not found';
  end if;

  insert into public.quotations (
    service_request_id,
    technician_id,
    scope_description,
    labor_amount,
    currency,
    status,
    submitted_at
  ) values (
    p_request_id,
    v_technician_id,
    v_scope,
    p_labor_amount,
    v_currency,
    'submitted',
    now()
  )
  on conflict (service_request_id, technician_id)
  do update set
    scope_description = excluded.scope_description,
    labor_amount = excluded.labor_amount,
    currency = excluded.currency,
    status = 'submitted',
    submitted_at = excluded.submitted_at
  returning * into v_quotation;

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_technician_id,
    'quotation.submitted',
    'quotation',
    v_quotation.id,
    jsonb_build_object(
      'service_request_id', p_request_id,
      'labor_amount', p_labor_amount,
      'currency', v_quotation.currency
    )
  );

  return v_quotation;
end;
$$;

create or replace function public.list_customer_request_shortlist(
  p_request_id uuid
)
returns table (
  request_id uuid,
  request_status public.service_request_status,
  price_model public.price_model,
  catalog_labor_amount numeric,
  currency text,
  technician_id uuid,
  display_name text,
  technician_bio text,
  years_experience smallint,
  interest_created_at timestamptz,
  quotation_id uuid,
  quotation_scope_description text,
  quotation_labor_amount numeric,
  quotation_submitted_at timestamptz,
  shortlist_rank bigint,
  is_selected boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
begin
  if v_customer_id is null or not public.has_account_role('customer') then
    raise exception 'Customer role required';
  end if;
  if not exists (
    select 1 from public.service_requests
    where id = p_request_id and customer_id = v_customer_id
      and status in ('matching', 'technician_selected')
  ) then
    raise exception 'Customer service request not found';
  end if;

  return query
  with ranked as (
    select
      interest.*,
      row_number() over (
        order by
          coalesce(quotation.status = 'submitted', false) desc,
          coalesce(skill.years_experience, 0) desc,
          interest.created_at,
          interest.technician_id
      ) as shortlist_rank
    from public.technician_interests as interest
    join public.service_requests as request
      on request.id = interest.service_request_id
    join public.technician_profiles as technician
      on technician.user_id = interest.technician_id
     and technician.verification_status = 'verified'
    join public.profiles as profile
      on profile.id = interest.technician_id
     and profile.account_status = 'active'
    left join public.technician_skills as skill
      on skill.technician_id = interest.technician_id
     and skill.service_category_id = request.service_category_id
     and skill.is_active
    left join public.quotations as quotation
      on quotation.service_request_id = interest.service_request_id
     and quotation.technician_id = interest.technician_id
    where interest.service_request_id = p_request_id
      and (
        interest.status = 'active'
        or exists (
          select 1 from public.service_request_selections as chosen
          where chosen.service_request_id = p_request_id
            and chosen.technician_id = interest.technician_id
        )
      )
  )
  select
    request.id,
    request.status,
    coalesce(item.price_model, 'evidence_quote'::public.price_model),
    item.base_labor_price,
    coalesce(item.currency, 'THB'::bpchar)::text,
    ranked.technician_id,
    profile.display_name,
    technician.bio,
    skill.years_experience,
    ranked.created_at,
    quotation.id,
    quotation.scope_description,
    quotation.labor_amount,
    quotation.submitted_at,
    ranked.shortlist_rank,
    coalesce(selection.technician_id = ranked.technician_id, false)
  from ranked
  join public.service_requests as request on request.id = ranked.service_request_id
  join public.profiles as profile on profile.id = ranked.technician_id
  join public.technician_profiles as technician on technician.user_id = ranked.technician_id
  left join public.technician_skills as skill
    on skill.technician_id = ranked.technician_id
   and skill.service_category_id = request.service_category_id
   and skill.is_active
  left join public.service_items as item on item.id = request.service_item_id
  left join public.quotations as quotation
    on quotation.service_request_id = request.id
   and quotation.technician_id = ranked.technician_id
   and quotation.status in ('submitted', 'accepted')
  left join public.service_request_selections as selection
    on selection.service_request_id = request.id
  where ranked.shortlist_rank <= 3
  order by ranked.shortlist_rank;
end;
$$;

create or replace function public.select_technician_for_request(
  p_request_id uuid,
  p_technician_id uuid
)
returns public.service_request_selections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_request public.service_requests;
  v_interest public.technician_interests;
  v_item public.service_items;
  v_price_model public.price_model;
  v_quotation public.quotations;
  v_amount numeric(12, 2);
  v_currency char(3);
  v_is_shortlisted boolean;
  v_selection public.service_request_selections;
begin
  if v_customer_id is null or not public.has_account_role('customer') then
    raise exception 'Customer role required';
  end if;

  select * into v_request
  from public.service_requests
  where id = p_request_id
    and customer_id = v_customer_id
    and status = 'matching'
  for update;
  if not found then
    raise exception 'Matching customer service request not found';
  end if;

  perform 1 from public.technician_interests
  where service_request_id = p_request_id
  for update;

  select * into v_interest
  from public.technician_interests
  where service_request_id = p_request_id
    and technician_id = p_technician_id
    and status = 'active';
  if not found then
    raise exception 'Active shortlisted technician interest not found';
  end if;

  with ranked as (
    select
      interest.technician_id,
      row_number() over (
        order by
          coalesce(quotation.status = 'submitted', false) desc,
          coalesce(skill.years_experience, 0) desc,
          interest.created_at,
          interest.technician_id
      ) as shortlist_rank
    from public.technician_interests as interest
    left join public.technician_skills as skill
      on skill.technician_id = interest.technician_id
     and skill.service_category_id = v_request.service_category_id
     and skill.is_active
    left join public.quotations as quotation
      on quotation.service_request_id = interest.service_request_id
     and quotation.technician_id = interest.technician_id
    join public.technician_profiles as technician
      on technician.user_id = interest.technician_id
     and technician.verification_status = 'verified'
    join public.profiles as profile
      on profile.id = interest.technician_id
     and profile.account_status = 'active'
    where interest.service_request_id = p_request_id
      and interest.status = 'active'
  )
  select exists (
    select 1 from ranked
    where technician_id = p_technician_id and shortlist_rank <= 3
  ) into v_is_shortlisted;
  if not v_is_shortlisted then
    raise exception 'Technician is not in the current shortlist';
  end if;

  if v_request.service_item_id is not null then
    select * into v_item from public.service_items
    where id = v_request.service_item_id;
  end if;
  v_price_model := coalesce(v_item.price_model, 'evidence_quote');

  if v_price_model = 'evidence_quote' then
    select * into v_quotation
    from public.quotations
    where service_request_id = p_request_id
      and technician_id = p_technician_id
      and status = 'submitted'
    for update;
    if not found then
      raise exception 'Submitted quotation required';
    end if;
    v_amount := v_quotation.labor_amount;
    v_currency := v_quotation.currency;
  else
    if v_item.base_labor_price is null or v_item.base_labor_price <= 0 then
      raise exception 'Approved catalog labor price required';
    end if;
    v_amount := v_item.base_labor_price;
    v_currency := v_item.currency;
  end if;

  insert into public.service_request_selections (
    service_request_id,
    customer_id,
    technician_id,
    technician_interest_id,
    quotation_id,
    price_model,
    agreed_labor_amount,
    currency
  ) values (
    p_request_id,
    v_customer_id,
    p_technician_id,
    v_interest.id,
    v_quotation.id,
    v_price_model,
    v_amount,
    v_currency
  ) returning * into v_selection;

  update public.service_requests
  set status = 'technician_selected'
  where id = p_request_id;

  update public.technician_interests
  set status = 'withdrawn'
  where service_request_id = p_request_id
    and technician_id <> p_technician_id
    and status = 'active';

  update public.quotations
  set status = case
    when technician_id = p_technician_id then 'accepted'::public.quotation_status
    else 'declined'::public.quotation_status
  end
  where service_request_id = p_request_id and status = 'submitted';

  insert into public.audit_log (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    v_customer_id,
    'service_request.technician_selected',
    'service_request',
    p_request_id,
    jsonb_build_object(
      'technician_id', p_technician_id,
      'price_model', v_price_model,
      'agreed_labor_amount', v_amount,
      'currency', v_currency
    )
  );

  return v_selection;
end;
$$;

revoke execute on function public.submit_technician_quotation(uuid, text, numeric)
  from public, anon;
revoke execute on function public.list_customer_request_shortlist(uuid)
  from public, anon;
revoke execute on function public.select_technician_for_request(uuid, uuid)
  from public, anon;
revoke execute on function public.list_matching_service_requests()
  from public, anon;

grant execute on function public.submit_technician_quotation(uuid, text, numeric)
  to authenticated;
grant execute on function public.list_customer_request_shortlist(uuid)
  to authenticated;
grant execute on function public.select_technician_for_request(uuid, uuid)
  to authenticated;
grant execute on function public.list_matching_service_requests()
  to authenticated;
