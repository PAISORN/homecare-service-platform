import { resolve } from 'node:path';

import { runSupabase } from './lib/supabase-cli.mjs';
import {
  adminCompose,
  parseEnvironment,
  run,
  selfHostedCompose,
  waitForHttp,
  workspaceRoot,
} from './lib/self-hosted-rehearsal.mjs';

const action = process.argv[2];
const supportedActions = new Set([
  'up',
  'migrate',
  'db-test',
  'check',
  'persistence',
  'backup-restore',
  'storage-backup-restore',
  'down',
]);
if (!supportedActions.has(action)) {
  process.stderr.write(
    'Usage: node scripts/run-self-hosted-rehearsal.mjs <up|migrate|db-test|check|persistence|backup-restore|storage-backup-restore|down>\n',
  );
  process.exit(2);
}

function prepare() {
  run(process.execPath, [
    resolve(workspaceRoot, 'scripts', 'prepare-self-hosted-rehearsal.mjs'),
  ]);
}

function databaseFingerprint() {
  const sql = `select json_build_object(
    'public_tables', (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
    'service_categories', (select count(*) from public.service_categories),
    'service_items', (select count(*) from public.service_items),
    'operational_controls', (select count(*) from public.operational_controls)
  )::text;`;
  return run(
    'docker',
    [
      'exec',
      'supabase-db',
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--command',
      sql,
    ],
    { capture: true },
  ).stdout.trim();
}

async function check() {
  const environment = parseEnvironment();
  const headers = {
    apikey: environment.SUPABASE_PUBLISHABLE_KEY,
    authorization: `Bearer ${environment.SUPABASE_PUBLISHABLE_KEY}`,
  };
  const results = await Promise.all([
    waitForHttp('http://127.0.0.1:58000/auth/v1/health', { headers }),
    waitForHttp(
      'http://127.0.0.1:58000/rest/v1/service_categories?select=id&limit=1',
      { headers },
    ),
    waitForHttp('http://127.0.0.1:58000/storage/v1/status', { headers }),
    waitForHttp('http://127.0.0.1:3200/login'),
  ]);
  if (results.some((response) => response.status >= 400)) {
    throw new Error(
      `Self-hosted health check failed: ${results.map((response) => response.status).join(', ')}`,
    );
  }
  const summarize = (output) =>
    output
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map(({ Service, State, Health }) =>
        [Service, State, Health].filter(Boolean).join(':'),
      )
      .sort()
      .join(', ');
  const containers = summarize(
    selfHostedCompose(['ps', '--format', 'json'], { capture: true }).stdout,
  );
  const admin = summarize(
    adminCompose(['ps', '--format', 'json'], { capture: true }).stdout,
  );
  process.stdout.write(
    `Self-hosted rehearsal passed. Fingerprint: ${databaseFingerprint()}\nServices: ${containers}\nAdmin: ${admin}\n`,
  );
}

function migrate() {
  const environment = parseEnvironment();
  const databaseUrl = `postgresql://postgres:${environment.POSTGRES_PASSWORD}@127.0.0.1:${environment.POSTGRES_DIRECT_PORT}/postgres?sslmode=disable`;
  const result = runSupabase([
    'db',
    'push',
    '--db-url',
    databaseUrl,
    '--include-all',
    '--include-seed',
    '--yes',
  ]);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function databaseTest() {
  const environment = parseEnvironment();
  const databaseUrl = `postgresql://postgres:${environment.POSTGRES_PASSWORD}@127.0.0.1:${environment.POSTGRES_DIRECT_PORT}/postgres?sslmode=disable`;
  for (const [label, args] of [
    ['pgTAP', ['test', 'db', '--db-url', databaseUrl]],
    [
      'database lint',
      [
        'db',
        'lint',
        '--db-url',
        databaseUrl,
        '--schema',
        'public',
        '--level',
        'warning',
        '--fail-on',
        'error',
      ],
    ],
  ]) {
    const result = runSupabase(args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.status !== 0) {
      process.stderr.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      process.exit(result.status ?? 1);
    }
    const summary = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) =>
        /^(Files=|Result:|All tests successful|No schema errors found)/i.test(
          line,
        ),
      );
    process.stdout.write(
      `${label} passed${summary.length ? `: ${summary.join(' | ')}` : ''}\n`,
    );
  }
}

if (action === 'down') {
  prepare();
  adminCompose(['down'], { allowFailure: true });
  selfHostedCompose(['down']);
  process.exit(0);
}

prepare();

if (action === 'up') {
  selfHostedCompose(['up', '--detach', '--wait']);
  migrate();
  adminCompose(['up', '--build', '--detach', '--wait']);
  await check();
}

if (action === 'migrate') migrate();
if (action === 'db-test') databaseTest();
if (action === 'check') await check();

if (action === 'persistence') {
  const before = databaseFingerprint();
  adminCompose(['down']);
  selfHostedCompose(['down']);
  selfHostedCompose(['up', '--detach', '--wait']);
  adminCompose(['up', '--detach', '--wait']);
  await check();
  const after = databaseFingerprint();
  if (before !== after) {
    throw new Error(`Persistence mismatch: before=${before}; after=${after}`);
  }
  process.stdout.write(`Persistence rehearsal passed: ${after}\n`);
}

if (action === 'backup-restore') {
  run(process.execPath, [
    resolve(workspaceRoot, 'scripts', 'verify-self-hosted-backup-restore.mjs'),
  ]);
}

if (action === 'storage-backup-restore') {
  run(process.execPath, [
    resolve(
      workspaceRoot,
      'scripts',
      'verify-self-hosted-storage-backup-restore.mjs',
    ),
  ]);
}
