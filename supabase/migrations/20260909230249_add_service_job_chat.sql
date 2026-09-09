-- Phase 4C adds one private chat room per service job, explicit memberships,
-- immutable durable messages, and database-triggered private Broadcast events.

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  service_job_id uuid not null unique
    references public.service_jobs(id) on delete restrict,
  topic text not null unique,
  created_at timestamptz not null default now(),
  constraint chat_rooms_topic_format
    check (topic = 'service-job-chat:' || service_job_id::text)
);

create table public.chat_room_memberships (
  chat_room_id uuid not null references public.chat_rooms(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  member_role text not null check (member_role in ('customer', 'technician')),
  created_at timestamptz not null default now(),
  primary key (chat_room_id, user_id)
);

create index chat_room_memberships_user_room_idx
  on public.chat_room_memberships (user_id, chat_room_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_room_id uuid not null references public.chat_rooms(id) on delete restrict,
  sender_user_id uuid not null references public.profiles(id) on delete restrict,
  client_message_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_body_length
    check (char_length(body) between 1 and 2000),
  constraint chat_messages_sender_client_message_unique
    unique (sender_user_id, client_message_id)
);

create index chat_messages_room_created_idx
  on public.chat_messages (chat_room_id, created_at, id);

alter table public.chat_rooms enable row level security;
alter table public.chat_room_memberships enable row level security;
alter table public.chat_messages enable row level security;

create function private.is_chat_room_member(p_chat_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_account((select auth.uid()))
    and exists (
      select 1
      from public.chat_room_memberships as membership
      where membership.chat_room_id = p_chat_room_id
        and membership.user_id = (select auth.uid())
    );
$$;

create function private.can_receive_chat_broadcast(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_account((select auth.uid()))
    and exists (
      select 1
      from public.chat_rooms as room
      join public.chat_room_memberships as membership
        on membership.chat_room_id = room.id
      where room.topic = p_topic
        and membership.user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_chat_room_member(uuid) from public, anon;
revoke all on function private.can_receive_chat_broadcast(text)
  from public, anon;
grant execute on function private.is_chat_room_member(uuid) to authenticated;
grant execute on function private.can_receive_chat_broadcast(text)
  to authenticated;

create policy "chat_rooms_member_read"
on public.chat_rooms
for select
to authenticated
using (private.is_chat_room_member(id));

create policy "chat_room_memberships_self_read"
on public.chat_room_memberships
for select
to authenticated
using (
  private.is_active_account((select auth.uid()))
  and user_id = (select auth.uid())
);

create policy "chat_messages_member_read"
on public.chat_messages
for select
to authenticated
using (private.is_chat_room_member(chat_room_id));

revoke all on table public.chat_rooms from public, anon, authenticated;
revoke all on table public.chat_room_memberships
  from public, anon, authenticated;
revoke all on table public.chat_messages from public, anon, authenticated;
grant select on table public.chat_rooms to authenticated;
grant select on table public.chat_room_memberships to authenticated;
grant select on table public.chat_messages to authenticated;

create policy "chat_members_receive_broadcast"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and private.can_receive_chat_broadcast((select realtime.topic()))
);

create function private.create_service_job_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
begin
  insert into public.chat_rooms (service_job_id, topic)
  values (new.id, 'service-job-chat:' || new.id::text)
  on conflict (service_job_id) do update
    set service_job_id = excluded.service_job_id
  returning id into v_room_id;

  insert into public.chat_room_memberships (
    chat_room_id, user_id, member_role
  ) values
    (v_room_id, new.customer_id, 'customer'),
    (v_room_id, new.technician_id, 'technician')
  on conflict (chat_room_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.create_service_job_chat() from public;

create trigger service_jobs_create_chat
after insert on public.service_jobs
for each row execute function private.create_service_job_chat();

insert into public.chat_rooms (service_job_id, topic)
select job.id, 'service-job-chat:' || job.id::text
from public.service_jobs as job
on conflict (service_job_id) do nothing;

insert into public.chat_room_memberships (
  chat_room_id, user_id, member_role
)
select room.id, participant.user_id, participant.member_role
from public.chat_rooms as room
join public.service_jobs as job on job.id = room.service_job_id
cross join lateral (values
  (job.customer_id, 'customer'),
  (job.technician_id, 'technician')
) as participant(user_id, member_role)
on conflict (chat_room_id, user_id) do nothing;

create function public.send_service_job_message(
  p_job_id uuid,
  p_client_message_id uuid,
  p_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_body text := trim(coalesce(p_body, ''));
  v_room_id uuid;
  v_message public.chat_messages;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_client_message_id is null then
    raise exception 'Client message ID required' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Message body must contain 1 to 2000 characters'
      using errcode = '22023';
  end if;

  select room.id into v_room_id
  from public.chat_rooms as room
  join public.chat_room_memberships as membership
    on membership.chat_room_id = room.id
  where room.service_job_id = p_job_id
    and membership.user_id = v_actor_id;
  if not found then
    raise exception 'Service job not found' using errcode = 'P0002';
  end if;

  insert into public.chat_messages (
    chat_room_id, sender_user_id, client_message_id, body
  ) values (
    v_room_id, v_actor_id, p_client_message_id, v_body
  )
  on conflict (sender_user_id, client_message_id) do nothing
  returning * into v_message;

  if not found then
    select * into v_message
    from public.chat_messages
    where sender_user_id = v_actor_id
      and client_message_id = p_client_message_id;

    if v_message.chat_room_id <> v_room_id or v_message.body <> v_body then
      raise exception 'Client message ID already used' using errcode = '23505';
    end if;
  end if;

  return v_message;
end;
$$;

revoke execute on function public.send_service_job_message(uuid, uuid, text)
  from public, anon;
grant execute on function public.send_service_job_message(uuid, uuid, text)
  to authenticated;

create function private.broadcast_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topic text;
begin
  select room.topic into v_topic
  from public.chat_rooms as room
  where room.id = new.chat_room_id;

  perform realtime.send(to_jsonb(new), 'message_created', v_topic, true);
  return new;
end;
$$;

revoke all on function private.broadcast_chat_message_insert() from public;

create trigger chat_messages_broadcast_insert
after insert on public.chat_messages
for each row execute function private.broadcast_chat_message_insert();
