import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const supabaseEntry = require.resolve('supabase/dist/supabase.js');
const workspaceRoot = resolve(import.meta.dirname, '..', '..');

export const supabaseEnvironment = {
  ...process.env,
  SUPABASE_HOME:
    process.env.SUPABASE_HOME ?? resolve(workspaceRoot, '.supabase-home'),
  SUPABASE_TELEMETRY_DISABLED: '1',
  ...(process.platform === 'win32'
    ? {
        DOCKER_CONFIG:
          process.env.DOCKER_CONFIG ?? resolve(workspaceRoot, '.docker-config'),
      }
    : {}),
};

mkdirSync(supabaseEnvironment.SUPABASE_HOME, { recursive: true });
if (supabaseEnvironment.DOCKER_CONFIG) {
  mkdirSync(supabaseEnvironment.DOCKER_CONFIG, { recursive: true });
}

export function runSupabase(args, options = {}) {
  const result = spawnSync(process.execPath, [supabaseEntry, ...args], {
    cwd: workspaceRoot,
    env: supabaseEnvironment,
    encoding: options.encoding,
    maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024,
    shell: false,
    stdio: options.stdio ?? 'inherit',
  });

  if (result.error) throw result.error;
  return result;
}

export function runSupabaseOrExit(args) {
  const result = runSupabase(args);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function getLocalSupabaseStatus() {
  const result = runSupabase(['status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Unable to read local Supabase status.');
  }

  return JSON.parse(result.stdout);
}

function getLocalSupabaseDiagnostics() {
  const result = runSupabase(['status'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return [
    `supabase status exit code: ${result.status ?? 'unknown'}`,
    result.stdout?.trim(),
    result.stderr?.trim(),
  ]
    .filter(Boolean)
    .join('\n');
}

const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

export async function waitForLocalSupabase({
  timeoutMilliseconds = 180_000,
  initialDelayMilliseconds = 1_000,
  maximumDelayMilliseconds = 5_000,
  requestTimeoutMilliseconds = 5_000,
} = {}) {
  const startedAt = Date.now();
  let attempt = 0;
  let delayMilliseconds = initialDelayMilliseconds;
  let lastError;

  while (Date.now() - startedAt < timeoutMilliseconds) {
    attempt += 1;
    try {
      const status = getLocalSupabaseStatus();
      const response = await fetch(`${status.REST_URL}/`, {
        headers: { apikey: status.ANON_KEY },
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });

      if (response.status < 500) return status;
      lastError = new Error(`REST readiness returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    const elapsedMilliseconds = Date.now() - startedAt;
    const remainingMilliseconds = timeoutMilliseconds - elapsedMilliseconds;
    if (remainingMilliseconds <= 0) break;

    const sleepMilliseconds = Math.min(
      delayMilliseconds,
      remainingMilliseconds,
    );
    process.stderr.write(
      `Local Supabase is not ready (attempt ${attempt}, ${Math.ceil(elapsedMilliseconds / 1_000)}s elapsed): ${lastError?.message ?? 'unknown error'}; retrying in ${sleepMilliseconds}ms.\n`,
    );
    await wait(sleepMilliseconds);
    delayMilliseconds = Math.min(
      Math.ceil(delayMilliseconds * 1.5),
      maximumDelayMilliseconds,
    );
  }

  const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1_000);
  const diagnostics = getLocalSupabaseDiagnostics();
  throw new Error(
    `Local Supabase did not become ready after ${attempt} attempts and ${elapsedSeconds}s: ${lastError?.message ?? 'unknown error'}\n${diagnostics}`,
  );
}

export { wait };
