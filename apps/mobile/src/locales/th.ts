import type { ServiceCategoryCode } from '@homecare/domain/database';

export type MobileHomeCopy = Readonly<{
  brand: string;
  title: string;
  description: string;
  requestService: string;
  serviceJobs: string;
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
  serviceJobs: 'งานบริการของฉัน',
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
      title: 'เปิดทดสอบการส่งคำขอแล้ว',
      description:
        'ลูกค้าส่งคำขอให้ช่างที่ผ่านการตรวจสอบและมีทักษะตรงกับหมวดงานได้ โดยยังไม่ใช้พื้นที่เป็นเงื่อนไขคัดกรอง',
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
  notificationsTitle: 'การแจ้งเตือนงานบริการ',
  notificationsDescription:
    'รับการอัปเดตสถานะงาน ข้อความ และคำขอเพิ่มงาน โดยแตะการแจ้งเตือนเพื่อเปิดงานที่เกี่ยวข้องได้ทันที',
  notificationStates: {
    checking: 'กำลังตรวจสอบสถานะการแจ้งเตือน…',
    permission_required: 'ยังไม่ได้อนุญาตให้ HomeCare ส่งการแจ้งเตือน',
    enabled: 'เปิดรับการแจ้งเตือนบนอุปกรณ์นี้แล้ว',
    disabled: 'ปิดการแจ้งเตือนจาก HomeCare บนอุปกรณ์นี้แล้ว',
    permission_denied:
      'อุปกรณ์ปิดสิทธิ์การแจ้งเตือน กรุณาเปิดสิทธิ์ให้ HomeCare ในการตั้งค่า',
    development_build_required:
      'Push Notification ต้องทดสอบด้วย HomeCare Development Build ไม่ใช่ Expo Go',
    configuration_required:
      'ยังไม่ได้เชื่อมแอปกับ EAS Project จึงยังสร้าง Push Token ไม่ได้',
    unsupported:
      'Push Notification ใช้ได้บนแอป HomeCare สำหรับ iOS และ Android',
    error: 'เชื่อมต่อบริการแจ้งเตือนไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
  enableNotifications: 'เปิดการแจ้งเตือน',
  enablingNotifications: 'กำลังเปิดการแจ้งเตือน…',
  disableNotifications: 'ปิดการแจ้งเตือนบนอุปกรณ์นี้',
  openNotificationSettings: 'เปิดการตั้งค่าอุปกรณ์',
  retryNotifications: 'ลองเชื่อมต่ออีกครั้ง',
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
  openTechnicianFeed: 'ดูงานที่เหมาะกับคุณ',
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
    'กรอกที่อยู่ให้ช่างค้นหาหน้างานได้ชัดเจน และปักหมุดตำแหน่งปัจจุบันเพื่อใช้คำนวณระยะทางระหว่างเดินทาง โดยยังไม่ต้องเลือกเขตบริการ',
  labelLabel: 'ชื่อเรียกสถานที่',
  labelPlaceholder: 'เช่น บ้าน, คอนโด, ร้าน',
  addressLabel: 'ที่อยู่',
  addressPlaceholder: 'บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์',
  buildingLabel: 'อาคารหรือหมู่บ้าน (ไม่บังคับ)',
  floorLabel: 'ชั้น (ไม่บังคับ)',
  unitLabel: 'ห้องหรือยูนิต (ไม่บังคับ)',
  accessLabel: 'คำแนะนำการเข้าถึง (ไม่บังคับ)',
  accessPlaceholder: 'เช่น โทรก่อนถึง แลกบัตรที่ป้อม หรือจอดรถด้านหลัง',
  pinTitle: 'ปักหมุดสถานที่ (แนะนำ)',
  pinDescription:
    'ใช้ตำแหน่งของโทรศัพท์ขณะเปิดหน้านี้ พิกัดจะบันทึกเมื่อกดบันทึกสถานที่',
  useCurrentLocation: 'ใช้ตำแหน่งปัจจุบัน',
  updateCurrentLocation: 'อัปเดตตำแหน่งปัจจุบัน',
  pinReady: 'พร้อมบันทึกพิกัดของสถานที่นี้',
  locationFailed:
    'อ่านตำแหน่งไม่สำเร็จ กรุณาเปิดบริการตำแหน่งและอนุญาตให้แอปเข้าถึงขณะใช้งาน',
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

export const technicianMatchingCopyTh = {
  back: 'ย้อนกลับ',
  title: 'งานที่เหมาะกับคุณ',
  description:
    'แสดงคำขอที่ตรงกับหมวดทักษะของคุณ โดยยังไม่ใช้พื้นที่หรือเวลาว่างเป็นเงื่อนไขในช่วงทดสอบนี้',
  openServiceJobs: 'ดูงานบริการที่ได้รับ',
  privacyTitle: 'ข้อมูลลูกค้ายังถูกปิดบัง',
  privacyBody:
    'ก่อนจับคู่ คุณจะไม่เห็นชื่อ เบอร์โทร ที่อยู่ รหัสสถานที่ รูปหน้างาน หรือข้อความอิสระของลูกค้า',
  selectedTitle: 'ข้อตกลงที่ต้องตรวจสอบ',
  selectedEmpty: 'ยังไม่มีคำขอที่เลือกคุณเป็นช่าง',
  selectedCustomer: (name: string) => `ลูกค้า ${name}`,
  selectedAppointment: (date: string, time: string) => `${date} · ${time}`,
  selectedNoAppointment: 'ยังไม่มีเวลานัดหมาย',
  selectedCompleted: 'ทั้งสองฝ่ายยืนยันแล้ว',
  selectedWaiting: 'กำลังรอการยืนยัน',
  openAgreement: 'ตรวจข้อตกลง',
  skillsTitle: 'หมวดงานที่ถนัด',
  skillsDescription: 'เลือกอย่างน้อยหนึ่งหมวดเพื่อรับงานที่ตรงกับทักษะ',
  feedTitle: 'คำขอที่กำลังหาช่าง',
  empty: 'ยังไม่มีคำขอที่ตรงกับหมวดทักษะของคุณ',
  selectSkillFirst: 'เลือกหมวดงานที่ถนัดก่อนเพื่อดูคำขอที่เหมาะกับคุณ',
  symptomRequest: 'ลูกค้าแจ้งอาการให้ช่วยประเมิน',
  quantity: (quantity: number) => `จำนวน ${quantity}`,
  urgency: {
    flexible: 'ยืดหยุ่นได้',
    within_3_days: 'ภายใน 3 วัน',
    as_soon_as_possible: 'เร็วที่สุดที่ว่าง',
  },
  expressInterest: 'แสดงความสนใจรับงาน',
  withdrawInterest: 'ถอนความสนใจ',
  createQuotation: 'ส่งใบเสนอราคา',
  editQuotation: 'แก้ไขใบเสนอราคา',
  quotationSubmitted: 'ส่งใบเสนอราคาแล้ว',
  quotationAmount: (amount: number) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      maximumFractionDigits: 0,
    }).format(amount),
  loadFailed: 'โหลดงานไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
} as const;

export const serviceRequestCopyTh = {
  catalogTitle: 'เลือกรายการบริการ',
  symptomCatalogTitle: 'เลือกหมวดอาการ',
  catalogDescription:
    'รายการอยู่ในช่วงทดลอง คุณบันทึกแบบร่างและยืนยันส่งให้ช่างที่มีทักษะตรงกับหมวดงานได้',
  symptomCatalogDescription: 'เลือกหมวดที่ใกล้เคียง แล้วเล่าอาการให้เราทราบ',
  noCatalog: 'ยังไม่มีรายการบริการที่พร้อมให้ทดลอง',
  choose: 'เลือก',
  draftsTitle: 'คำขอรับบริการของฉัน',
  draftsDescription:
    'แก้ไขแบบร่างหรือส่งคำขอให้ช่างที่ผ่านการตรวจสอบและมีทักษะตรงกับหมวดงาน',
  emptyDrafts: 'ยังไม่มีคำขอรับบริการ',
  newCatalogRequest: 'เลือกจากรายการบริการ',
  newSymptomRequest: 'แจ้งอาการให้ช่วยประเมิน',
  editDraft: 'แก้ไขแบบร่าง',
  draftStatus: 'แบบร่าง',
  matchingStatus: 'กำลังหาช่างที่เหมาะสม',
  technicianSelectedStatus: 'เลือกช่างแล้ว',
  viewShortlist: 'ดูรายชื่อช่างที่สนใจ',
  viewSelectedTechnician: 'ดูช่างที่เลือก',
  openAgreement: 'ตรวจและยืนยันข้อตกลง',
  submitRequest: 'ส่งคำขอ',
  submitTitle: 'ส่งคำขอให้ช่างหรือไม่',
  submitBody:
    'ช่างที่ผ่านการตรวจสอบและมีทักษะตรงกับหมวดงานจะเห็นเฉพาะข้อมูลแบบย่อ โดยยังไม่เห็นชื่อ เบอร์โทร และที่อยู่ของคุณ',
  confirmSubmit: 'ยืนยันส่งคำขอ',
  cancel: 'ยังไม่ส่ง',
  cancelRequest: 'ยกเลิกคำขอ',
  cancelRequestTitle: 'ยกเลิกการหาช่างหรือไม่',
  cancelRequestBody: 'คำขอนี้จะหยุดแสดงในงานที่เหมาะกับช่างทันที',
  keepRequest: 'เก็บคำขอไว้',
  confirmCancelRequest: 'ยืนยันยกเลิก',
  actionFailedTitle: 'ดำเนินการไม่สำเร็จ',
  actionFailedBody: 'กรุณาตรวจอินเทอร์เน็ตและสถานะคำขอ แล้วลองอีกครั้ง',
  formTitle: 'รายละเอียดคำขอรับบริการ',
  editFormTitle: 'แก้ไขคำขอรับบริการแบบร่าง',
  formDescription:
    'ข้อมูลนี้ช่วยเตรียมคำขอให้ชัดเจน ระบบจะยังไม่ส่งหาช่างจนกว่าคุณจะบันทึกและยืนยันส่งจากหน้าคำขอของฉัน',
  locationLabel: 'สถานที่รับบริการ',
  addLocation: 'เพิ่มสถานที่รับบริการ',
  locationRequired: 'กรุณาเลือกสถานที่รับบริการ',
  descriptionLabel: 'อาการหรือรายละเอียดที่ต้องการให้ช่างช่วย',
  descriptionPlaceholder: 'เช่น แอร์มีกลิ่นอับและไม่ได้ล้างมา 1 ปี',
  quantityLabel: 'จำนวนเครื่องหรือจำนวนจุด',
  urgencyLabel: 'ความเร่งด่วน',
  urgency: {
    flexible: 'ยืดหยุ่นได้',
    within_3_days: 'ภายใน 3 วัน',
    as_soon_as_possible: 'เร็วที่สุดที่ว่าง',
  },
  preferredDateLabel: 'วันที่สะดวก (ไม่บังคับ)',
  preferredDatePlaceholder: 'เลือกวันที่สะดวก',
  clearPreferredDate: 'ไม่ระบุวันที่',
  preferredTimeLabel: 'ช่วงเวลาที่สะดวก (ไม่บังคับ)',
  preferredTimePlaceholder: 'เช่น 09:00–12:00',
  safetyTitle: 'ตรวจความปลอดภัยก่อนบันทึก',
  safetyDescription: 'ตอบตามสภาพปัจจุบัน หากพบความเสี่ยง ระบบจะหยุดการจองปกติ',
  safetyQuestions: {
    fireSmoke: 'มีไฟ ควัน ประกายไฟต่อเนื่อง หรือกลิ่นไหม้รุนแรง',
    waterNearElectricity: 'มีน้ำรั่วหรือน้ำท่วมใกล้ปลั๊ก ตู้ไฟ หรือสายไฟ',
    externalPowerHazard: 'มีสายไฟภายนอกขาด เสาไฟล้ม หรือไฟดับทั้งบริเวณ',
    uncontrolledWater: 'มีน้ำไหลรุนแรงและปิดวาล์วไม่ได้',
    outOfScopeAccess:
      'งานต้องใช้นั่งร้าน โรยตัว ผู้ช่วย หรือเข้าพื้นที่อับอากาศ',
  },
  yes: 'มี',
  no: 'ไม่มี',
  safetyStopTitle: 'หยุดการจองปกติเพื่อความปลอดภัย',
  safetyStops: {
    FIRE_SMOKE:
      'ออกจากพื้นที่หากไม่ปลอดภัย โทรแจ้งเหตุเพลิงไหม้ 199 และอย่ารอช่าง HomeCare',
    WATER_NEAR_ELECTRICITY:
      'อย่าสัมผัสน้ำหรืออุปกรณ์ไฟฟ้า ตัดไฟเฉพาะเมื่อทำได้อย่างปลอดภัย และติดต่อหน่วยงานไฟฟ้า',
    EXTERNAL_POWER_HAZARD:
      'ติดต่อ MEA 1130 หรือ PEA 1129 ตามพื้นที่ผู้ใช้ไฟ ไม่สร้างงานช่างภายในบ้าน',
    UNCONTROLLED_WATER:
      'หลีกเลี่ยงพื้นที่ ปิดวาล์วเมนเมื่อปลอดภัย และติดต่อนิติบุคคลหรือหน่วยงานน้ำประปา',
    OUT_OF_SCOPE_ACCESS:
      'งานลักษณะนี้อยู่นอกขอบเขตบริการนำร่องและจะไม่ถูกส่งเป็นงานทั่วไป',
  },
  emergencyDisclaimer: 'HomeCare ไม่ใช่บริการฉุกเฉิน',
  photosLabel: 'รูปหน้างาน',
  photosHelper:
    'แนะนำอย่างน้อย 2 รูป: ภาพรวมและจุดที่ต้องการให้บริการ รองรับ JPG/PNG ไม่เกิน 6 MB ต่อรูป',
  choosePhotos: 'เลือกรูปจากเครื่อง',
  photoLimit: 'แนบได้สูงสุด 6 รูป',
  saveDraft: 'บันทึกแบบร่าง',
  savingDraft: 'กำลังบันทึก…',
  savedDraft: 'บันทึกแบบร่างแล้ว',
  saveFailed: 'บันทึกแบบร่างไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง',
  loadFailed: 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
  required: 'กรุณากรอกข้อมูลนี้',
  invalid: 'ข้อมูลไม่ถูกต้อง',
  tooLong: 'ข้อความยาวเกินจำนวนที่กำหนด',
  back: 'ย้อนกลับ',
  retry: 'ลองอีกครั้ง',
} as const;

export const requestShortlistCopyTh = {
  back: 'ย้อนกลับ',
  title: 'รายชื่อช่างที่สนใจ',
  description:
    'เปรียบเทียบช่างที่ผ่านการตรวจสอบสูงสุด 3 คน ราคาและขอบเขตงานที่แสดงเป็นข้อมูลเฉพาะคำขอนี้',
  rank: (rank: number) => `ลำดับ ${rank}`,
  verifiedBadge: 'ยืนยันตัวตนแล้ว',
  selectedBadge: 'ช่างที่เลือก',
  experience: (years: number) => `ประสบการณ์ ${years} ปี`,
  quotationTitle: 'ใบเสนอราคาแบบปิด',
  catalogPriceTitle: 'ราคาค่าแรงมาตรฐาน',
  waitingForQuotation: 'รอช่างส่งใบเสนอราคา จึงจะเลือกช่างคนนี้ได้',
  waitingForCatalogPrice:
    'ราคาค่าแรงมาตรฐานยังรอการอนุมัติ จึงยังเลือกช่างไม่ได้',
  chooseTechnician: 'เลือกช่างคนนี้',
  selectedNotice: 'คุณเลือกช่างคนนี้แล้ว ขั้นตอนยืนยันงานจะแสดงในระยะถัดไป',
  emptyTitle: 'ยังไม่มีช่างแสดงความสนใจ',
  emptyBody: 'เมื่อมีช่างที่เหมาะสมสนใจรับงาน รายชื่อจะปรากฏที่หน้านี้',
  loadFailed: 'โหลดรายชื่อช่างไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  confirmTitle: 'ยืนยันเลือกช่างคนนี้หรือไม่',
  confirmBody: (name: string, amount: string) =>
    `คุณกำลังเลือก ${name} ด้วยค่าแรง ${amount} หลังยืนยันจะเปลี่ยนเป็นช่างคนอื่นไม่ได้`,
  keepComparing: 'เปรียบเทียบต่อ',
  confirm: 'ยืนยันเลือกช่าง',
  selectedTitle: 'เลือกช่างแล้ว',
  selectedBody:
    'ระบบบันทึกช่างและราคาไว้แล้ว แต่ยังไม่สร้างงานบริการจนกว่าจะยืนยันขอบเขต ราคา และเวลานัดหมายครบถ้วน',
  selectFailedTitle: 'เลือกช่างไม่สำเร็จ',
  selectFailedBody:
    'รายชื่อหรือสถานะคำขออาจเปลี่ยนแล้ว กรุณาโหลดใหม่และลองอีกครั้ง',
} as const;

export const serviceAgreementCopyTh = {
  back: 'ย้อนกลับ',
  title: 'ยืนยันข้อตกลงงาน',
  description:
    'ตรวจขอบเขต ค่าแรง สถานที่ และนัดหมายให้ตรงกัน ทั้งสองฝ่ายต้องยืนยันข้อมูลฉบับเดียวกันก่อนเปิดงานบริการ',
  scopeTitle: 'ขอบเขตและค่าแรง',
  serviceLocationTitle: 'สถานที่รับบริการ',
  appointmentTitle: 'นัดหมาย',
  appointmentDescription:
    'ลูกค้าหรือช่างเสนอวันและช่วงเวลาได้ หากแก้ไข ระบบจะขอให้ทั้งสองฝ่ายยืนยันฉบับใหม่',
  dateLabel: 'วันที่นัดหมาย',
  datePlaceholder: 'เลือกวันที่นัดหมาย',
  clearDate: 'ล้างวันที่',
  timeLabel: 'ช่วงเวลานัดหมาย',
  timePlaceholder: 'เช่น 09:00–12:00',
  required: 'กรุณากรอกข้อมูลนี้',
  invalidDate: 'กรุณาเลือกวันนี้หรือวันที่ในอนาคต',
  invalidTime: 'ช่วงเวลาต้องไม่เกิน 80 ตัวอักษร',
  saveAppointment: 'เสนอเวลานัดหมาย',
  saving: 'กำลังบันทึก…',
  confirmationTitle: 'สถานะการยืนยัน',
  customerLabel: 'ลูกค้า',
  technicianLabel: 'ช่าง',
  confirmed: 'ยืนยันแล้ว',
  waiting: 'รอยืนยัน',
  changedNotice: 'ข้อมูลนัดหมายมีการแก้ไข กรุณาบันทึกก่อนยืนยัน',
  confirmAgreement: 'ยืนยันข้อตกลงฉบับนี้',
  confirmTitle: 'ยืนยันข้อตกลงหรือไม่',
  confirmBody:
    'คุณยืนยันขอบเขต ค่าแรง สถานที่ วันที่ และช่วงเวลาที่แสดงในหน้านี้',
  keepReviewing: 'ตรวจสอบต่อ',
  confirm: 'ยืนยัน',
  completedTitle: 'ทั้งสองฝ่ายยืนยันแล้ว',
  completedBody:
    'ข้อตกลงถูกล็อกแล้ว ระบบกำลังเตรียมข้อมูลงานบริการ กรุณาลองโหลดใหม่',
  jobNumber: (jobNumber: string) => `เลขงาน ${jobNumber}`,
  jobScheduled: (date: string, timeWindow: string) =>
    `นัดหมาย ${date} · ${timeWindow}`,
  openServiceJob: 'เปิดรายละเอียดงานบริการ',
  customerJobAmount: (amount: number, currency: string) =>
    `ยอดงานที่ยืนยัน ${new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)}`,
  technicianJobAmount: (
    laborAmount: number,
    commissionAmount: number,
    netAmount: number,
    currency: string,
  ) => {
    const formatter = new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    return `ค่าแรง ${formatter.format(laborAmount)} · ค่าคอมมิชชัน ${formatter.format(commissionAmount)} · รับสุทธิ ${formatter.format(netAmount)}`;
  },
  waitingOtherParty: 'คุณยืนยันแล้ว กำลังรออีกฝ่ายยืนยันข้อมูลฉบับเดียวกัน',
  loadFailed: 'โหลดข้อตกลงไม่สำเร็จ กรุณาตรวจสถานะคำขอแล้วลองอีกครั้ง',
  saveFailed: 'บันทึกเวลานัดหมายไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง',
  confirmFailed: 'ยืนยันข้อตกลงไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดแล้วลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  symptomRequest: 'คำขอจากการแจ้งอาการ',
  quantity: (quantity: number) => `จำนวน ${quantity}`,
  laborAmount: (amount: number, currency: string) =>
    new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount),
} as const;

export const serviceJobsCopyTh = {
  customerTitle: 'งานบริการของฉัน',
  customerDescription: 'ติดตามนัดหมาย สถานะงาน และรายละเอียดที่ยืนยันกับช่าง',
  technicianTitle: 'งานบริการที่ได้รับ',
  technicianDescription:
    'ดูนัดหมายและอัปเดตสถานะงานตามลำดับเมื่อปฏิบัติงานจริง',
  back: 'ย้อนกลับ',
  emptyCustomer: 'ยังไม่มีงานบริการที่ทั้งสองฝ่ายยืนยันแล้ว',
  emptyTechnician: 'ยังไม่มีงานบริการที่มอบหมายให้คุณ',
  loadFailed: 'โหลดรายการงานไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  symptomRequest: 'งานจากการแจ้งอาการ',
  counterpartCustomer: (name: string) => `ลูกค้า ${name}`,
  counterpartTechnician: (name: string) => `ช่าง ${name}`,
  appointment: (date: string, time: string) => `${date} · ${time}`,
  open: 'ดูรายละเอียดงาน',
  statusLabels: {
    scheduled: 'รอถึงเวลานัดหมาย',
    technician_en_route: 'ช่างกำลังเดินทาง',
    technician_arrived: 'ช่างถึงหน้างานแล้ว',
    in_progress: 'กำลังดำเนินงาน',
    awaiting_additional_work_approval: 'รออนุมัติงานเพิ่มเติม',
    awaiting_acceptance: 'รอตรวจรับ',
    completed: 'ตรวจรับเสร็จแล้ว',
    cancelled: 'ยกเลิกแล้ว',
  },
} as const;

export const serviceJobDetailCopyTh = {
  back: 'ย้อนกลับ',
  title: 'รายละเอียดงานบริการ',
  loadFailed:
    'โหลดรายละเอียดงานไม่สำเร็จ กรุณากลับไปที่รายการงานแล้วลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  symptomRequest: 'งานจากการแจ้งอาการ',
  appointmentTitle: 'นัดหมายและสถานที่',
  scopeTitle: 'ขอบเขตงาน',
  priceTitle: 'สรุปราคา',
  customerAmount: (amount: string) => `ยอดงานที่ยืนยัน ${amount}`,
  technicianAmount: (labor: string, commission: string, net: string) =>
    `ค่าแรง ${labor}\nค่าคอมมิชชัน ${commission}\nรับสุทธิ ${net}`,
  materialsAmount: (amount: string) => `ค่าวัสดุ ${amount}`,
  warranty: (days: number) => `รับประกันงาน ${days} วัน`,
  noWarranty: 'ยังไม่มีระยะเวลารับประกันสำหรับรายการนี้',
  accessInstructions: 'คำแนะนำการเข้าถึง',
  statusTitle: 'สถานะงาน',
  historyTitle: 'ประวัติสถานะ',
  changedBy: (name: string) => `ดำเนินการโดย ${name}`,
  initialEvent: 'เปิดงานบริการ',
  nextActions: {
    technician_en_route: 'เริ่มเดินทาง',
    technician_arrived: 'ถึงหน้างานแล้ว',
    in_progress: 'เริ่มดำเนินงาน',
  },
  confirmTransitionTitle: 'ยืนยันอัปเดตสถานะหรือไม่',
  confirmTransitionBody: 'สถานะนี้จะบันทึกในประวัติงานและย้อนกลับไม่ได้',
  keepReviewing: 'ตรวจสอบต่อ',
  confirm: 'ยืนยัน',
  transitionFailed: 'อัปเดตสถานะไม่สำเร็จ สถานะงานอาจเปลี่ยนแล้ว กรุณาโหลดใหม่',
  cancelTitle: 'ยกเลิกงานบริการ',
  cancelDescription:
    'ระบุเหตุผลให้ชัดเจน 10–500 ตัวอักษร เหตุผลจะแสดงให้อีกฝ่ายเห็นในประวัติงาน',
  cancelReasonLabel: 'เหตุผลการยกเลิก',
  cancelReasonPlaceholder: 'เช่น ไม่สะดวกตามเวลานัดหมายและต้องการยกเลิกงานนี้',
  cancelReasonInvalid: 'กรุณาระบุเหตุผล 10–500 ตัวอักษร',
  cancelButton: 'ยกเลิกงานนี้',
  cancelConfirmTitle: 'ยืนยันยกเลิกงานหรือไม่',
  cancelConfirmBody: 'เมื่อยืนยัน งานและนัดหมายจะถูกยกเลิกและย้อนกลับไม่ได้',
  keepJob: 'เก็บงานไว้',
  confirmCancel: 'ยืนยันยกเลิก',
  cancelFailed: 'ยกเลิกงานไม่สำเร็จ กรุณาโหลดสถานะล่าสุดแล้วลองอีกครั้ง',
  cancellationLockedCustomer:
    'เมื่องานเริ่มเดินทางแล้ว ลูกค้าต้องติดต่อทีม HomeCare เพื่อขอความช่วยเหลือ',
  cancellationLockedTechnician:
    'เมื่อถึงหน้างานแล้ว ช่างต้องติดต่อทีม HomeCare เพื่อขอความช่วยเหลือ',
  chatCustomer: 'แชตกับช่าง',
  chatTechnician: 'แชตกับลูกค้า',
  chatDescription: 'ข้อความจะเก็บไว้กับงานบริการเพื่อใช้อ้างอิงร่วมกัน',
  workFlow: 'หลักฐาน รูปงาน PIN และงานเพิ่มเติม',
  workFlowDescription:
    'จัดการขั้นตอนหน้างานที่ต้องยืนยันร่วมกันและตรวจสอบย้อนหลังได้',
} as const;

export const serviceJobAcceptanceCopyTh = {
  title: 'การตรวจรับงาน',
  sandboxTitle: 'โหมดทดสอบการชำระเงิน',
  sandboxBody:
    'ขั้นตอนนี้ใช้ระบบจำลองเท่านั้น ไม่มีการเรียกเก็บ ปล่อยยอด หรือโอนเงินจริง',
  statusLabels: {
    pending: 'อยู่ในช่วงตรวจรับ',
    help_requested: 'หยุดเวลาตรวจรับเพื่อขอความช่วยเหลือ',
    customer_accepted: 'ลูกค้ายืนยันตรวจรับแล้ว',
    automatic_accepted: 'ระบบตรวจรับเมื่อครบกำหนด',
  },
  deadline: (value: string) => `กำหนดตรวจรับ ${value}`,
  customerGuidance:
    'ตรวจรูปหลังงาน ขอบเขต ราคา และเงื่อนไขรับประกันก่อนยืนยัน การยืนยันจะบันทึกถาวรและย้อนกลับไม่ได้',
  technicianGuidance:
    'ลูกค้ากำลังตรวจหลักฐาน ขอบเขต ราคา และเงื่อนไขรับประกัน คุณยังไม่ต้องดำเนินการเพิ่ม',
  openEvidence: 'ดูหลักฐานและรูปหลังงาน',
  acceptAction: 'ยืนยันตรวจรับงาน',
  confirmTitle: 'ยืนยันตรวจรับงานหรือไม่',
  confirmBody:
    'โปรดยืนยันเมื่อผลงานตรงตามขอบเขต ราคา และเงื่อนไขที่ตกลงแล้ว การดำเนินการนี้ย้อนกลับไม่ได้',
  keepReviewing: 'ตรวจสอบต่อ',
  confirmAction: 'ยืนยันตรวจรับ',
  acceptedTitle: 'บันทึกการตรวจรับแล้ว',
  acceptedBody:
    'งานเปลี่ยนเป็นเสร็จสิ้นแล้ว แต่โหมดทดสอบนี้ยังไม่มีการเคลื่อนไหวของเงินจริง',
  helpAction: 'งานยังมีปัญหา',
  helpReasonLabel: 'รายละเอียดที่ต้องการให้ HomeCare ช่วย',
  helpReasonHelp:
    'การส่งข้อมูลจะหยุดการตรวจรับอัตโนมัติไว้ก่อน และยังไม่ใช่การเปิดข้อพิพาททางการเงิน',
  helpReasonPlaceholder:
    'เช่น ยังมีน้ำรั่วที่จุดเดิม และต้องการให้ช่วยตรวจสอบหลักฐานกับช่าง',
  helpReasonInvalid: 'กรุณาระบุรายละเอียด 10–1,000 ตัวอักษร',
  saveHelpAction: 'ส่งคำขอความช่วยเหลือ',
  helpSavedTitle: 'บันทึกคำขอแล้ว',
  helpSavedBody:
    'ระบบหยุดการตรวจรับอัตโนมัติไว้ก่อน ขั้นตอนจัดการข้อร้องเรียนเต็มรูปแบบจะเพิ่มใน Phase 5',
  helpRequestedBody:
    'ระบบหยุดการตรวจรับอัตโนมัติไว้ก่อน เพื่อรอขั้นตอนช่วยเหลือจาก HomeCare',
  customerAcceptedBody:
    'งานเสร็จสิ้นจากการยืนยันของลูกค้า และบันทึกเวลาไว้ในประวัติงานแล้ว',
  automaticAcceptedBody:
    'งานเสร็จสิ้นเมื่อครบช่วงตรวจรับโดยไม่มีการแจ้งปัญหา และบันทึกเวลาไว้แล้ว',
  loadFailed: 'โหลดข้อมูลตรวจรับไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  notAvailable: 'ยังไม่มีหน้าต่างตรวจรับสำหรับงานนี้',
  actionFailedTitle: 'ดำเนินการไม่สำเร็จ',
  actionFailedBody:
    'สถานะงานอาจเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุดและลองอีกครั้ง',
} as const;

export const serviceJobTravelCopyTh = {
  title: 'การเดินทางของช่าง',
  readyTitle: 'แชร์ตำแหน่งเมื่อพร้อมออกเดินทาง',
  readyBody:
    'ระบบใช้เฉพาะตำแหน่งล่าสุดขณะคุณเปิดหน้านี้ ไม่ติดตามเบื้องหลังและไม่เก็บเส้นทางย้อนหลัง',
  startSharing: 'เริ่มแชร์ตำแหน่งขณะเปิดหน้านี้',
  sharingTitle: 'กำลังแชร์ตำแหน่งล่าสุด',
  sharingBody:
    'เปิดหน้านี้ค้างไว้ระหว่างเดินทาง การแชร์จะหยุดเมื่อออกจากหน้า ปิดแอป หรือแอปอยู่เบื้องหลัง',
  stopSharing: 'หยุดแชร์ตำแหน่ง',
  shareFailed:
    'เริ่มแชร์ไม่ได้ กรุณาเปิดบริการตำแหน่งและอนุญาตให้แอปเข้าถึงขณะใช้งาน',
  publishFailed:
    'ส่งตำแหน่งล่าสุดไม่สำเร็จ ระบบจะลองใหม่เมื่อได้รับตำแหน่งครั้งถัดไป',
  customerActiveTitle: 'ช่างกำลังเดินทาง',
  customerWaitingTitle: 'กำลังรอตำแหน่งล่าสุดจากช่าง',
  customerWaitingBody:
    'เวลาโดยประมาณจะแสดงเมื่อช่างเปิดการแชร์ตำแหน่งระหว่างเดินทาง',
  destinationMissingTitle: 'ยังคำนวณเวลาเดินทางไม่ได้',
  destinationMissingBody:
    'นัดหมายนี้สร้างก่อนมีหมุดสถานที่ งานใหม่ที่ปักหมุดสถานที่จะคำนวณระยะทางและเวลาได้',
  loadFailed: 'โหลดตำแหน่งล่าสุดไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ',
} as const;

export const serviceJobWorkCopyTh = {
  back: 'ย้อนกลับ',
  title: 'หลักฐานและการยืนยันงาน',
  description: 'รูปและการยืนยันทั้งหมดผูกกับงานนี้และแก้ไขย้อนหลังไม่ได้',
  loadFailed: 'โหลดข้อมูลหน้างานไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  evidenceTitle: 'รูปหลักฐานหน้างาน',
  evidenceEmpty: 'ยังไม่มีรูปหลักฐาน',
  before: 'ก่อนเริ่มงาน',
  during: 'ระหว่างงาน',
  after: 'หลังงาน',
  additional_work: 'ประกอบคำขอเพิ่มงาน',
  uploadBefore: 'เพิ่มรูปก่อนเริ่มงาน',
  uploadDuring: 'เพิ่มรูประหว่างงาน',
  uploadAfter: 'เพิ่มรูปหลังงาน',
  uploadAdditional: 'เพิ่มรูปประกอบงานเพิ่มเติม',
  uploadFailed: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
  pinTitle: 'PIN ยืนยันหน้างาน',
  issueStart: 'สร้าง PIN เริ่มงาน',
  issueCompletion: 'สร้าง PIN จบงาน',
  pinCustomerHelp: 'แสดง PIN นี้ให้ช่างกรอกภายใน 15 นาที และไม่ส่งให้บุคคลอื่น',
  pinValue: (pin: string) => `PIN: ${pin}`,
  pinLabel: 'PIN 6 หลัก',
  pinPlaceholder: '000000',
  verifyStart: 'ยืนยัน PIN เริ่มงาน',
  verifyCompletion: 'ยืนยัน PIN จบงาน',
  pinFailed: 'PIN ไม่ถูกต้อง หมดอายุ หรือถูกใช้แล้ว กรุณาขอ PIN ใหม่',
  pinAttempts: (count: number) => `PIN ไม่ถูกต้อง เหลือลองได้ ${count} ครั้ง`,
  additionalTitle: 'งานเพิ่มเติม',
  additionalEmpty: 'ยังไม่มีคำขอเพิ่มงาน',
  newAdditional: 'ส่งคำขอเพิ่มงาน',
  scopeLabel: 'ขอบเขตงานเพิ่มเติม',
  reasonLabel: 'เหตุผลที่ต้องเพิ่มงาน',
  laborLabel: 'ค่าแรงเพิ่ม (บาท)',
  materialsLabel: 'ค่าวัสดุเพิ่ม (บาท)',
  evidenceRequired: 'ต้องเพิ่มรูปประกอบงานเพิ่มเติมก่อนส่งคำขอ',
  invalidAdditional:
    'กรอกขอบเขตและเหตุผลอย่างน้อย 10 ตัวอักษร พร้อมยอดเพิ่มมากกว่า 0 บาท',
  submitAdditional: 'ส่งให้ลูกค้าอนุมัติ',
  pending: 'รอลูกค้าตัดสินใจ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธแล้ว',
  approve: 'อนุมัติงานและราคาเพิ่ม',
  reject: 'ปฏิเสธ',
  responseFailed: 'บันทึกคำตอบไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุด',
  amount: (labor: string, materials: string) =>
    `ค่าแรงเพิ่ม ${labor} · ค่าวัสดุเพิ่ม ${materials}`,
  saved: 'บันทึกเรียบร้อย',
} as const;

export const serviceJobChatCopyTh = {
  back: 'ย้อนกลับ',
  title: 'ข้อความในงาน',
  technician: (name: string) => `ช่าง ${name}`,
  customer: (name: string) => `ลูกค้า ${name}`,
  connecting: 'กำลังเชื่อมต่อข้อความแบบเรียลไทม์…',
  liveUnavailable:
    'การอัปเดตสดไม่พร้อมในขณะนี้ ข้อความที่ส่งยังถูกบันทึกตามปกติ',
  loadFailed: 'โหลดข้อความไม่สำเร็จ กรุณาลองอีกครั้ง',
  retry: 'ลองอีกครั้ง',
  emptyTitle: 'ยังไม่มีข้อความในงานนี้',
  emptyBody: 'เริ่มสนทนาเรื่องนัดหมาย การเข้าถึงสถานที่ หรือรายละเอียดหน้างาน',
  messageLabel: 'ข้อความ',
  messagePlaceholder: 'พิมพ์ข้อความถึงอีกฝ่าย',
  messageHelper: 'สูงสุด 2,000 ตัวอักษร และไม่ควรส่งข้อมูลสำคัญนอกขอบเขตงาน',
  send: 'ส่ง',
  sendFailedTitle: 'ส่งข้อความไม่สำเร็จ',
  sendFailedBody:
    'ข้อความยังอยู่ในช่องพิมพ์ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
} as const;

export const technicianQuotationCopyTh = {
  back: 'ย้อนกลับ',
  title: 'ใบเสนอราคา',
  description:
    'ระบุขอบเขตงานและค่าแรงจากข้อมูลแบบย่อ ลูกค้ายังไม่ได้ยืนยันจ้างในขั้นตอนนี้',
  sealedTitle: 'ใบเสนอราคาเป็นข้อมูลแบบปิด',
  sealedBody:
    'ช่างคนอื่นจะไม่เห็นราคาและรายละเอียดของคุณ ลูกค้าจะเห็นเฉพาะรายชื่อที่ระบบคัดไว้สูงสุด 3 คน',
  scopeLabel: 'ขอบเขตงานที่เสนอ',
  scopePlaceholder:
    'เช่น ล้างคอยล์เย็น คอยล์ร้อน และตรวจระบบระบายน้ำ 1 เครื่อง',
  scopeHelper:
    'กรอก 10–2,000 ตัวอักษร และไม่ใส่เบอร์โทรหรือช่องทางติดต่อนอกระบบ',
  amountLabel: 'ค่าแรงที่เสนอ (บาท)',
  amountPlaceholder: 'เช่น 650',
  amountHelper:
    'ระบุค่าแรงมากกว่า 0 บาท ยังไม่รวมอะไหล่ที่ไม่ได้อยู่ในขอบเขตนี้',
  required: 'กรุณากรอกข้อมูลนี้',
  scopeInvalid: 'กรุณาระบุขอบเขตงาน 10–2,000 ตัวอักษร',
  amountInvalid: 'กรุณาระบุค่าแรงเป็นตัวเลขมากกว่า 0',
  submit: 'ส่งใบเสนอราคา',
  savedTitle: 'ส่งใบเสนอราคาแล้ว',
  savedBody: 'คุณแก้ไขใบเสนอราคาได้ตราบใดที่ลูกค้ายังไม่ได้เลือกช่าง',
  done: 'กลับไปหน้างาน',
  saveFailedTitle: 'ส่งใบเสนอราคาไม่สำเร็จ',
  saveFailedBody:
    'คำขอหรือความสนใจรับงานอาจเปลี่ยนสถานะแล้ว กรุณากลับไปโหลดหน้างานใหม่',
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
  profileHelper: '20–500 ตัวอักษร และไม่ใส่เลขบัตรหรือข้อมูลเอกสาร',
  profileRequired: 'กรุณาเขียนข้อความแนะนำตัวอย่างน้อย 20 ตัวอักษร',
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
  profileNotReady: 'ต้องเพิ่มข้อความแนะนำตัวอย่างน้อย 20 ตัวอักษรก่อนส่งตรวจ',
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
