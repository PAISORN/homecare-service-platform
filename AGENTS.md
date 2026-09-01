# HomeCare agent instructions

- ก่อนเริ่มงานหลายขั้นตอนหรือสร้าง deliverable ให้เปิดอ่านและใช้ `C:\Users\User\.codex\skills\task-observer\SKILL.md` และตรวจ `skill-observations/log.md`
- อ่าน `CONTEXT.md`, `docs/PRODUCT-BRIEF.md`, `docs/adr/` และ `design-system/homecare/MASTER.md` ก่อนเปลี่ยน domain, architecture หรือ UI
- ใช้คำศัพท์ canonical ใน `CONTEXT.md`
- เปลี่ยนฐานข้อมูลผ่าน `supabase/migrations/` เท่านั้น และต้องมี RLS สำหรับตารางใน `public`
- ห้ามใส่ service-role key ใน mobile, Client Component, `EXPO_PUBLIC_*` หรือ `NEXT_PUBLIC_*`
- ห้ามใช้ raw hex ใน UI component; ใช้ `@homecare/design-tokens`
- ราคาและพื้นที่บริการต้องเป็นข้อมูลที่ตั้งค่าได้ ไม่ฝังเป็น business rule ใน UI
