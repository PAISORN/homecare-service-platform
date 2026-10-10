import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  getLocalSupabaseStatus,
  waitForLocalSupabase,
} from './lib/supabase-cli.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(workspaceRoot, 'infra', 'local-vps', '.env.local');
const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]+$/;

function isSafePublicKey(key) {
  if (publishableKeyPattern.test(key)) return true;

  const parts = key.split('.');
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    );
    return payload?.role === 'anon';
  } catch {
    return false;
  }
}

await waitForLocalSupabase();
const status = getLocalSupabaseStatus();
const apiUrl = new URL(status.API_URL);

if (!['127.0.0.1', 'localhost'].includes(apiUrl.hostname)) {
  throw new Error(
    'Refusing to prepare Docker environment from a non-local Supabase API.',
  );
}

const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!isSafePublicKey(publishableKey ?? '')) {
  throw new Error('Local Supabase did not return a safe public key.');
}

const dockerApiUrl = new URL(status.API_URL);
dockerApiUrl.hostname = 'host.docker.internal';

writeFileSync(
  outputPath,
  [
    'ADMIN_PORT=3100',
    `NEXT_PUBLIC_SUPABASE_URL=${dockerApiUrl.toString().replace(/\/$/, '')}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishableKey}`,
    '',
  ].join('\n'),
  { encoding: 'utf8', mode: 0o600 },
);

process.stdout.write(
  'Prepared infra/local-vps/.env.local with localhost-only API settings and a public client key.\n',
);
