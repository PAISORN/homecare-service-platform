import { createHash, randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  dockerRoot,
  parseEnvironment,
  selfHostedRoot,
} from './lib/self-hosted-rehearsal.mjs';

const environment = parseEnvironment();
const storageRoot = resolve(dockerRoot, 'volumes', 'storage');
const backupRoot = resolve(selfHostedRoot, 'backups');
const drillId = randomUUID();
const bucketId = `rehearsal-${drillId}`;
const objectPath = 'sentinel.txt';
const sentinel = Buffer.from(`HomeCare storage restore drill ${drillId}\n`);
const backupPath = resolve(backupRoot, `${bucketId}-backup`);
const restorePath = resolve(backupRoot, `${bucketId}-restore`);
const apiRoot = 'http://127.0.0.1:58000/storage/v1';
const headers = {
  apikey: environment.SUPABASE_SECRET_KEY,
  authorization: `Bearer ${environment.SUPABASE_SECRET_KEY}`,
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function filesBelow(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...filesBelow(path));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

async function expectOk(response, operation) {
  if (response.ok) return response;
  const detail = await response.text();
  throw new Error(
    `${operation} failed with HTTP ${response.status}: ${detail}`,
  );
}

async function removeFixture() {
  await fetch(`${apiRoot}/object/${bucketId}/${objectPath}`, {
    method: 'DELETE',
    headers,
  }).catch(() => undefined);
  await fetch(`${apiRoot}/bucket/${bucketId}`, {
    method: 'DELETE',
    headers,
  }).catch(() => undefined);
}

mkdirSync(backupRoot, { recursive: true });

try {
  await expectOk(
    await fetch(`${apiRoot}/bucket`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ id: bucketId, name: bucketId, public: false }),
    }),
    'creating the drill bucket',
  );
  await expectOk(
    await fetch(`${apiRoot}/object/${bucketId}/${objectPath}`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'text/plain' },
      body: sentinel,
    }),
    'uploading the sentinel object',
  );

  const liveResponse = await expectOk(
    await fetch(`${apiRoot}/object/authenticated/${bucketId}/${objectPath}`, {
      headers,
    }),
    'reading the sentinel object',
  );
  const liveObject = Buffer.from(await liveResponse.arrayBuffer());
  if (sha256(liveObject) !== sha256(sentinel)) {
    throw new Error('The uploaded Storage object checksum does not match.');
  }

  cpSync(storageRoot, backupPath, { recursive: true, force: false });
  cpSync(backupPath, restorePath, { recursive: true, force: false });

  const sentinelHash = sha256(sentinel);
  const restoredMatches = filesBelow(restorePath).filter((path) => {
    if (statSync(path).size !== sentinel.length) return false;
    return sha256(readFileSync(path)) === sentinelHash;
  });
  if (restoredMatches.length !== 1) {
    throw new Error(
      `Expected one restored sentinel, found ${restoredMatches.length}.`,
    );
  }

  process.stdout.write(
    `Storage backup/restore rehearsal passed: ${basename(restoredMatches[0])} matched SHA-256.\n`,
  );
} finally {
  await removeFixture();
  rmSync(backupPath, { recursive: true, force: true });
  rmSync(restorePath, { recursive: true, force: true });
}
