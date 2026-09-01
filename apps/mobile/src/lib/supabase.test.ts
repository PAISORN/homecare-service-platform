import { describe, expect, it } from 'vitest';

import {
  isSafePublicSupabaseKey,
  readSupabaseConfiguration,
} from './supabase-config';

function encodeJwtPart(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fakeLegacyJwt(payload: unknown): string {
  return `${encodeJwtPart({ alg: 'HS256', typ: 'JWT' })}.${encodeJwtPart(payload)}.test-signature`;
}

describe('isSafePublicSupabaseKey', () => {
  it('accepts a current publishable key', () => {
    expect(isSafePublicSupabaseKey('sb_publishable_test-value_123')).toBe(true);
  });

  it('accepts a legacy JWT only when its decoded role is anon', () => {
    expect(isSafePublicSupabaseKey(fakeLegacyJwt({ role: 'anon' }))).toBe(true);
  });

  it.each([
    'sb_secret_test-value',
    'sb_publishable_',
    'opaque-key',
    'not.a.jwt',
    'a.%%%invalid%%%.c',
    fakeLegacyJwt({ role: 'service_role' }),
    fakeLegacyJwt({ role: 'authenticated' }),
    fakeLegacyJwt({}),
    fakeLegacyJwt(null),
  ])('rejects unsafe or malformed public key %s', (value) => {
    expect(isSafePublicSupabaseKey(value)).toBe(false);
  });
});

describe('readSupabaseConfiguration', () => {
  it('returns null when public configuration is missing', () => {
    expect(readSupabaseConfiguration({})).toBeNull();
  });

  it('accepts only URL and publishable key', () => {
    expect(
      readSupabaseConfiguration({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it('does not fall back to an exposed service-role variable', () => {
    expect(
      readSupabaseConfiguration({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'never-use-this',
      }),
    ).toBeNull();
  });

  it('fails closed when the configured public variable contains a secret key', () => {
    expect(
      readSupabaseConfiguration({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not-for-clients',
      }),
    ).toBeNull();
  });

  it('fails closed when the configured legacy JWT has service-role access', () => {
    expect(
      readSupabaseConfiguration({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeLegacyJwt({
          role: 'service_role',
        }),
      }),
    ).toBeNull();
  });

  it('accepts a legacy anon JWT for local compatibility', () => {
    const anonJwt = fakeLegacyJwt({ role: 'anon' });
    expect(
      readSupabaseConfiguration({
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonJwt,
      }),
    ).toEqual({
      url: 'http://127.0.0.1:54321',
      publishableKey: anonJwt,
    });
  });
});
