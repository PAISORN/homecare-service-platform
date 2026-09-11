# Phase 5A — การรับประกัน รีวิว ข้อร้องเรียน และข้อพิพาท

สถานะ: Implemented locally (2026-09-11)

## ขอบเขต

Phase 5A เพิ่มขั้นตอนดูแลคุณภาพหลังงานสำหรับงานที่อยู่ระหว่างตรวจรับหรือเสร็จสมบูรณ์ โดยยังไม่เชื่อมผู้ให้บริการชำระเงินจริง

- ลูกค้าเปิดคำขอรับประกันภายในระยะ `warranty_days` ของงานเดิม
- ลูกค้าเปิดข้อร้องเรียนและแนบหลักฐาน JPG/PNG ขนาดไม่เกิน 6 MB
- ลูกค้าและช่างส่งคำชี้แจงเพิ่มเติมในเคสได้
- ลูกค้าให้คะแนน 5 มิติและแก้ไขได้ภายใน 7 วัน หรือระหว่างมีเคสเปิด
- ช่างตอบรีวิวได้หนึ่งครั้ง
- ผู้ดูแลที่มีสิทธิ์ `case_management` ตรวจคิว ขอข้อมูลเพิ่ม ตัดสิน หรือยกระดับเป็นข้อพิพาท
- รีวิวถูกซ่อนขณะมีข้อพิพาท และกลับเข้าคิวตรวจข้อความหลังข้อพิพาทจบ

## ข้อจำกัดด้านการเงิน

ฟิลด์ `payment_hold_simulated`, `simulated_refund_amount` และ `payment_mode = fake_sandbox` เป็นข้อมูลจำลองเท่านั้น ทุกตารางเคสและข้อพิพาทบังคับ `real_money_moved = false` และ Audit Log ของการดำเนินการสำคัญบันทึกค่านี้ไว้ด้วย

Phase นี้ไม่มีการ charge, capture, refund, release หรือ payout และไม่มี Apple Developer/EAS production build เป็นเงื่อนไขในการใช้งานบนเว็บ/Expo local

## โครงสร้างข้อมูล

- `service_job_warranties` — ระยะรับประกัน snapshot เมื่อสถานะงานเป็น `completed`
- `service_quality_cases` — คำขอรับประกันและข้อร้องเรียน
- `service_quality_case_attachments` — metadata ของหลักฐานใน private bucket `service-quality-evidence`
- `service_quality_case_events` — ประวัติเหตุการณ์แบบ append-only
- `service_disputes` — ข้อพิพาทที่ยกระดับจากเคส
- `service_job_reviews` — คะแนน 5 มิติ ข้อความ สถานะ moderation และคำตอบช่าง

ตารางใน `public` เปิด RLS ทั้งหมด ผู้เข้าถึงได้มีเฉพาะลูกค้า/ช่างของงาน ผู้ดูแลที่มีสิทธิ์ หรือผู้ใช้ที่อ่านรีวิวซึ่งเผยแพร่แล้ว การเขียนข้อมูลต้องผ่าน RPC ที่ตรวจตัวตน สถานะงาน และสิทธิ์ทุกครั้ง

## หน้าจอ

- Mobile ลูกค้า: รายละเอียดงาน → `ดูแลคุณภาพหลังงาน`
- Mobile ช่าง: รายละเอียดงาน → `ดูแลคุณภาพหลังงาน`
- Admin: `/cases` และ `/cases/[caseId]`

## Migration

1. `20260911110000_add_service_quality_permission.sql`
2. `20260911110100_add_service_quality_cases.sql`
3. `20260911110200_sync_dispute_and_review_resolution.sql`

## การตรวจสอบ

```powershell
pnpm db:test
pnpm db:lint
pnpm db:test:storage
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

pgTAP ของ Phase 5A อยู่ที่ `supabase/tests/database/019_service_quality_cases.test.sql` และตรวจทั้ง RLS, warranty trigger, case/review RPC, simulated financial state, dispute lifecycle และ Audit Log

## งานที่เลื่อนไป Phase หลัง

- Payment provider และการเคลื่อนย้ายเงินจริงทุกชนิด
- Ledger/settlement/payout จริง
- production iOS build และ App Store distribution
- SLA automation และ notification เฉพาะเคสคุณภาพงาน
