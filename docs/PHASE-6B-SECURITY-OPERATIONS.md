# Phase 6B — Security และ Operational Readiness

สถานะ: implemented และ apply บน HomeCare Staging แล้วเมื่อ 2026-10-10;
isolated staging restore drill, incident ownership และ production vendor configuration ยังเป็น release gate

## เป้าหมาย

ลดความเสี่ยงก่อนเปิดเขตบริการนำร่องโดยให้ทีม HomeCare หยุดการทำงานที่เสี่ยงได้ทันที,
ตรวจ secret และ security invariant ใน CI, จำกัด abuse ของ mutation สำคัญ และพิสูจน์ว่า
backup ของฐานข้อมูลกู้กลับไปยังฐานแยกได้โดยไม่แตะฐานต้นทาง

Phase นี้ยังไม่เชื่อม payment provider และไม่มีการเคลื่อนย้ายเงินจริง

## สิ่งที่ส่งมอบ

### 1. Operational controls

ตาราง `public.operational_controls` มี kill switch สามตัว:

| Control | ค่าเริ่มต้น | ผลเมื่อปิด |
|---|---:|---|
| `matching` | เปิด | ปฏิเสธการส่งคำขอใหม่และการเปิดความสนใจรับงานใหม่ แต่ยังยกเลิก/ถอนได้ |
| `content` | เปิด | ปฏิเสธข้อความใหม่ แต่ประวัติห้องสนทนายังอ่านได้ |
| `payment` | ปิด | ไม่มี payment จริง; RPC ป้องกันการเปิดจนกว่าจะมี provider และตรวจ webhook แล้ว |

- เฉพาะผู้ดูแลที่มี `operations_management` เปลี่ยนสถานะได้
- ทุกการเปลี่ยนใช้ `set_operational_control(...)`, เพิ่ม `revision` และบันทึก Audit Log
- เหตุผลฉบับเต็มเก็บใน control record แต่ไม่คัดลอกลง Audit Log เพื่อลดข้อมูลอิสระซ้ำ
- ลูกค้าและช่างอ่านเฉพาะ key, สถานะ และเวลาอัปเดตผ่าน `get_operational_controls()`;
  เหตุผลและ revision จำกัดไว้สำหรับ Operations Admin ผ่าน RLS
- หน้า `/operations` ของ Admin ใช้ Server Action ที่ตรวจสิทธิ์ซ้ำและจบด้วย redirect

### 2. Abuse controls

- SMS OTP เว้นอย่างน้อย 1 นาทีตาม `supabase/config.toml`
- ลูกค้าส่งคำขอเข้าสู่ matching ได้สูงสุด 5 รายการต่อ 10 นาที
- ผู้ส่งหนึ่งคนส่ง chat ได้สูงสุด 20 ข้อความต่อนาที
- state transition, RLS และ idempotency เดิมยังเป็นชั้นป้องกันเพิ่มเติม
- Pilot ใช้ผู้เข้าร่วมแบบเชิญและ manual support; CAPTCHA เป็น gate ก่อนเปิดสมัครสาธารณะ

### 3. Secret and CI preflight

`pnpm security:check` ตรวจไฟล์ที่ Git track และไฟล์ใหม่ที่ยังไม่ถูก ignore แล้วหยุด CI เมื่อพบ:

- `.env` จริงถูก commit
- Supabase secret key หรือ private key material
- secret/service-role ถูกกำหนดใน `EXPO_PUBLIC_*` หรือ `NEXT_PUBLIC_*`
- service-role reference ใน Mobile หรือ Client Component
- Edge Function ส่ง notification ปิด JWT verification

### 4. Backup/restore drill

`pnpm db:drill:restore` ทำงานกับ Supabase local เท่านั้น:

1. dump ฐาน `postgres` ภายใน container โดยไม่รวม managed `pg_cron`, Realtime และ
   Vault ซึ่งผูกกับ configuration/secret store ของ Supabase runtime
2. ตรวจว่าไม่มีฐาน `homecare_restore_drill` อยู่ก่อน และจะไม่เขียนทับถ้ามี
3. restore ไปยังฐานชั่วคราวที่สร้างจาก `template0`
4. เปรียบเทียบ fingerprint ของตารางและข้อมูลอ้างอิงสำคัญ
5. ลบเฉพาะฐานชั่วคราวและไฟล์ `/tmp/homecare-restore-drill.dump`

การซ้อม staging ต้อง restore ไป **Supabase project แยก** เท่านั้น ห้าม restore ทับ staging
เดิม ขั้นตอนและหลักฐานที่ต้องเก็บอยู่ใน
[`runbooks/PILOT-INCIDENT-AND-RESTORE.md`](runbooks/PILOT-INCIDENT-AND-RESTORE.md)

## Security review

| Area | หลักฐาน/สถานะ |
|---|---|
| Secret separation | CI preflight + config resolver ปฏิเสธ secret key |
| Database/RLS | pgTAP ทุกไฟล์ รวม operational controls |
| Storage | Storage API integration suites เดิมทั้งหมด |
| Audit access | `audit_view` และ permission-specific reads |
| OTP abuse | SMS cooldown 1 นาที; CAPTCHA ก่อน public launch |
| Mutation abuse | matching/chat database rate limits |
| Webhook signatures | payment ปิดและเปิดไม่ได้จนกว่าจะ implement provider |
| Monitoring | GitHub Actions, Supabase logs/metrics และ notification queue ตาม runbook |
| Restore | local isolated drill ใน CI; staging isolated-project drill เป็น release gate |

## Verification

```powershell
pnpm security:check
pnpm db:reset
pnpm db:test
pnpm db:test:storage
pnpm db:lint
pnpm db:types
pnpm db:drill:restore
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Exit criteria

- unauthorized caller เปลี่ยน control ไม่ได้และ direct table mutation ไม่มี grant
- matching/content kill switch บล็อกที่ database boundary และ recovery paths ยังทำงาน
- payment จริงยังปิดและไม่สามารถเปิดจากหน้า Admin หรือ RPC
- security preflight, pgTAP, Storage, lint, types, tests และ build ผ่าน
- local backup กู้กลับฐานแยกและ fingerprint ตรงกัน
- ก่อน pilot จริง ต้องซ้อม staging restore ไป project แยก, ระบุ incident owner และตั้ง alert channel

## Staging verification — 2026-10-10

- Linked project: `HomeCare Staging` (`opdtzlptueglotqntzzu`)
- Applied migrations: `20261010090000` และ `20261010090100`
- migration history ตรงกันและ `db push --dry-run` ไม่พบ migration ค้าง
- control defaults: `matching=true`, `content=true`, `payment=false`
- RLS เปิดอยู่, `anon` อ่านตารางไม่ได้ และไม่มี role สาธารณะเปลี่ยน control ได้
- `authenticated` เรียก writer ได้เฉพาะผ่าน permission check ภายใน
- apply `20261010090300_add_initial_operations_admin_bootstrap.sql` แล้ว และใช้ one-time bootstrap
  มอบ `administrator` + `operations_management` ให้บัญชี email/password แบบ dedicated โดยไม่บันทึก PII ลง Git
- ล็อกอินหน้า `/operations` สำเร็จ และทดสอบปิด/เปิด `matching` กับ `content` ผ่าน UI แล้ว;
  ค่าปลายทางเป็น `matching=true` revision 5, `content=true` revision 5 และ `payment=false` revision 1
- การเปลี่ยนสถานะจาก UI ทั้งสี่ครั้งมีเหตุผลและ Audit Log; `payment` ยังไม่มีปุ่มเปิด
- rate-limit indexes ของ service request และ chat มีอยู่ครบ
- ฟังก์ชัน Phase 6B ใช้ fixed empty `search_path`; trigger helpers ไม่เปิด `EXECUTE` แก่ `public`
- Security Advisor รายงานคำเตือนที่เกี่ยวข้อง 2 รายการสำหรับ authenticated-callable
  `SECURITY DEFINER` RPC ซึ่งเป็นข้อยกเว้นโดยตั้งใจ:
  - `get_operational_controls()` ตรวจ active account และคืนเฉพาะ safe control contract
  - `set_operational_control(...)` ตรวจ `operations_management` ก่อน mutation ทุกครั้ง
- logical backup ชั่วคราวถูกตรวจ SHA256 แล้วลบออกจากเครื่องหลัง verification;
  ยังไม่ใช้เป็นหลักฐาน restore เพราะไม่มี Supabase project ปลายทางที่แยกสำหรับ drill

รายละเอียด release gates และหลักฐานที่ยังต้องเก็บอยู่ใน
[`PHASE-6C-STAGING-PILOT-READINESS.md`](PHASE-6C-STAGING-PILOT-READINESS.md)
