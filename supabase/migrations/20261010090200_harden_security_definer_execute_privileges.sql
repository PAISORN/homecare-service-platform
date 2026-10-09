-- SECURITY DEFINER trigger helpers execute through their trigger owner. They
-- must not be exposed as callable Data API functions to any API role.
revoke execute on function public.audit_account_role_change()
  from public, anon, authenticated, service_role;
revoke execute on function public.audit_admin_permission_change()
  from public, anon, authenticated, service_role;
revoke execute on function public.block_profile_hard_delete_with_kyc()
  from public, anon, authenticated, service_role;
revoke execute on function public.create_service_job_warranty_on_completion()
  from public, anon, authenticated, service_role;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated, service_role;
revoke execute on function public.protect_technician_document_identity()
  from public, anon, authenticated, service_role;
revoke execute on function public.protect_technician_verification_fields()
  from public, anon, authenticated, service_role;
do $migration$
begin
  -- This event-trigger helper exists on hosted projects created with the
  -- dashboard hardening template, but is absent from a clean local stack.
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end
$migration$;

-- Internal validation is called by owner-executed database workflows only.
revoke execute on function public.has_required_technician_documents(uuid)
  from public, anon, authenticated, service_role;

-- Hosted projects may have explicit API-role grants from default privileges.
-- Re-state the intended callable contract rather than relying on a PUBLIC
-- revoke to remove role-specific grants.
revoke execute on function public.bootstrap_technician_application()
  from public, anon, service_role;
grant execute on function public.bootstrap_technician_application()
  to authenticated;

revoke execute on function public.can_delete_technician_document_file(text)
  from public, anon, service_role;
grant execute on function public.can_delete_technician_document_file(text)
  to authenticated;

revoke execute on function public.has_account_role(public.account_role)
  from public, anon, service_role;
grant execute on function public.has_account_role(public.account_role)
  to authenticated;

-- Public technician discovery is the single intentional anonymous
-- SECURITY DEFINER endpoint and exposes only its reviewed projection.
revoke execute on function public.list_public_technicians()
  from public, service_role;
grant execute on function public.list_public_technicians()
  to anon, authenticated;
