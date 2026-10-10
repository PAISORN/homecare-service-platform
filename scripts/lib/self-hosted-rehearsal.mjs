import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const workspaceRoot = resolve(import.meta.dirname, '..', '..');
export const selfHostedRoot = resolve(workspaceRoot, 'infra', 'self-hosted');
export const runtimeRoot = resolve(selfHostedRoot, 'runtime');
export const dockerRoot = resolve(runtimeRoot, 'docker');
export const runtimeEnvironmentPath = resolve(dockerRoot, '.env');
export const adminEnvironmentPath = resolve(selfHostedRoot, '.env.local');
export const upstreamComposePath = resolve(dockerRoot, 'docker-compose.yml');
export const localComposePath = resolve(selfHostedRoot, 'compose.local.yaml');
export const adminComposePath = resolve(selfHostedRoot, 'compose.admin.yaml');

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: options.maxBuffer ?? 32 * 1024 * 1024,
    shell: false,
    stdio: options.capture ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (!options.allowFailure && result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        `${command} exited with ${result.status ?? 'unknown'}`,
    );
  }
  return result;
}

export function parseEnvironment(path = runtimeEnvironmentPath) {
  const entries = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    entries[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return entries;
}

export function updateEnvironment(path, replacements) {
  const source = readFileSync(path, 'utf8');
  const lines = source.split(/\r?\n/);
  const remaining = new Map(Object.entries(replacements));
  const updated = lines.map((line) => {
    const separator = line.indexOf('=');
    if (separator < 1 || line.trimStart().startsWith('#')) return line;
    const key = line.slice(0, separator);
    if (!remaining.has(key)) return line;
    const value = remaining.get(key);
    remaining.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of remaining) updated.push(`${key}=${value}`);
  writeFileSync(path, `${updated.join('\n').replace(/\n+$/, '')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function selfHostedCompose(args, options = {}) {
  return run(
    'docker',
    [
      'compose',
      '--env-file',
      runtimeEnvironmentPath,
      '-f',
      upstreamComposePath,
      '-f',
      localComposePath,
      ...args,
    ],
    options,
  );
}

export function adminCompose(args, options = {}) {
  return run(
    'docker',
    [
      'compose',
      '--env-file',
      adminEnvironmentPath,
      '-f',
      adminComposePath,
      ...args,
    ],
    options,
  );
}

export async function waitForHttp(url, options = {}) {
  const deadline = Date.now() + (options.timeoutMilliseconds ?? 180_000);
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        headers: options.headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(5_000),
      });
      if (response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
  }
  throw new Error(
    `Timed out waiting for ${url}: ${lastError?.message ?? 'unknown error'}`,
  );
}
