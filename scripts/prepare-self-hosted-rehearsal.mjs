import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  adminEnvironmentPath,
  dockerRoot,
  parseEnvironment,
  run,
  runtimeEnvironmentPath,
  runtimeRoot,
  updateEnvironment,
  workspaceRoot,
} from './lib/self-hosted-rehearsal.mjs';

const upstreamRef = 'self-hosted/v0.8.2';
const expectedCommit = '564eab8ad7840b13324f68b1bfac074ef8d51c21';
const publicApiUrl = 'http://127.0.0.1:58000';

function gitBashPath() {
  if (process.platform !== 'win32') return '/bin/sh';
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
  ];
  const selected = candidates.find(existsSync);
  if (!selected) throw new Error('Git Bash is required on Windows.');
  return selected;
}

mkdirSync(resolve(workspaceRoot, 'infra', 'self-hosted'), {
  recursive: true,
});

if (!existsSync(resolve(runtimeRoot, '.git'))) {
  run('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    upstreamRef,
    'https://github.com/supabase/supabase.git',
    runtimeRoot,
  ]);
}

const actualCommit = run('git', ['-C', runtimeRoot, 'rev-parse', 'HEAD'], {
  capture: true,
}).stdout.trim();
if (actualCommit !== expectedCommit) {
  throw new Error(
    `Unexpected Supabase commit ${actualCommit}; expected ${expectedCommit}.`,
  );
}

if (!existsSync(runtimeEnvironmentPath)) {
  copyFileSync(resolve(dockerRoot, '.env.example'), runtimeEnvironmentPath);
  const shell = gitBashPath();
  run(shell, ['utils/generate-keys.sh', '--update-env'], {
    cwd: dockerRoot,
    capture: true,
  });
  run(shell, ['utils/add-new-auth-keys.sh', '--update-env'], {
    cwd: dockerRoot,
    capture: true,
  });
}

updateEnvironment(runtimeEnvironmentPath, {
  COMPOSE_FILE: 'docker-compose.yml',
  DASHBOARD_USERNAME: 'homecare-local',
  SUPABASE_PUBLIC_URL: publicApiUrl,
  API_EXTERNAL_URL: `${publicApiUrl}/auth/v1`,
  POSTGRES_PORT: '55432',
  POSTGRES_DIRECT_PORT: '55433',
  POOLER_PROXY_PORT_TRANSACTION: '56543',
  POOLER_TENANT_ID: 'homecare-local-rehearsal',
  SITE_URL: 'http://127.0.0.1:3200',
  ADDITIONAL_REDIRECT_URLS: 'http://127.0.0.1:3200/**',
  ENABLE_EMAIL_AUTOCONFIRM: 'true',
  ENABLE_PHONE_AUTOCONFIRM: 'true',
  SMTP_ADMIN_EMAIL: 'local@example.invalid',
  API_GW_HTTP_PORT: '58000',
  KONG_HTTP_PORT: '58000',
  KONG_HTTPS_PORT: '58443',
});

const environment = parseEnvironment();
const requiredNonPlaceholder = [
  'POSTGRES_PASSWORD',
  'JWT_SECRET',
  'ANON_KEY',
  'SERVICE_ROLE_KEY',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'DASHBOARD_PASSWORD',
  'SECRET_KEY_BASE',
  'REALTIME_DB_ENC_KEY',
  'VAULT_ENC_KEY',
  'PG_META_CRYPTO_KEY',
];
for (const key of requiredNonPlaceholder) {
  const value = environment[key]?.trim();
  if (
    !value ||
    /your-|insecure|example|xxxxxxxx/i.test(value) ||
    value === 'supabaserealtime'
  ) {
    throw new Error(`Unsafe or missing self-hosted value: ${key}`);
  }
}

if (
  !/^sb_publishable_[A-Za-z0-9_-]+$/.test(environment.SUPABASE_PUBLISHABLE_KEY)
) {
  throw new Error('Generated publishable key is invalid.');
}

writeFileSync(
  adminEnvironmentPath,
  [
    'ADMIN_PORT=3200',
    `NEXT_PUBLIC_SUPABASE_URL=${publicApiUrl}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${environment.SUPABASE_PUBLISHABLE_KEY}`,
    'SUPABASE_INTERNAL_URL=http://host.docker.internal:58000',
    '',
  ].join('\n'),
  { encoding: 'utf8', mode: 0o600 },
);

writeFileSync(
  resolve(runtimeRoot, '.supabase-version'),
  `ref=${upstreamRef}\n`,
  {
    encoding: 'utf8',
  },
);

process.stdout.write(
  `Prepared Supabase ${upstreamRef} (${expectedCommit.slice(0, 12)}) for localhost-only rehearsal.\n`,
);
