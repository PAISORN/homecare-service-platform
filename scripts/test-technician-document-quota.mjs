import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runSupabase, waitForLocalSupabase } from './lib/supabase-cli.mjs';

const status = await waitForLocalSupabase();
const apiUrl = new URL(status.API_URL);

assert.ok(
  apiUrl.hostname === '127.0.0.1' || apiUrl.hostname === 'localhost',
  `Quota integration tests refuse non-local API URL: ${apiUrl.origin}`,
);

const runId = randomUUID();
const email = `quota-tech-${runId}@example.test`;
const password = `HomeCare-${runId}!`;
let technicianId;
const uploadedPaths = [];

async function request(
  path,
  { token, method = 'GET', body, headers = {}, apiKey = status.ANON_KEY },
) {
  const response = await fetch(`${apiUrl.origin}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body,
  });
  const text = await response.text();
  let payload = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Plain text is useful in assertion messages.
    }
  }
  return { response, payload };
}

function runLocalFixtureSql(sql) {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'homecare-quota-'));
  const fixturePath = join(fixtureDirectory, 'fixture.sql');
  try {
    writeFileSync(fixturePath, sql, 'utf8');
    const result = runSupabase(
      ['db', 'query', '--local', '--file', fixturePath],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    assert.equal(
      result.status,
      0,
      `Local quota fixture SQL failed:\n${result.stderr}\n${result.stdout}`,
    );
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

async function createTechnician() {
  const created = await request('/auth/v1/admin/users', {
    token: status.SERVICE_ROLE_KEY,
    apiKey: status.SERVICE_ROLE_KEY,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: 'Quota technician' },
    }),
  });
  assert.ok(created.response.ok, JSON.stringify(created.payload));
  technicianId = created.payload.id;

  runLocalFixtureSql(`
    insert into public.account_roles (user_id, role)
    values ('${technicianId}', 'technician');
  `);
  runLocalFixtureSql(`
    insert into public.technician_profiles (user_id)
    values ('${technicianId}');
  `);

  const signedIn = await request('/auth/v1/token?grant_type=password', {
    token: status.ANON_KEY,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.ok(signedIn.response.ok, JSON.stringify(signedIn.payload));
  const token = signedIn.payload.access_token;
  const acknowledgement = await request(
    '/rest/v1/rpc/acknowledge_technician_kyc_notice',
    {
      token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  assert.ok(
    acknowledgement.response.ok,
    JSON.stringify(acknowledgement.payload),
  );
  return token;
}

async function registerDocument(token, index) {
  const path = `${technicianId}/concurrent-row-${index}-${runId}.jpg`;
  const result = await request('/rest/v1/technician_documents', {
    token,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      technician_id: technicianId,
      document_type: 'other',
      storage_path: path,
    }),
  });
  return { ...result, path };
}

async function uploadDocument(token, path) {
  const result = await request(
    `/storage/v1/object/technician-documents/${path}`,
    {
      token,
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'x-upsert': 'false',
      },
      body: new TextEncoder().encode(path),
    },
  );
  if (result.response.ok) uploadedPaths.push(path);
  return result;
}

try {
  const technicianToken = await createTechnician();

  runLocalFixtureSql(`
    update private.kyc_storage_configuration
    set max_documents_per_technician = 2,
        updated_at = transaction_timestamp()
    where singleton;
  `);

  const registrations = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      registerDocument(technicianToken, index),
    ),
  );
  const successfulRegistrations = registrations.filter(
    ({ response }) => response.ok,
  );
  assert.equal(
    successfulRegistrations.length,
    2,
    'concurrent database registrations must stop exactly at the configured quota',
  );

  const rows = await request(
    `/rest/v1/technician_documents?technician_id=eq.${technicianId}&select=id`,
    {
      token: technicianToken,
    },
  );
  assert.ok(rows.response.ok, JSON.stringify(rows.payload));
  assert.equal(rows.payload.length, 2, 'database quota must not be exceeded');

  const uploadCandidates = registrations.map(({ path }) => path);

  const uploads = await Promise.all(
    uploadCandidates.map((path) => uploadDocument(technicianToken, path)),
  );
  assert.equal(
    uploads.filter(({ response }) => response.ok).length,
    2,
    'only the two concurrency-safe document reservations may be uploaded',
  );

  const listed = await request('/storage/v1/object/list/technician-documents', {
    token: status.SERVICE_ROLE_KEY,
    apiKey: status.SERVICE_ROLE_KEY,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: technicianId, limit: 100 }),
  });
  assert.ok(listed.response.ok, JSON.stringify(listed.payload));
  assert.equal(listed.payload.length, 2, 'Storage quota must not be exceeded');

  process.stdout.write(
    'Concurrent quota integration passed: database registration and Storage uploads never exceeded the configured maximum.\n',
  );
} finally {
  if (uploadedPaths.length > 0) {
    const cleanup = await request('/storage/v1/object/technician-documents', {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: uploadedPaths }),
    });
    assert.ok(cleanup.response.ok, JSON.stringify(cleanup.payload));
  }

  runLocalFixtureSql(`
    update private.kyc_storage_configuration
    set max_documents_per_technician = 10,
        updated_at = transaction_timestamp()
    where singleton;
  `);
  if (technicianId) {
    runLocalFixtureSql(`
    do $cleanup$
    begin
      execute 'alter table public.technician_documents disable trigger technician_documents_protect_identity';
      execute 'alter table public.profiles disable trigger profiles_block_hard_delete_with_kyc';
      begin
        delete from auth.users where id = '${technicianId}';
      exception when others then
        execute 'alter table public.technician_documents enable trigger technician_documents_protect_identity';
        execute 'alter table public.profiles enable trigger profiles_block_hard_delete_with_kyc';
        raise;
      end;
      execute 'alter table public.technician_documents enable trigger technician_documents_protect_identity';
      execute 'alter table public.profiles enable trigger profiles_block_hard_delete_with_kyc';
    end
    $cleanup$;
    `);
  }
}
