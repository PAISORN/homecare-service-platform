import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { parseEnvironment, run } from './lib/self-hosted-rehearsal.mjs';

const environment = parseEnvironment();
const apiUrl = new URL('http://127.0.0.1:58000');
const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY;
const secretKey = environment.SUPABASE_SECRET_KEY;
assert.ok(publishableKey && secretKey, 'Self-hosted API keys are unavailable.');
assert.ok(
  ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
  'Write-flow UAT refuses a non-local API URL.',
);

const runId = randomUUID();
const password = `HomeCare-${runId}!`;
const emails = [
  `selfhost-owner-${runId}@example.test`,
  `selfhost-other-${runId}@example.test`,
];
const createdUserIds = [];
let requestId;
let attachmentId;
let storagePath;

async function request(
  path,
  {
    token,
    apiKey = publishableKey,
    method = 'GET',
    body,
    headers = {},
    bytes = false,
  } = {},
) {
  const response = await fetch(`${apiUrl.origin}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      authorization: `Bearer ${token ?? apiKey}`,
      ...headers,
    },
    body,
  });
  if (bytes) {
    return { response, payload: new Uint8Array(await response.arrayBuffer()) };
  }
  const text = await response.text();
  let payload = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Keep plain-text failures readable.
    }
  }
  return { response, payload };
}

async function success(path, options, label) {
  const result = await request(path, options);
  assert.ok(
    result.response.ok,
    `${label}: HTTP ${result.response.status} ${JSON.stringify(result.payload)}`,
  );
  return result.payload;
}

async function createUser(email, displayName) {
  const user = await success(
    '/auth/v1/admin/users',
    {
      token: secretKey,
      apiKey: secretKey,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      }),
    },
    `create ${displayName}`,
  );
  assert.match(
    user.id,
    /^[0-9a-f-]{36}$/i,
    'Auth returned an invalid user id.',
  );
  createdUserIds.push(user.id);
  return user.id;
}

async function signIn(email) {
  const session = await success(
    '/auth/v1/token?grant_type=password',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    `sign in ${email}`,
  );
  return session.access_token;
}

async function rpc(name, token, args) {
  return success(
    `/rest/v1/rpc/${name}`,
    {
      token,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'return=representation',
      },
      body: JSON.stringify(args),
    },
    `rpc ${name}`,
  );
}

function databaseFingerprint() {
  const sql = `select json_build_object(
    'profiles', (select count(*) from public.profiles),
    'roles', (select count(*) from public.account_roles),
    'technicians', (select count(*) from public.technician_profiles),
    'locations', (select count(*) from public.service_locations),
    'requests', (select count(*) from public.service_requests),
    'request_attachments', (select count(*) from public.request_attachments),
    'storage_objects', (select count(*) from storage.objects)
  )::text;`;
  return run(
    'docker',
    [
      'exec',
      'supabase-db',
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--tuples-only',
      '--no-align',
      '--command',
      sql,
    ],
    { capture: true },
  ).stdout.trim();
}

function cleanupDatabaseFixtures() {
  if (!createdUserIds.length) return;
  const ids = createdUserIds.map((id) => `'${id}'::uuid`).join(',');
  const sql = `do $cleanup$
  begin
    delete from public.request_attachments where customer_id in (${ids});
    delete from public.service_requests where customer_id in (${ids});
    perform set_config('homecare.service_location_rpc', '1', true);
    delete from public.service_locations where customer_id in (${ids});
  end
  $cleanup$;`;
  run('docker', [
    'exec',
    'supabase-db',
    'psql',
    '--username',
    'postgres',
    '--dbname',
    'postgres',
    '--set',
    'ON_ERROR_STOP=1',
    '--command',
    sql,
  ]);
}

async function removeStorageFixture() {
  if (!storagePath) return;
  await request('/storage/v1/object/request-attachments', {
    token: secretKey,
    apiKey: secretKey,
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
}

async function removeUsers() {
  for (const userId of createdUserIds.toReversed()) {
    const result = await request(`/auth/v1/admin/users/${userId}`, {
      token: secretKey,
      apiKey: secretKey,
      method: 'DELETE',
    });
    assert.ok(
      result.response.ok,
      `cleanup user ${userId}: HTTP ${result.response.status}`,
    );
  }
}

const before = databaseFingerprint();
let primaryError;

try {
  const ownerId = await createUser(emails[0], 'Self-hosted customer');
  await createUser(emails[1], 'Unrelated customer');
  const ownerToken = await signIn(emails[0]);
  const otherToken = await signIn(emails[1]);

  const profile = await success(
    `/rest/v1/profiles?id=eq.${ownerId}&select=id,account_status`,
    { token: ownerToken },
    'read the generated profile through RLS',
  );
  assert.deepEqual(profile, [{ id: ownerId, account_status: 'active' }]);

  const initialRoles = await success(
    `/rest/v1/account_roles?user_id=eq.${ownerId}&select=role`,
    { token: ownerToken },
    'read the initial customer role',
  );
  assert.deepEqual(initialRoles, [{ role: 'customer' }]);

  const location = await rpc('save_service_location', ownerToken, {
    p_label: 'บ้านทดสอบ Self-hosted',
    p_address_line: '99/99 ถนนทดสอบ กรุงเทพฯ',
    p_is_default: true,
  });
  const categories = await success(
    '/rest/v1/service_categories?code=eq.AIR-CONDITIONING&select=id',
    { token: ownerToken },
    'read the configured service category',
  );
  const items = await success(
    '/rest/v1/service_items?code=eq.AC-CLEAN-WALL&select=id',
    { token: ownerToken },
    'read the configured service item',
  );
  assert.equal(categories.length, 1);
  assert.equal(items.length, 1);

  const draft = await rpc('save_service_request_draft', ownerToken, {
    p_service_location_id: location.id,
    p_service_category_id: categories[0].id,
    p_service_item_id: items[0].id,
    p_entry_point: 'service_catalog',
    p_problem_description: 'ทดสอบ write flow บน Self-hosted local',
    p_quantity: 1,
    p_urgency: 'flexible',
    p_preferred_date: null,
    p_preferred_time_window: null,
    p_intake_answers: {},
    p_safety_answers: {},
  });
  requestId = draft.id;
  storagePath = `${ownerId}/${requestId}/${randomUUID()}.jpg`;

  const attachment = await rpc('register_request_attachment', ownerToken, {
    p_service_request_id: requestId,
    p_storage_path: storagePath,
    p_mime_type: 'image/jpeg',
    p_size_bytes: 16,
  });
  attachmentId = attachment.id;
  const image = new TextEncoder().encode('selfhost-image!!');
  await success(
    `/storage/v1/object/request-attachments/${storagePath}`,
    {
      token: ownerToken,
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false' },
      body: image,
    },
    'upload a reserved request attachment',
  );

  const ownerRead = await request(
    `/storage/v1/object/authenticated/request-attachments/${storagePath}`,
    { token: ownerToken, bytes: true },
  );
  assert.ok(ownerRead.response.ok, 'The owner must read their attachment.');
  assert.deepEqual(ownerRead.payload, image);
  const otherRead = await request(
    `/storage/v1/object/authenticated/request-attachments/${storagePath}`,
    { token: otherToken },
  );
  assert.ok(
    !otherRead.response.ok,
    'An unrelated customer must not read the attachment.',
  );

  const firstBootstrap = await rpc(
    'bootstrap_technician_application',
    ownerToken,
    {},
  );
  const retryBootstrap = await rpc(
    'bootstrap_technician_application',
    ownerToken,
    {},
  );
  assert.equal(firstBootstrap.verification_status, 'draft');
  assert.equal(retryBootstrap.verification_status, 'draft');
  const finalRoles = await success(
    `/rest/v1/account_roles?user_id=eq.${ownerId}&select=role&order=role.asc`,
    { token: ownerToken },
    'read customer and technician roles',
  );
  assert.deepEqual(finalRoles, [{ role: 'customer' }, { role: 'technician' }]);

  const ownerDelete = await request('/storage/v1/object/request-attachments', {
    token: ownerToken,
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  assert.ok(ownerDelete.response.ok, 'The draft owner must delete the object.');
  const deletedPath = await rpc('delete_request_attachment', ownerToken, {
    p_attachment_id: attachmentId,
  });
  assert.equal(deletedPath, storagePath);
  attachmentId = undefined;
  storagePath = undefined;

  process.stdout.write(
    'Self-hosted write-flow passed: Auth, profile trigger, customer RLS, configurable catalog, request draft, private Storage, cross-account denial, and idempotent technician bootstrap.\n',
  );
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  try {
    await removeStorageFixture();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    cleanupDatabaseFixtures();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await removeUsers();
  } catch (error) {
    cleanupErrors.push(error);
  }
  const after = databaseFingerprint();
  if (before !== after) {
    cleanupErrors.push(
      new Error(`Fixture cleanup mismatch: before=${before}; after=${after}`),
    );
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors);
  process.stdout.write(`Fixture cleanup passed: ${after}\n`);
}
