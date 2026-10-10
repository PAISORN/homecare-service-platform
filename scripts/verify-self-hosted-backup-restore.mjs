import { run } from './lib/self-hosted-rehearsal.mjs';

const container = 'supabase-db';
const drillDatabase = 'homecare_selfhost_restore_drill';
const backupPath = '/tmp/homecare-selfhost-restore-drill.dump';

function dockerExec(args, options = {}) {
  return run('docker', ['exec', container, ...args], options);
}

function databaseExists() {
  return (
    dockerExec(
      [
        'psql',
        '--username',
        'postgres',
        '--dbname',
        'postgres',
        '--tuples-only',
        '--no-align',
        '--command',
        `select 1 from pg_database where datname = '${drillDatabase}'`,
      ],
      { capture: true },
    ).stdout.trim() === '1'
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
    dockerExec(
      [
        'psql',
        '--username',
        'postgres',
        '--dbname',
        database,
        '--tuples-only',
        '--no-align',
        '--command',
        sql,
      ],
      { capture: true },
    ).stdout.trim(),
  );
}

if (databaseExists()) {
  throw new Error(`Refusing to overwrite existing database ${drillDatabase}.`);
}

let created = false;
try {
  const source = fingerprint('postgres');
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
  created = true;
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
  const restored = fingerprint(drillDatabase);
  if (JSON.stringify(source) !== JSON.stringify(restored)) {
    throw new Error(
      `Restore fingerprint mismatch: source=${JSON.stringify(source)} restored=${JSON.stringify(restored)}`,
    );
  }
  process.stdout.write(
    `Self-hosted database backup/restore passed: ${JSON.stringify(restored)}\n`,
  );
} finally {
  if (created) {
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
