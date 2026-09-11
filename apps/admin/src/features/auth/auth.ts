import 'server-only';

import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createAdminSupabaseClient } from '@/lib/supabase-server';

export type AdminViewer = Readonly<{
  id: string;
  displayName: string;
}>;

async function requireAdminPermission(
  permission: 'technician_review' | 'case_management',
): Promise<AdminViewer> {
  const client = await createAdminSupabaseClient();
  const { data: userResult, error: userError } = await client.auth.getUser();
  const user = userResult.user;

  if (userError || !user) redirect('/login');

  const [profileResult, roleResult, permissionResult] = await Promise.all([
    client
      .from('profiles')
      .select('display_name, account_status')
      .eq('id', user.id)
      .maybeSingle(),
    client
      .from('account_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'administrator')
      .maybeSingle(),
    client
      .from('admin_permissions')
      .select('permission')
      .eq('user_id', user.id)
      .eq('permission', permission)
      .maybeSingle(),
  ]);

  if (
    profileResult.error ||
    roleResult.error ||
    permissionResult.error ||
    profileResult.data?.account_status !== 'active' ||
    !roleResult.data ||
    !permissionResult.data
  )
    redirect('/unauthorized');

  return { id: user.id, displayName: profileResult.data.display_name };
}

export const requireTechnicianReviewer = cache(async () =>
  requireAdminPermission('technician_review'),
);

export const requireCaseManager = cache(async () =>
  requireAdminPermission('case_management'),
);
