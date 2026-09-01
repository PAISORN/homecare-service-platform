import type { DocumentType, ReviewStatus } from './review-types';

export const documentTypeLabels: Readonly<Record<DocumentType, string>> = {
  national_id: 'บัตรประจำตัวประชาชน',
  selfie: 'ภาพถ่ายยืนยันตัวตน',
  professional_certificate: 'ใบรับรองวิชาชีพ',
  criminal_record: 'เอกสารตรวจสอบประวัติ',
  other: 'เอกสารประกอบอื่น',
};

export const reviewStatusLabels: Readonly<Record<ReviewStatus, string>> = {
  pending: 'รอตรวจ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

export const historyActionLabels: Readonly<Record<string, string>> = {
  'technician.profile_submitted': 'ช่างส่งใบสมัคร',
  'technician.document_reviewed': 'ผู้ดูแลตรวจเอกสาร',
  'technician.profile_decided': 'ผู้ดูแลสรุปผลใบสมัคร',
  'technician.kyc_notice_acknowledged': 'ช่างยอมรับประกาศการเก็บข้อมูล',
};

export function formatAdminDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}
