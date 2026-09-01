export type SupabaseConfiguration = Readonly<{
  url: string;
  publishableKey: string;
}>;

const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]+$/;

function decodeJwtPayload(value: string): unknown {
  const segments = value.split('.');
  if (
    segments.length !== 3 ||
    segments.some((segment) => segment.length === 0)
  ) {
    return null;
  }

  try {
    const payloadSegment = segments[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function isSafePublicSupabaseKey(value: string): boolean {
  if (publishableKeyPattern.test(value)) return true;
  if (value.startsWith('sb_secret_')) return false;

  const payload = decodeJwtPayload(value);
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'role' in payload &&
    payload.role === 'anon'
  );
}

export function readSupabaseConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): SupabaseConfiguration | null {
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey || !isSafePublicSupabaseKey(publishableKey)) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
  } catch {
    return null;
  }

  return { url, publishableKey };
}
