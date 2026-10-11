import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { parseEnvironment, run } from './lib/self-hosted-rehearsal.mjs';

const root = resolve(import.meta.dirname, '..');
const mobileRoot = resolve(root, 'apps/mobile');
const expoCli = resolve(mobileRoot, 'node_modules/expo/bin/cli');
const playwrightCli = resolve(root, 'node_modules/@playwright/test/cli.js');
const mobileUrl = 'http://127.0.0.1:8082';
const adminUrl = 'http://127.0.0.1:3200';
const environment = parseEnvironment();

async function waitForUrl(url, label) {
  const deadline = Date.now() + 120_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }
  throw new Error(`${label} did not become ready: ${lastError?.message}`);
}

function waitForExit(child) {
  return new Promise((resolveExit, rejectExit) => {
    child.once('error', rejectExit);
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
}

run('node', ['scripts/run-self-hosted-rehearsal.mjs', 'up']);

const mobile = spawn(
  process.execPath,
  [expoCli, 'start', '--web', '--port', '8082'],
  {
    cwd: mobileRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      CI: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:58000',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        environment.SUPABASE_PUBLISHABLE_KEY,
    },
    stdio: 'inherit',
  },
);

let exitCode = 1;
try {
  await Promise.all([
    waitForUrl(`${mobileUrl}/`, 'Mobile Web'),
    waitForUrl(`${adminUrl}/login`, 'Admin'),
  ]);
  const playwright = spawn(
    process.execPath,
    [playwrightCli, 'test', '--config=playwright.self-hosted.config.mjs'],
    {
      cwd: root,
      env: {
        ...process.env,
        SELFHOST_UI_ADMIN_URL: adminUrl,
        SELFHOST_UI_MOBILE_URL: mobileUrl,
      },
      stdio: 'inherit',
    },
  );
  const result = await waitForExit(playwright);
  exitCode = result.code ?? 1;
} finally {
  if (!mobile.killed) mobile.kill();
  await Promise.race([
    waitForExit(mobile),
    new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000)),
  ]);
}

process.exitCode = exitCode;
