export const qualityCaseStatusLabels = {
  submitted: 'ส่งเรื่องแล้ว',
  under_review: 'กำลังตรวจสอบ',
  awaiting_customer: 'รอลูกค้า',
  awaiting_technician: 'รอช่าง',
  resolved: 'แก้ไขแล้ว',
  dismissed: 'ยุติเรื่อง',
  escalated: 'ข้อพิพาท',
} as const;

export const qualitySlaLabels = {
  on_track: 'อยู่ในเวลา',
  due_soon: 'ใกล้ครบกำหนด',
  overdue: 'เกินกำหนด',
  closed: 'หยุดจับเวลาแล้ว',
} as const;

export const qualityNextActorLabels = {
  homecare: 'HomeCare ดำเนินการ',
  customer: 'รอลูกค้า',
  technician: 'รอช่าง',
  none: 'ไม่มีรายการค้าง',
} as const;

export const qualityEventLabels: Readonly<Record<string, string>> = {
  submitted: 'ลูกค้าส่งเรื่อง',
  customer_responded: 'ลูกค้าเพิ่มข้อมูล',
  technician_responded: 'ช่างเพิ่มคำชี้แจง',
  admin_under_review: 'ผู้ดูแลเริ่มตรวจสอบ',
  admin_awaiting_customer: 'ผู้ดูแลขอข้อมูลจากลูกค้า',
  admin_awaiting_technician: 'ผู้ดูแลขอข้อมูลจากช่าง',
  admin_resolved: 'ผู้ดูแลตัดสินและแก้ไขเคส',
  admin_dismissed: 'ผู้ดูแลยุติเคส',
  escalated_to_dispute: 'ยกระดับเป็นข้อพิพาท',
  dispute_resolved: 'ข้อพิพาทได้รับการตัดสิน',
  sla_due_soon: 'ใกล้ครบกำหนด SLA',
  sla_overdue: 'เกินกำหนด SLA',
};

export function formatQualityDeadline(value: string | null) {
  if (!value) return 'ไม่มีกำหนดเวลา';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
