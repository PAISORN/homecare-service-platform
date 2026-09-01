import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { waitForLocalSupabase } from './lib/supabase-cli.mjs';

const status = await waitForLocalSupabase();
const apiUrl = new URL(status.API_URL);

assert.ok(
  apiUrl.hostname === '127.0.0.1' || apiUrl.hostname === 'localhost',
  `Identity integration test refuses non-local API URL: ${apiUrl.origin}`,
);
assert.ok(status.ANON_KEY, 'Local publishable/anon key is unavailable.');
assert.ok(status.SERVICE_ROLE_KEY, 'Local service-role key is unavailable.');

const runId = randomUUID();
const email = `mobile-identity-${runId}@example.test`;
const phone = `+668${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
const password = `HomeCare-${runId}!`;
let userId = null;

async function request(
  path,
  { token, apiKey = status.ANON_KEY, method = 'GET', body, headers = {} },
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
      // Keep plain-text error responses readable in the assertion.
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

try {
  const createdUser = await expectSuccess(
    '/auth/v1/admin/users',
    {
      token: status.SERVICE_ROLE_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        phone,
        password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { display_name: 'สมาชิกทดสอบมือถือ' },
      }),
    },
    'create fresh identity fixture',
  );
  userId = createdUser.id;

  const session = await expectSuccess(
    '/auth/v1/token?grant_type=password',
    {
      token: status.ANON_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'sign in fresh identity fixture',
  );
  const accessToken = session.access_token;

  const initialProfile = await expectSuccess(
    `/rest/v1/profiles?id=eq.${userId}&select=id,display_name,phone,account_status`,
    { token: accessToken },
    'read own fresh profile through RLS',
  );
  assert.equal(initialProfile.length, 1, 'auth trigger created one profile');
  assert.equal(initialProfile[0].account_status, 'active');
  assert.equal(
    initialProfile[0].phone,
    createdUser.phone,
    'profile retains the phone verified by Supabase Auth',
  );
  assert.match(
    createdUser.phone,
    /^668\d{8}$/,
    'Supabase Auth returns the expected canonical Thai mobile form',
  );

  const initialRoles = await expectSuccess(
    `/rest/v1/account_roles?user_id=eq.${userId}&select=role`,
    { token: accessToken },
    'read own fresh roles through RLS',
  );
  assert.deepEqual(initialRoles, [{ role: 'customer' }]);

  const updatedProfile = await expectSuccess(
    `/rest/v1/profiles?id=eq.${userId}&select=display_name`,
    {
      token: accessToken,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ display_name: 'ลูกค้า HomeCare ทดสอบ' }),
    },
    'update own display name through RLS',
  );
  assert.equal(updatedProfile[0].display_name, 'ลูกค้า HomeCare ทดสอบ');

  const firstLocation = await expectSuccess(
    '/rest/v1/rpc/save_service_location',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_label: '  บ้าน  ',
        p_address_line: '  99 ถนนสุขุมวิท กรุงเทพฯ  ',
      }),
    },
    'create first service location',
  );
  assert.equal(firstLocation.label, 'บ้าน');
  assert.equal(firstLocation.is_default, true);
  assert.equal(firstLocation.customer_id, userId);

  const secondLocation = await expectSuccess(
    '/rest/v1/rpc/save_service_location',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_label: 'คอนโด',
        p_address_line: '88 ถนนสุขุมวิท กรุงเทพฯ',
        p_building: 'อาคาร A',
        p_floor: '12',
        p_unit: '1204',
      }),
    },
    'create second service location',
  );
  assert.equal(secondLocation.is_default, false);

  const selectedDefault = await expectSuccess(
    '/rest/v1/rpc/set_default_service_location',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_location_id: secondLocation.id }),
    },
    'select the second location as default',
  );
  assert.equal(selectedDefault.id, secondLocation.id);
  assert.equal(selectedDefault.is_default, true);

  const visibleLocations = await expectSuccess(
    `/rest/v1/service_locations?customer_id=eq.${userId}&select=id,label,is_default&order=created_at.asc`,
    { token: accessToken },
    'list own service locations through RLS',
  );
  assert.deepEqual(visibleLocations, [
    { id: firstLocation.id, label: 'บ้าน', is_default: false },
    { id: secondLocation.id, label: 'คอนโด', is_default: true },
  ]);

  const removedLocationId = await expectSuccess(
    '/rest/v1/rpc/delete_service_location',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_location_id: secondLocation.id }),
    },
    'delete the current default service location',
  );
  assert.equal(removedLocationId, secondLocation.id);

  const remainingLocations = await expectSuccess(
    `/rest/v1/service_locations?customer_id=eq.${userId}&select=id,is_default`,
    { token: accessToken },
    'verify automatic default promotion through the Data API',
  );
  assert.deepEqual(remainingLocations, [
    { id: firstLocation.id, is_default: true },
  ]);

  const firstBootstrap = await expectSuccess(
    '/rest/v1/rpc/bootstrap_technician_application',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    'bootstrap technician application',
  );
  assert.equal(firstBootstrap.verification_status, 'draft');

  const retryBootstrap = await expectSuccess(
    '/rest/v1/rpc/bootstrap_technician_application',
    {
      token: accessToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    },
    'retry technician application bootstrap',
  );
  assert.equal(retryBootstrap.verification_status, 'draft');

  const finalRoles = await expectSuccess(
    `/rest/v1/account_roles?user_id=eq.${userId}&select=role&order=role.asc`,
    { token: accessToken },
    'read final roles through RLS',
  );
  assert.deepEqual(finalRoles, [{ role: 'customer' }, { role: 'technician' }]);

  const technicianProfiles = await expectSuccess(
    `/rest/v1/technician_profiles?user_id=eq.${userId}&select=user_id,verification_status`,
    { token: accessToken },
    'read own technician application through RLS',
  );
  assert.deepEqual(technicianProfiles, [
    { user_id: userId, verification_status: 'draft' },
  ]);

  console.log(
    'Mobile identity integration passed: fresh profile/customer role, service-location lifecycle, own-name update, and idempotent technician bootstrap.',
  );
} finally {
  if (userId) {
    const cleanup = await request(`/auth/v1/admin/users/${userId}`, {
      token: status.SERVICE_ROLE_KEY,
      method: 'DELETE',
    });
    assert.ok(
      cleanup.response.ok,
      `cleanup identity fixture: HTTP ${cleanup.response.status} ${JSON.stringify(cleanup.payload)}`,
    );
  }
}
