import type { ServiceCategoryCode } from '@homecare/domain/database';

export type MobileHomeCopy = Readonly<{
  brand: string;
  title: string;
  description: string;
  requestService: string;
  account: string;
  pilotServicesTitle: string;
  viewService: string;
  viewServiceAccessibilityLabel: (categoryLabel: string) => string;
  categoryLabels: Readonly<Record<ServiceCategoryCode, string>>;
  availability: Readonly<
    Record<'preparing', Readonly<{ title: string; description: string }>>
  >;
}>;

export const mobileHomeCopyTh: MobileHomeCopy = {
  brand: 'HOMECARE',
  title: 'ดูแลบ้านได้อย่างมั่นใจ',
  description:
    'เลือกบริการหรือค้นหาช่างที่ผ่านการตรวจสอบ งานทุกชิ้นมีขอบเขต ราคา และหลักฐานที่ตรวจสอบได้',
  requestService: 'เริ่มขอรับบริการ',
  account: 'บัญชีของฉัน',
  pilotServicesTitle: 'บริการนำร่อง',
  viewService: 'ดูบริการ',
  viewServiceAccessibilityLabel: (categoryLabel) => `ดูบริการ ${categoryLabel}`,
  categoryLabels: {
    'AIR-CONDITIONING': 'ล้างและซ่อมแอร์',
    PLUMBING: 'งานประปา',
    ELECTRICAL: 'งานไฟฟ้า',
  },
  availability: {
    preparing: {
      title: 'กำลังเตรียมบริการนำร่อง',
      description: 'รายละเอียดการเปิดให้บริการจะแสดงเมื่อผ่านการตรวจความพร้อม',
    },
  },
};

export const authCopyTh = {
  brand: 'HOMECARE',
  phone: {
    title: 'เข้าสู่ระบบด้วยเบอร์โทร',
    description: 'เราจะส่งรหัส OTP ทาง SMS เพื่อยืนยันเบอร์โทรของคุณ',
    label: 'เบอร์โทรศัพท์',
    placeholder: '081-234-5678',
    helper: 'ใช้เบอร์มือถือไทย 10 หลัก',
    submit: 'ขอรหัส OTP',
    submitting: 'กำลังส่งรหัส…',
    invalid: 'กรุณากรอกเบอร์มือถือไทยให้ครบ 10 หลัก',
    requestFailed: 'ส่งรหัสไม่สำเร็จ กรุณาตรวจเบอร์แล้วลองอีกครั้ง',
  },
  otp: {
    title: 'กรอกรหัส OTP',
    description: (phone: string) => `รหัส 6 หลักถูกส่งไปที่ ${phone}`,
    label: 'รหัส OTP 6 หลัก',
    placeholder: '000000',
    submit: 'ยืนยันและเข้าสู่ระบบ',
    submitting: 'กำลังตรวจสอบ…',
    invalid: 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก',
    verifyFailed: 'รหัสไม่ถูกต้องหรือหมดอายุ กรุณาลองใหม่',
    resend: 'ส่งรหัสอีกครั้ง',
    resending: 'กำลังส่งรหัส…',
    resendCountdown: (seconds: number) =>
      `ส่งรหัสอีกครั้งได้ใน ${seconds} วินาที`,
    resendFailed: 'ส่งรหัสใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง',
    changePhone: 'เปลี่ยนเบอร์โทร',
    missingPhone: 'กรุณากรอกเบอร์โทรก่อนขอรหัส OTP',
  },
} as const;

export const sessionCopyTh = {
  loading: 'กำลังตรวจสอบบัญชี…',
  configTitle: 'ยังไม่ได้เชื่อมต่อระบบ',
  configDescription:
    'ตั้งค่า Supabase URL และ publishable key ในไฟล์ environment แล้วเปิดแอปใหม่',
  blockedTitle: 'บัญชีนี้ไม่พร้อมใช้งาน',
  blockedDescription:
    'บัญชีอาจถูกปิดใช้งานหรือข้อมูลบัญชียังไม่พร้อม กรุณาติดต่อ HomeCare',
  signOut: 'ออกจากระบบ',
} as const;

export const accountCopyTh = {
  title: 'บัญชีของฉัน',
  customerRole: 'ลูกค้า',
  displayNameLabel: 'ชื่อที่ใช้ติดต่อ',
  phoneLabel: 'เบอร์โทรศัพท์',
  editName: 'แก้ไขชื่อ',
  serviceLocationsTitle: 'สถานที่รับบริการ',
  serviceLocationsDescription:
    'บันทึกบ้าน คอนโด หรือสถานที่ที่ต้องการให้ช่างเข้าให้บริการ',
  manageServiceLocations: 'จัดการสถานที่',
  saveName: 'บันทึกชื่อ',
  savingName: 'กำลังบันทึก…',
  invalidName: 'กรุณากรอกชื่อ 1–120 ตัวอักษร',
  saveFailed: 'บันทึกชื่อไม่สำเร็จ กรุณาลองอีกครั้ง',
  technicianTitle: 'สมัครเป็นช่าง',
  technicianDescription:
    'สร้างใบสมัครช่างโดยยังใช้บัญชีนี้เป็นลูกค้าได้ตามปกติ',
  startApplication: 'เริ่มสมัครเป็นช่าง',
  startingApplication: 'กำลังสร้างใบสมัคร…',
  applicationFailed: 'สร้างใบสมัครไม่สำเร็จ กรุณาลองอีกครั้ง',
  applicationStatusLabel: 'สถานะใบสมัครช่าง',
  applicationStatuses: {
    draft: 'แบบร่าง',
    pending_review: 'รอตรวจสอบ',
    verified: 'ผ่านการตรวจสอบ',
    rejected: 'ไม่ผ่านการตรวจสอบ',
    suspended: 'ถูกระงับ',
  },
  technicianModeLocked: 'โหมดช่างจะเปิดเมื่อผ่านการตรวจสอบแล้วเท่านั้น',
  technicianModeReady: 'บัญชีนี้พร้อมใช้งานโหมดช่าง',
  backHome: 'กลับหน้าหลัก',
  signOut: 'ออกจากระบบ',
} as const;

export const serviceLocationCopyTh = {
  title: 'สถานที่รับบริการ',
  description:
    'เพิ่มได้หลายแห่งและเลือกหนึ่งแห่งเป็นสถานที่หลัก ที่อยู่จะแสดงแก่ช่างเมื่อเกิดการจับคู่ตามขั้นตอนของ HomeCare เท่านั้น',
  add: 'เพิ่มสถานที่',
  emptyTitle: 'ยังไม่มีสถานที่รับบริการ',
  emptyBody: 'เพิ่มสถานที่แรกเพื่อเตรียมพร้อมสำหรับการขอรับบริการ',
  defaultBadge: 'สถานที่หลัก',
  setDefault: 'ตั้งเป็นสถานที่หลัก',
  edit: 'แก้ไข',
  remove: 'ลบ',
  removeTitle: 'ลบสถานที่นี้หรือไม่',
  removeBody: (label: string) =>
    `สถานที่ “${label}” จะถูกลบออกจากบัญชี หากเป็นสถานที่หลัก ระบบจะเลือกแห่งที่เก่าที่สุดแทน`,
  cancel: 'ยกเลิก',
  confirmRemove: 'ลบสถานที่',
  loading: 'กำลังโหลดสถานที่…',
  loadFailed: 'โหลดสถานที่ไม่สำเร็จ กรุณาลองอีกครั้ง',
  actionFailed: 'ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  back: 'ย้อนกลับ',
  newTitle: 'เพิ่มสถานที่รับบริการ',
  editTitle: 'แก้ไขสถานที่รับบริการ',
  formDescription:
    'กรอกที่อยู่ให้ช่างค้นหาหน้างานได้ชัดเจน โดยยังไม่ต้องปักหมุดหรือเลือกเขตบริการในขั้นตอนนี้',
  labelLabel: 'ชื่อเรียกสถานที่',
  labelPlaceholder: 'เช่น บ้าน, คอนโด, ร้าน',
  addressLabel: 'ที่อยู่',
  addressPlaceholder: 'บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์',
  buildingLabel: 'อาคารหรือหมู่บ้าน (ไม่บังคับ)',
  floorLabel: 'ชั้น (ไม่บังคับ)',
  unitLabel: 'ห้องหรือยูนิต (ไม่บังคับ)',
  accessLabel: 'คำแนะนำการเข้าถึง (ไม่บังคับ)',
  accessPlaceholder: 'เช่น โทรก่อนถึง แลกบัตรที่ป้อม หรือจอดรถด้านหลัง',
  makeDefault: 'ใช้เป็นสถานที่หลัก',
  defaultLocked: 'สถานที่นี้เป็นสถานที่หลักอยู่แล้ว',
  required: 'กรุณากรอกข้อมูลนี้',
  tooLong: 'ข้อความยาวเกินจำนวนที่กำหนด',
  save: 'บันทึกสถานที่',
  saving: 'กำลังบันทึก…',
  saveFailed: 'บันทึกสถานที่ไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง',
  notFound: 'ไม่พบสถานที่นี้ หรือบัญชีไม่มีสิทธิ์เข้าถึง',
} as const;

export const navigationCopyTh = {
  home: 'หน้าหลัก',
  account: 'บัญชี',
} as const;

export const technicianApplicationCopyTh = {
  hubTitle: 'ใบสมัครช่าง',
  hubDescription:
    'เตรียมโปรไฟล์และเอกสารยืนยันตัวตน ก่อนส่งให้ทีม HomeCare ตรวจสอบ',
  profileTitle: 'แนะนำตัวและประสบการณ์',
  profileDescription:
    'เขียนสั้น ๆ ว่าคุณถนัดงานประเภทใดและมีประสบการณ์อย่างไร ไม่ต้องระบุพื้นที่บริการในขั้นตอนนี้',
  profileLabel: 'ข้อความแนะนำตัว',
  profilePlaceholder: 'เช่น มีประสบการณ์ล้างและซ่อมแอร์ที่อยู่อาศัย 5 ปี',
  profileHelper: 'ไม่เกิน 500 ตัวอักษร และไม่ใส่เลขบัตรหรือข้อมูลเอกสาร',
  profileInvalid: 'ข้อความแนะนำตัวยาวเกิน 500 ตัวอักษร',
  save: 'บันทึกข้อมูล',
  saving: 'กำลังบันทึก…',
  saveFailed: 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
  documentsTitle: 'เอกสารยืนยันตัวตน',
  documentsDescription:
    'อัปโหลดเฉพาะบัตรประชาชนของคุณและภาพใบหน้าปัจจุบัน ไฟล์จะอยู่ในพื้นที่ส่วนตัวและใช้เพื่อการตรวจสอบเท่านั้น',
  nationalId: 'บัตรประชาชน',
  selfie: 'ภาพใบหน้า',
  required: 'จำเป็น',
  uploaded: 'อัปโหลดแล้ว',
  missing: 'ยังไม่ได้อัปโหลด',
  choosePhoto: 'เลือกจากเครื่อง',
  takePhoto: 'ถ่ายรูป',
  replacePhoto: 'เปลี่ยนรูป',
  uploading: 'กำลังอัปโหลด…',
  uploadPhoto: 'อัปโหลดรูปนี้',
  imageRules: 'รองรับ JPG หรือ PNG ขนาดไม่เกิน 6 MB',
  imageInvalid: 'ใช้ได้เฉพาะรูป JPG หรือ PNG ขนาดไม่เกิน 6 MB',
  permissionDenied: 'กรุณาอนุญาตการใช้กล้องก่อนถ่ายรูป',
  pickFailed: 'เปิดรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
  uploadFailed: 'อัปโหลดไม่สำเร็จ กรุณาเลือกรูปแล้วลองอีกครั้ง',
  reviewTitle: 'ตรวจสอบและส่งใบสมัคร',
  reviewDescription:
    'ตรวจให้ครบก่อนส่ง หลังส่งแล้วจะเปลี่ยนเอกสารเองไม่ได้จนกว่าทีม HomeCare จะตรวจเสร็จ',
  retentionTitle: 'การเก็บรักษาเอกสาร',
  retentionNotice:
    'หลังส่งตรวจ เอกสารและประวัติการตรวจจะถูกเก็บไว้และคุณจะลบเองไม่ได้ ขณะนี้ระยะเวลาเก็บและกระบวนการขอลบตามกฎหมายยังรอการอนุมัติก่อนเปิดนำร่อง หากต้องการความช่วยเหลือให้ติดต่อ HomeCare',
  acknowledgeBeforeUpload:
    'อ่านและรับทราบคำชี้แจงนี้ก่อนเลือกหรือถ่ายรูปเอกสาร ระบบจะบันทึกเวอร์ชันและเวลาที่รับทราบไว้เพื่อการตรวจสอบ',
  acknowledgeAndContinue: 'รับทราบและดำเนินการต่อ',
  acknowledging: 'กำลังบันทึก…',
  acknowledgementFailed:
    'บันทึกการรับทราบไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง',
  acknowledgement:
    'ฉันเข้าใจว่าเอกสารจะถูกเก็บในพื้นที่ส่วนตัวเพื่อการตรวจสอบ และข้อกำหนดการลบยังอยู่ระหว่างจัดทำ',
  acknowledged: 'รับทราบแล้ว',
  notAcknowledged: 'แตะเพื่อรับทราบ',
  submit: 'ส่งใบสมัครให้ตรวจสอบ',
  submitting: 'กำลังส่ง…',
  submitFailed: 'ส่งใบสมัครไม่สำเร็จ กรุณาตรวจเอกสารแล้วลองอีกครั้ง',
  notReady: 'ต้องอัปโหลดบัตรประชาชนและภาพใบหน้าให้ครบก่อน',
  pendingTitle: 'ส่งใบสมัครแล้ว',
  pendingBody: 'ทีม HomeCare กำลังตรวจสอบ คุณยังใช้บัญชีลูกค้าได้ตามปกติ',
  verifiedTitle: 'ผ่านการตรวจสอบแล้ว',
  verifiedBody: 'บัญชีนี้พร้อมใช้โหมดช่าง',
  rejectedTitle: 'ใบสมัครไม่ผ่านการตรวจสอบ',
  rejectedBody:
    'เอกสารที่ส่งแล้วถูกเก็บไว้ตามนโยบาย กรุณาติดต่อ HomeCare หากต้องการความช่วยเหลือ',
  suspendedTitle: 'บัญชีช่างถูกระงับ',
  suspendedBody: 'คุณยังไม่สามารถใช้โหมดช่างได้ กรุณาติดต่อ HomeCare',
  openProfile: 'แก้ไขข้อความแนะนำตัว',
  openDocuments: 'จัดการเอกสารยืนยันตัวตน',
  openReview: 'ตรวจสอบก่อนส่ง',
  back: 'ย้อนกลับ',
  loadingDocuments: 'กำลังโหลดสถานะเอกสาร…',
  retry: 'ลองโหลดอีกครั้ง',
  refreshFailed: 'โหลดข้อมูลใบสมัครไม่สำเร็จ กรุณาลองอีกครั้ง',
} as const;
