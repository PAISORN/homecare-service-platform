# Phase 4E — Push Notification และ Deep Link ของงานบริการ

Phase 4E แจ้งคู่สัญญาเมื่อสถานะงาน ข้อความ หรือคำขอเพิ่มงานเปลี่ยน และพาผู้รับไปยังหน้าของงานบริการที่ถูกต้องเมื่อแตะการแจ้งเตือน โดยยังไม่รวมตำแหน่ง/ETA การตรวจรับ และการชำระเงิน

## ขอบเขตที่ส่งมอบ

- ลงทะเบียน Expo Push Token ต่อบัญชีและ installation ของอุปกรณ์ผ่าน RPC เท่านั้น
- Push Token ไม่เปิดให้อ่านตรงจาก mobile client และถูกปิดเมื่อผู้ใช้ออกจากระบบหรือปิดการแจ้งเตือนใน HomeCare
- สร้าง `notifications` เป็น durable outbox เมื่อเกิด Job Status Event, ข้อความใหม่ หรือการขอ/ตอบงานเพิ่มเติม
- เนื้อหา Push เป็นข้อความทั่วไป ไม่คัดลอกข้อความแชต ที่อยู่ หรือรายละเอียดหน้างานไปแสดงบน Lock Screen
- Edge Function `dispatch-job-notifications` ใช้สิทธิ์ฝั่ง server เพื่ออ่าน Push Token และส่งผ่าน Expo Push Service
- การส่งล้มเหลวจะกลับเข้าคิวได้สูงสุด 3 ครั้ง; token ที่ Expo ระบุว่า `DeviceNotRegistered` จะถูกปิด
- Deep Link ยอมรับเฉพาะหน้ารายละเอียด แชต และจัดการงาน พร้อม `jobId` รูปแบบ UUID
- เส้นทางถูกสร้างตามบทบาทผู้รับ เช่น ลูกค้าเปิด `/jobs/...` และช่างเปิด `/technician/jobs/...`
- หน้า “บัญชีของฉัน” แสดงสถานะ permission/configuration และให้ผู้ใช้เปิด ปิด หรือนำไปยัง Settings ของอุปกรณ์

## ขอบเขตสิทธิ์

- บัญชีที่ active ลงทะเบียนและปิดได้เฉพาะ installation ของตนผ่าน RPC
- ตาราง `push_devices` เปิด RLS แต่ไม่ให้ authenticated client อ่าน token โดยตรง
- ผู้รับอ่าน notification ของตนเองได้เท่านั้น
- client ไม่มีสิทธิ์ claim คิว; Edge Function เป็นผู้ claim ผ่าน service role และประมวลผลเฉพาะเหตุการณ์ที่ actor ผู้เรียกสร้างขึ้น
- Service-role/secret key อยู่ใน Supabase Edge Function เท่านั้น ห้ามนำไปไว้ใน `EXPO_PUBLIC_*`

## การตั้งค่า environment

1. เชื่อม `apps/mobile` กับ EAS Project แล้วนำ UUID ของ Project ไปตั้งเป็น `EXPO_PUBLIC_EAS_PROJECT_ID` หรือให้ EAS ใส่ `extra.eas.projectId` ใน app config
2. Deploy migration และ Edge Function:

   ```powershell
   pnpm exec supabase db push
   pnpm exec supabase functions deploy dispatch-job-notifications
   ```

3. ถ้าเปิด Enhanced Security for Push Notifications ให้สร้าง Expo Access Token และตั้งใน Supabase Secrets เท่านั้น:

   ```powershell
   pnpm exec supabase secrets set EXPO_ACCESS_TOKEN=<token>
   ```

4. สร้าง HomeCare Development Build จาก `apps/mobile/eas.json` เพราะ Expo Go ไม่รองรับการทดสอบ remote push ครบถ้วน:

   ```powershell
   eas build --platform ios --profile development
   # หรือ
   eas build --platform android --profile development
   ```

## การทดสอบบนโทรศัพท์จริง

1. ติดตั้ง HomeCare Development Build แล้วเปิด Metro ด้วย `npx expo start --dev-client`
2. เข้าสู่ระบบ เปิด “บัญชีของฉัน” แล้วกด “เปิดการแจ้งเตือน”
3. ตรวจว่าหน้าจอแสดง “เปิดรับการแจ้งเตือนบนอุปกรณ์นี้แล้ว” โดยไม่แสดง Push Token
4. ใช้อีกบัญชีเปลี่ยนสถานะงาน ส่งข้อความ และส่งคำขอเพิ่มงาน
5. ปิดหรือพักแอปของผู้รับ แล้วตรวจว่าได้รับ Push ที่ไม่เปิดเผยข้อความแชตหรือที่อยู่
6. แตะ Push และตรวจว่าเปิดงานเดียวกันในหน้ารายละเอียด แชต หรือหน้าจัดการงานตามชนิดเหตุการณ์และบทบาท
7. ทดสอบทั้งกรณีแอปอยู่ foreground, background และถูกปิด
8. ออกจากระบบ แล้วตรวจว่าอุปกรณ์ไม่รับ Push ของบัญชีเดิมอีก

## งานที่เลื่อนไป Phase ถัดไป

- Foreground location และ ETA ระหว่างช่างเดินทาง
- การตรวจรับ กรอบเวลา 48 ชั่วโมง และ Payment adapter
- Notification Center/ไอคอนกระดิ่งพร้อม unread badge ภายในแอป
- worker ตามเวลาเพื่อ retry คิวโดยไม่ต้องรอ action ถัดไปจาก mobile client
