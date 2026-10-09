'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireOperationsManager } from '@/features/auth/auth';
import { createAdminSupabaseClient } from '@/lib/supabase-server';

import { isOperationalControlKey } from './operational-control-copy';

export async function setOperationalControlAction(formData: FormData) {
  await requireOperationsManager();
  const controlKey = String(formData.get('controlKey') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  const reason = String(formData.get('reason') ?? '').trim();

  if (!isOperationalControlKey(controlKey)) throw new Error('invalid_control');
  if (reason.length < 10 || reason.length > 500)
    throw new Error('invalid_reason');
  if (controlKey === 'payment' && enabled)
    throw new Error('payment_provider_not_ready');

  const client = await createAdminSupabaseClient();
  const { error } = await client.rpc('set_operational_control', {
    p_control_key: controlKey,
    p_enabled: enabled,
    p_reason: reason,
  });
  if (error) throw error;

  revalidatePath('/operations');
  redirect(`/operations?updated=${controlKey}`);
}
