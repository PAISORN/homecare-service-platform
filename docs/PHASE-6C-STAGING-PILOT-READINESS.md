# Phase 6C — Staging และ Pilot Readiness

สถานะ: Staging schema verified; ยังไม่พร้อมเปิด Pilot

## ผลที่ยืนยันแล้ว

| Gate | ผล | หลักฐาน |
|---|---|---|
| Phase 6B migrations | ผ่าน | Local และ remote migration history ตรงกัน; dry-run ไม่พบรายการค้าง |
| Operational defaults | ผ่าน | `matching=true`, `content=true`, `payment=false` |
| Database boundary | ผ่าน | RLS เปิด, anonymous access ถูกปิด, writer ตรวจ permission ภายใน |
| Rate limits | ผ่าน | service request และ chat indexes มีอยู่ครบ |
| Function hardening | ผ่าน | fixed `search_path`; trigger/event-trigger helpers ไม่เปิดให้ `public`, `anon`, `authenticated` หรือ `service_role` เรียกโดยตรง |
| Security Advisor baseline | triage ครบ | ลดจาก 90 เหลือ 69 warnings: 67 authenticated RPCs ที่ตั้งใจเปิด, 1 public projection ที่ตั้งใจเปิด และ 1 Auth setting ที่ต้องใช้แผน Pro |
| Temporary backup hygiene | ผ่าน | ตรวจ SHA256 แล้วลบ logical backup ชั่วคราวจากเครื่อง |

## Security Advisor baseline หลัง privilege hardening

ตรวจบน Staging หลัง apply migration `20261010090200_harden_security_definer_execute_privileges.sql`:

| Advisor | จำนวน | ข้อสรุป |
|---|---:|---|
| `authenticated_security_definer_function_executable` | 67 | Accepted exceptions: เป็น RPC contract สำหรับผู้ล็อกอิน โดยตรวจ actor/account/permission ภายในและมี database workflow tests |
| `anon_security_definer_function_executable` | 1 | Accepted exception: `list_public_technicians()` เป็น public projection ที่ตั้งใจเปิดและไม่คืนข้อมูล KYC/PII |
| `auth_leaked_password_protection` | 1 | Open release gate: admin ใช้ email/password แต่ฟีเจอร์ leaked-password protection ต้องใช้ Supabase Pro |

ผลรวมลดลง 21 warnings โดยตัด anonymous access ที่ไม่ได้ตั้งใจ และปิด direct execute ของ trigger/event-trigger/internal helper ทุก API role แล้ว การเหลือ warning ไม่ได้แปลว่าปลอดภัยโดยอัตโนมัติ จึงต้องคง regression tests และทบทวนใหม่ทุกครั้งที่เพิ่ม RPC

## Release blockers

1. **ไม่มี Operations Admin บน Staging**
   - `administrator` role count = 0
   - `operations_management` grant count = 0
   - ต้องเลือกบัญชีทดสอบที่เชื่อถือได้ แล้วมอบ role/permission ผ่าน workflow ที่ audit ได้
2. **Incident ownership ยังเป็น `UNASSIGNED`**
   - Incident commander
   - Operations/support
   - Database owner
   - ช่องทางแจ้งเตือนหลักและสำรอง
3. **ยังไม่มี Supabase project สำหรับ isolated restore drill**
   - ห้าม restore ทับ Staging หรือ Production
   - ต้องใช้ project ปลายทางที่ไม่มีข้อมูลสำคัญและได้รับอนุญาตก่อน
4. **Physical-device coverage ยังไม่ครบ**
   - iPhone text scaling, landscape และ native push ต้องมีหลักฐานจากอุปกรณ์จริง
5. **Leaked-password protection ยังเปิดไม่ได้ในแผนปัจจุบัน**
   - Staging ยังมี `auth_leaked_password_protection` 1 warning
   - ระหว่างยังไม่อัปเกรด ให้จำกัดจำนวน admin, ใช้รหัสผ่านเฉพาะที่แข็งแรง, เปิด MFA เมื่อพร้อม และไม่เปิด public email/password signup
   - ก่อน Production ต้องตัดสินใจอัปเกรดเพื่อเปิด leaked-password protection หรือบันทึก risk acceptance อย่างเป็นทางการ

## ลำดับดำเนินการถัดไป

1. ระบุบัญชี Staging ที่จะเป็น Operations Admin โดยไม่บันทึกอีเมลหรือ PII ลง Git
2. กรอก owner และ alert channels ในระบบภายใน แล้วแทน `UNASSIGNED` ใน runbook
3. สร้างหรืออนุมัติ Supabase project สำหรับ restore drill; บันทึก source/destination refs ใน change record
4. ทำ isolated restore, ตรวจ schema/data fingerprint, pgTAP/RLS และ health smoke tests
5. ตัดสินใจเรื่อง Supabase Pro/leaked-password protection ก่อน Production และบันทึก risk acceptance หากยังไม่เปิด
6. ทำ physical-device matrix ที่ค้าง แล้วทบทวน P0/P1 ก่อนตัดสินใจ Pilot

## ขอบเขตที่ยังห้ามเปิด

- `payment` ต้องคงปิดและเปิดผ่าน RPC ไม่ได้
- ห้ามเปิด public signup ก่อน CAPTCHA/OTP abuse gate พร้อม
- ห้ามเปิดพื้นที่ Pilot จนกว่า Operations Admin, incident ownership, alert channels และ restore drill ผ่าน
- ห้ามเก็บ backup ที่มีข้อมูล Staging บนเครื่องส่วนตัวเกินช่วงเวลาที่อนุมัติ
