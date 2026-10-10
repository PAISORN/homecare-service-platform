import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const composeFile = resolve(
  workspaceRoot,
  'infra',
  'local-vps',
  'compose.yaml',
);
const environmentFile = resolve(
  workspaceRoot,
  'infra',
  'local-vps',
  '.env.local',
);
const action = process.argv[2];

const supportedActions = new Set(['up', 'down', 'check']);
if (!supportedActions.has(action)) {
  process.stderr.write(
    'Usage: node scripts/run-local-vps-environment.mjs <up|down|check>\n',
  );
  process.exit(2);
}

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        `${command} exited with ${result.status}`,
    );
  }
  return result;
}

const composeArgs = [
  'compose',
  '--env-file',
  environmentFile,
  '-f',
  composeFile,
];

if (action === 'up') {
  run(process.execPath, [
    resolve(workspaceRoot, 'scripts', 'prepare-local-vps-environment.mjs'),
  ]);
  run('docker', [...composeArgs, 'up', '--build', '--detach']);
}

if (action === 'down') {
  run('docker', [...composeArgs, 'down']);
  process.exit(0);
}

const deadline = Date.now() + 120_000;
let lastError;
while (Date.now() < deadline) {
  try {
    const response = await fetch('http://127.0.0.1:3100/login', {
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status < 500) {
      const container = run(
        'docker',
        [...composeArgs, 'ps', '--format', 'json'],
        { capture: true },
      ).stdout.trim();
      process.stdout.write(
        `Local VPS-like environment is ready at http://127.0.0.1:3100 (HTTP ${response.status}).\n${container}\n`,
      );
      process.exit(0);
    }
    lastError = new Error(`Admin returned HTTP ${response.status}.`);
  } catch (error) {
    lastError = error;
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
}

throw new Error(
  `Local VPS-like environment did not become ready: ${lastError?.message ?? 'unknown error'}`,
);
