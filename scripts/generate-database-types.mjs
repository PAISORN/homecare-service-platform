import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { runSupabase, waitForLocalSupabase } from './lib/supabase-cli.mjs';

const target = resolve('packages/database-types/src/database.types.ts');
const temporary = resolve(
  dirname(target),
  `.database.types.${process.pid}.tmp`,
);
mkdirSync(dirname(target), { recursive: true });
await waitForLocalSupabase();

const generated = runSupabase(['gen', 'types', 'typescript', '--local'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (generated.status !== 0) {
  process.stderr.write(
    generated.stderr || 'Supabase type generation failed.\n',
  );
  process.exit(generated.status ?? 1);
}

if (!generated.stdout.includes('export type Database')) {
  process.stderr.write('Generated output did not contain a Database type.\n');
  process.exit(1);
}

const normalized = `${generated.stdout.replaceAll('\r\n', '\n').trimEnd()}\n`;
writeFileSync(temporary, normalized, 'utf8');

try {
  // Node maps rename to an atomic replacement on supported local filesystems.
  // If replacement fails, the existing generated file remains untouched.
  renameSync(temporary, target);
} catch (error) {
  rmSync(temporary, { force: true });
  throw error;
}
