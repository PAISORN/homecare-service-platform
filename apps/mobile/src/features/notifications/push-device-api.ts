import type { MobileSupabaseClient } from '../../lib/supabase';

export type PushDevicePlatform = 'ios' | 'android';

export async function registerPushDevice(
  client: MobileSupabaseClient,
  input: Readonly<{
    installationId: string;
    expoPushToken: string;
    platform: PushDevicePlatform;
  }>,
) {
  const { data, error } = await client.rpc('register_push_device', {
    p_installation_id: input.installationId,
    p_expo_push_token: input.expoPushToken,
    p_platform: input.platform,
  });
  if (error) throw error;
  return data;
}

export async function disablePushDevice(
  client: MobileSupabaseClient,
  installationId: string,
) {
  const { data, error } = await client.rpc('disable_push_device', {
    p_installation_id: installationId,
  });
  if (error) throw error;
  return data;
}

export async function dispatchPendingJobNotifications(
  client: MobileSupabaseClient,
): Promise<void> {
  const { error } = await client.functions.invoke('dispatch-job-notifications');
  if (error) throw error;
}

export function requestJobNotificationDispatch(client: MobileSupabaseClient) {
  void dispatchPendingJobNotifications(client).catch(() => undefined);
}
