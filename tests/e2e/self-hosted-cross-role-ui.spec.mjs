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
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('customer-home-portrait.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('customer-home-landscape.png'),
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'งานบริการของฉัน' }).click();
  await expect(
    page.getByRole('heading', { name: 'งานบริการของฉัน' }),
  ).toBeVisible();
  await expect(page.getByText(fixture.jobNumber)).toBeVisible();
  await page
    .getByRole('button', { name: 'กำลังดำเนินการ', exact: true })
    .click();
  await expect(
    page.getByText('ยังไม่มีงานที่กำลังดำเนินการ', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'ประวัติ', exact: true }).click();
  await expect(page.getByText(fixture.jobNumber)).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('customer-jobs-history.png'),
  });
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

test('customer searches catalog and interested technicians', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createMobilePage(
    browser,
    fixture.sessions.customer,
  );
  const assertConsoleHealthy = attachConsoleGuard(page);
  await page.goto(`${mobileUrl}/requests/catalog`);
  await expect(
    page.getByRole('heading', { name: 'เลือกรายการบริการ' }),
  ).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'ทั้งหมด', exact: true }).click();
  await page.getByLabel('ค้นหารายการบริการ').fill('ล้างแอร์');
  await expect(
    page.getByText('ล้างแอร์ติดผนัง', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('catalog-search.png') });
  await page.getByLabel('ค้นหารายการบริการ').fill('no-match-qa');
  await expect(page.getByText(/ไม่พบบริการที่ตรงกับการค้นหา/)).toBeVisible();
  await page.getByLabel('ค้นหารายการบริการ').fill('');
  await page
    .getByRole('button', { name: 'ประปาและสุขภัณฑ์', exact: true })
    .click();
  await expect(page.getByText('ล้างแอร์ติดผนัง', { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'ทั้งหมด', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'ล้างแอร์ติดผนัง' }).click();
  await expect(page).toHaveURL(/requests\/new/);
  await expect(
    page.getByRole('heading', { name: 'รายละเอียดคำขอรับบริการ' }),
  ).toBeVisible();
  await page.goto(
    `${mobileUrl}/requests/shortlist?requestId=${fixture.requestId}`,
  );
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByLabel('ค้นหาช่างในรายชื่อ')).toBeVisible();
  await page
    .getByRole('button', { name: 'มีราคาพร้อมเลือก', exact: true })
    .click();
  await expect(page.getByText('ช่างที่เลือก', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'ตรวจและยืนยันข้อตกลง', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('technician-shortlist.png'),
  });
  await page.getByLabel('ค้นหาช่างในรายชื่อ').fill('no-match-qa');
  await expect(page.getByText(/ไม่พบช่างที่ตรงกับตัวกรอง/)).toBeVisible();
  await page.getByLabel('ค้นหาช่างในรายชื่อ').fill('');
  await expect(page.getByText('ช่างที่เลือก', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^ดูข้อมูลช่าง / }).click();
  await expect(
    page.getByRole('heading', { name: 'ข้อมูลช่าง', exact: true }),
  ).toBeVisible();
  const profile = page.getByTestId('request-technician-profile');
  await expect(profile.getByText('฿800', { exact: true })).toBeVisible();
  await expect(
    profile.getByText('ล้างคอยล์และตรวจระบบระบายน้ำตามอาการที่แจ้ง', {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('technician-profile.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(profile.getByText('฿800', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'กลับรายชื่อช่าง', exact: true })
    .click();
  await expect(page.getByLabel('ค้นหาช่างในรายชื่อ')).toHaveValue('');
  await page.goto(
    `${mobileUrl}/requests/technician?requestId=${fixture.requestId}&technicianId=00000000-0000-0000-0000-000000000000`,
  );
  await expect(page.getByText(/ไม่พบช่างในรายชื่อของคำขอนี้/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'เลือกช่างคนนี้', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
  assertConsoleHealthy();
  await context.close();
});

test('customer completes the request wizard without losing entered details', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createMobilePage(
    browser,
    fixture.sessions.customer,
  );
  const assertConsoleHealthy = attachConsoleGuard(page);
  await page.goto(`${mobileUrl}/requests/catalog`);
  await page.getByRole('button').filter({ hasText: 'ล้างแอร์ติดผนัง' }).click();
  const form = page.getByTestId('request-form');
  await form.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(
    form.getByText('กรุณากรอกข้อมูลนี้', { exact: true }),
  ).toBeVisible();
  const description = 'แอร์มีกลิ่นอับ ต้องการล้างจำนวน 2 เครื่อง';
  await form
    .getByLabel('อาการหรือรายละเอียดที่ต้องการให้ช่างช่วย')
    .fill(description);
  await form.getByRole('button', { name: 'เพิ่มจำนวน', exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath('request-step-details.png'),
  });
  await form.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await form.getByRole('radio', { name: 'ภายใน 3 วัน', exact: true }).click();
  await form
    .getByRole('radio', { name: /^วันที่สะดวก / })
    .nth(1)
    .click();
  const date = await form.getByLabel('เลือกวันที่สะดวก').inputValue();
  await form
    .getByRole('radio', { name: 'ช่วงเวลา 09:00–12:00', exact: true })
    .click();
  await form.getByLabel('ช่วงเวลาที่สะดวก (ไม่บังคับ)').fill('10:00–13:00');
  await form.getByRole('button', { name: 'ย้อนกลับ', exact: true }).click();
  await expect(
    form.getByLabel('อาการหรือรายละเอียดที่ต้องการให้ช่างช่วย'),
  ).toHaveValue(description);
  await form.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(form.getByLabel('เลือกวันที่สะดวก')).toHaveValue(date);
  await expect(form.getByLabel('ช่วงเวลาที่สะดวก (ไม่บังคับ)')).toHaveValue(
    '10:00–13:00',
  );
  await page.screenshot({
    path: testInfo.outputPath('request-step-schedule.png'),
  });
  await form.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(
    form.getByText('จำนวน 2 · ภายใน 3 วัน', { exact: true }),
  ).toBeVisible();
  await form
    .getByTestId('safety-fireSmoke')
    .getByRole('radio', { name: 'มี', exact: true })
    .click();
  await expect(
    form.getByRole('button', { name: 'บันทึกแบบร่าง', exact: true }),
  ).toBeDisabled();
  await form
    .getByTestId('safety-fireSmoke')
    .getByRole('radio', { name: 'ไม่มี', exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath('request-step-review.png'),
  });
  await form
    .getByRole('button', { name: 'บันทึกแบบร่าง', exact: true })
    .click();
  await expect(page).toHaveURL(/requests\/saved\?requestId=/);
  const saved = page.getByTestId('request-saved');
  await expect(
    saved.getByRole('heading', { name: 'บันทึกแบบร่างแล้ว', exact: true }),
  ).toBeVisible();
  await expect(saved.getByText(description, { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('request-saved.png') });
  await page.reload();
  await expect(
    saved.getByRole('heading', { name: 'บันทึกแบบร่างแล้ว', exact: true }),
  ).toBeVisible();
  await saved
    .getByRole('button', { name: 'แก้ไขแบบร่าง', exact: true })
    .click();
  await expect(page).toHaveURL(/requests\/edit\?requestId=/);
  await expect(
    form.getByLabel('อาการหรือรายละเอียดที่ต้องการให้ช่างช่วย'),
  ).toHaveValue(description);
  await page.reload();
  await expect(
    form.getByLabel('อาการหรือรายละเอียดที่ต้องการให้ช่างช่วย'),
  ).toHaveValue(description);
  await form.getByRole('button', { name: 'ถัดไป', exact: true }).click();
  await expect(form.getByLabel('เลือกวันที่สะดวก')).toHaveValue(date);
  await expect(form.getByLabel('ช่วงเวลาที่สะดวก (ไม่บังคับ)')).toHaveValue(
    '10:00–13:00',
  );
  assertConsoleHealthy();
  await context.close();
});

test('customer confirms technician selection from the profile', async ({
  browser,
}, testInfo) => {
  const { context, page } = await createMobilePage(
    browser,
    fixture.sessions.customer,
  );
  const assertConsoleHealthy = attachConsoleGuard(page);
  await page.goto(
    `${mobileUrl}/requests/technician?requestId=${fixture.selectionRequestId}&technicianId=${fixture.userIds.technician}`,
  );
  const profile = page.getByTestId('request-technician-profile');
  await expect(profile.getByText('฿900', { exact: true })).toBeVisible();
  await profile
    .getByRole('button', { name: 'เลือกช่างคนนี้', exact: true })
    .click();
  await expect(
    profile.getByText('ยืนยันเลือกช่างคนนี้หรือไม่', { exact: true }),
  ).toBeVisible();
  await profile
    .getByRole('button', { name: 'เปรียบเทียบต่อ', exact: true })
    .click();
  await expect(
    profile.getByRole('button', { name: 'ยืนยันเลือกช่าง', exact: true }),
  ).toHaveCount(0);
  await profile
    .getByRole('button', { name: 'เลือกช่างคนนี้', exact: true })
    .click();
  await profile
    .getByRole('button', { name: 'ยืนยันเลือกช่าง', exact: true })
    .click();
  await expect(page).toHaveURL(/requests\/agreement/);
  await expect(
    page.getByRole('heading', { name: 'ยืนยันข้อตกลงงาน', exact: true }),
  ).toBeVisible();
  await page.goto(
    `${mobileUrl}/requests/technician?requestId=${fixture.selectionRequestId}&technicianId=${fixture.userIds.technician}`,
  );
  await expect(
    profile.getByRole('button', { name: 'ตรวจและยืนยันข้อตกลง', exact: true }),
  ).toBeVisible();
  await expect(
    profile.getByRole('button', { name: 'เลือกช่างคนนี้', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('technician-profile-selected.png'),
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
