insert into public.service_categories (code, name_th, description_th, status, sort_order)
values
  ('AIR-CONDITIONING', 'เครื่องปรับอากาศ', 'งานล้าง ตรวจ และดูแลเครื่องปรับอากาศ', 'draft', 10),
  ('PLUMBING', 'ประปาและสุขภัณฑ์', 'งานติดตั้ง แก้อุดตัน และตรวจน้ำรั่ว', 'draft', 20),
  ('ELECTRICAL', 'ระบบไฟฟ้า', 'งานติดตั้งและตรวจความผิดปกติของระบบไฟฟ้า', 'draft', 30)
on conflict (code) do update set
  name_th = excluded.name_th,
  description_th = excluded.description_th,
  sort_order = excluded.sort_order;

insert into public.service_items (
  service_category_id,
  code,
  name_th,
  price_model,
  base_labor_price,
  warranty_days,
  status
)
select category.id, item.code, item.name_th, item.price_model::public.price_model,
  null, item.warranty_days, 'draft'::public.catalog_status
from (
  values
    ('AIR-CONDITIONING', 'AC-CLEAN-WALL', 'ล้างแอร์ติดผนัง', 'fixed', 30),
    ('AIR-CONDITIONING', 'AC-CLEAN-FLOOR-CEILING', 'ล้างแอร์แขวนใต้ฝ้าหรือตั้งพื้น', 'fixed', 30),
    ('AIR-CONDITIONING', 'AC-CLEAN-CASSETTE', 'ล้างแอร์ฝังฝ้าหรือสี่ทิศทาง', 'fixed', 30),
    ('AIR-CONDITIONING', 'AC-DRAIN-CLEAR', 'ล้างท่อน้ำทิ้งแอร์หรือแก้น้ำหยดจากการอุดตัน', 'fixed', 15),
    ('AIR-CONDITIONING', 'AC-FAULT-INSPECTION', 'ตรวจหาสาเหตุแอร์ผิดปกติ', 'onsite_inspection', null),
    ('PLUMBING', 'PL-FAUCET-REPLACE', 'เปลี่ยนก๊อกน้ำหรือก๊อกสนามจุดเดิม', 'fixed', 30),
    ('PLUMBING', 'PL-BIDET-REPLACE', 'เปลี่ยนสายฉีดชำระจุดเดิม', 'fixed', 30),
    ('PLUMBING', 'PL-TOILET-INSTALL', 'เปลี่ยนหรือติดตั้งโถสุขภัณฑ์ตำแหน่งเดิม', 'fixed', 30),
    ('PLUMBING', 'PL-DRAIN-UNCLOG', 'แก้อุดตันท่อระบายน้ำที่เข้าถึงได้', 'fixed', 7),
    ('PLUMBING', 'PL-LEAK-INSPECTION', 'ตรวจหาสาเหตุน้ำรั่วหรือแรงดันผิดปกติ', 'onsite_inspection', null),
    ('ELECTRICAL', 'EL-SOCKET-SWITCH-REPLACE', 'เปลี่ยนปลั๊กหรือสวิตช์ที่จุดเดิม', 'fixed', 30),
    ('ELECTRICAL', 'EL-SOCKET-SWITCH-SURFACE', 'ติดตั้งปลั๊กหรือสวิตช์ใหม่แบบเดินลอย', 'fixed', 30),
    ('ELECTRICAL', 'EL-LIGHT-INSTALL', 'ติดตั้งหรือเปลี่ยนโคมไฟที่จุดเดิม', 'fixed', 30),
    ('ELECTRICAL', 'EL-CEILING-FAN-INSTALL', 'ติดตั้งพัดลมเพดานที่จุดเดิม', 'fixed', 30),
    ('ELECTRICAL', 'EL-FAULT-INSPECTION', 'ตรวจไฟฟ้าผิดปกติหรือเบรกเกอร์ตัด', 'onsite_inspection', null)
) as item(category_code, code, name_th, price_model, warranty_days)
join public.service_categories category on category.code = item.category_code
on conflict (code) do update set
  service_category_id = excluded.service_category_id,
  name_th = excluded.name_th,
  price_model = excluded.price_model,
  warranty_days = excluded.warranty_days;
