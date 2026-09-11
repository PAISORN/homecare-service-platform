'use server';

import { redirect } from 'next/navigation';

import { createAdminSupabaseClient } from '@/lib/supabase-server';

import {
  getAdminLandingPath,
  type AdminPermission,
} from './admin-landing-path';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/login?error=required');
  }

  const client = await createAdminSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect('/login?error=invalid');
  }

  const { data: permissions } = await client
    .from('admin_permissions')
    .select('permission')
    .eq('user_id', data.user.id);
  redirect(
    getAdminLandingPath(
      (permissions?.map(({ permission }) => permission) ??
        []) as AdminPermission[],
    ),
  );
}

export async function signOutAction() {
  const client = await createAdminSupabaseClient();
  await client.auth.signOut();
  redirect('/login');
}
