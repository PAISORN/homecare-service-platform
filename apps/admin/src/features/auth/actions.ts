'use server';

import { redirect } from 'next/navigation';

import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function signInAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    redirect('/login?error=required');
  }

  const client = await createAdminSupabaseClient();
  const { error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    redirect('/login?error=invalid');
  }

  redirect('/technicians');
}

export async function signOutAction() {
  const client = await createAdminSupabaseClient();
  await client.auth.signOut();
  redirect('/login');
}
