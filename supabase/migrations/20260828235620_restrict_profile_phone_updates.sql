-- The verified phone is owned by Supabase Auth. Application clients may edit
-- presentation fields only; a future verified phone-change workflow must
-- update Auth and the profile projection atomically from trusted server code.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
