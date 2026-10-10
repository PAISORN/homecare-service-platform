import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const defaultRosterPath = path.join(
  projectRoot,
  'ops',
  'pilot-incident-roster.local.json',
);
const configuredRosterPath =
  process.env.HOMECARE_PILOT_CONTACTS_FILE ?? defaultRosterPath;
const rosterPath = path.isAbsolute(configuredRosterPath)
  ? configuredRosterPath
  : path.resolve(projectRoot, configuredRosterPath);

const fail = (message) => {
  throw new Error(`Pilot incident roster is not ready: ${message}`);
};

let roster;
try {
  roster = JSON.parse(readFileSync(rosterPath, 'utf8'));
} catch (error) {
  fail(error instanceof Error ? error.message : 'cannot read roster');
}

if (roster.version !== 1) fail('version must be 1');

const requiredRoles = [
  'incident_commander',
  'operations_support',
  'database_owner',
];

for (const role of requiredRoles) {
  const contactKey = roster.roles?.[role];
  if (!contactKey || contactKey === 'UNASSIGNED') {
    fail(`${role} is not assigned`);
  }
  if (!roster.contacts?.[contactKey]) {
    fail(`${role} references an unknown contact`);
  }
}

const channelSummary = {};
for (const channelName of ['primary', 'backup']) {
  const channel = roster.channels?.[channelName];
  if (!channel?.contact || !channel?.method) {
    fail(`${channelName} channel is incomplete`);
  }

  const destination =
    roster.contacts?.[channel.contact]?.destinations?.[channel.method];
  if (
    typeof destination !== 'string' ||
    destination.trim().length < 3 ||
    /replace|unassigned|example/i.test(destination)
  ) {
    fail(`${channelName} channel has no usable destination`);
  }

  channelSummary[channelName] = channel.method;
}

if (rosterPath.startsWith(`${projectRoot}${path.sep}`)) {
  try {
    execFileSync('git', ['check-ignore', '--quiet', rosterPath], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
  } catch {
    fail('the private roster inside the repository is not ignored by Git');
  }
}

process.stdout.write(
  `${JSON.stringify({
    status: 'ready',
    roles: Object.fromEntries(
      requiredRoles.map((role) => [role, roster.roles[role]]),
    ),
    channels: channelSummary,
  })}\n`,
);
