import type { MobileSupabaseClient } from '../../lib/supabase';
import { normalizeOtp, normalizeThaiPhone } from './phone';

export type AuthOperationResult =
  | Readonly<{ ok: true; phone: string }>
  | Readonly<{
      ok: false;
      reason: 'invalid_phone' | 'invalid_otp' | 'request_failed';
    }>;

export async function requestPhoneOtp(
  client: MobileSupabaseClient,
  phoneInput: string,
): Promise<AuthOperationResult> {
  const phone = normalizeThaiPhone(phoneInput);
  if (!phone) return { ok: false, reason: 'invalid_phone' };

  const { error } = await client.auth.signInWithOtp({ phone });
  return error ? { ok: false, reason: 'request_failed' } : { ok: true, phone };
}

export async function verifyPhoneOtp(
  client: MobileSupabaseClient,
  phone: string,
  otpInput: string,
): Promise<AuthOperationResult> {
  const token = normalizeOtp(otpInput);
  if (!token) return { ok: false, reason: 'invalid_otp' };

  const { error } = await client.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  return error ? { ok: false, reason: 'request_failed' } : { ok: true, phone };
}
