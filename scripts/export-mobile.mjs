import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const workspaceExpoHome = resolve(process.cwd(), '../../.expo');
mkdirSync(workspaceExpoHome, { recursive: true });

const executable = process.platform === 'win32' ? 'expo.cmd' : 'expo';
const result = spawnSync(
  executable,
  ['export', '--platform', 'web', '--output-dir', 'dist'],
  {
    env: {
      ...process.env,
      EXPO_HOME: workspaceExpoHome,
      EXPO_NO_TELEMETRY: '1',
    },
    shell: process.platform === 'win32',
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
