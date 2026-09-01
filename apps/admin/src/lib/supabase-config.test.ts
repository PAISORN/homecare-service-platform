import { describe, expect, it } from 'vitest';

import { resolveAdminSupabaseConfig } from './supabase-config';

function jwt(payload: Record<string, unknown>) {
  return [
    Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify(payload)).toString('base64url'),
    'signature',
  ].join('.');
}

describe('resolveAdminSupabaseConfig', () => {
  it('accepts a publishable key and normalizes the URL', () => {
    expect(
      resolveAdminSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co/',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    ).toEqual({
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_example',
    });
  });

  it.each([
    'sb_secret_example',
    'service-role-never-public',
    'opaque-public-looking-value',
    'not.a.valid-jwt',
    jwt({ role: 'service_role' }),
  ])('rejects privileged material from public configuration', (key) => {
    expect(() =>
      resolveAdminSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toThrow('admin_supabase_public_key_forbidden');
  });

  it('fails closed when configuration is incomplete', () => {
    expect(() => resolveAdminSupabaseConfig({})).toThrow(
      'admin_supabase_configuration_missing',
    );
  });
});
