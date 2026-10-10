# HomeCare Pilot Incident and Restore Runbook

## ผู้รับผิดชอบก่อนเปิด pilot

ทะเบียนผู้รับผิดชอบและปลายทางติดต่อจริงเก็บในไฟล์ภายใน
`ops/pilot-incident-roster.local.json` ซึ่ง Git ignore และห้ามนำขึ้น repository
ตรวจความพร้อมด้วย `pnpm ops:check:contacts` ก่อนเปิดบริการจริง

- Incident commander: `primary_operator` (private roster)
- Operations/support: `primary_operator` (private roster)
- Database owner: `primary_operator` (private roster)
- ช่องทางแจ้งเตือนหลัก: Email (private roster)
- ช่องทางสำรอง: LINE (private roster)

ห้ามใส่ชื่อ อีเมล เบอร์โทร หรือ LINE ID จริงในเอกสารที่ Git track ค่า `UNASSIGNED`,
placeholder, contact ที่หาไม่พบ หรือไฟล์ภายในที่ไม่ถูก ignore ถือเป็น release blocker

## ระดับเหตุการณ์

| ระดับ | ตัวอย่าง | เวลาตอบรับเป้าหมาย |
|---|---|---:|
| P0 | ข้อมูลรั่ว, เงินจริงเคลื่อนผิด, สูญเสียข้อมูลถาวร | 15 นาที |
| P1 | จองหรือดำเนินงานหลักไม่ได้หลายบัญชี, RLS ผิดปกติ | 30 นาที |
| P2 | ฟีเจอร์รองผิดปกติและมี workaround | 4 ชั่วโมง |

## ขั้นตอน 10 นาทีแรก

1. เปิด incident record พร้อมเวลา ผู้รายงาน environment และ commit SHA ห้ามใส่ PII
2. ตรวจ GitHub Actions, Supabase Database/Auth/Edge Function logs และ notification queue
3. ถ้ามีความเสี่ยงต่อการจับคู่หรือข้อความ ให้ผู้มี `operations_management` ปิด control ที่เกี่ยวข้อง
4. Payment ต้องคงปิดเสมอใน Pilot ที่ยังเป็น `fake_sandbox`
5. ห้ามแก้ข้อมูลผู้ใช้ด้วย SQL แบบ ad hoc; ใช้ audited RPC หรือ migration ที่ review แล้ว
6. เก็บ timeline ของการตัดสินใจและสถานะ control ทุกครั้ง

## Monitoring signals

| Signal | Warning | Critical/action |
|---|---|---|
| GitHub Quality/Database CI | งานใดงานหนึ่ง fail | ห้าม deploy commit นั้น |
| Supabase API 5xx | เกิดต่อเนื่อง 5 นาที | ปิด matching และตรวจ incident |
| Auth OTP errors | เพิ่มผิดปกติหรือผู้ใช้ร้องเรียนหลายราย | จำกัดการรับสมัครและตรวจ provider |
| Notification pending/failed | ค้างเกิน SLA ของเหตุการณ์ | ใช้ Notification Center และ manual support |
| Quality case SLA overdue | มีเคสเกินกำหนด | มอบหมายผู้ดูแลและบันทึกเหตุการณ์ |
| Storage authorization errors | หลายบัญชีหรือหลาย bucket | หยุด deploy และรัน Storage suites |

## Local restore drill

```powershell
pnpm db:start
pnpm db:reset
pnpm db:drill:restore
```

คำสั่งสร้างฐานชั่วคราวชื่อคงที่และจะหยุดทันทีถ้าชื่อนั้นมีอยู่แล้ว เพื่อลดความเสี่ยงลบฐานที่
ผู้ใช้สร้างเอง เมื่อจบจะลบเฉพาะฐานชั่วคราวและ backup ใน `/tmp` ของ local database container
Local drill จะไม่รวม managed `pg_cron`, Realtime และ Vault; เป้าหมายคือพิสูจน์การกู้ schema
และข้อมูลแอป ส่วนการกู้ Supabase runtime เต็มรูปแบบต้องใช้ staging project drill ด้านล่าง

## Staging restore drill

ต้องมี Supabase project ปลายทางสำหรับ drill โดยเฉพาะและได้รับอนุญาตก่อนทำ:

1. บันทึก project ref ต้นทางและปลายทางใน incident/change record
2. ยืนยันว่าปลายทางไม่ใช่ staging/production และไม่มีข้อมูลที่ต้องเก็บ
3. สร้าง backup จาก staging ด้วยวิธีที่แผน Supabase รองรับ ณ เวลานั้น
4. restore ไปปลายทางแยก
5. ตรวจ migration version, จำนวนตาราง, catalog, control defaults และบัญชีทดสอบที่ไม่ใช่ PII
6. รัน pgTAP/RLS และ health smoke tests กับปลายทาง
7. ตรวจ Storage objects แยกจาก database backup เพราะ backup ฐานข้อมูลมีเพียง metadata
   ของ Storage ไม่ได้กู้ไฟล์ object ที่ถูกลบ
8. บันทึกเวลา RPO/RTO, SHA256 ของไฟล์ backup และผลตรวจ
9. ลบ project drill ตาม retention ที่อนุมัติ ห้ามเก็บ backup บนเครื่องส่วนตัวเกินกำหนด

ห้ามถือว่า local drill แทน staging restore ได้ ทั้งสองเป็นหลักฐานคนละระดับ

## Recovery และปิดเหตุการณ์

1. เปิด control กลับทีละตัวหลัง root cause ถูกแก้และ smoke test ผ่าน
2. ตรวจว่าไม่มี mutation ถูก replay จาก browser refresh หรือ retry queue
3. แจ้งผู้ได้รับผลกระทบด้วยข้อความที่ผ่านผู้รับผิดชอบด้านกฎหมาย/operations เมื่อจำเป็น
4. ทำ post-incident review ภายใน 2 วันทำการสำหรับ P0/P1
5. เพิ่ม regression test ก่อนปิด incident เมื่อสาเหตุแก้ด้วย code/schema
