import {
  runSupabase,
  wait,
  waitForLocalSupabase,
} from './lib/supabase-cli.mjs';

const transientConnectionError =
  /connection (?:refused|reset)|ECONNREFUSED|server closed the connection|timeout expired|the database system is starting up/i;

await waitForLocalSupabase();

for (let attempt = 1; attempt <= 3; attempt += 1) {
  const result = runSupabase(
    [
      'db',
      'lint',
      '--local',
      '--schema',
      'public',
      '--level',
      'error',
      '--fail-on',
      'error',
    ],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  if (result.status === 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(0);
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (!transientConnectionError.test(output) || attempt === 3) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  process.stderr.write(
    `Database connection was not stable for lint (attempt ${attempt}/3); retrying.\n`,
  );
  await wait(1_000 * attempt);
}
