-- Phase 4E: private device registration, durable job notifications, and
-- deep-link payloads for service-job status, chat, and additional-work events.

create type public.notification_delivery_status as enum (
  'pending', 'processing', 'submitted', 'failed', 'skipped'
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  installation_id uuid not null,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_devices_user_installation_unique
    unique (user_id, installation_id),
  constraint push_devices_token_unique unique (expo_push_token),
  constraint push_devices_token_format check (
    expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete restrict,
  actor_user_id uuid not null references public.profiles (id) on delete restrict,
  service_job_id uuid not null references public.service_jobs (id) on delete restrict,
  event_key text not null check (char_length(event_key) between 3 and 80),
  source_record_id uuid not null,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 240),
  deep_link text not null check (
    deep_link ~ '^/(jobs|technician/jobs)/(detail|chat|work)[?]jobId=[0-9a-f-]{36}$'
  ),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  delivery_status public.notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  provider_response jsonb,
  last_error text check (
    last_error is null or char_length(last_error) <= 500
  ),
  submitted_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_source_recipient_unique
    unique (event_key, source_record_id, recipient_user_id),
  constraint notifications_actor_is_not_recipient
    check (actor_user_id <> recipient_user_id),
  constraint notifications_delivery_shape check (
    (delivery_status = 'submitted' and submitted_at is not null)
    or (delivery_status <> 'submitted' and submitted_at is null)
  )
);

create index push_devices_enabled_user_idx
  on public.push_devices (user_id) where enabled;
create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_dispatch_idx
  on public.notifications (actor_user_id, next_attempt_at, created_at)
  where delivery_status in ('pending', 'processing');

create trigger push_devices_set_updated_at
before update on public.push_devices
for each row execute function public.set_updated_at();

alter table public.push_devices enable row level security;
alter table public.notifications enable row level security;

revoke all on public.push_devices from public, anon, authenticated;
revoke all on public.notifications from public, anon, authenticated;

create policy "notifications_recipient_read"
on public.notifications
for select
to authenticated
using (
  private.is_active_account((select auth.uid()))
  and recipient_user_id = (select auth.uid())
);

grant select on public.notifications to authenticated;

create function public.register_push_device(
  p_installation_id uuid,
  p_expo_push_token text,
  p_platform text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_device_id uuid;
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if p_installation_id is null
    or p_expo_push_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$'
    or p_platform not in ('ios', 'android') then
    raise exception 'Invalid push device registration' using errcode = '22023';
  end if;

  delete from public.push_devices
  where expo_push_token = p_expo_push_token
    and (user_id, installation_id) <> (v_actor_id, p_installation_id);

  insert into public.push_devices (
    user_id, installation_id, expo_push_token, platform, enabled,
    last_registered_at
  ) values (
    v_actor_id, p_installation_id, p_expo_push_token, p_platform, true, now()
  )
  on conflict (user_id, installation_id) do update set
    expo_push_token = excluded.expo_push_token,
    platform = excluded.platform,
    enabled = true,
    last_registered_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

create function public.disable_push_device(p_installation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.push_devices set enabled = false
  where user_id = v_actor_id and installation_id = p_installation_id;
  return found;
end;
$$;

create function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null or not private.is_active_account(v_actor_id) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_user_id = v_actor_id;
  return found;
end;
$$;

revoke all on function public.register_push_device(uuid, text, text)
  from public, anon;
revoke all on function public.disable_push_device(uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.register_push_device(uuid, text, text)
  to authenticated;
grant execute on function public.disable_push_device(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create function private.job_deep_link(
  p_recipient_id uuid,
  p_job public.service_jobs,
  p_destination text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_recipient_id = p_job.customer_id then '/jobs/'
    else '/technician/jobs/'
  end || p_destination || '?jobId=' || p_job.id::text;
$$;

revoke all on function private.job_deep_link(uuid, public.service_jobs, text)
  from public;

create function private.enqueue_job_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_job public.service_jobs,
  p_event_key text,
  p_source_record_id uuid,
  p_title text,
  p_body text,
  p_destination text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deep_link text;
begin
  if p_recipient_id is null or p_actor_id is null
    or p_recipient_id = p_actor_id then
    return;
  end if;

  v_deep_link := private.job_deep_link(
    p_recipient_id, p_job, p_destination
  );
  insert into public.notifications (
    recipient_user_id, actor_user_id, service_job_id, event_key,
    source_record_id, title, body, deep_link, data
  ) values (
    p_recipient_id, p_actor_id, p_job.id, p_event_key,
    p_source_record_id, p_title, p_body, v_deep_link,
    jsonb_build_object(
      'url', v_deep_link,
      'jobId', p_job.id,
      'event', p_event_key
    )
  ) on conflict (event_key, source_record_id, recipient_user_id) do nothing;
end;
$$;

revoke all on function private.enqueue_job_notification(
  uuid, uuid, public.service_jobs, text, uuid, text, text, text
) from public;

create function private.enqueue_job_status_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.service_jobs;
  v_recipient_id uuid;
  v_status_label text;
begin
  select * into v_job from public.service_jobs where id = new.service_job_id;
  if not found or new.actor_user_id not in (v_job.customer_id, v_job.technician_id)
    or new.to_status = 'awaiting_additional_work_approval'
    or new.from_status = 'awaiting_additional_work_approval' then
    return new;
  end if;

  v_recipient_id := case when new.actor_user_id = v_job.customer_id
    then v_job.technician_id else v_job.customer_id end;
  v_status_label := case new.to_status::text
    when 'scheduled' then 'นัดหมายงานแล้ว'
    when 'technician_en_route' then 'ช่างกำลังเดินทาง'
    when 'technician_arrived' then 'ช่างถึงสถานที่แล้ว'
    when 'in_progress' then 'เริ่มดำเนินงานแล้ว'
    when 'awaiting_acceptance' then 'งานพร้อมให้ตรวจรับ'
    when 'cancelled' then 'งานถูกยกเลิก'
    else 'สถานะงานมีการอัปเดต'
  end;

  perform private.enqueue_job_notification(
    v_recipient_id, new.actor_user_id, v_job,
    'job.status.' || new.to_status::text, new.id,
    'สถานะงานบริการมีการอัปเดต', v_status_label, 'detail'
  );
  return new;
end;
$$;

create function private.enqueue_chat_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.service_jobs;
  v_recipient_id uuid;
begin
  select job.* into v_job
  from public.chat_rooms as room
  join public.service_jobs as job on job.id = room.service_job_id
  where room.id = new.chat_room_id;
  if not found or new.sender_user_id not in (v_job.customer_id, v_job.technician_id) then
    return new;
  end if;
  v_recipient_id := case when new.sender_user_id = v_job.customer_id
    then v_job.technician_id else v_job.customer_id end;
  perform private.enqueue_job_notification(
    v_recipient_id, new.sender_user_id, v_job,
    'job.chat.message', new.id,
    'มีข้อความใหม่ในงานบริการ',
    'แตะเพื่อเปิดข้อความที่เกี่ยวข้องกับงาน', 'chat'
  );
  return new;
end;
$$;

create function private.enqueue_additional_work_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.service_jobs;
  v_actor_id uuid;
  v_recipient_id uuid;
  v_event_key text;
  v_title text;
  v_body text;
begin
  select * into v_job from public.service_jobs where id = new.service_job_id;
  if not found then return new; end if;

  if tg_op = 'INSERT' then
    v_actor_id := new.technician_id;
    v_recipient_id := v_job.customer_id;
    v_event_key := 'job.additional_work.requested';
    v_title := 'มีคำขอเพิ่มงานรอการยืนยัน';
    v_body := 'ตรวจสอบขอบเขตและราคาก่อนอนุมัติให้ช่างดำเนินการ';
  elsif old.status = 'pending' and new.status = 'approved' then
    v_actor_id := new.responded_by;
    v_recipient_id := v_job.technician_id;
    v_event_key := 'job.additional_work.approved';
    v_title := 'ลูกค้าอนุมัติงานเพิ่มเติมแล้ว';
    v_body := 'เปิดงานบริการเพื่อดูขอบเขตและดำเนินงานต่อ';
  elsif old.status = 'pending' and new.status = 'rejected' then
    v_actor_id := new.responded_by;
    v_recipient_id := v_job.technician_id;
    v_event_key := 'job.additional_work.rejected';
    v_title := 'ลูกค้าปฏิเสธงานเพิ่มเติม';
    v_body := 'เปิดงานบริการเพื่อตรวจสอบและดำเนินงานตามขอบเขตเดิม';
  else
    return new;
  end if;

  perform private.enqueue_job_notification(
    v_recipient_id, v_actor_id, v_job, v_event_key, new.id,
    v_title, v_body, 'work'
  );
  return new;
end;
$$;

revoke all on function private.enqueue_job_status_notification() from public;
revoke all on function private.enqueue_chat_message_notification() from public;
revoke all on function private.enqueue_additional_work_notification() from public;

create trigger job_status_events_enqueue_notification
after insert on public.job_status_events
for each row execute function private.enqueue_job_status_notification();

create trigger chat_messages_enqueue_notification
after insert on public.chat_messages
for each row execute function private.enqueue_chat_message_notification();

create trigger additional_work_enqueue_notification
after insert or update of status on public.service_job_additional_work_requests
for each row execute function private.enqueue_additional_work_notification();

create function public.claim_job_notifications_for_actor(
  p_actor_id uuid,
  p_limit integer default 25
)
returns setof public.notifications
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null then
    raise exception 'Actor required' using errcode = '22023';
  end if;
  return query
  with candidates as (
    select notification.id
    from public.notifications as notification
    where notification.actor_user_id = p_actor_id
      and notification.delivery_status in ('pending', 'processing')
      and notification.next_attempt_at <= now()
      and (
        notification.delivery_status = 'pending'
        or notification.last_attempt_at < now() - interval '5 minutes'
      )
      and notification.attempt_count < 3
    order by notification.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  update public.notifications as notification set
    delivery_status = 'processing',
    attempt_count = notification.attempt_count + 1,
    last_attempt_at = now(),
    last_error = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

revoke all on function public.claim_job_notifications_for_actor(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_job_notifications_for_actor(uuid, integer)
  to service_role;
