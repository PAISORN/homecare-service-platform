import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import { parseEnvironment, run } from './lib/self-hosted-rehearsal.mjs';

const environment = parseEnvironment();
const apiUrl = new URL('http://127.0.0.1:58000');
const publishableKey = environment.SUPABASE_PUBLISHABLE_KEY;
const secretKey = environment.SUPABASE_SECRET_KEY;
assert.ok(publishableKey && secretKey, 'Self-hosted API keys are unavailable.');
assert.ok(
  ['127.0.0.1', 'localhost'].includes(apiUrl.hostname),
  'Cross-role UAT refuses a non-local API URL.',
);

const runId = randomUUID();
const password = `HomeCare-${runId}!`;
const identities = {
  customer: `lifecycle-customer-${runId}@example.test`,
  technician: `lifecycle-technician-${runId}@example.test`,
  administrator: `lifecycle-administrator-${runId}@example.test`,
};
const createdUserIds = [];
const storagePaths = [];

async function request(
  path,
  { token, apiKey = publishableKey, method = 'GET', body, headers = {} } = {},
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
  const text = await response.text();
  let payload = text;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Preserve plain-text API errors.
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
  return session;
}

function executeSql(sql) {
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

function databaseFingerprint() {
  const sql = `select json_build_object(
    'profiles', (select count(*) from public.profiles),
    'roles', (select count(*) from public.account_roles),
    'locations', (select count(*) from public.service_locations),
    'requests', (select count(*) from public.service_requests),
    'interests', (select count(*) from public.technician_interests),
    'jobs', (select count(*) from public.service_jobs),
    'notifications', (select count(*) from public.notifications),
    'quality_cases', (select count(*) from public.service_quality_cases),
    'storage_objects', (select count(*) from storage.objects),
    'audit_log', (select count(*) from public.audit_log)
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

function setupRoles(customerId, technicianId, administratorId) {
  executeSql(`do $fixture$
  begin
    insert into public.account_roles (user_id, role) values
      ('${technicianId}', 'technician'),
      ('${administratorId}', 'administrator');
    insert into public.technician_profiles (
      user_id, bio, verification_status, submitted_at, verified_at, verified_by
    ) values (
      '${technicianId}',
      'ช่างทดสอบวงจรงาน Self-hosted ที่ผ่านการตรวจสอบแล้ว',
      'verified', now(), now(), '${administratorId}'
    );
    insert into public.technician_skills (
      technician_id, service_category_id, years_experience
    )
    select '${technicianId}', id, 5
    from public.service_categories where code = 'AIR-CONDITIONING';
    insert into public.admin_permissions (user_id, permission)
    values ('${administratorId}', 'case_management');
    update public.profiles set display_name = case id
      when '${customerId}' then 'ลูกค้าทดสอบวงจรงาน'
      when '${technicianId}' then 'ช่างทดสอบวงจรงาน'
      when '${administratorId}' then 'ผู้ดูแลทดสอบวงจรงาน'
      else display_name end
    where id in ('${customerId}', '${technicianId}', '${administratorId}');
  end
  $fixture$;`);
}

async function removeStorageFixtures() {
  for (const { bucket, path } of storagePaths) {
    await request(`/storage/v1/object/${bucket}`, {
      token: secretKey,
      apiKey: secretKey,
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] }),
    });
  }
}

async function removeStoredFixturesForUsers(userIds) {
  if (!userIds.length) return;
  const ids = userIds.map((id) => `'${id}'`).join(',');
  const result = run(
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
      '--field-separator',
      '|',
      '--command',
      `select bucket_id, name from storage.objects where owner_id::text in (${ids}) order by bucket_id, name;`,
    ],
    { capture: true },
  );
  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf('|');
    assert.ok(separator > 0, `Invalid Storage fixture row: ${line}`);
    const bucket = line.slice(0, separator);
    const path = line.slice(separator + 1);
    const removal = await request(`/storage/v1/object/${bucket}`, {
      token: secretKey,
      apiKey: secretKey,
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] }),
    });
    assert.ok(
      removal.response.ok,
      `cleanup Storage object ${bucket}/${path} failed`,
    );
  }
}

async function registerAndUploadEvidence(
  token,
  technicianId,
  jobId,
  evidenceType,
  content,
) {
  const evidenceBody = new TextEncoder().encode(content);
  const evidencePath = `${technicianId}/${jobId}/${evidenceType}/${randomUUID()}.jpg`;
  storagePaths.push({ bucket: 'service-job-evidence', path: evidencePath });
  await rpc('register_service_job_evidence', token, {
    p_job_id: jobId,
    p_evidence_type: evidenceType,
    p_storage_path: evidencePath,
    p_mime_type: 'image/jpeg',
    p_size_bytes: evidenceBody.byteLength,
  });
  await success(
    `/storage/v1/object/service-job-evidence/${evidencePath}`,
    {
      token,
      method: 'POST',
      headers: { 'content-type': 'image/jpeg', 'x-upsert': 'false' },
      body: evidenceBody,
    },
    `upload ${evidenceType} work evidence`,
  );
}

function cleanupDatabaseFixtures(userIds = createdUserIds) {
  if (!userIds.length) return;
  const ids = userIds.map((id) => `'${id}'::uuid`).join(',');
  const idTexts = userIds.map((id) => `'${id}'`).join(',');
  executeSql(`do $cleanup$
  begin
    execute 'alter table public.job_status_events disable trigger job_status_events_prevent_delete';
    begin
      delete from public.service_quality_case_events
        where case_id in (select id from public.service_quality_cases where customer_id in (${ids}));
      delete from public.service_quality_case_attachments
        where case_id in (select id from public.service_quality_cases where customer_id in (${ids}));
      delete from public.service_disputes where customer_id in (${ids});
      delete from public.service_quality_cases where customer_id in (${ids});
      delete from public.service_job_reviews where customer_id in (${ids});
      delete from public.service_job_warranties where customer_id in (${ids});
      delete from public.service_job_acceptances
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.chat_messages where sender_user_id in (${ids});
      delete from public.chat_room_memberships where user_id in (${ids});
      delete from public.chat_rooms
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.notifications
        where recipient_user_id in (${ids}) or actor_user_id in (${ids});
      delete from public.push_devices where user_id in (${ids});
      delete from public.service_job_additional_work_requests
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      perform set_config('app.service_job_evidence_cleanup', 'on', true);
      delete from public.service_job_evidence
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_job_pins
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.job_status_events
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.appointments
        where service_job_id in (select id from public.service_jobs where customer_id in (${ids}));
      delete from public.service_jobs where customer_id in (${ids});
      delete from public.service_request_agreements
        where customer_id in (${ids}) or technician_id in (${ids});
      delete from public.service_request_selections where customer_id in (${ids});
      delete from public.quotations where technician_id in (${ids});
      delete from public.technician_interests where technician_id in (${ids});
      delete from public.request_attachments where customer_id in (${ids});
      delete from public.service_requests where customer_id in (${ids});
      perform set_config('homecare.service_location_rpc', '1', true);
      delete from public.service_locations where customer_id in (${ids});
      delete from public.technician_skills where technician_id in (${ids});
      delete from public.admin_permissions where user_id in (${ids}) or assigned_by in (${ids});
      delete from public.technician_profiles where user_id in (${ids});
      delete from public.account_roles where user_id in (${ids});
      delete from public.audit_log
        where actor_user_id in (${ids})
          or (
            entity_type = 'account_role'
            and metadata ->> 'target_user_id' in (${idTexts})
          );
    exception when others then
      execute 'alter table public.job_status_events enable trigger job_status_events_prevent_delete';
      raise;
    end;
    execute 'alter table public.job_status_events enable trigger job_status_events_prevent_delete';
  end
  $cleanup$;`);
}

async function removeUsers(userIds = createdUserIds) {
  for (const userId of userIds.toReversed()) {
    const result = await request(`/auth/v1/admin/users/${userId}`, {
      token: secretKey,
      apiKey: secretKey,
      method: 'DELETE',
    });
    assert.ok(result.response.ok, `cleanup user ${userId} failed`);
  }
}

const cleanupOnlyUserIds = (process.env.SELFHOST_CROSS_ROLE_CLEANUP_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
for (const userId of cleanupOnlyUserIds) {
  assert.match(
    userId,
    /^[0-9a-f]{8}-[0-9a-f-]{27}$/i,
    'Invalid cleanup user id.',
  );
}
if (cleanupOnlyUserIds.length) {
  await removeStoredFixturesForUsers(cleanupOnlyUserIds);
  cleanupDatabaseFixtures(cleanupOnlyUserIds);
  await removeUsers(cleanupOnlyUserIds);
  process.stdout.write(
    `Removed ${cleanupOnlyUserIds.length} explicit cross-role fixture users.\n`,
  );
  process.exit(0);
}

const before = databaseFingerprint();
const fixtureOutputPath =
  process.env.SELFHOST_CROSS_ROLE_FIXTURE_OUTPUT?.trim();
let primaryError;
let fixtureKept = false;

try {
  const customerId = await createUser(
    identities.customer,
    'Lifecycle customer',
  );
  const technicianId = await createUser(
    identities.technician,
    'Lifecycle technician',
  );
  const administratorId = await createUser(
    identities.administrator,
    'Lifecycle administrator',
  );
  setupRoles(customerId, technicianId, administratorId);

  const customerSession = await signIn(identities.customer);
  const technicianSession = await signIn(identities.technician);
  const administratorSession = await signIn(identities.administrator);
  const customerToken = customerSession.access_token;
  const technicianToken = technicianSession.access_token;
  const administratorToken = administratorSession.access_token;

  const location = await rpc('save_service_location', customerToken, {
    p_label: 'บ้านทดสอบวงจรงาน',
    p_address_line: '99/99 ถนนทดสอบ กรุงเทพมหานคร 10110',
    p_is_default: true,
  });
  const categories = await success(
    '/rest/v1/service_categories?code=eq.AIR-CONDITIONING&select=id',
    { token: customerToken },
    'read configured category',
  );
  assert.equal(categories.length, 1);
  const draft = await rpc('save_service_request_draft', customerToken, {
    p_service_location_id: location.id,
    p_service_category_id: categories[0].id,
    p_service_item_id: null,
    p_entry_point: 'symptom',
    p_problem_description: 'แอร์มีกลิ่นอับและต้องการให้ช่างประเมินหน้างาน',
    p_quantity: 1,
    p_urgency: 'flexible',
    p_preferred_date: null,
    p_preferred_time_window: null,
    p_intake_answers: {},
    p_safety_answers: {},
  });
  const submitted = await rpc('submit_service_request', customerToken, {
    p_request_id: draft.id,
  });
  assert.equal(submitted.status, 'matching');

  await rpc('express_technician_interest', technicianToken, {
    p_request_id: draft.id,
  });
  await rpc('submit_technician_quotation', technicianToken, {
    p_request_id: draft.id,
    p_scope_description: 'ล้างคอยล์และตรวจระบบระบายน้ำตามอาการที่แจ้ง',
    p_labor_amount: 800,
  });
  const shortlist = await rpc(
    'list_customer_request_shortlist',
    customerToken,
    {
      p_request_id: draft.id,
    },
  );
  assert.equal(shortlist.length, 1);
  assert.equal(shortlist[0].technician_id, technicianId);
  const selection = await rpc('select_technician_for_request', customerToken, {
    p_request_id: draft.id,
    p_technician_id: technicianId,
  });
  assert.equal(Number(selection.agreed_labor_amount), 800);

  const appointmentDate = new Date(Date.now() + 2 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await rpc('propose_service_request_appointment', customerToken, {
    p_request_id: draft.id,
    p_appointment_date: appointmentDate,
    p_appointment_time_window: '09:00–12:00',
  });
  await rpc('confirm_service_request_agreement', customerToken, {
    p_request_id: draft.id,
  });
  await rpc('confirm_service_request_agreement', technicianToken, {
    p_request_id: draft.id,
  });
  const jobResult = await rpc('get_service_job_for_request', customerToken, {
    p_request_id: draft.id,
  });
  const job = Array.isArray(jobResult) ? jobResult[0] : jobResult;
  assert.ok(job, 'Service job was not created after both agreements.');
  assert.equal(job.job_status, 'scheduled');

  await rpc('transition_service_job', technicianToken, {
    p_job_id: job.job_id,
    p_expected_status: 'scheduled',
    p_new_status: 'technician_en_route',
    p_reason: null,
  });
  await rpc('transition_service_job', technicianToken, {
    p_job_id: job.job_id,
    p_expected_status: 'technician_en_route',
    p_new_status: 'technician_arrived',
    p_reason: null,
  });
  await registerAndUploadEvidence(
    technicianToken,
    technicianId,
    job.job_id,
    'before',
    'before-work-image',
  );
  const startPin = await rpc('issue_service_job_pin', customerToken, {
    p_job_id: job.job_id,
    p_purpose: 'start',
  });
  assert.match(startPin, /^\d{6}$/);
  const started = await rpc('verify_service_job_pin', technicianToken, {
    p_job_id: job.job_id,
    p_purpose: 'start',
    p_pin: startPin,
  });
  assert.equal(started.verified, true);

  await registerAndUploadEvidence(
    technicianToken,
    technicianId,
    job.job_id,
    'after',
    'completed-work-image',
  );

  const completionPin = await rpc('issue_service_job_pin', customerToken, {
    p_job_id: job.job_id,
    p_purpose: 'completion',
  });
  const completedByPin = await rpc('verify_service_job_pin', technicianToken, {
    p_job_id: job.job_id,
    p_purpose: 'completion',
    p_pin: completionPin,
  });
  assert.equal(completedByPin.verified, true);
  const acceptance = await rpc(
    'confirm_service_job_acceptance',
    customerToken,
    {
      p_job_id: job.job_id,
    },
  );
  assert.equal(acceptance.status, 'customer_accepted');

  const review = await rpc('submit_service_job_review', customerToken, {
    p_job_id: job.job_id,
    p_overall: 4,
    p_quality: 4,
    p_punctuality: 5,
    p_price_clarity: 4,
    p_manners: 5,
    p_tags: ['ตรงเวลา'],
    p_review_text: 'ช่างตรงเวลาและสื่อสารชัดเจน แต่ต้องการติดตามผลหลังงาน',
  });
  const qualityCase = await rpc('open_service_quality_case', customerToken, {
    p_job_id: job.job_id,
    p_kind: 'complaint',
    p_category: 'work_quality',
    p_details: 'หลังงานยังมีกลิ่นอับเล็กน้อยและต้องการให้ HomeCare ตรวจสอบ',
  });
  await rpc('respond_to_service_quality_case', technicianToken, {
    p_case_id: qualityCase.id,
    p_response: 'รับทราบและพร้อมกลับเข้าตรวจสอบอาการตามที่ลูกค้าแจ้ง',
  });
  await rpc('admin_escalate_service_quality_case', administratorToken, {
    p_case_id: qualityCase.id,
  });
  const resolution = await rpc(
    'admin_update_service_quality_case',
    administratorToken,
    {
      p_case_id: qualityCase.id,
      p_status: 'resolved',
      p_decision: 'warranty_rework',
      p_decision_note: 'ให้ช่างกลับเข้าตรวจสอบและแก้งานตามการรับประกัน',
      p_simulated_refund_amount: null,
    },
  );
  assert.equal(resolution.status, 'resolved');
  await rpc('admin_moderate_service_job_review', administratorToken, {
    p_review_id: review.id,
    p_status: 'published',
    p_note: 'ตรวจข้อความแล้วไม่มีข้อมูลส่วนบุคคล',
  });

  const customerNotifications = await success(
    '/rest/v1/notifications?select=id,event_key&order=created_at.asc',
    { token: customerToken },
    'read customer notifications',
  );
  const technicianNotifications = await success(
    '/rest/v1/notifications?select=id,event_key&order=created_at.asc',
    { token: technicianToken },
    'read technician notifications',
  );
  assert.ok(
    customerNotifications.length > 0,
    'Customer must receive notifications.',
  );
  assert.ok(
    technicianNotifications.length > 0,
    'Technician must receive notifications.',
  );
  const events = await rpc('list_service_job_status_events', customerToken, {
    p_job_id: job.job_id,
  });
  assert.equal(events.at(-1).to_status, 'completed');

  if (fixtureOutputPath) {
    writeFileSync(
      fixtureOutputPath,
      `${JSON.stringify(
        {
          identities,
          password,
          userIds: {
            customer: customerId,
            technician: technicianId,
            administrator: administratorId,
          },
          sessions: {
            customer: customerSession,
            technician: technicianSession,
            administrator: administratorSession,
          },
          requestId: draft.id,
          jobId: job.job_id,
          jobNumber: job.job_number,
          qualityCaseId: qualityCase.id,
        },
        null,
        2,
      )}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );
    fixtureKept = true;
    process.stdout.write('Cross-role UI fixture prepared.\n');
  }

  process.stdout.write(
    `Cross-role lifecycle passed: request ${draft.id}, job ${job.job_number}, ${events.length} status events, ${customerNotifications.length} customer notifications, ${technicianNotifications.length} technician notifications, resolved quality case.\n`,
  );
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  let after = before;
  if (!fixtureKept) {
    try {
      await removeStorageFixtures();
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
    after = databaseFingerprint();
    if (before !== after) {
      cleanupErrors.push(
        new Error(`Fixture cleanup mismatch: before=${before}; after=${after}`),
      );
    }
  }
  if (primaryError) throw primaryError;
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors);
  if (!fixtureKept) {
    process.stdout.write(`Cross-role fixture cleanup passed: ${after}\n`);
  }
}
