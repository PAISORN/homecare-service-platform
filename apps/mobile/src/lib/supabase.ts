import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from '@homecare/database-types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type NativeEventSubscription, Platform } from 'react-native';

import {
  readSupabaseConfiguration,
  type SupabaseConfiguration,
} from './supabase-config';
import { synchronizeSupabaseAutoRefresh } from './supabase-auto-refresh';

export type MobileSupabaseClient = SupabaseClient<Database>;

export function createMobileSupabaseClient(
  configuration: SupabaseConfiguration,
): MobileSupabaseClient {
  return createClient<Database>(
    configuration.url,
    configuration.publishableKey,
    {
      auth: {
        ...(Platform.OS === 'web' ? {} : { storage: AsyncStorage }),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    },
  );
}

const configuration = readSupabaseConfiguration({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
export const supabase = configuration
  ? createMobileSupabaseClient(configuration)
  : null;

let appStateSubscription: NativeEventSubscription | null = null;

export function installSupabaseAutoRefresh(
  client: MobileSupabaseClient,
): () => void {
  if (Platform.OS === 'web') return () => undefined;

  synchronizeSupabaseAutoRefresh(client.auth, AppState.currentState);

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (state) => {
      synchronizeSupabaseAutoRefresh(client.auth, state);
    });
  }

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
    client.auth.stopAutoRefresh();
  };
}
