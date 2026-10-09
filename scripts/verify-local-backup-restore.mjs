import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { waitForLocalSupabase } from './lib/supabase-cli.mjs';

const workspaceRoot = resolve(import.meta.dirname, '..');
const config = readFileSync(
  resolve(workspaceRoot, 'supabase', 'config.toml'),
  'utf8',
);
const projectId = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
if (!projectId) throw new Error('Unable to resolve Supabase project_id.');

const container =
  process.env.SUPABASE_DB_CONTAINER ?? `supabase_db_${projectId}`;
const drillDatabase = 'homecare_restore_drill';
const backupPath = '/tmp/homecare-restore-drill.dump';

if (!/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) {
  throw new Error('Unsafe Supabase database container name.');
}
if (drillDatabase !== 'homecare_restore_drill') {
  throw new Error('Unsafe restore drill database name.');
}

function dockerExec(args, { allowFailure = false } = {}) {
  const result = spawnSync('docker', ['exec', container, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    shell: false,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Docker command failed.');
  }
  return result;
}

function databaseExists() {
  return (
    dockerExec([
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--command',
      `select 1 from pg_database where datname = '${drillDatabase}'`,
    ]).stdout.trim() === '1'
  );
}

function fingerprint(database) {
  const sql = `select json_build_object(
    'public_tables', (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
    'service_categories', (select count(*) from public.service_categories),
    'service_items', (select count(*) from public.service_items),
    'operational_controls', (select count(*) from public.operational_controls)
  )::text;`;
  return JSON.parse(
    dockerExec([
      'psql',
      '--username',
      'postgres',
      '--dbname',
      database,
      '--tuples-only',
      '--no-align',
      '--command',
      sql,
    ]).stdout.trim(),
  );
}

await waitForLocalSupabase();
if (databaseExists()) {
  throw new Error(
    `Refusing to overwrite existing database ${drillDatabase}. Remove it manually after verifying ownership.`,
  );
}

let createdDrillDatabase = false;
try {
  const sourceFingerprint = fingerprint('postgres');
  dockerExec([
    'pg_dump',
    '--username',
    'postgres',
    '--dbname',
    'postgres',
    '--format',
    'custom',
    '--exclude-extension',
    'pg_cron',
    '--exclude-extension',
    'supabase_vault',
    '--exclude-schema',
    'realtime',
    '--exclude-schema',
    'vault',
    '--no-owner',
    '--no-privileges',
    '--file',
    backupPath,
  ]);
  dockerExec([
    'createdb',
    '--username',
    'postgres',
    '--template',
    'template0',
    drillDatabase,
  ]);
  createdDrillDatabase = true;
  dockerExec([
    'pg_restore',
    '--username',
    'postgres',
    '--dbname',
    drillDatabase,
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    backupPath,
  ]);
  const restoredFingerprint = fingerprint(drillDatabase);
  if (
    JSON.stringify(sourceFingerprint) !== JSON.stringify(restoredFingerprint)
  ) {
    throw new Error(
      `Restore fingerprint mismatch: source=${JSON.stringify(sourceFingerprint)} restored=${JSON.stringify(restoredFingerprint)}`,
    );
  }
  process.stdout.write(
    `Backup/restore drill passed: ${JSON.stringify(restoredFingerprint)}\n`,
  );
} finally {
  if (createdDrillDatabase) {
    dockerExec(
      [
        'dropdb',
        '--username',
        'postgres',
        '--force',
        '--if-exists',
        drillDatabase,
      ],
      { allowFailure: true },
    );
  }
  dockerExec(['rm', '-f', backupPath], { allowFailure: true });
}
