import { describe, expect, it, vi } from 'vitest';

import type { MobileSupabaseClient } from '../../lib/supabase';
import {
  disablePushDevice,
  dispatchPendingJobNotifications,
  registerPushDevice,
} from './push-device-api';

describe('push device API', () => {
  it('registers a token through the account-bound RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'device-id', error: null });
    const client = { rpc } as unknown as MobileSupabaseClient;
    await expect(
      registerPushDevice(client, {
        installationId: '550e8400-e29b-41d4-a716-446655440000',
        expoPushToken: 'ExponentPushToken[test]',
        platform: 'ios',
      }),
    ).resolves.toBe('device-id');
    expect(rpc).toHaveBeenCalledWith('register_push_device', {
      p_installation_id: '550e8400-e29b-41d4-a716-446655440000',
      p_expo_push_token: 'ExponentPushToken[test]',
      p_platform: 'ios',
    });
  });

  it('disables only the current installation through the RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc } as unknown as MobileSupabaseClient;
    await expect(
      disablePushDevice(client, '550e8400-e29b-41d4-a716-446655440000'),
    ).resolves.toBe(true);
  });

  it('invokes the server-side dispatcher without exposing a secret key', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
    const client = { functions: { invoke } } as unknown as MobileSupabaseClient;
    await dispatchPendingJobNotifications(client);
    expect(invoke).toHaveBeenCalledWith('dispatch-job-notifications');
  });
});
