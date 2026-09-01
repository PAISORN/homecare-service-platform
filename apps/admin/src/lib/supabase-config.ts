export type AdminSupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

const PUBLISHABLE_KEY_PATTERN = /^sb_publishable_[A-Za-z0-9_-]+$/;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function decodeJwtPayload(key: string): unknown {
  try {
    const payload = key.split('.')[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function isSafePublicKey(key: string) {
  if (PUBLISHABLE_KEY_PATTERN.test(key)) return true;
  if (!JWT_PATTERN.test(key)) return false;

  const payload = decodeJwtPayload(key);
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'role' in payload &&
    payload.role === 'anon'
  );
}

export function resolveAdminSupabaseConfig(
  environment: Readonly<Record<string, string | undefined>>,
): AdminSupabaseConfig {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!url || !publishableKey) {
    throw new Error('admin_supabase_configuration_missing');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('admin_supabase_url_invalid');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('admin_supabase_url_invalid');
  }
  if (!isSafePublicKey(publishableKey)) {
    throw new Error('admin_supabase_public_key_forbidden');
  }

  return { url: parsedUrl.toString().replace(/\/$/, ''), publishableKey };
}
