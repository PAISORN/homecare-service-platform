import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { runSupabase, waitForLocalSupabase } from './lib/supabase-cli.mjs';

const status = await waitForLocalSupabase();
const apiUrl = new URL(status.API_URL);
assert.ok(
  ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
  'Quality evidence tests only run locally.',
);
assert.ok(
  status.ANON_KEY && status.SERVICE_ROLE_KEY,
  'Local API keys are unavailable.',
);

const runId = randomUUID();
const password = `HomeCare-${runId}!`;
const emails = ['quality-owner', 'quality-tech', 'quality-other'].map(
  (name) => `${name}-${runId}@example.test`,
);
const userIds = [];
let caseId;
let storagePath;
const jobNumber = `HC-20260911-${String(Math.floor(Math.random() * 900000) + 100000)}`;

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
  if (text)
    try {
      payload = JSON.parse(text);
    } catch {
      /* keep text */
    }
  return { response, payload };
}

async function success(path, options, message) {
  const result = await request(path, options);
  assert.ok(
    result.response.ok,
    `${message}: HTTP ${result.response.status} ${JSON.stringify(result.payload)}`,
  );
  return result.payload;
}

async function createUser(email) {
  const user = await success(
    '/auth/v1/admin/users',
    {
      token: status.SERVICE_ROLE_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    },
    `create ${email}`,
  );
  userIds.push(user.id);
  return user.id;
}

async function signIn(email) {
  const session = await success(
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
  return success(
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

function query(sql, label) {
  const result = runSupabase(['db', 'query', '--local', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(
    result.status,
    0,
    `${label}:\n${result.stderr}\n${result.stdout}`,
  );
}

try {
  const ownerId = await createUser(emails[0]);
  const technicianId = await createUser(emails[1]);
  await createUser(emails[2]);
  const ownerToken = await signIn(emails[0]);
  const technicianToken = await signIn(emails[1]);
  const otherToken = await signIn(emails[2]);
  const locationId = randomUUID();
  const requestId = randomUUID();
  const jobId = randomUUID();
  query(
    `do $fixture$ begin
    insert into public.account_roles (user_id, role) values ('${technicianId}', 'technician');
    insert into public.technician_profiles (user_id, bio)
      values ('${technicianId}', 'ช่างทดสอบ Storage คุณภาพงาน');
    insert into public.service_locations (id, customer_id, label, address_line, is_default)
      values ('${locationId}', '${ownerId}', 'บ้านทดสอบ', '99/99 ถนนทดสอบ', true);
    insert into public.service_requests (id, customer_id, service_location_id, service_category_id, entry_point, status, problem_description, quantity, urgency)
      select '${requestId}', '${ownerId}', '${locationId}', id, 'symptom', 'technician_selected', 'ทดสอบแนบหลักฐานข้อร้องเรียน', 1, 'flexible'
      from public.service_categories where code = 'AIR-CONDITIONING';
    insert into public.service_jobs (id, job_number, service_request_id, customer_id, technician_id, service_category_id, agreement_revision, price_model, scope_description, labor_amount, materials_amount, currency, labor_commission_rate, warranty_days, status)
      select '${jobId}', '${jobNumber}', '${requestId}', '${ownerId}', '${technicianId}', id, 1, 'evidence_quote', 'ทดสอบหลักฐานคุณภาพงาน', 1000, 0, 'THB', 0.15, 30, 'awaiting_acceptance'
      from public.service_categories where code = 'AIR-CONDITIONING';
    update public.service_jobs set status = 'completed' where id = '${jobId}';
  end $fixture$`,
    'create quality evidence fixtures',
  );

  const qualityCase = await rpc('open_service_quality_case', ownerToken, {
    p_job_id: jobId,
    p_kind: 'complaint',
    p_category: 'work_quality',
    p_details: 'งานยังมีอาการเดิมและแนบรูปเพื่อให้ HomeCare ตรวจสอบ',
  });
  caseId = qualityCase.id;
  storagePath = `${ownerId}/${caseId}/${randomUUID()}.jpg`;

  const orphanPath = `${ownerId}/${caseId}/${randomUUID()}.jpg`;
  const orphan = await request(
    `/storage/v1/object/service-quality-evidence/${orphanPath}`,
    {
      token: ownerToken,
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: new TextEncoder().encode('orphan'),
    },
  );
  assert.ok(
    !orphan.response.ok,
    'an unreserved quality image must be rejected',
  );

  await rpc('register_service_quality_case_attachment', ownerToken, {
    p_case_id: caseId,
    p_storage_path: storagePath,
    p_mime_type: 'image/jpeg',
    p_size_bytes: 13,
  });
  const image = new TextEncoder().encode('quality-image');
  await success(
    `/storage/v1/object/service-quality-evidence/${storagePath}`,
    {
      token: ownerToken,
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: image,
    },
    'upload reserved quality image',
  );

  for (const [name, token] of [
    ['owner', ownerToken],
    ['technician', technicianToken],
  ]) {
    const read = await request(
      `/storage/v1/object/authenticated/service-quality-evidence/${storagePath}`,
      { token, bytes: true },
    );
    assert.ok(
      read.response.ok,
      `${name} can read assigned-job quality evidence`,
    );
    assert.deepEqual(read.payload, image);
  }
  const otherRead = await request(
    `/storage/v1/object/authenticated/service-quality-evidence/${storagePath}`,
    { token: otherToken },
  );
  assert.ok(
    !otherRead.response.ok,
    'an unrelated account cannot read quality evidence',
  );
  process.stdout.write(
    'Service quality evidence Storage integration checks passed.\n',
  );
} finally {
  if (storagePath)
    await request('/storage/v1/object/service-quality-evidence', {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [storagePath] }),
    });
  if (userIds.length) {
    const ids = userIds.map((id) => `'${id}'::uuid`).join(',');
    query(
      `do $cleanup$ begin
      delete from public.service_quality_case_events where case_id in (select id from public.service_quality_cases where customer_id in (${ids}));
      delete from public.service_quality_case_attachments where case_id in (select id from public.service_quality_cases where customer_id in (${ids}));
      delete from public.service_disputes where customer_id in (${ids});
      delete from public.service_quality_cases where customer_id in (${ids});
      delete from public.service_job_reviews where customer_id in (${ids});
      delete from public.service_job_warranties where customer_id in (${ids});
      delete from public.service_job_acceptances where customer_id in (${ids});
      delete from public.chat_messages where chat_room_id in (
        select id from public.chat_rooms where service_job_id in (
          select id from public.service_jobs where customer_id in (${ids})
        )
      );
      delete from public.chat_room_memberships where chat_room_id in (
        select id from public.chat_rooms where service_job_id in (
          select id from public.service_jobs where customer_id in (${ids})
        )
      );
      delete from public.chat_rooms where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.notifications where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_job_additional_work_requests where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_job_evidence where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_job_pins where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.job_status_events where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_jobs where customer_id in (${ids});
      delete from public.service_requests where customer_id in (${ids});
      perform set_config('homecare.service_location_rpc', '1', true);
      delete from public.service_locations where customer_id in (${ids});
      delete from public.technician_profiles where user_id in (${ids});
      delete from auth.users where id in (${ids});
    end $cleanup$`,
      'cleanup quality evidence fixtures',
    );
  }
}
