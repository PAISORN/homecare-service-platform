# Phase 6A — Physical-device UAT และ Verification Matrix

สถานะ: Web/Backend functional UAT ผ่าน; เหลือ physical-only checks (2026-09-12)

## เป้าหมาย

ยืนยัน critical flow ของ HomeCare บนอุปกรณ์จริงโดยเริ่มจาก Mobile Web บน iPhone
ก่อน เนื่องจาก Development Build สำหรับ iOS ยังต้องใช้ Apple Developer Program ส่วน
การทดสอบ database, RLS, Storage และ SLA transition ยังคงทำอัตโนมัติใน local/CI

Phase นี้ไม่เชื่อม payment provider และไม่มีการเคลื่อนย้ายเงินจริง

## Environment ที่ใช้

- Mobile Web: Expo SDK 57 ผ่าน Metro แบบ LAN
- URL ของรอบทดสอบนี้: `http://192.168.1.104:8081`
- Backend: Supabase staging `opdtzlptueglotqntzzu`
- Migration ล่าสุด: `20260911144745_add_service_quality_sla_notifications.sql`
- Edge Function: `dispatch-job-notifications`

IP ของเครื่องอาจเปลี่ยนหลังเปลี่ยน Wi-Fi หรือ restart router ให้ใช้ URL ที่ Metro แสดง
ใน Terminal เป็นค่าปัจจุบันเสมอ โทรศัพท์และคอมพิวเตอร์ต้องอยู่ Wi-Fi เดียวกัน

## ผล preflight จากเครื่องพัฒนา

| ID | รายการ | ผล |
|---|---|---|
| WEB-01 | หน้า Home โหลดและมีทางเข้าการแจ้งเตือน | ผ่าน |
| WEB-02 | Notification Center โหลดและแสดง empty state | ผ่าน |
| WEB-03 | ไม่พบ framework error overlay | ผ่าน |
| WEB-04 | ย้อนกลับจากเส้นทางปกติ | ผ่าน |
| WEB-05 | เปิด `/notifications?mode=customer` โดยตรงแล้วย้อนกลับ | ผ่าน |
| DB-01 | pgTAP รวม RLS และ SLA | ผ่าน 541 assertions |
| DB-02 | Storage API integration | ผ่าน 4 ชุด |
| CI-01 | GitHub Quality และ Database jobs | ผ่าน |

## สิ่งที่ต้องเตรียมก่อน UAT แบบสองบทบาท

1. บัญชีลูกค้าที่ active หนึ่งบัญชี
2. บัญชีช่างที่ผ่านการตรวจสอบหนึ่งบัญชี
3. งานบริการหนึ่งงานที่ทั้งสองฝ่ายยืนยันแล้ว
4. เปิด Safari สอง session หรือใช้อุปกรณ์/เบราว์เซอร์อีกเครื่องสำหรับอีกบทบาท
5. ห้ามใช้ข้อมูลส่วนบุคคลจริงในคำอธิบาย รูป หรือข้อความทดสอบ

หากหน้ารายการงานขึ้นว่า “ยังไม่มีงานบริการที่ทั้งสองฝ่ายยืนยันแล้ว” ให้สร้างคำขอ
เลือกช่าง ยืนยันขอบเขต และยืนยันนัดหมายทั้งสองฝ่ายก่อนเริ่มเคสด้านล่าง

## Matrix สำหรับทดสอบบน iPhone

บันทึกผลเป็น `ผ่าน`, `ไม่ผ่าน` หรือ `ติดข้อจำกัด` พร้อมเวลาและภาพหน้าจอเมื่อพบปัญหา

| ID | บทบาท | ขั้นตอน | ผลที่ต้องได้ | สถานะ |
|---|---|---|---|---|
| IOS-WEB-01 | ลูกค้า | เปิด URL จาก Metro | หน้า Home แสดงครบและเลื่อนได้ ไม่มีหน้าขาว | ผ่านบน iPhone Safari |
| IOS-WEB-02 | ลูกค้า | แตะ “การแจ้งเตือน” | เปิด Notification Center และย้อนกลับได้ | ผ่านบน iPhone Safari |
| IOS-WEB-03 | ลูกค้า | เปิด URL `/notifications?mode=customer` โดยตรง | กดย้อนกลับแล้วกลับ Home โดยไม่มี `GO_BACK` error | ผ่านด้วย browser automation |
| IOS-WEB-04 | ลูกค้า | เปิดงานที่ยืนยันแล้วและสร้างเคสคุณภาพงาน | เห็นเลขเคส สถานะ ผู้ดำเนินการถัดไป และกำหนด SLA | ผ่านด้วย local browser automation |
| IOS-WEB-05 | ช่าง | เปิด Notification Center หลังลูกค้าสร้างเคส | มีรายการใหม่และ unread badge เพิ่ม | ผ่านด้วย local browser automation |
| IOS-WEB-06 | ช่าง | แตะ notification ของเคส | เปิดเคสของงานเดียวกันและอ่านรายละเอียดได้ | ผ่านด้วย local browser automation |
| IOS-WEB-07 | ช่าง | เพิ่มคำชี้แจง | ลูกค้าได้รับ notification โดยไม่มีที่อยู่หรือเนื้อหาละเอียดบนรายการย่อ | ผ่านด้วย local browser automation |
| IOS-WEB-08 | ลูกค้า | แตะ “อ่านทั้งหมด” | badge หายและทุกรายการเปลี่ยนเป็นอ่านแล้ว | ผ่านด้วย local browser automation |
| IOS-WEB-09 | ผู้ดูแล | เปลี่ยนเคสเป็นรอข้อมูลลูกค้า | ลูกค้าเห็นผู้ดำเนินการถัดไปและกำหนด SLA รอบใหม่ | ผ่านด้วย local browser automation |
| IOS-WEB-10 | ลูกค้า | เพิ่มข้อมูลตามที่ขอ | ช่างได้รับ notification และ timeline เพิ่มแบบ append-only | ผ่านด้วย local browser automation |
| IOS-WEB-11 | ผู้ดูแล | ตัดสินหรือยุติเคส | SLA เป็น “หยุดจับเวลาแล้ว” และทั้งสองฝ่ายเห็นผล | ผ่านด้วย local browser automation |
| IOS-WEB-12 | ทุกบทบาท | เพิ่มขนาดข้อความของ iPhone แล้วทดสอบซ้ำ | ข้อความไม่ทับ ปุ่มยังแตะได้ และไม่มี horizontal scroll | ติดข้อจำกัด: ต้องยืนยันบน iPhone |
| IOS-WEB-13 | ทุกบทบาท | หมุนเครื่องเป็น landscape | เนื้อหาอ่านและเลื่อนได้ ปุ่มไม่ถูก browser bar บัง | ติดข้อจำกัด: ต้องยืนยันบน iPhone |

## ผล local browser UAT วันที่ 2026-09-12

- ใช้ Supabase local และข้อมูลจำลองที่สร้างเฉพาะรอบทดสอบ ไม่แตะข้อมูล staging
- ทดสอบครบสามบทบาท: ลูกค้าสร้างข้อร้องเรียน, ช่างรับ notification และเพิ่มคำชี้แจง,
  ผู้ดูแลขอข้อมูลเพิ่ม, ลูกค้าตอบกลับ, ผู้ดูแลตัดสิน และทั้งลูกค้า/ช่างได้รับผล
- ยืนยัน notification summary ไม่แสดงที่อยู่หรือรายละเอียดปัญหา และ deep link เปิดงาน/เคสที่ถูกต้อง
- ยืนยัน “อ่านทั้งหมด” เปลี่ยน unread state และยืนยัน timeline เป็น append-only
- ยืนยันการปิดเคสแสดง SLA “หยุดจับเวลาแล้ว”, ไม่มีผู้ดำเนินการค้าง และไม่มีกำหนดเวลา
- ล้างบัญชี งาน เคส notification และ session bridge ที่ใช้ทดสอบออกจาก local แล้ว

## Defect ที่พบและแก้ระหว่าง UAT

| ID | อาการ | การแก้และผลยืนยัน |
|---|---|---|
| ADM-WEB-01 | หน้า `/cases` ตอบ 500 จาก dynamic object `href` | ใช้ URL `/cases/{caseId}` โดยตรง; เปิดรายการและรายละเอียดผ่าน |
| ADM-WEB-02 | บัญชีที่มีเฉพาะ `case_management` ถูกส่งไป `/technicians` | เลือกปลายทางหลัง login ตาม permission; เข้าสู่ `/cases` ผ่าน |
| ADM-WEB-03 | refresh หลังบันทึก Server Action อาจส่ง POST ซ้ำ | redirect หลัง mutation ให้รอบถัดไปเป็น GET; refresh แล้ว event ปิดเคสคงอยู่หนึ่งรายการ |
| ADM-WEB-04 | ฟอร์มรายละเอียดแสดงสถานะเริ่มต้นไม่ตรงข้อมูลและ badge เป็น enum | ใช้สถานะจริงเป็นค่าเริ่มต้นและแสดงป้ายภาษาไทย; ตรวจด้วย browser ผ่าน |

## SLA ที่ยืนยันด้วย automation

ไม่ต้องรอ 4–48 ชั่วโมงบนโทรศัพท์เพื่อพิสูจน์ transition เพราะชุด pgTAP ใช้เวลา
จำลองตรวจ `on_track`, `due_soon`, `overdue` และ `closed` แล้ว รวมถึงตรวจว่า client
เรียก worker แบบ service-role ไม่ได้ การทดสอบบน iPhone เน้นการแสดงผล, unread state,
deep link และการสื่อสารระหว่างสองบทบาท

## ข้อจำกัดที่ยอมรับในรอบนี้

- Safari/Mobile Web ไม่สามารถยืนยัน remote push ตอนแอปถูกปิด, permission ของ iOS,
  Expo Push Token หรือการแตะ system notification ได้
- การทดสอบดังกล่าวต้องใช้ HomeCare iOS Development Build ซึ่งยังเลื่อนไว้จนกว่าจะ
  มี Apple Developer Program
- Notification Center ภายในแอป, durable outbox, deep link ภายในเว็บ, SLA scheduler,
  RLS และ Edge Function ยังทดสอบต่อได้โดยไม่เสียค่า Apple Developer

## Exit criteria ของ Phase 6A รอบ Mobile Web

- Functional flow `IOS-WEB-01` ถึง `IOS-WEB-11` ไม่มี P0/P1 defect หลังแก้ defect ด้านบน
- `IOS-WEB-12` และ `IOS-WEB-13` ต้องยืนยันบน iPhone จริงก่อนปิด physical-device UAT
- หากมี defect ต้องบันทึกหน้าจอ ขั้นตอนทำซ้ำ บทบาท URL และเวลาที่เกิด
- automated Quality และ Database CI ยังผ่านบน commit ล่าสุด
- รายการ native-only ถูกระบุเป็น `ติดข้อจำกัด` ไม่ถือว่า `ผ่าน`
