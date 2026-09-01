# HomeCare MVP Implementation Plan

แผนนี้เปลี่ยน Product Brief และ Wireframe ที่ยืนยันแล้วให้เป็นงานพัฒนาแบบต่อเนื่อง โดยเริ่มจากพิสูจน์กระบวนการบริการจริง แล้วค่อยสร้าง vertical slice ที่ลูกค้าส่งคำขอ ช่างรับงาน ผู้ดูแลตรวจสอบ และงานจบพร้อมหลักฐานครบวงจร

## เป้าหมายและลำดับความสำคัญ

เป้าหมายของ MVP ไม่ใช่จำนวนหน้าจอ แต่คือทำให้งานบริการหนึ่งงานผ่านวงจรต่อไปนี้ได้อย่างปลอดภัย:

`สมัคร → เลือกบริการ/แจ้งอาการ → คัดกรองช่าง → ยืนยันขอบเขตและราคา → นัดหมาย → ดำเนินงานพร้อมหลักฐาน → ตรวจรับ → ชำระ/ปล่อยยอด → รีวิว/รับประกัน`

หลักอ้างอิงของแผน:

- ภาษาโดเมน: [`CONTEXT.md`](../../CONTEXT.md)
- ขอบเขตผลิตภัณฑ์และนโยบาย: [`docs/PRODUCT-BRIEF.md`](../PRODUCT-BRIEF.md)
- ระบบภาพ: [`design-system/homecare/MASTER.md`](../../design-system/homecare/MASTER.md)
- Stack ที่ยืนยัน: [`docs/adr/0001-mvp-application-stack.md`](../adr/0001-mvp-application-stack.md)

## Phase 0 — Documentation Discovery และ Product/Operations Gate

### สิ่งที่ต้องทำ

1. ทดสอบบริการแบบ manual หรือ concierge ก่อนเริ่มระบบเต็มรูปแบบ:
   - สัมภาษณ์ลูกค้าอย่างน้อย 10–20 คนและช่าง 5–10 คน
   - ทดลองรับงานจริง 10–20 งานใน 3 หมวดเริ่มต้น
   - บันทึกเวลาจับคู่ อัตรารับงาน ราคาที่เปลี่ยน เหตุยกเลิก หลักฐานที่ขาด และข้อร้องเรียน
   - ใช้แบบสัมภาษณ์ แบบบันทึกงาน และเกณฑ์ Go/Revise/Stop จาก [`PILOT-VALIDATION-KIT.md`](../PILOT-VALIDATION-KIT.md)
2. กำหนดเขตบริการนำร่องก่อนเปิดรับสมัครช่าง แม้ระบบจะไม่ผูกกับพื้นที่ใดในโค้ด
3. สร้าง Service Catalog รุ่นแรก:
   - รายการบริการจริงของแอร์ ประปา และไฟฟ้า
   - รูปแบบราคา คำถามคัดกรอง ตัวเลือกเพิ่มราคา ระยะรับประกัน และข้อยกเว้น
   - ตารางเปลี่ยนสถานะงานที่ระบุผู้มีสิทธิ์ทำแต่ละ transition
4. เลือกและตรวจสอบผู้ให้บริการที่ยังเป็น dependency:
   - SMS OTP และข้อกำหนดหมายเลข/ผู้ส่งในประเทศไทย
   - Payment Gateway ที่รองรับรับเงิน คืนเงิน webhook และการปล่อยยอดตามโมเดล HomeCare
   - แผนที่/Geocoding และข้อจำกัดค่าใช้จ่าย
5. ให้ที่ปรึกษากฎหมายตรวจ PDPA, ข้อตกลงช่าง, การรับประกัน, การคืนเงิน และความถูกต้องของคำว่า “ยอดคุ้มครองงาน”
6. กำหนด permission matrix ของผู้ดูแล เช่น ตรวจช่าง, ดูการเงิน, คืนเงิน, จัดการข้อพิพาท และดูเอกสาร KYC

### Allowed APIs และเอกสารที่ตรวจแล้ว

- Expo bootstrap: `npx create-expo-app@latest <app> --template default@sdk-57` จาก [create-expo-app](https://docs.expo.dev/more/create-expo/)
- Expo Router ใช้ `src/app`, `_layout.tsx`, route groups และ deep links จาก [Router core concepts](https://docs.expo.dev/router/basics/core-concepts/)
- Supabase phone OTP ใช้ `supabase.auth.signInWithOtp()` และ `supabase.auth.verifyOtp()` จาก [Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- Supabase migration/RLS ใช้ CLI และ policy ของ Postgres จาก [Local development](https://supabase.com/docs/guides/local-development/cli-workflows) และ [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Next.js Admin ใช้ App Router, Server Components และ server-side authorization จาก [App Router](https://nextjs.org/docs/app) และ [Authentication](https://nextjs.org/docs/app/guides/authentication)

### Gate ก่อนผ่าน Phase 0

- มีรายงาน manual pilot และหลักฐานว่าทั้งลูกค้าและช่างเข้าใจกระบวนการ
- ระบุเขตนำร่อง รายการบริการ ราคา และนโยบายรับประกันรุ่นแรกแล้ว
- มี shortlist ผู้ให้บริการ SMS, Payment และ Maps พร้อมข้อจำกัดจริง
- ตารางสถานะงาน permission matrix และ Audit Log events ผ่านการทบทวน
- ประเด็นกฎหมายที่บล็อกการรับเงินจริงมีคำตอบหรือแผนทดสอบใน sandbox

### Anti-pattern guards

- ห้ามเริ่มระบบการเงินด้วยคำว่า Escrow โดยยังไม่มีผู้ให้บริการ/ข้อกฎหมายรองรับ
- ห้ามเพิ่มหมวด “ช่างทั่วไป” หรือ “เครื่องใช้ไฟฟ้าทุกชนิด” ก่อนพิสูจน์ 3 หมวดแรก
- ห้ามใช้ Wireframe เป็นหลักฐานว่ากระบวนการหน้างานใช้ได้จริง

## Phase 1 — Workspace, Architecture และ Quality Baseline

ระยะเวลาโดยประมาณ: 1–2 สัปดาห์ หลังผ่าน Phase 0

### สิ่งที่ต้องทำ

1. ใช้ pnpm workspace และสร้างโครงสร้าง:

   ```text
   apps/mobile/
   apps/admin/
   packages/domain/
   packages/design-tokens/
   packages/database-types/
   supabase/migrations/
   supabase/tests/database/
   ```

2. Scaffold แอปมือถือด้วย Expo + TypeScript + Expo Router และ Admin ด้วย Next.js App Router
3. สร้าง Supabase local stack, migration workflow, seed และ generated database types
4. ย้าย semantic colors, typography, spacing และภาษาไทยจาก Design System เข้า packages
5. ตั้ง ESLint, TypeScript strict mode, formatting, unit tests, environment templates และ CI ขั้นต้น
6. กำหนด adapter interfaces สำหรับ Payment, Map และ Notifications โดยยังไม่ผูก provider จริง

### เอกสารและ pattern ที่ต้องคัดลอก

- Expo project/router: [Create Expo app](https://docs.expo.dev/more/create-expo/), [Navigation layouts](https://docs.expo.dev/router/basics/navigation-layouts/)
- Supabase local/migration commands: [CLI workflow](https://supabase.com/docs/guides/local-development/cli-workflows), [Database migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- Next.js scaffold/structure: [Installation](https://nextjs.org/docs/app/getting-started/installation), [Project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- Local source constraints: [`ADR-0001`](../adr/0001-mvp-application-stack.md), โดยเฉพาะ shared domain types แต่ไม่แชร์ UI โดยอัตโนมัติ

### Verification checklist

- `apps/mobile` เปิด development build และ route แรกได้
- `apps/admin` ผ่าน `pnpm lint`, `pnpm test` และ `pnpm build`
- `npx supabase start`, `npx supabase db reset`, `npx supabase db lint --level error` ผ่าน
- generated database types สร้างซ้ำได้จาก migration
- ไม่มี secret จริงใน repo และไม่มี service-role key ในตัวแปร `EXPO_PUBLIC_*` หรือ `NEXT_PUBLIC_*`

### Anti-pattern guards

- ห้ามเริ่มจาก `App.tsx` แบบ navigation ทำเองเมื่อเลือก Expo Router แล้ว
- ห้ามสร้าง schema ผ่าน dashboard โดยไม่มี migration
- ห้ามใช้ raw hex ใน component; ใช้ semantic token
- ห้ามผูก business rule ไว้ใน UI component

## Phase 2 — Identity, Roles, Service Locations และ Technician Approval

ระยะเวลาโดยประมาณ: 2–3 สัปดาห์

### สิ่งที่ต้องทำ

1. สร้าง schema ขั้นแรก: profiles, roles, service_locations, technician_profiles, technician_skills, technician_documents, service_categories, service_items และ audit_log
2. ทำ Phone OTP สำหรับลูกค้า/ช่าง และ session persistence บนมือถือ
3. สร้าง onboarding ลูกค้าและสถานที่รับบริการ
4. สร้าง onboarding ช่าง อัปโหลดเอกสาร KYC ไป private bucket และสถานะการตรวจแยกประเภท
5. สร้าง Admin vertical slice: login → รายชื่อช่าง → ตรวจเอกสาร → อนุมัติ/ปฏิเสธ → Audit Log
6. บังคับ permissions ทั้งใน server-side admin code และ Supabase RLS

### เอกสารและ pattern ที่ต้องคัดลอก

- React Native Supabase singleton/session refresh: [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- OTP: [Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- Storage private buckets and policies: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- Next.js DAL/DTO และ `server-only`: [Data Security](https://nextjs.org/docs/app/guides/data-security)
- คำศัพท์ canonical: [`CONTEXT.md`](../../CONTEXT.md), ส่วน “ผู้เกี่ยวข้อง”

### Verification checklist

- OTP local test ใช้ fixed test OTP และ production configuration ไม่ใช้ค่าเดียวกัน
- ลูกค้าอ่าน/แก้ได้เฉพาะ profile และสถานที่ของตน
- ช่างอัปโหลด KYC เข้า private bucket และลูกค้าดูไม่ได้
- ผู้ดูแลที่ไม่มี permission ไม่สามารถอนุมัติช่างได้ทั้งจาก UI และ direct request
- การอนุมัติ/ปฏิเสธสร้าง Audit Log
- RLS tests มีทั้ง positive และ negative CRUD cases

### Anti-pattern guards

- ห้ามเก็บ domain data หรือไฟล์ใหญ่ใน SecureStore; ใช้สำหรับ secret/session ขนาดเล็กเท่านั้น
- ห้ามใช้ service-role client ใน Client Component หรือแอปมือถือ
- `proxy.ts` ใช้ redirect เชิง optimistic เท่านั้น ไม่ถือเป็น authorization boundary
- ห้ามแสดง KYC ผ่าน public URL

## Phase 3 — Service Catalog, Request, Discovery และ Matching

ระยะเวลาโดยประมาณ: 3–4 สัปดาห์

### สิ่งที่ต้องทำ

1. สร้าง 3 ทางเข้าของลูกค้า: เลือกบริการมาตรฐาน, แจ้งอาการ, เลือกช่างจากโพสต์ผลงาน
2. สร้าง service_requests, request_attachments, technician_interests, quotations, quotation_items และ portfolio_posts
3. ทำคำถามคัดกรองเฉพาะหมวดและ safety stop สำหรับเหตุอันตราย
4. สร้าง feed งานที่เหมาะกับช่าง โดยปิดบังชื่อ ที่อยู่ และข้อมูลติดต่อก่อนจับคู่
5. สร้าง shortlist ช่างสูงสุด 3 คนและ flow เลือกช่าง
6. ทำโพสต์ผลงานแบบมีโครงสร้าง การตรวจเนื้อหา และ consent สำหรับรูปจากงานจริง
7. สร้าง Admin สำหรับรายการบริการ ราคา โพสต์ และการช่วยจับคู่

### เอกสารและ pattern ที่ต้องคัดลอก

- Evidence/media picker: [Expo ImagePicker usage](https://docs.expo.dev/versions/latest/sdk/imagepicker/#usage)
- Upload ด้วย immutable unique paths และ private/public bucket ตามข้อมูล: [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- Product rules: [`PRODUCT-BRIEF.md`](../PRODUCT-BRIEF.md), ส่วน 4, 7, 8 และ 9
- UI rules: [`MASTER.md`](../../design-system/homecare/MASTER.md), ส่วน Forms, Feed และ privacy

### Verification checklist

- ลูกค้าสร้างคำขอได้ทั้ง 3 ช่องทางและกลับมาแก้ draft ได้
- Safety stop หยุด flow ปกติเมื่อคำตอบบ่งชี้เหตุอันตราย
- ช่างเห็นเฉพาะคำขอที่ RLS และ matching rule อนุญาต
- ช่างไม่เห็นข้อเสนอของผู้อื่นและข้อมูลลูกค้าก่อนถูกเลือก
- shortlist ไม่เกิน 3 คน และการเลือกหนึ่งคนปิดความสนใจรายอื่นอย่างสอดคล้อง
- โพสต์ที่ไม่มี consent/ผ่าน moderation ไม่เผยแพร่

### Anti-pattern guards

- ห้ามใช้ “ราคาเริ่มต้น” โดยไม่แสดงเงื่อนไขราคาเพิ่ม
- ห้ามให้ client เป็นผู้ตัดสิน matching/visibility โดยไม่มี server/RLS enforcement
- ห้าม `upsert` ทับ path รูปเดิมเมื่อ CDN อาจแสดงไฟล์ stale; ใช้ชื่อ immutable
- ห้ามเปิดข้อมูลติดต่อใน feed

## Phase 4 — Work Order, Appointment, Chat, Evidence และ Acceptance

ระยะเวลาโดยประมาณ: 3–4 สัปดาห์

### สิ่งที่ต้องทำ

1. เปลี่ยนคำขอที่เลือกช่างแล้วเป็น service_job พร้อม snapshot ของราคา/คอมมิชชัน/เงื่อนไข
2. สร้าง appointments, append-only job_status_events และ transition service ที่ตรวจสิทธิ์
3. สร้าง chat_rooms, memberships และ durable messages พร้อม private Realtime Broadcast
4. ทำรูปก่อน–ระหว่าง–หลังงาน, PIN เริ่ม/จบ และคำขอเพิ่มงานที่ลูกค้าต้องอนุมัติ
5. ทำ push notifications และ deep links ไปยังงาน
6. ใช้ foreground location/ETA ระหว่างเดินทาง; ยังไม่ทำ background tracking ต่อเนื่อง
7. ทำการตรวจรับและเปิดหน้าต่าง 48 ชั่วโมงตามนโยบาย โดยยังใช้ payment sandbox/fake adapter ได้

### เอกสารและ pattern ที่ต้องคัดลอก

- Expo Notifications registration/deep link: [Push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Notification navigation](https://docs.expo.dev/versions/latest/sdk/notifications/#handle-push-notifications-with-navigation)
- Foreground location: [Expo Location](https://docs.expo.dev/versions/latest/sdk/location/)
- Durable chat + private Broadcast: [Subscribing to database changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes), [Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- State/evidence policy: [`PRODUCT-BRIEF.md`](../PRODUCT-BRIEF.md), ส่วน 5, 6 และ 8

### Verification checklist

- ทุก transition ที่สำคัญบันทึก actor, เวลา, เหตุผล และ Audit Log ตามกฎ
- ข้ามสถานะหรือเปลี่ยนงานของคนอื่นผ่าน direct API ไม่ได้
- ข้อความเก็บถาวรใน messages; Realtime เป็น delivery channel ไม่ใช่ source of truth
- unmount screen แล้ว remove Realtime channel/subscription
- งานเพิ่มไม่เริ่มจนลูกค้ากดยืนยันขอบเขตและราคา
- PIN และหลักฐานก่อน–หลังสัมพันธ์กับงานและผู้ทำจริง
- push tap เปิด deep link ของงานถูกต้องบน development build

### Anti-pattern guards

- ห้ามใช้ Presence สำหรับตำแหน่งถี่ๆ หรือเป็นหลักฐานงาน
- ห้ามใช้ Realtime payload แทน durable database record
- ห้ามทำ background location ใน MVP โดยยังไม่มี privacy/battery/store-review proof
- ห้ามแก้ประวัติสถานะย้อนหลัง; ใช้ append-only events

## Phase 5 — Payment, Ledger, Commission, Warranty และ Dispute

ระยะเวลาโดยประมาณ: 3–5 สัปดาห์ และเริ่มได้เมื่อ Phase 0 payment/legal gate ผ่านแล้ว

### สิ่งที่ต้องทำ

1. Implement provider adapter และ sandbox flow สำหรับ authorize/charge, webhook, refund และ payout/release ตามความสามารถจริงของ provider
2. สร้าง payment ledger แบบ append-only แยกค่าแรง ค่าวัสดุ คอมมิชชัน 15% refund และยอดรับสุทธิ
3. ทำ idempotent webhook processing และ reconciliation job
4. ทำการตรวจรับ, auto-release หลัง 48 ชั่วโมง, payout hold เมื่อเปิดข้อร้องเรียน และ admin override พร้อม Audit Log
5. ทำ cancellation/no-show/refund matrix ที่ตั้งค่าได้
6. ทำ reviews, warranty claims, complaints และ disputes เชื่อมกับงานเดิม
7. ทำ Admin การเงินแบบ least privilege; แยกสิทธิ์ดู/ระงับ/คืน/ปล่อยยอด

### เอกสารและ pattern ที่ต้องคัดลอก

- Privileged workflows ใน Supabase Edge Functions: [Functions quickstart](https://supabase.com/docs/guides/functions/quickstart), [Function auth](https://supabase.com/docs/guides/functions/auth)
- Next.js Route Handlers เฉพาะ HTTP integrations/webhooks: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- Server Action security สำหรับ admin-triggered mutations: [Authentication](https://nextjs.org/docs/app/guides/authentication)
- Financial rules: [`PRODUCT-BRIEF.md`](../PRODUCT-BRIEF.md), ส่วน 6.1, 7, 8 และ 10
- Payment provider docs ที่เลือกใน Phase 0 ต้องเป็น source หลักของ signature, idempotency และ refund APIs

### Verification checklist

- duplicate/out-of-order webhook ไม่สร้างยอดซ้ำ
- ledger รวมยอดได้ตรงกับ provider sandbox และแก้ย้อนหลังด้วย compensating entry ไม่แก้ row เดิม
- คอมมิชชันคิดจากค่าแรงเท่านั้นและ rate ถูก snapshot เมื่องานยืนยัน
- ข้อร้องเรียนก่อน release ระงับเฉพาะงานนั้น
- refund recalculates payout/commission ตามส่วนที่คืน
- ทุก admin financial action ต้องมี permission, เหตุผล และ Audit Log
- reconciliation ระบุยอดไม่ตรงและแจ้งเตือนได้

### Anti-pattern guards

- ห้ามคำนวณยอดสำคัญจาก client
- ห้ามเก็บเลขบัตรหรือข้อมูล payment credential ใน HomeCare
- ห้ามเชื่อ webhook ที่ไม่ผ่าน signature verification
- ห้ามใช้ update/delete กับ financial ledger เพื่อแก้ประวัติ
- ห้ามเขียน gateway-specific logic กระจายทั่ว domain

## Phase 6 — Verification, Security และ Pilot Release

ระยะเวลาโดยประมาณ: 2–3 สัปดาห์

### สิ่งที่ต้องทำ

1. Unit tests สำหรับ validation, state transition, price, commission, cancellation และ warranty rules
2. Database/RLS tests สำหรับลูกค้า ช่าง ผู้ดูแล และ unauthorized callers
3. Component tests ของ Mobile/Admin และ E2E critical flows
4. Accessibility review: contrast, 44×44 touch target, dynamic text, labels, error states, Reduce Motion
5. Security review: secret separation, RLS, Storage policies, webhook signatures, rate limits, CAPTCHA/OTP abuse, audit access
6. สร้าง EAS development/preview/production profiles และ physical-device test matrix
7. ตั้ง staging, monitoring, error reporting, backup/restore drill และ operational runbook
8. เปิด pilot เฉพาะเขตที่กำหนด พร้อม manual support และ kill switches สำหรับ payment/matching/content

### เอกสารและ pattern ที่ต้องคัดลอก

- Expo Jest/Testing Library: [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)
- React Native test pyramid: [Testing overview](https://reactnative.dev/docs/testing-overview)
- EAS profiles/builds: [EAS Build setup](https://docs.expo.dev/build/setup/), [eas.json](https://docs.expo.dev/eas/json/)
- Supabase DB/RLS tests: [Testing overview](https://supabase.com/docs/guides/local-development/testing/overview), [Database testing](https://supabase.com/docs/guides/database/testing)
- Next.js Vitest/Playwright: [Testing](https://nextjs.org/docs/app/guides/testing), [Production checklist](https://nextjs.org/docs/app/guides/production-checklist)

### Verification checklist

- Mobile: lint, typecheck, Jest/component tests และ critical E2E ผ่านบน Android/iOS จริง
- Admin: `pnpm lint`, `pnpm test`, `pnpm build`, Playwright ผ่าน
- Backend: `supabase db reset`, `supabase test db`, `supabase db lint --level error` ผ่าน
- unauthenticated/unauthorized callers อ่านหรือเปลี่ยนข้อมูลข้ามบทบาทไม่ได้
- camera, image picker, notifications, foreground location และ deep links ผ่านบน physical devices
- restore backup ใน staging ได้จริงและ runbook ผ่านการซ้อม
- ไม่มี P0/P1 security, payment หรือ data-loss defect ก่อน pilot

### Anti-pattern guards

- ห้ามถือว่า simulator เพียงพอสำหรับ camera, push, biometric หรือ location
- ห้ามเปิด production โดยไม่มี monitoring, backup restore และคนรับผิดชอบ incident
- ห้ามใช้ OTA update กับการเปลี่ยน native permission/dependency; ต้องสร้าง binary ใหม่
- ห้ามขยายพื้นที่ก่อน KPI และ supply ช่างในเขตนำร่องผ่านเกณฑ์

## Phase 7 — Pilot Metrics และ Iteration

ระยะเวลา: 4–8 สัปดาห์แรกหลังเปิด pilot

ติดตามอย่างน้อย: request-to-match rate, เวลาจนได้ shortlist, quote acceptance, completion, cancellation แยกฝ่าย, dispute/warranty rate, repeat usage, active technicians, contribution margin ต่อ job และเหตุการณ์ที่ทีมต้องแก้ manual

ทุก 1–2 สัปดาห์ให้เลือกแก้ bottleneck ใหญ่ที่สุดหนึ่งเรื่องก่อนเพิ่มฟีเจอร์ใหม่ การเพิ่มหมวด พื้นที่ ทีมช่าง ระบบองค์กร โปรโมชัน หรือ AI ต้องมีข้อมูลจาก pilot รองรับ

## Definition of Done สำหรับทุก Phase

- ใช้คำศัพท์ตาม `CONTEXT.md` และข้อความภาษาไทยผ่าน translation keys
- มี loading, empty, error, offline/retry และ permission-denied states ที่เกี่ยวข้อง
- Authorization อยู่ทั้งใกล้ operation และใน RLS; UI visibility ไม่ถือเป็น security
- การเปลี่ยนแปลงสำคัญมี Audit Log และการเงินเป็น append-only ledger
- Tests ครอบคลุมทั้ง happy path และ unauthorized/invalid-state path
- เอกสาร API ที่ใช้ตรงกับเวอร์ชันติดตั้งจริง; ไม่มี method หรือ parameter ที่คิดขึ้นเอง
- ผ่าน checklist ของ phase ก่อนเริ่ม phaseที่พึ่งพากัน

## ลำดับที่แนะนำให้ทำทันทีใน 7 วันถัดไป

1. กำหนดเกณฑ์และขอบเขตของพื้นที่นำร่อง พร้อมผู้รับผิดชอบ operation โดยยังไม่ต้องระบุชื่อจังหวัดหรือเขต
2. ทำรายการบริการจริง 10–15 รายการใน 3 หมวด พร้อมราคา/คำถาม/รับประกัน
3. รับสมัครช่างนำร่อง 5–10 คนและตรวจเอกสารด้วยกระบวนการ manual
4. สัมภาษณ์ลูกค้า 10–20 คนและทดลองงานจริงชุดแรก
5. ขอข้อมูล sandbox/technical docs จาก SMS และ Payment Gateway อย่างน้อย 2 ราย
6. สร้าง work-state transition table, permission matrix และ Audit Log event list
7. เมื่อ gate ผ่านแล้วจึงเริ่ม Phase 1 scaffold และ vertical slice การอนุมัติช่าง

## ประมาณการภาพรวม

สำหรับทีมเล็ก 2–4 คน MVP จนพร้อม pilot ใช้เวลาประมาณ 14–21 สัปดาห์หลังผ่าน Phase 0 โดย Payment/Legal, จำนวนช่างนำร่อง และคุณภาพข้อมูลบริการเป็นตัวแปรที่มีผลต่อกำหนดการมากที่สุด
