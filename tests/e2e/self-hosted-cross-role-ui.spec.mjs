import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const adminUrl = process.env.SELFHOST_UI_ADMIN_URL;
const mobileUrl = process.env.SELFHOST_UI_MOBILE_URL;
const authStorageKey = 'sb-127-auth-token';

let fixtureDirectory;
let fixturePath;
let fixture;

function runFixture(environment) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'scripts/test-self-hosted-cross-role-lifecycle.mjs')],
    {
      cwd: root,
      env: { ...process.env, ...environment },
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Cross-role fixture command failed.\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function attachConsoleGuard(page) {
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return () => expect(errors, errors.join('\n')).toEqual([]);
}

async function createMobilePage(browser, session) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: authStorageKey, value: session },
  );
  return { context, page: await context.newPage() };
}

test.beforeAll(() => {
  expect(adminUrl).toBeTruthy();
  expect(mobileUrl).toBeTruthy();
  fixtureDirectory = mkdtempSync(join(tmpdir(), 'homecare-ui-e2e-'));
  fixturePath = join(fixtureDirectory, 'fixture.json');
  runFixture({ SELFHOST_CROSS_ROLE_FIXTURE_OUTPUT: fixturePath });
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
});

test.afterAll(() => {
  if (fixture?.userIds) {
    runFixture({
      SELFHOST_CROSS_ROLE_CLEANUP_IDS: Object.values(fixture.userIds).join(','),
    });
  }
  if (
    fixtureDirectory?.startsWith(tmpdir()) &&
    fixtureDirectory.includes('homecare-ui-e2e-')
  ) {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test('customer sees the completed job and resolved quality case on Mobile Web', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createMobilePage(
    browser,
    fixture.sessions.customer,
  );
  const assertConsoleHealthy = attachConsoleGuard(page);

  await page.goto(`${mobileUrl}/`);
  await expect(page).toHaveURL(`${mobileUrl}/`);
  await expect(page).toHaveTitle(/HomeCare/i);
  await expect(
    page.getByText('ดูแลบ้านได้อย่างมั่นใจ', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'งานบริการของฉัน' }).click();
  await expect(
    page.getByRole('heading', { name: 'งานบริการของฉัน' }),
  ).toBeVisible();
  await expect(page.getByText(fixture.jobNumber)).toBeVisible();
  await page.getByRole('button', { name: 'ดูรายละเอียดงาน' }).click();
  await expect(page.getByText(fixture.jobNumber).last()).toBeVisible();
  await page.getByRole('button', { name: 'เปิดศูนย์ดูแลคุณภาพงาน' }).click();
  await expect(
    page.getByRole('heading', { name: 'ดูแลคุณภาพหลังงาน' }),
  ).toBeVisible();
  await expect(page.getByText(/ข้อร้องเรียน · แก้ไขแล้ว/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('customer-quality-mobile.png'),
    fullPage: true,
  });
  assertConsoleHealthy();
  await context.close();
});

test('technician sees the same job and resolved case on Mobile Web', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createMobilePage(
    browser,
    fixture.sessions.technician,
  );
  const assertConsoleHealthy = attachConsoleGuard(page);

  await page.goto(`${mobileUrl}/technician/jobs`);
  await expect(page).toHaveURL(`${mobileUrl}/technician/jobs`);
  await expect(page).toHaveTitle(/HomeCare/i);
  await expect(
    page.getByRole('heading', { name: 'งานบริการที่ได้รับ' }),
  ).toBeVisible();
  await expect(page.getByText(fixture.jobNumber)).toBeVisible();
  await page.getByRole('button', { name: 'ดูรายละเอียดงาน' }).click();
  await page.getByRole('button', { name: 'เปิดศูนย์ดูแลคุณภาพงาน' }).click();
  await expect(
    page.getByRole('heading', { name: 'ดูแลคุณภาพหลังงาน' }),
  ).toBeVisible();
  await expect(page.getByText(/ข้อร้องเรียน · แก้ไขแล้ว/)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('technician-quality-mobile.png'),
    fullPage: true,
  });
  assertConsoleHealthy();
  await context.close();
});

test('case manager signs in and opens the resolved case in Admin', async ({
  page,
}, testInfo) => {
  const assertConsoleHealthy = attachConsoleGuard(page);

  await page.goto(`${adminUrl}/login`);
  await expect(page).toHaveTitle(/HomeCare/i);
  await expect(
    page.getByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' }),
  ).toBeVisible();
  await page.getByLabel('อีเมล').fill(fixture.identities.administrator);
  await page.getByLabel('รหัสผ่าน').fill(fixture.password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page).toHaveURL(`${adminUrl}/cases`);
  await expect(
    page.getByRole('heading', { name: 'เคสคุณภาพงาน' }),
  ).toBeVisible();
  await expect(page.getByText('หลังงานยังมีกลิ่นอับเล็กน้อย')).toBeVisible();
  await page.getByRole('link', { name: 'เปิดเคส' }).click();
  await expect(page).toHaveURL(`${adminUrl}/cases/${fixture.qualityCaseId}`);
  await expect(
    page.getByRole('heading', { name: 'รายละเอียดเคส' }),
  ).toBeVisible();
  await expect(page.getByText('แก้ไขแล้ว', { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'รายละเอียดเคส' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('admin-resolved-case.png'),
    fullPage: true,
  });
  assertConsoleHealthy();
});
