create type public.operational_control_key as enum (
  'matching',
  'content',
  'payment'
);

create table public.operational_controls (
  control_key public.operational_control_key primary key,
  enabled boolean not null,
  reason text not null check (char_length(trim(reason)) between 10 and 500),
  revision bigint not null default 1 check (revision > 0),
  updated_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now()
);

comment on table public.operational_controls is
  'Audited pilot kill switches. Disabling a control blocks new work but preserves read and recovery paths.';

insert into public.operational_controls (control_key, enabled, reason)
values
  ('matching', true, 'เปิดรับคำขอและความสนใจรับงานในเขตบริการนำร่อง'),
  ('content', true, 'เปิดการส่งข้อความภายในงานบริการสำหรับรอบนำร่อง'),
  ('payment', false, 'ยังไม่เชื่อมผู้ให้บริการชำระเงินจริง ระบบใช้ข้อมูลจำลองเท่านั้น');

alter table public.operational_controls enable row level security;

insert into public.admin_permissions (user_id, permission, assigned_by)
select role.user_id, 'operations_management', null
from public.account_roles as role
where role.role = 'administrator'
on conflict (user_id, permission) do nothing;

create or replace function private.is_operational_control_enabled(
  p_control_key public.operational_control_key
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select control.enabled
    from public.operational_controls as control
    where control.control_key = p_control_key
  ), false);
$$;

create or replace function private.assert_operational_control_enabled(
  p_control_key public.operational_control_key
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_operational_control_enabled(p_control_key) then
    raise exception 'Operational control % is disabled', p_control_key
      using errcode = '55000';
  end if;
end;
$$;

revoke all on function private.is_operational_control_enabled(
  public.operational_control_key
) from public, anon, authenticated, service_role;
revoke all on function private.assert_operational_control_enabled(
  public.operational_control_key
) from public, anon, authenticated, service_role;

create or replace function public.get_operational_controls()
returns table (
  control_key public.operational_control_key,
  enabled boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not private.is_active_account((select auth.uid())) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  return query
  select
    control.control_key,
    control.enabled,
    control.updated_at
  from public.operational_controls as control
  order by control.control_key;
end;
$$;

create or replace function public.set_operational_control(
  p_control_key public.operational_control_key,
  p_enabled boolean,
  p_reason text
)
returns public.operational_controls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := trim(coalesce(p_reason, ''));
  v_previous_enabled boolean;
  v_control public.operational_controls;
begin
  if v_actor is null
     or not private.has_admin_permission('operations_management', v_actor) then
    raise exception 'Operations management permission required'
      using errcode = '42501';
  end if;
  if char_length(v_reason) not between 10 and 500 then
    raise exception 'Operational reason must contain 10 to 500 characters'
      using errcode = '22023';
  end if;
  if p_control_key = 'payment' and p_enabled then
    raise exception 'Real payment is not available in the pilot sandbox'
      using errcode = '55000';
  end if;

  select enabled into v_previous_enabled
  from public.operational_controls
  where control_key = p_control_key
  for update;
  if not found then
    raise exception 'Operational control not found' using errcode = 'P0002';
  end if;

  update public.operational_controls
  set
    enabled = p_enabled,
    reason = v_reason,
    revision = revision + 1,
    updated_by = v_actor,
    updated_at = now()
  where control_key = p_control_key
  returning * into v_control;

  insert into public.audit_log (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_actor,
    'operational_control.updated',
    'operational_control',
    null,
    jsonb_build_object(
      'control_key', p_control_key,
      'previous_enabled', v_previous_enabled,
      'enabled', p_enabled,
      'revision', v_control.revision,
      'reason_recorded', true
    )
  );

  return v_control;
end;
$$;

create or replace function private.enforce_matching_operational_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'matching' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;
  end if;

  perform private.assert_operational_control_enabled('matching');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('matching:' || new.customer_id::text, 0)
  );
  if (
    select count(*) >= 5
    from public.service_requests as request
    where request.customer_id = new.customer_id
      and request.submitted_at >= now() - interval '10 minutes'
  ) then
    raise exception 'Matching request rate limit exceeded'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger service_requests_enforce_matching_control
before insert or update of status on public.service_requests
for each row execute function private.enforce_matching_operational_control();

create index service_requests_customer_submitted_rate_idx
  on public.service_requests (customer_id, submitted_at desc)
  where submitted_at is not null;

create or replace function private.enforce_interest_operational_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status is not distinct from new.status then
      return new;
    end if;
  end if;

  perform private.assert_operational_control_enabled('matching');
  return new;
end;
$$;

create trigger technician_interests_enforce_matching_control
before insert or update of status on public.technician_interests
for each row execute function private.enforce_interest_operational_control();

create or replace function private.enforce_content_operational_control()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_operational_control_enabled('content');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('content:' || new.sender_user_id::text, 0)
  );
  if (
    select count(*) >= 20
    from public.chat_messages as message
    where message.sender_user_id = new.sender_user_id
      and message.created_at >= now() - interval '1 minute'
  ) then
    raise exception 'Chat message rate limit exceeded'
      using errcode = '54000';
  end if;
  return new;
end;
$$;

create index chat_messages_sender_created_rate_idx
  on public.chat_messages (sender_user_id, created_at desc);

create trigger chat_messages_enforce_content_control
before insert on public.chat_messages
for each row execute function private.enforce_content_operational_control();

create policy "operational_controls_operations_read"
on public.operational_controls for select to authenticated
using (private.has_admin_permission('operations_management'));

revoke all on public.operational_controls from anon, authenticated;
grant select on public.operational_controls to authenticated;

revoke execute on function public.get_operational_controls()
  from public, anon;
grant execute on function public.get_operational_controls()
  to authenticated;

revoke execute on function public.set_operational_control(
  public.operational_control_key,
  boolean,
  text
) from public, anon;
grant execute on function public.set_operational_control(
  public.operational_control_key,
  boolean,
  text
) to authenticated;

revoke all on function private.enforce_matching_operational_control()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_interest_operational_control()
  from public, anon, authenticated, service_role;
revoke all on function private.enforce_content_operational_control()
  from public, anon, authenticated, service_role;
