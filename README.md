# HomeCare

HomeCare เป็นตลาดบริการแบบควบคุมสำหรับเชื่อมลูกค้ากับช่างที่ผ่านการตรวจสอบ โครงนี้เป็น
baseline สำหรับ MVP ตาม [ADR-0001](docs/adr/0001-mvp-application-stack.md): แอปมือถือใช้ Expo,
ศูนย์ผู้ดูแลใช้ Next.js และระบบข้อมูลใช้ Supabase

ข้อมูลรายการบริการทั้ง 15 รายการใน seed มีสถานะ `pilot` เพื่อให้บัญชีที่เข้าสู่ระบบทดลองสร้าง
คำขอรับบริการแบบร่างได้ แต่ยังไม่มีราคาเปิดขาย พื้นที่ให้บริการ
เป็นข้อมูลที่กำหนดภายหลัง ไม่มีจังหวัดหรือเขตถูกฝังในโค้ดหรือ schema

## โครงสร้าง

```text
apps/mobile/                 Expo SDK 57 + Expo Router
apps/admin/                  Next.js 16 + App Router
packages/domain/             คำศัพท์และ adapter contracts ที่ใช้ร่วมกัน
packages/design-tokens/      semantic tokens สำหรับ mobile และ web
packages/database-types/     TypeScript types ที่สร้างซ้ำจาก Supabase ได้
supabase/migrations/         schema ที่ตรวจสอบย้อนกลับได้
supabase/tests/database/     พื้นที่สำหรับ pgTAP/RLS tests
```

## สิ่งที่ต้องมี

- Node.js 24.19.0 (สาย 24 LTS ตาม `.nvmrc`; ไม่รองรับ Node สาย Current/EOL โดยปริยาย)
- pnpm 11
- Docker Desktop สำหรับ Supabase local stack
- Android Studio/Xcode หรืออุปกรณ์จริงสำหรับทดสอบ mobile ตามแพลตฟอร์ม

## เริ่มใช้งาน

```powershell
pnpm install
Copy-Item apps/mobile/.env.example apps/mobile/.env.local
Copy-Item apps/admin/.env.example apps/admin/.env.local
pnpm db:start
pnpm db:reset
```

ใน environment ที่ไม่อนุญาตให้เขียน user profile สามารถตั้ง `SUPABASE_HOME` ให้ชี้มายัง
โฟลเดอร์ `.supabase-home` ใน workspace และตั้ง `SUPABASE_TELEMETRY_DISABLED=1` ได้

หลัง `pnpm db:start` ให้คัดลอก local publishable key ที่ CLI แสดงไปใส่
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ใน `apps/mobile/.env.local` ส่วนเว็บผู้ดูแลให้ใช้ชื่อตัวแปร
ตามไฟล์ตัวอย่างของเว็บ
ห้ามนำ service-role key ไปใส่ตัวแปร `EXPO_PUBLIC_*` หรือ `NEXT_PUBLIC_*`

ก่อนส่งขึ้น repository ให้รัน `pnpm security:check` และสำหรับการเตรียม Pilot ให้ใช้
`pnpm db:drill:restore` เพื่อพิสูจน์ backup/restore บนฐาน local แยกตาม
[`docs/PHASE-6B-SECURITY-OPERATIONS.md`](docs/PHASE-6B-SECURITY-OPERATIONS.md)

สถานะ Staging และ release gates สำหรับ Pilot อยู่ที่
[`docs/PHASE-6C-STAGING-PILOT-READINESS.md`](docs/PHASE-6C-STAGING-PILOT-READINESS.md)

แอปมือถือสมัครและเข้าสู่ระบบด้วยเบอร์โทรผ่าน SMS OTP จึงต้องเปิด Phone provider และตั้งค่า
SMS provider ใน Supabase ก่อนทดสอบบนอุปกรณ์จริง หากยังไม่ตั้งค่า environment แอปจะแสดง
หน้าสถานะการเชื่อมต่อแทนการ crash เพื่อให้ build และ CI ทำงานได้อย่างปลอดภัย

เปิดแอปแยกกัน:

```powershell
pnpm dev:mobile
pnpm dev:admin
```

หรือเปิดพร้อมกันด้วย `pnpm dev`

ทดสอบ Admin Web แบบ container ที่ใช้รูปแบบเดียวกับเป้าหมาย Hostinger VPS:

```powershell
pnpm db:start
pnpm env:local-vps:up
pnpm env:local-vps:check
```

รายละเอียด topology, firewall, HTTPS, backup และขั้นตอนย้ายขึ้น VPS อยู่ที่
[`infra/hostinger/README.md`](infra/hostinger/README.md)

ก่อนซื้อ VPS ให้รัน Supabase Self-hosted แบบเต็มบนเครื่อง local เพื่อทดสอบ stack เดียวกับ
production รวม migration, pgTAP/RLS, persistence และการกู้คืน Database/Storage:

```powershell
pnpm selfhost:up
pnpm selfhost:db:test
pnpm selfhost:persistence
pnpm selfhost:backup-restore
pnpm selfhost:storage:backup-restore
```

Admin ของชุดนี้อยู่ที่ `http://127.0.0.1:3200/login` และทุก port bind เฉพาะ localhost ดูคำสั่ง
และขอบเขตความปลอดภัยใน [`infra/self-hosted/README.md`](infra/self-hosted/README.md)

## ตรวจคุณภาพ

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:mobile:native
pnpm build
pnpm db:test
pnpm db:test:identity
pnpm db:test:storage
pnpm db:lint
```

`validate:mobile:native` ตรวจ dependency compatibility, Expo Doctor และ app/config-plugin
ทั้ง public config และ native introspection โดยไม่ต้องใช้อุปกรณ์ ส่วน `pnpm build` ของ mobile
เป็นการ export เว็บเพื่อ smoke test เท่านั้น **ไม่ใช่ native build** ก่อนปล่อย preview/production
ยังต้องสร้าง Android/iOS binary แล้วทดสอบบนอุปกรณ์จริง โดยเฉพาะ splash screen, ฟอนต์, กล้อง,
push notification และ location

`db:test` รัน pgTAP/RLS ผ่าน PostgreSQL roles จริง ส่วน `db:test:identity` สร้างผู้ใช้เฉพาะ
local stack และเรียก Data/Auth API จริงเพื่อยืนยัน profile เริ่มต้น บทบาทลูกค้า การแก้ชื่อ และ
การเริ่มใบสมัครช่างแบบ idempotent จากนั้นจึงลบ fixture ของตัวเอง ส่วน `db:test:storage` สร้างผู้ใช้ทดสอบ
เฉพาะ local stack และเรียก Storage API จริงเพื่อยืนยันว่าเอกสารช่างลบได้เฉพาะตอนเป็น draft
ชุดทดสอบลบไฟล์และผู้ใช้ทดสอบของตัวเองเมื่อจบ และจะปฏิเสธทันทีหาก API URL ไม่ใช่ localhost

สร้าง database types ใหม่หลัง migration เปลี่ยน:

```powershell
pnpm db:reset
pnpm db:types
```

## กติกาฐานข้อมูล

- แก้ schema ผ่านไฟล์ใน `supabase/migrations/` เท่านั้น
- ตารางใน `public` ต้องเปิด RLS และมี policy ที่ทดสอบทั้งกรณีผ่านและไม่ผ่าน
- เอกสารช่างอยู่ใน private bucket `technician-documents`; path ต้องขึ้นต้นด้วย user id ของช่าง
- ราคาอยู่ใน `service_items` และตั้งค่าได้ `base_labor_price` เป็น `null` ได้
- การเปิดบริการควรเปลี่ยน `catalog_status` หลังผ่าน operational gate ไม่เปลี่ยนจาก UI ฝั่ง client โดยตรง

## Environment safety

ไฟล์ `.env*` จริงถูก ignore ทั้งหมด ยกเว้นไฟล์ตัวอย่าง ไม่มี secret จริงอยู่ใน repository และ
การทำ privileged operation ในอนาคตต้องอยู่ใน server-only code หรือ Edge Function เท่านั้น
