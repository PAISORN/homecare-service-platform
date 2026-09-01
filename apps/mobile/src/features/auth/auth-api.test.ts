import { describe, expect, it, vi } from 'vitest';

import type { MobileSupabaseClient } from '../../lib/supabase';
import { requestPhoneOtp, verifyPhoneOtp } from './auth-api';

function createClientMock() {
  const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
  const verifyOtp = vi.fn().mockResolvedValue({ error: null });
  return {
    client: {
      auth: { signInWithOtp, verifyOtp },
    } as unknown as MobileSupabaseClient,
    signInWithOtp,
    verifyOtp,
  };
}

describe('phone OTP API', () => {
  it('normalizes the phone before requesting SMS OTP', async () => {
    const { client, signInWithOtp } = createClientMock();
    await expect(requestPhoneOtp(client, '081-234-5678')).resolves.toEqual({
      ok: true,
      phone: '+66812345678',
    });
    expect(signInWithOtp).toHaveBeenCalledWith({ phone: '+66812345678' });
  });

  it('verifies a phone token with the sms type', async () => {
    const { client, verifyOtp } = createClientMock();
    await expect(
      verifyPhoneOtp(client, '+66812345678', '123456'),
    ).resolves.toEqual({ ok: true, phone: '+66812345678' });
    expect(verifyOtp).toHaveBeenCalledWith({
      phone: '+66812345678',
      token: '123456',
      type: 'sms',
    });
  });

  it('does not call Supabase for invalid local input', async () => {
    const { client, signInWithOtp, verifyOtp } = createClientMock();
    await expect(requestPhoneOtp(client, '123')).resolves.toEqual({
      ok: false,
      reason: 'invalid_phone',
    });
    await expect(verifyPhoneOtp(client, '+66812345678', '12')).resolves.toEqual(
      { ok: false, reason: 'invalid_otp' },
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
