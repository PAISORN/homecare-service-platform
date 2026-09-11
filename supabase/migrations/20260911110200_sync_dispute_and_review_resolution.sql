begin;

create function private.sync_service_quality_dispute_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'escalated' and old.status is distinct from 'escalated' then
    update public.service_job_reviews
    set status = 'hidden',
      moderated_by = (select auth.uid()),
      moderated_at = now(),
      moderation_note = 'ซ่อนระหว่างตรวจสอบข้อพิพาท',
      updated_at = now()
    where service_job_id = new.service_job_id
      and status <> 'hidden';
  elsif old.status = 'escalated' and new.status in ('resolved', 'dismissed') then
    update public.service_disputes
    set status = 'resolved',
      decision_note = new.decision_note,
      decided_by = new.decided_by,
      decided_at = new.decided_at,
      updated_at = now()
    where case_id = new.id and status <> 'resolved';

    update public.service_job_reviews
    set status = 'pending_moderation',
      moderated_by = null,
      moderated_at = null,
      moderation_note = null,
      updated_at = now()
    where service_job_id = new.service_job_id
      and moderation_note = 'ซ่อนระหว่างตรวจสอบข้อพิพาท';
  end if;
  return new;
end;
$$;

create trigger service_quality_cases_sync_dispute_state
after update of status on public.service_quality_cases
for each row execute function private.sync_service_quality_dispute_state();

create or replace function public.admin_moderate_service_job_review(
  p_review_id uuid, p_status public.service_job_review_status, p_note text
)
returns public.service_job_reviews language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid()); v_review public.service_job_reviews;
begin
  if not private.has_admin_permission('case_management', v_actor) then
    raise exception 'Case management permission required' using errcode = '42501';
  end if;
  if p_status not in ('published', 'hidden')
    or char_length(trim(coalesce(p_note, ''))) not between 10 and 1000 then
    raise exception 'Moderation decision and note required' using errcode = '22023';
  end if;
  if p_status = 'published' and exists (
    select 1 from public.service_job_reviews r
    join public.service_disputes d on d.service_job_id = r.service_job_id
    where r.id = p_review_id and d.status <> 'resolved'
  ) then
    raise exception 'Review is hidden during an open dispute' using errcode = '55000';
  end if;
  update public.service_job_reviews set status = p_status, moderated_by = v_actor,
    moderated_at = now(), moderation_note = trim(p_note), updated_at = now()
  where id = p_review_id returning * into v_review;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  insert into public.audit_log (actor_user_id, action, entity_type, entity_id, metadata)
  values (v_actor, 'service_quality.review_moderated', 'service_job_review', p_review_id,
    jsonb_build_object('status', p_status, 'real_money_moved', false));
  return v_review;
end;
$$;

commit;
