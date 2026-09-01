# Database tests

ไฟล์ `001_kyc_workflow_rls.test.sql` ทดสอบ RLS และ workflow ของบัญชีและ KYC โดยสลับ
PostgreSQL role เป็น `anon` และ `authenticated` พร้อม JWT subject จริงในแต่ละกรณี ครอบคลุม
cross-user access, role escalation, path spoofing, การส่งโปรไฟล์ และ immutability หลัง review

ไฟล์ `002_admin_kyc_permissions.test.sql` ทดสอบสิทธิ์ผู้ดูแลแบบแยกราย permission,
การบังคับให้ review/verification ผ่าน audited RPC, actor จาก `auth.uid()`, เหตุผลเมื่อปฏิเสธ,
เอกสารที่จำเป็นก่อน verified, quota การลงทะเบียนและอัปโหลด KYC, soft deactivation และ
การบล็อก hard delete ขณะที่ยังมี KYC ตาม ADR-0002

ไฟล์ `003_final_lifecycle_security.test.sql` ทดสอบวงจรบัญชีช่างรอบสุดท้าย ได้แก่ การห้าม
ตรวจบัญชีที่ปิดใช้งาน การห้าม verified ขณะยังมีเอกสาร pending การซ่อนช่างที่ปิดใช้งาน
public projection ที่ไม่เปิดเผย PII, audit ของการเปลี่ยนบทบาท และ retention guard ที่ตรวจ
ทั้งแถวฐานข้อมูลและไฟล์กำพร้าใน Storage

ไฟล์ `004_technician_application_bootstrap.test.sql`,
`004_required_technician_document_uniqueness.test.sql` และ
`005_kyc_collection_contract.test.sql` ทดสอบ bootstrap แบบ idempotent, เอกสาร KYC
ที่จำเป็นเพียงหนึ่งฉบับต่อประเภท, การยอมรับประกาศ KYC แบบมีเวอร์ชัน และการเปลี่ยนเอกสาร
แบบ staging โดยไม่ทำเอกสารเดิมสูญหาย

ไฟล์ `006_technician_review_read_contract.test.sql` ทดสอบ read contract ของ Phase 2C:
เฉพาะผู้ดูแลที่มี `technician_review` จึงเห็นคิว `pending_review`, DTO ของใบสมัครและเอกสาร,
Storage object ที่เกี่ยวข้อง และ Audit history ที่จำกัดเฉพาะ target โดยไม่ให้สิทธิ์
`audit_view` ทั้งระบบ

ไฟล์ `008_service_request_drafts.test.sql` ทดสอบสัญญา Phase 3A สำหรับคำขอรับบริการ
แบบร่าง ได้แก่ การเลือกแค็ตตาล็อกและสถานที่ของตนเอง การแก้ไขแบบร่าง การคำนวณ
Safety Stop ฝั่งฐานข้อมูล การกันข้อมูลข้ามบัญชี การจอง metadata รูปใน path ที่ผูกกับ
ลูกค้าและคำขอ ตลอดจน private bucket, RLS และ audit ที่ไม่บันทึกข้อความละเอียด

คำสั่งตรวจสอบ:

```sh
pnpm db:reset
pnpm db:test
pnpm db:test:storage
pnpm db:lint
pnpm db:types
```

`db:test:storage` เป็น integration test แยกจาก pgTAP ครอบคลุมทั้งเอกสาร KYC และรูปของ
คำขอรับบริการแบบร่าง เพราะการลบ `storage.objects` โดยตรง
ถูก Supabase ปฏิเสธเสมอ ชุดนี้จึงเรียก Storage API และตรวจว่าไฟล์ถูกลบหรือเนื้อหายังคงเดิมจริง
รวมถึงตรวจ signed URL อายุสั้นสำหรับ reviewer, ปฏิเสธ caller ที่ไม่มีสิทธิ์/เคสที่ยังเป็น draft
หรือจบการตรวจแล้ว และรัน quota concurrency test เพื่อยืนยันว่าการลงทะเบียนและอัปโหลดพร้อมกัน
ไม่เกินค่าที่กำหนด ชุดทดสอบทำงานกับ local stack เท่านั้น และ teardown ของ fixture จะปิดเฉพาะ trigger
ป้องกัน retention ที่ขัดขวางการลบผู้ใช้ทดสอบเป็นการชั่วคราว โดยไม่ปิด foreign key หรือ check
constraint และเปิด trigger คืนภายใน SQL block เดียวกัน
