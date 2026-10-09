import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const workspaceFiles = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    cwd: workspaceRoot,
    encoding: 'utf8',
  },
)
  .split('\0')
  .filter(Boolean);

const textExtensions = new Set([
  '',
  '.cjs',
  '.css',
  '.json',
  '.js',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const findings = [];

function report(file, rule) {
  findings.push(`${file}: ${rule}`);
}

for (const file of workspaceFiles) {
  const name = basename(file);
  if (name.startsWith('.env') && !name.endsWith('.example')) {
    report(file, 'tracked environment file is forbidden');
  }
  if (!textExtensions.has(extname(file))) continue;

  const content = readFileSync(resolve(workspaceRoot, file), 'utf8');
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(content)) {
    report(file, 'Supabase secret key pattern detected');
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    report(file, 'private key material detected');
  }
  if (
    /(?:EXPO_PUBLIC|NEXT_PUBLIC)_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY)\s*=/.test(
      content,
    )
  ) {
    report(file, 'secret-like value assigned to a public environment variable');
  }
  if (
    file.startsWith('apps/mobile/') &&
    !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) &&
    /service[_-]?role/i.test(content)
  ) {
    report(file, 'service-role reference detected in the mobile application');
  }
  if (
    file.startsWith('apps/admin/src/') &&
    /^['"]use client['"];?/m.test(content) &&
    /service[_-]?role/i.test(content)
  ) {
    report(file, 'service-role reference detected in a Client Component');
  }
}

const config = readFileSync(
  resolve(workspaceRoot, 'supabase', 'config.toml'),
  'utf8',
);
if (
  !/\[functions\.dispatch-job-notifications\][\s\S]*?verify_jwt\s*=\s*true/.test(
    config,
  )
) {
  report(
    'supabase/config.toml',
    'dispatch-job-notifications must keep JWT verification enabled',
  );
}

if (findings.length > 0) {
  process.stderr.write(
    `Security preflight failed:\n- ${findings.join('\n- ')}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `Security preflight passed (${workspaceFiles.length} tracked and untracked files checked).\n`,
);
