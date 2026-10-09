import 'server-only';

import { createAdminSupabaseClient } from '@/lib/supabase-server';

export async function listOperationalControls() {
  const client = await createAdminSupabaseClient();
  const { data, error } = await client
    .from('operational_controls')
    .select('control_key, enabled, reason, revision, updated_at')
    .order('control_key');
  if (error) throw error;
  return data;
}
