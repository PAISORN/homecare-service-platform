# Phase 5B — SLA และการแจ้งเตือนเคสคุณภาพงาน

สถานะ: Implemented locally (2026-09-11)

## ขอบเขต

Phase 5B ต่อจากการรับประกัน รีวิว ข้อร้องเรียน และข้อพิพาทใน Phase 5A โดยเพิ่มกรอบเวลาดำเนินการและช่องทางติดตามที่ตรวจสอบย้อนหลังได้

- กำหนด SLA แยกตามสถานะของเคสผ่านข้อมูลในฐานข้อมูล
- แสดงผู้ดำเนินการถัดไป กำหนดเวลา และสถานะ `อยู่ในเวลา`, `ใกล้ครบกำหนด`, `เกินกำหนด` หรือ `หยุดจับเวลาแล้ว`
- ใช้ PostgreSQL Cron ประมวลผล SLA ทุก 5 นาที แม้ไม่มีโทรศัพท์เปิดอยู่
- บันทึก `sla_due_soon` และ `sla_overdue` ในประวัติเคสแบบ append-only
- สร้างการแจ้งเตือนเมื่อเปิดเคส เพิ่มคำชี้แจง ขอข้อมูล ตัดสิน ยกระดับข้อพิพาท ใกล้ครบกำหนด หรือเกินกำหนด
- เพิ่ม Notification Center สำหรับลูกค้าและช่าง พร้อมจำนวนที่ยังไม่ได้อ่านและคำสั่งอ่านทั้งหมด
- รองรับ Deep Link ไปยังหน้า `ดูแลคุณภาพหลังงาน` ของบทบาทผู้รับ
- เพิ่ม SLA summary และลำดับคิวตามกำหนดบน Dashboard ผู้ดูแล

## กติกา SLA เริ่มต้น

กติกาอยู่ใน `private.service_quality_sla_policies` และแก้ได้ด้วย migration ในอนาคตโดยไม่ต้องเปลี่ยน Mobile หรือ Admin UI

| สถานะเคส | ผู้ดำเนินการถัดไป | เวลาทั้งหมด | แจ้งเตือนก่อนครบกำหนด |
|---|---|---:|---:|
| ส่งเรื่องแล้ว | HomeCare | 4 ชั่วโมง | 1 ชั่วโมง |
| กำลังตรวจสอบ | HomeCare | 24 ชั่วโมง | 4 ชั่วโมง |
| รอข้อมูลลูกค้า | ลูกค้า | 24 ชั่วโมง | 4 ชั่วโมง |
| รอข้อมูลช่าง | ช่าง | 24 ชั่วโมง | 4 ชั่วโมง |
| ข้อพิพาท | HomeCare | 48 ชั่วโมง | 8 ชั่วโมง |

เมื่อเปลี่ยนสถานะ ระบบเริ่ม SLA รอบใหม่ตาม policy ของสถานะนั้น การอัปเดตข้อมูลโดยไม่เปลี่ยนสถานะไม่ยืดกำหนดเวลา และเมื่อแก้ไขหรือยุติเคส ระบบหยุดจับเวลา

## ความปลอดภัย

- `private.service_quality_sla_policies` ไม่เปิดให้ Mobile หรือ authenticated client อ่านหรือเขียนโดยตรง
- `process_service_quality_sla` และ `claim_pending_notifications` ให้เรียกได้เฉพาะ `service_role`
- Mobile อ่านได้เฉพาะ notification ที่ `recipient_user_id` ตรงกับบัญชีของตนตาม RLS เดิม
- Push Token ยังเป็นข้อมูล private และไม่ถูกส่งกลับไปยัง Mobile
- เนื้อหา Push ไม่ใส่รายละเอียดข้อร้องเรียน ที่อยู่ ข้อความคำชี้แจง หรือข้อมูลหลักฐานบน Lock Screen
- Phase นี้ยังคง `payment_mode = fake_sandbox` และไม่มีการเคลื่อนย้ายเงินจริง

## Push และการทำงานแบบไม่เสียค่าใช้จ่าย

การเปลี่ยนสถานะที่เกิดจาก Mobile หรือ Dashboard จะเรียก Edge Function `dispatch-job-notifications` เดิมทันที ส่วน PostgreSQL Cron สร้าง SLA event และ notification ลง durable outbox ทุก 5 นาที

การส่ง Push ของ SLA แบบไม่มีผู้ใช้เปิดแอปต้องตั้ง Cron เรียก Edge Function โดยเก็บ Project URL และ service-role key ใน Supabase Vault เท่านั้น ห้ามใส่คีย์ลง migration, Mobile, `EXPO_PUBLIC_*` หรือ `NEXT_PUBLIC_*` การตั้งค่านี้ไม่จำเป็นต่อ Notification Center และการทดสอบ local

## Migration

`20260911144745_add_service_quality_sla_notifications.sql`

## การตรวจสอบ

```powershell
pnpm db:reset
pnpm db:test
pnpm db:test:storage
pnpm db:lint
pnpm db:types
pnpm test
pnpm typecheck
pnpm lint
pnpm validate:mobile:native
pnpm build
```

pgTAP ของ Phase 5B อยู่ที่ `supabase/tests/database/020_service_quality_sla_notifications.test.sql` และตรวจ policy, cron, function privilege, RLS, deep link, notification lifecycle, SLA transition และการหยุดเวลาเมื่อปิดเคส

## งานที่ยังไม่รวม

- Payment provider, ledger, refund, settlement และ payout จริง
- การเพิ่มหรือแก้ SLA ผ่านหน้า Dashboard; ระยะนี้แก้ผ่าน migration ที่ตรวจสอบได้
- การตั้ง Supabase Vault และ Cron สำหรับเรียก Edge Function ส่ง Push แบบ unattended
- Production iOS build และ App Store distribution
