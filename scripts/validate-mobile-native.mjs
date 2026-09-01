import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const mobileRoot = resolve(workspaceRoot, 'apps/mobile');
const mobileRequire = createRequire(resolve(mobileRoot, 'package.json'));
const executables = {
  expo: mobileRequire.resolve('expo/bin/cli'),
  'expo-doctor': mobileRequire.resolve('expo-doctor/bin/expo-doctor.js'),
};

const environment = {
  ...process.env,
  CI: '1',
  EXPO_HOME: resolve(workspaceRoot, '.expo'),
  EXPO_NO_CACHE: '1',
  EXPO_NO_TELEMETRY: '1',
};

function run(binary, args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [executables[binary], ...args], {
    cwd: mobileRoot,
    env: environment,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) {
      process.stderr.write(result.stderr ?? '');
      process.stderr.write(result.stdout ?? '');
    }
    process.exit(result.status ?? 1);
  }

  return result.stdout ?? '';
}

for (const configType of ['public', 'introspect']) {
  const config = run('expo', ['config', '--type', configType, '--json'], {
    capture: true,
  });
  JSON.parse(config);
  console.log(`Expo ${configType} config: valid`);
}

run('expo', ['install', '--check']);
run('expo-doctor', []);
