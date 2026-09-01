import 'server-only';

import type { Database } from '@homecare/database-types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { resolveAdminSupabaseConfig } from './supabase-config';

export async function createAdminSupabaseClient() {
  const cookieStore = await cookies();
  const config = resolveAdminSupabaseConfig(process.env);

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. Server Actions and Route
          // Handlers still persist refreshed sessions through this same client.
        }
      },
    },
  });
}
