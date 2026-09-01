import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { runSupabase, waitForLocalSupabase } from './lib/supabase-cli.mjs';

const status = await waitForLocalSupabase();
const apiUrl = new URL(status.API_URL);

assert.ok(
  apiUrl.hostname === '127.0.0.1' || apiUrl.hostname === 'localhost',
  `Storage integration tests refuse non-local API URL: ${apiUrl.origin}`,
);
assert.ok(status.ANON_KEY, 'Local anon key is unavailable.');
assert.ok(status.SERVICE_ROLE_KEY, 'Local service-role key is unavailable.');

const runId = randomUUID();
const technicianEmail = `storage-tech-${runId}@example.test`;
const administratorEmail = `storage-admin-${runId}@example.test`;
const catalogAdministratorEmail = `storage-catalog-admin-${runId}@example.test`;
const password = `HomeCare-${runId}!`;
const createdUserIds = [];
const uploadedPaths = [];

async function request(
  path,
  {
    token,
    apiKey = status.ANON_KEY,
    method = 'GET',
    body,
    headers = {},
    responseType = 'text',
  },
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
  if (responseType === 'bytes') {
    return { response, payload: new Uint8Array(await response.arrayBuffer()) };
  }

  const text = await response.text();
  let payload = text;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // Binary or plain-text responses are intentionally kept as text.
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

async function createUser(email, displayName) {
  const user = await expectSuccess(
    '/auth/v1/admin/users',
    {
      token: status.SERVICE_ROLE_KEY,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      }),
    },
    `create ${displayName}`,
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

function assertUuid(value) {
  assert.match(
    value,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'Auth Admin API returned an invalid user id.',
  );
  return value;
}

function runLocalFixtureSql(sql) {
  const result = runSupabase(['db', 'query', '--local', sql], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  assert.equal(
    result.status,
    0,
    `Local fixture SQL failed:\n${result.stderr}\n${result.stdout}`,
  );
}

async function postgrest(path, token, method, value) {
  return expectSuccess(
    `/rest/v1/${path}`,
    {
      token,
      method,
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: value === undefined ? undefined : JSON.stringify(value),
    },
    `${method} ${path}`,
  );
}

async function postgrestReturning(path, token, method, value) {
  return expectSuccess(
    `/rest/v1/${path}`,
    {
      token,
      method,
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: value === undefined ? undefined : JSON.stringify(value),
    },
    `${method} ${path}`,
  );
}

async function upload(path, token, content, method = 'POST') {
  uploadedPaths.push(path);
  return expectSuccess(
    `/storage/v1/object/technician-documents/${path}`,
    {
      token,
      method,
      headers: {
        'Content-Type': 'image/jpeg',
        'x-upsert': method === 'PUT' ? 'true' : 'false',
      },
      body: new TextEncoder().encode(content),
    },
    `upload ${path}`,
  );
}

async function createSignedUrl(path, token) {
  return request(
    `/storage/v1/object/sign/technician-documents/${encodeURIComponent(path).replaceAll('%2F', '/')}`,
    {
      token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 120 }),
    },
  );
}

async function assertUploadDenied(path, token, content, message) {
  const result = await request(
    `/storage/v1/object/technician-documents/${path}`,
    {
      token,
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'x-upsert': 'false',
      },
      body: new TextEncoder().encode(content),
    },
  );
  assert.ok(!result.response.ok, `${message}: upload unexpectedly succeeded`);
  await assertObjectMissing(path);
}

async function deleteObjects(paths, token) {
  return request('/storage/v1/object/technician-documents', {
    token,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  });
}

async function deleteObject(path, token) {
  return deleteObjects([path], token);
}

async function assertObjectContents(path, expectedContent) {
  const result = await request(
    `/storage/v1/object/authenticated/technician-documents/${path}`,
    {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
      responseType: 'bytes',
    },
  );
  assert.ok(
    result.response.ok,
    `${path} should be downloadable through trusted verification: HTTP ${result.response.status}`,
  );
  assert.deepEqual(
    result.payload,
    new TextEncoder().encode(expectedContent),
    `${path} content must be immutable`,
  );
}

async function assertObjectMissing(path) {
  const result = await request(
    `/storage/v1/object/authenticated/technician-documents/${path}`,
    {
      token: status.SERVICE_ROLE_KEY,
      apiKey: status.SERVICE_ROLE_KEY,
    },
  );
  assert.ok(
    result.response.status === 400 || result.response.status === 404,
    `${path} should be deleted`,
  );
  assert.match(
    JSON.stringify(result.payload),
    /not.?found/i,
    `${path} missing check must fail because the object does not exist`,
  );
}

async function assertFrozen(path, technicianToken, state, originalContent) {
  // Storage may acknowledge a batch delete with HTTP 200 even when RLS removes
  // zero rows. The trusted download below is the assertion that matters.
  const deletion = await deleteObject(path, technicianToken);
  assert.ok(
    deletion.response.ok,
    `${state} delete should be acknowledged by the batch API: HTTP ${deletion.response.status}`,
  );
  await assertObjectContents(path, originalContent);

  // Upsert responses have the same ambiguity, so verify the stored bytes rather
  // than treating the response status as proof of a rejected replacement.
  const replacement = await request(
    `/storage/v1/object/technician-documents/${path}`,
    {
      token: technicianToken,
      method: 'PUT',
      headers: {
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
      body: new TextEncoder().encode('replacement-must-not-be-written'),
    },
  );
  assert.ok(
    !replacement.response.ok,
    `${state} replacement should be rejected by Storage RLS`,
  );
  await assertObjectContents(path, originalContent);
}

try {
  const technicianId = await createUser(technicianEmail, 'Storage technician');
  const administratorId = await createUser(
    administratorEmail,
    'Storage administrator',
  );
  const catalogAdministratorId = await createUser(
    catalogAdministratorEmail,
    'Storage catalog administrator',
  );

  assertUuid(technicianId);
  assertUuid(administratorId);
  assertUuid(catalogAdministratorId);
  runLocalFixtureSql(`
    insert into public.account_roles (user_id, role)
    values
      ('${technicianId}', 'technician'),
      ('${administratorId}', 'administrator'),
      ('${catalogAdministratorId}', 'administrator')
  `);
  runLocalFixtureSql(`
    insert into public.admin_permissions (user_id, permission)
    select '${administratorId}', permission
    from unnest(enum_range(null::public.admin_permission)) as permission
  `);
  runLocalFixtureSql(`
    insert into public.admin_permissions (user_id, permission)
    values ('${catalogAdministratorId}', 'catalog_management')
  `);
  runLocalFixtureSql(`
    insert into public.technician_profiles (user_id)
    values ('${technicianId}')
  `);

  const technicianToken = await signIn(technicianEmail);
  const administratorToken = await signIn(administratorEmail);
  const catalogAdministratorToken = await signIn(catalogAdministratorEmail);
  const prefix = technicianId;

  await postgrest(
    'rpc/acknowledge_technician_kyc_notice',
    technicianToken,
    'POST',
    {},
  );

  const rejectedPdfPath = `${prefix}/rejected-mime-${runId}.pdf`;
  await postgrest('technician_documents', technicianToken, 'POST', {
    technician_id: technicianId,
    document_type: 'other',
    storage_path: rejectedPdfPath,
  });
  const rejectedPdf = await request(
    `/storage/v1/object/technician-documents/${rejectedPdfPath}`,
    {
      token: technicianToken,
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-upsert': 'false',
      },
      body: new TextEncoder().encode('%PDF-test'),
    },
  );
  assert.ok(!rejectedPdf.response.ok, 'Storage must reject PDF KYC uploads');
  await assertObjectMissing(rejectedPdfPath);
  await postgrest(
    `technician_documents?storage_path=eq.${encodeURIComponent(rejectedPdfPath)}`,
    technicianToken,
    'DELETE',
  );

  const rejectedLargePath = `${prefix}/rejected-size-${runId}.jpg`;
  await postgrest('technician_documents', technicianToken, 'POST', {
    technician_id: technicianId,
    document_type: 'other',
    storage_path: rejectedLargePath,
  });
  const rejectedLarge = await request(
    `/storage/v1/object/technician-documents/${rejectedLargePath}`,
    {
      token: technicianToken,
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg',
        'x-upsert': 'false',
      },
      body: new Uint8Array(6291457),
    },
  );
  assert.ok(
    !rejectedLarge.response.ok,
    'Storage must reject KYC uploads larger than six MiB',
  );
  await assertObjectMissing(rejectedLargePath);
  await postgrest(
    `technician_documents?storage_path=eq.${encodeURIComponent(rejectedLargePath)}`,
    technicianToken,
    'DELETE',
  );

  const draftPath = `${prefix}/draft-${runId}.jpg`;
  await assertUploadDenied(
    `${prefix}/orphan-${runId}.jpg`,
    technicianToken,
    'orphan-document',
    'upload without a registered draft document must be denied',
  );
  await postgrest('technician_documents', technicianToken, 'POST', {
    technician_id: technicianId,
    document_type: 'other',
    storage_path: draftPath,
  });
  await upload(draftPath, technicianToken, 'draft-document');

  const draftReviewerSignedUrl = await createSignedUrl(
    draftPath,
    administratorToken,
  );
  assert.ok(
    !draftReviewerSignedUrl.response.ok,
    'reviewer must not create a signed URL for a draft application',
  );

  const draftDeletion = await deleteObject(draftPath, technicianToken);
  assert.ok(
    draftDeletion.response.ok,
    `draft owner delete failed: HTTP ${draftDeletion.response.status} ${JSON.stringify(draftDeletion.payload)}`,
  );
  await assertObjectMissing(draftPath);

  const approvedPath = `${prefix}/national-id-${runId}.jpg`;
  const rejectedPath = `${prefix}/selfie-${runId}.jpg`;
  await postgrest('technician_documents', technicianToken, 'POST', [
    {
      technician_id: technicianId,
      document_type: 'national_id',
      storage_path: approvedPath,
    },
    {
      technician_id: technicianId,
      document_type: 'selfie',
      storage_path: rejectedPath,
    },
  ]);
  await upload(approvedPath, technicianToken, 'original-national-id');
  await upload(rejectedPath, technicianToken, 'original-selfie');

  // Submission and owner deletion serialize on the technician profile row.
  // The only valid outcomes are a submitted profile with the file retained,
  // or a draft profile with deletion completed and submission rejected.
  const [raceDeletion, raceSubmission] = await Promise.all([
    deleteObject(approvedPath, technicianToken),
    request('/rest/v1/rpc/submit_technician_profile', {
      token: technicianToken,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
  ]);
  assert.ok(
    raceDeletion.response.ok,
    `concurrent delete was not acknowledged: HTTP ${raceDeletion.response.status}`,
  );

  const profileRows = await expectSuccess(
    `/rest/v1/technician_profiles?user_id=eq.${technicianId}&select=verification_status`,
    { token: technicianToken },
    'read profile after submit/delete race',
  );
  const raceStatus = profileRows[0]?.verification_status;
  if (raceStatus === 'pending_review') {
    assert.ok(
      raceSubmission.response.ok,
      'a committed submission must return success',
    );
    await assertObjectContents(approvedPath, 'original-national-id');
  } else {
    assert.equal(raceStatus, 'draft', 'race must leave a valid workflow state');
    assert.ok(
      !raceSubmission.response.ok,
      'submission must fail when concurrent deletion wins',
    );
    await assertObjectMissing(approvedPath);
    await upload(approvedPath, technicianToken, 'original-national-id');
    await postgrest(
      'rpc/submit_technician_profile',
      technicianToken,
      'POST',
      {},
    );
  }

  await assertUploadDenied(
    `${prefix}/late-${runId}.jpg`,
    technicianToken,
    'late-document',
    'upload after submission must be denied',
  );

  await assertFrozen(
    approvedPath,
    technicianToken,
    'submitted',
    'original-national-id',
  );
  await assertFrozen(
    rejectedPath,
    technicianToken,
    'submitted',
    'original-selfie',
  );

  const reviewerSignedUrl = await createSignedUrl(
    approvedPath,
    administratorToken,
  );
  assert.ok(
    reviewerSignedUrl.response.ok,
    `reviewer signed URL failed: HTTP ${reviewerSignedUrl.response.status} ${JSON.stringify(reviewerSignedUrl.payload)}`,
  );
  assert.match(
    reviewerSignedUrl.payload.signedURL,
    /^\/object\/sign\/technician-documents\//,
    'reviewer receives a short-lived private Storage signed URL',
  );
  const signedDownload = await fetch(
    `${apiUrl.origin}/storage/v1${reviewerSignedUrl.payload.signedURL}`,
  );
  assert.ok(
    signedDownload.ok,
    `reviewer signed URL download failed: HTTP ${signedDownload.status}`,
  );
  assert.deepEqual(
    new Uint8Array(await signedDownload.arrayBuffer()),
    new TextEncoder().encode('original-national-id'),
    'the authenticated reviewer signed URL resolves to the private KYC object',
  );

  const unprivilegedSignedUrl = await createSignedUrl(
    approvedPath,
    catalogAdministratorToken,
  );
  assert.ok(
    !unprivilegedSignedUrl.response.ok,
    'administrator without technician_review must not create a KYC signed URL',
  );

  const approvedDocument = await expectSuccess(
    `/rest/v1/technician_documents?storage_path=eq.${encodeURIComponent(approvedPath)}&select=id`,
    { token: administratorToken },
    'read approved document id',
  );
  const approvedRows = await postgrestReturning(
    'rpc/review_technician_document',
    administratorToken,
    'POST',
    {
      p_document_id: approvedDocument[0].id,
      p_decision: 'approved',
      p_reason: null,
    },
  );
  assert.equal(approvedRows.review_status, 'approved');
  assert.equal(approvedRows.reviewed_by, administratorId);

  const rejectedDocument = await expectSuccess(
    `/rest/v1/technician_documents?storage_path=eq.${encodeURIComponent(rejectedPath)}&select=id`,
    { token: administratorToken },
    'read rejected document id',
  );
  const rejectedRows = await postgrestReturning(
    'rpc/review_technician_document',
    administratorToken,
    'POST',
    {
      p_document_id: rejectedDocument[0].id,
      p_decision: 'rejected',
      p_reason: 'integration test rejection',
    },
  );
  assert.equal(rejectedRows.review_status, 'rejected');
  assert.equal(rejectedRows.reviewed_by, administratorId);

  const rejectedProfile = await postgrestReturning(
    'rpc/decide_technician_profile',
    administratorToken,
    'POST',
    {
      p_technician_id: technicianId,
      p_decision: 'rejected',
      p_reason: 'integration test profile rejection',
    },
  );
  assert.equal(rejectedProfile.verification_status, 'rejected');

  const completedReviewSignedUrl = await createSignedUrl(
    approvedPath,
    administratorToken,
  );
  assert.ok(
    !completedReviewSignedUrl.response.ok,
    'reviewer must not create new KYC signed URLs after the profile decision',
  );

  await assertFrozen(
    approvedPath,
    technicianToken,
    'approved',
    'original-national-id',
  );
  await assertFrozen(
    rejectedPath,
    technicianToken,
    'rejected',
    'original-selfie',
  );

  process.stdout.write(
    'Storage API integration passed: reviewer signed URLs are pending-only; draft delete allowed; submitted, approved, and rejected delete/replace denied.\n',
  );
} finally {
  const cleanupErrors = [];

  if (uploadedPaths.length > 0) {
    try {
      const cleanup = await deleteObjects(
        uploadedPaths,
        status.SERVICE_ROLE_KEY,
      );
      if (!cleanup.response.ok) {
        cleanupErrors.push(
          `storage cleanup returned HTTP ${cleanup.response.status}`,
        );
      } else {
        for (const path of uploadedPaths) {
          await assertObjectMissing(path);
        }
      }
    } catch (error) {
      cleanupErrors.push(`storage cleanup failed: ${error.message}`);
    }
  }

  if (createdUserIds.length > 0) {
    try {
      // The production immutability trigger intentionally blocks the cascaded
      // KYC-row deletion performed by Auth Admin delete. This local-only test
      // teardown disables that one trigger inside a transaction, while keeping
      // FK cascade triggers active so no fixture rows are orphaned.
      // Delete fixture users in creation order. The technician is created
      // before the reviewer, so its reviewed KYC rows are cascaded away before
      // deleting the reviewer can apply ON DELETE SET NULL to reviewed_by.
      // A single `where id in (...)` has no ordering guarantee and can violate
      // technician_document_review_metadata during teardown.
      const deleteUserStatements = createdUserIds
        .map((id) => `delete from auth.users where id = '${id}';`)
        .join('\n');
      runLocalFixtureSql(`
        do $cleanup$
        begin
          execute 'alter table public.technician_documents disable trigger technician_documents_protect_identity';
          execute 'alter table public.profiles disable trigger profiles_block_hard_delete_with_kyc';
          begin
            delete from public.admin_permissions
            where user_id = any(array[${createdUserIds
              .map((id) => `'${id}'::uuid`)
              .join(', ')}])
               or assigned_by = any(array[${createdUserIds
                 .map((id) => `'${id}'::uuid`)
                 .join(', ')}]);
            ${deleteUserStatements}
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
    } catch (error) {
      cleanupErrors.push(`local fixture cleanup failed: ${error.message}`);
    }
  }

  if (cleanupErrors.length > 0) {
    process.exitCode = 1;
    process.stderr.write(
      `Integration cleanup errors:\n${cleanupErrors.join('\n')}\n`,
    );
  }
}
