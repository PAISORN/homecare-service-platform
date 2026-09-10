# Phase 4G — การตรวจรับงาน 48 ชั่วโมง

## ผลลัพธ์ของ Phase

เมื่องานผ่าน PIN จบงานและเข้าสู่ `awaiting_acceptance` ระบบจะเปิดหน้าต่าง
`การตรวจรับ` ที่บันทึกในฐานข้อมูลตามเวลาที่ตั้งค่าไว้ ค่าเริ่มต้นคือ 48 ชั่วโมง
ลูกค้าและช่างอ่านกำหนดเวลาและผลตรวจรับเดียวกันได้จากรายละเอียดงาน

ขั้นตอนนี้ใช้ `payment_mode = fake_sandbox` เท่านั้น ไม่มีการเก็บข้อมูลบัตร
ไม่มีการเรียกเก็บเงิน การคืนเงิน การปล่อยยอด หรือการโอนเงินจริง

## State transition

```text
in_progress
  -> awaiting_acceptance
       -> completed (customer_accepted)
       -> completed (automatic_accepted เมื่อครบกำหนด)
       -> awaiting_acceptance + help_requested (หยุดการตรวจรับอัตโนมัติ)
```

- ช่างเปิดหน้าต่างตรวจรับทางอ้อมเมื่อยืนยัน PIN จบงานสำเร็จ
- ลูกค้าเท่านั้นที่ยืนยันตรวจรับหรือแจ้งว่างานยังมีปัญหาได้
- การแจ้งปัญหาจะหยุดการตรวจรับอัตโนมัติ และยังไม่ใช่ `ข้อพิพาท`
- การยืนยันซ้ำและ worker ที่ทำงานซ้ำต้องไม่สร้าง status event ซ้ำ
- ทุกผลลัพธ์มี actor เวลา และ audit metadata โดยระบุ
  `real_money_moved = false`

## การทำงานเมื่อครบกำหนด

PostgreSQL Cron เรียก `process_due_service_job_acceptances(100)` ทุก 5 นาที
และข้ามรายการที่ลูกค้าขอความช่วยเหลือ การเปิดรายละเอียดงานจะตรวจรายการที่ครบ
กำหนดอีกครั้งด้วย จึงได้ผลลัพธ์แบบ idempotent แม้ worker หรือผู้ใช้เรียกพร้อมกัน

ระยะเวลาตรวจรับและ payment mode อยู่ใน
`private.service_job_acceptance_configuration` ไม่ฝังเป็น business rule ใน UI

## Security

- `service_job_acceptances` เปิด RLS และอ่านได้เฉพาะลูกค้ากับช่างของงาน
- client ไม่มีสิทธิ์ insert, update หรือ delete โดยตรง
- mutation ผ่าน Security Definer RPC ที่ตรวจ active account และ ownership
- batch processor ให้สิทธิ์เฉพาะ `service_role` และ PostgreSQL scheduler
- service-role key ไม่อยู่ใน mobile หรือ public environment variable

## สิ่งที่ยังไม่ทำใน Phase นี้

- payment provider จริง, capture, refund, payout และ financial ledger
- workflow `ข้อร้องเรียน` / `ข้อพิพาท` และหน้าผู้ดูแล
- การรับประกันหลังตรวจรับและรีวิวสองฝ่าย

รายการเหล่านี้เป็นขอบเขต Phase 5 และต้องผ่าน payment/legal gate ก่อนเชื่อมเงินจริง
