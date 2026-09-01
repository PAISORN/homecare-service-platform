import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { runSupabase, waitForLocalSupabase } from './lib/supabase-cli.mjs';

const status = await waitForLocalSupabase();
const apiUrl = new URL(status.API_URL);
assert.ok(
  ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
  'Request Storage tests only run locally.',
);
assert.ok(
  status.ANON_KEY && status.SERVICE_ROLE_KEY,
  'Local API keys are unavailable.',
);

const runId = randomUUID();
const password = `HomeCare-${runId}!`;
const emails = [
  `request-owner-${runId}@example.test`,
  `request-other-${runId}@example.test`,
];
const createdUserIds = [];
let requestId;
let attachmentId;
let storagePath;

async function request(
  path,
  {
    token,
    apiKey = status.ANON_KEY,
    method = 'GET',
    body,
    headers = {},
    bytes = false,
  } = {},
) {
  const response = await fetch(`${apiUrl.origin}${path}`, {
    method,
    headers: { apikey: apiKey, Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  if (bytes)
    return { response, payload: new Uint8Array(await response.arrayBuffer()) };
  const text = await response.text();
  let payload = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      /* keep text */
    }
  }
  return { response, payload };
}

async function expectSuccess(path, options, message) {
  const result = await request(path, options);
  assert.ok(
    result.response.ok,
    `${message}: HTTP ${result.response.status} ${JSON.stringify(result.payload)}`,
  );
  return result.payload;
}

async function createUser(email) {
  const user = await expectSuccess(
    '/auth/v1/admin/users',
    {
      token: status.SERVICE_ROLE_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    },
    `create ${email}`,
  );
  createdUserIds.push(user.id);
  return user.id;
}

async function signIn(email) {
  const session = await expectSuccess(
    '/auth/v1/token?grant_type=password',
    {
      token: status.ANON_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    `sign in ${email}`,
  );
  return session.access_token;
}

async function rpc(name, token, args) {
  return expectSuccess(
    `/rest/v1/rpc/${name}`,
    {
      token,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(args),
    },
    `rpc ${name}`,
  );
}

async function assertMissing(path) {
  const result = await request(
    `/storage/v1/object/authenticated/request-attachments/${path}`,
    {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
    },
  );
  assert.ok(
    [400, 404].includes(result.response.status),
    `${path} should not exist`,
  );
}

async function cleanupFixtures() {
  if (createdUserIds.length === 0) return;
  const ids = createdUserIds.map((id) => `'${id}'::uuid`).join(',');
  const result = runSupabase(
    [
      'db',
      'query',
      '--local',
      `do $cleanup$
    begin
      delete from public.request_attachments where customer_id in (${ids});
      delete from public.service_requests where customer_id in (${ids});
      perform set_config('homecare.service_location_rpc', '1', true);
      delete from public.service_locations where customer_id in (${ids});
      delete from auth.users where id in (${ids});
    end
  $cleanup$`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  assert.equal(
    result.status,
    0,
    `Request Storage cleanup failed:\n${result.stderr}\n${result.stdout}`,
  );
}

try {
  const ownerId = await createUser(emails[0]);
  await createUser(emails[1]);
  const ownerToken = await signIn(emails[0]);
  const otherToken = await signIn(emails[1]);
  const location = await rpc('save_service_location', ownerToken, {
    p_label: 'บ้านทดสอบ',
    p_address_line: '99 ถนนสุขุมวิท',
    p_is_default: true,
  });
  const categories = await expectSuccess(
    '/rest/v1/service_categories?code=eq.AIR-CONDITIONING&select=id',
    { token: ownerToken },
    'read category',
  );
  const items = await expectSuccess(
    '/rest/v1/service_items?code=eq.AC-CLEAN-WALL&select=id',
    { token: ownerToken },
    'read item',
  );
  const draft = await rpc('save_service_request_draft', ownerToken, {
    p_service_location_id: location.id,
    p_service_category_id: categories[0].id,
    p_service_item_id: items[0].id,
    p_entry_point: 'service_catalog',
    p_problem_description: 'คำขอทดสอบ Storage',
    p_quantity: 1,
    p_urgency: 'flexible',
    p_preferred_date: null,
    p_preferred_time_window: null,
    p_intake_answers: {},
    p_safety_answers: {},
  });
  requestId = draft.id;
  storagePath = `${ownerId}/${requestId}/${randomUUID()}.jpg`;

  const orphanPath = `${ownerId}/${requestId}/${randomUUID()}.jpg`;
  const orphan = await request(
    `/storage/v1/object/request-attachments/${orphanPath}`,
    {
      token: ownerToken,
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: new TextEncoder().encode('orphan'),
    },
  );
  assert.ok(
    !orphan.response.ok,
    'an unreserved request image must be rejected',
  );
  await assertMissing(orphanPath);

  const attachment = await rpc('register_request_attachment', ownerToken, {
    p_service_request_id: requestId,
    p_storage_path: storagePath,
    p_mime_type: 'image/jpeg',
    p_size_bytes: 13,
  });
  attachmentId = attachment.id;
  await expectSuccess(
    `/storage/v1/object/request-attachments/${storagePath}`,
    {
      token: ownerToken,
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: new TextEncoder().encode('request-image'),
    },
    'upload reserved request image',
  );

  const ownerRead = await request(
    `/storage/v1/object/authenticated/request-attachments/${storagePath}`,
    { token: ownerToken, bytes: true },
  );
  assert.ok(
    ownerRead.response.ok,
    'the owner can read a private request image',
  );
  assert.deepEqual(
    ownerRead.payload,
    new TextEncoder().encode('request-image'),
  );

  const otherRead = await request(
    `/storage/v1/object/authenticated/request-attachments/${storagePath}`,
    { token: otherToken },
  );
  assert.ok(
    !otherRead.response.ok,
    'another customer cannot read the request image',
  );

  const otherDelete = await request('/storage/v1/object/request-attachments', {
    token: otherToken,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  assert.ok(
    otherDelete.response.ok,
    'Storage acknowledges an RLS-filtered batch delete',
  );
  const retained = await request(
    `/storage/v1/object/authenticated/request-attachments/${storagePath}`,
    {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
      bytes: true,
    },
  );
  assert.ok(
    retained.response.ok,
    'cross-customer deletion must leave the object intact',
  );

  const ownerDelete = await request('/storage/v1/object/request-attachments', {
    token: ownerToken,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  assert.ok(
    ownerDelete.response.ok,
    'the owner can delete an image from a draft',
  );
  await assertMissing(storagePath);
  const deletedPath = await rpc('delete_request_attachment', ownerToken, {
    p_attachment_id: attachmentId,
  });
  assert.equal(
    deletedPath,
    storagePath,
    'metadata deletion returns the removed storage path',
  );

  process.stdout.write(
    'Request attachment Storage integration checks passed.\n',
  );
} finally {
  if (storagePath) {
    await request('/storage/v1/object/request-attachments', {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [storagePath] }),
    });
  }
  await cleanupFixtures();
}
