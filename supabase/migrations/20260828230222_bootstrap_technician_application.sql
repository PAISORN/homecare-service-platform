-- Atomically add the non-privileged technician role and create the applicant's
-- draft profile. Existing roles and technician review state are never reset.
create or replace function public.bootstrap_technician_application()
returns public.technician_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_status public.account_status;
  v_profile public.technician_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select account_status
  into v_account_status
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Account profile is unavailable' using errcode = '42501';
  end if;

  if v_account_status <> 'active' then
    raise exception 'Account must be active' using errcode = '42501';
  end if;

  insert into public.account_roles (user_id, role)
  values (v_user_id, 'customer')
  on conflict (user_id, role) do nothing;

  insert into public.account_roles (user_id, role)
  values (v_user_id, 'technician')
  on conflict (user_id, role) do nothing;

  insert into public.technician_profiles (user_id, verification_status)
  values (v_user_id, 'draft')
  on conflict (user_id) do nothing;

  select *
  into strict v_profile
  from public.technician_profiles
  where user_id = v_user_id;

  return v_profile;
end;
$$;

revoke all on function public.bootstrap_technician_application() from public;
grant execute on function public.bootstrap_technician_application() to authenticated;
