# Phase 6C — Staging และ Pilot Readiness

สถานะ: Staging schema verified; ยังไม่พร้อมเปิด Pilot

## ผลที่ยืนยันแล้ว

| Gate | ผล | หลักฐาน |
|---|---|---|
| Phase 6B migrations | ผ่าน | Local และ remote migration history ตรงกัน; dry-run ไม่พบรายการค้าง |
| Operational defaults | ผ่าน | `matching=true`, `content=true`, `payment=false` |
| Database boundary | ผ่าน | RLS เปิด, anonymous access ถูกปิด, writer ตรวจ permission ภายใน |
| Rate limits | ผ่าน | service request และ chat indexes มีอยู่ครบ |
| Function hardening | ผ่าน | fixed empty `search_path`; trigger helpers ไม่เปิดให้ `public` execute |
| Security Advisor Phase 6B delta | ยอมรับแบบมีเหตุผล | 2 warnings เป็น RPC ที่ตั้งใจให้ authenticated เรียกและมี account/permission checks ภายใน |
| Temporary backup hygiene | ผ่าน | ตรวจ SHA256 แล้วลบ logical backup ชั่วคราวจากเครื่อง |

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
5. **Security Advisor baseline ยังไม่ได้ triage ครบ**
   - รอบหลัง migration มี warning ระดับ `WARN` รวม 90 รายการ
   - รอบนี้ตรวจเฉพาะ 2 รายการที่อ้างถึง Phase 6B RPC และยืนยันว่าเป็น intentional exception
   - รายการที่เหลือต้องแยกเป็น fix/accepted exception พร้อมเหตุผลก่อนเปิด Pilot

## ลำดับดำเนินการถัดไป

1. ระบุบัญชี Staging ที่จะเป็น Operations Admin โดยไม่บันทึกอีเมลหรือ PII ลง Git
2. กรอก owner และ alert channels ในระบบภายใน แล้วแทน `UNASSIGNED` ใน runbook
3. สร้างหรืออนุมัติ Supabase project สำหรับ restore drill; บันทึก source/destination refs ใน change record
4. ทำ isolated restore, ตรวจ schema/data fingerprint, pgTAP/RLS และ health smoke tests
5. triage Security Advisor baseline และบันทึก remediation/accepted exception
6. ทำ physical-device matrix ที่ค้าง แล้วทบทวน P0/P1 ก่อนตัดสินใจ Pilot

## ขอบเขตที่ยังห้ามเปิด

- `payment` ต้องคงปิดและเปิดผ่าน RPC ไม่ได้
- ห้ามเปิด public signup ก่อน CAPTCHA/OTP abuse gate พร้อม
- ห้ามเปิดพื้นที่ Pilot จนกว่า Operations Admin, incident ownership, alert channels และ restore drill ผ่าน
- ห้ามเก็บ backup ที่มีข้อมูล Staging บนเครื่องส่วนตัวเกินช่วงเวลาที่อนุมัติ
