import type { AdminDashboardScaffold } from '@/data/admin-dashboard-scaffold';

type ReadinessItem = AdminDashboardScaffold['readinessItems'][number];

export const adminMetadataTh = {
  title: 'HomeCare | ผู้ดูแล',
  description: 'ศูนย์จัดการตลาดบริการ HomeCare',
} as const;

export type AdminDashboardCopy = Readonly<{
  brand: string;
  title: string;
  description: string;
  environmentLabel: string;
  readinessTitle: string;
  readinessDescription: string;
  reviewCatalogAction: string;
  reviewQueueLabel: string;
  readinessLabels: Readonly<Record<ReadinessItem['id'], string>>;
  readinessValues: Readonly<Record<ReadinessItem['value'], string>>;
  readinessStatuses: Readonly<Record<ReadinessItem['status'], string>>;
  reviewQueue: Readonly<
    Record<
      AdminDashboardScaffold['reviewQueueStatus'],
      Readonly<{ title: string; description: string }>
    >
  >;
}>;

export const adminDashboardCopyTh: AdminDashboardCopy = {
  brand: 'HOMECARE OPERATIONS',
  title: 'ศูนย์จัดการ HomeCare',
  description: 'ตรวจความพร้อมของบริการ ช่าง และการเปิดให้บริการจากจุดเดียว',
  environmentLabel: 'โหมดพัฒนา',
  readinessTitle: 'ความพร้อมเบื้องต้น',
  readinessDescription:
    'ข้อมูล scaffold ยังไม่เปิดขายและต้องเปลี่ยนเป็นข้อมูลจากระบบ',
  reviewCatalogAction: 'ตรวจรายการบริการ',
  reviewQueueLabel: 'คิวตรวจสอบช่าง',
  readinessLabels: {
    catalog: 'รายการบริการ',
    'technician-review': 'การตรวจสอบช่าง',
    'launch-readiness': 'ความพร้อมเปิดบริการ',
  },
  readinessValues: {
    draft: 'ฉบับร่าง',
    empty: 'ยังไม่มีคำขอ',
    disabled: 'ยังไม่เปิดใช้งาน',
  },
  readinessStatuses: {
    awaiting_review: 'รอตรวจสอบ',
    ready_for_submission: 'พร้อมรับข้อมูล',
    awaiting_confirmation: 'รอยืนยัน',
  },
  reviewQueue: {
    empty: {
      title: 'ยังไม่มีคำขอรอตรวจ',
      description:
        'เมื่อช่างส่งเอกสาร ระบบจะแสดงรายการพร้อมประวัติการตรวจสอบย้อนหลัง',
    },
  },
};
