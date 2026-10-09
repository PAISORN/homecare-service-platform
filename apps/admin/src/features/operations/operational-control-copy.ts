export type OperationalControlKey = 'matching' | 'content' | 'payment';

export const operationalControlCopy: Readonly<
  Record<
    OperationalControlKey,
    Readonly<{ title: string; description: string; effect: string }>
  >
> = {
  matching: {
    title: 'การจับคู่ช่าง',
    description: 'ควบคุมการส่งคำขอใหม่และการแสดงความสนใจรับงานของช่าง',
    effect:
      'เมื่อปิด ลูกค้ายังแก้ไขแบบร่างได้ และผู้เกี่ยวข้องยังยกเลิกหรือถอนความสนใจเดิมได้',
  },
  content: {
    title: 'ข้อความในงานบริการ',
    description: 'ควบคุมการส่งข้อความใหม่ระหว่างลูกค้าและช่าง',
    effect:
      'เมื่อปิด ประวัติห้องสนทนายังอ่านได้ แต่ระบบจะปฏิเสธข้อความใหม่ที่ฐานข้อมูล',
  },
  payment: {
    title: 'การชำระเงินจริง',
    description: 'สถานะความพร้อมของผู้ให้บริการชำระเงินและ webhook',
    effect:
      'Phase นี้ยังเป็น fake sandbox และฐานข้อมูลป้องกันการเปิดจนกว่าจะมี provider จริง',
  },
};

export function isOperationalControlKey(
  value: string,
): value is OperationalControlKey {
  return value === 'matching' || value === 'content' || value === 'payment';
}
