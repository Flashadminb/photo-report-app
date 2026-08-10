/**
 * Config.gs — ค่าคงที่ทั้งหมดของระบบถ่ายรูปอัพเดทงาน
 *
 * ถ้าย้ายไฟล์ / เปลี่ยนชีท แก้ที่ไฟล์นี้ที่เดียว
 */

var CFG = {
  // ── ไฟล์ Google Sheets ────────────────────────────────────────────────
  MASTER_ID: '1eyEdIkSMxZbfSuzQVdWYRgR2m0imOK6W_KMKjDUbOhE', // ตั้งค่าระบบถ่ายรูปอัพเดทงาน (MASTER)
  DATA_ID:   '1HHqiNiWoie026_szuxKdhzpp2w7Cx_uNV7f6ixRymVU', // บันทึกหน้างาน Power Pallet (DATA)

  // โฟลเดอร์ Drive ที่จะเก็บรูป (ค่าเริ่มต้น = โฟลเดอร์เดียวกับไฟล์ชีท)
  DRIVE_PARENT_ID: '1NSRtZvorT2LQjwDr6d0PtH-p3-oilfz5',
  PHOTO_ROOT_NAME: 'รูปถ่ายหน้างาน',

  TZ: 'Asia/Bangkok',

  // ── ชื่อชีทใน MASTER ──────────────────────────────────────────────────
  M: {
    STAFF:  'พนักงาน',
    ASSETS: 'เครื่อง',
    TOPICS: 'หัวข้อสำรวจ',
    SLOTS:  'ช่องถ่ายรูป',
    RULES:  'เงื่อนไข'
  },

  // ── ชื่อชีทใน DATA ────────────────────────────────────────────────────
  D: {
    RECORDS: 'บันทึก',
    PHOTOS:  'รูปภาพ',
    OPEN:    'ค้างคืน'
  },

  // ── ลำดับคอลัมน์ (1-based) — ต้องตรงกับหัวตารางในชีทเป๊ะ ──────────────
  COL: {
    // MASTER!พนักงาน
    // PIN2 = รหัสลับ 3 หลักสำหรับเข้าแอพหน้างาน ใครมีค่าในช่องนี้ต้องใส่เพิ่มทุกครั้ง
    // อ่านตรงจากชีทตอนล็อกอินเท่านั้น ไม่เคยถูกส่งออกไปหน้าจอ
    STAFF: { ID: 1, NAME: 2, DEPT: 3, SHIFT: 4, ROLE: 5, STATUS: 6, PIN2: 7 },
    // MASTER!เครื่อง
    // DEFECT = "อาการค้าง" ติดตัวเครื่องไปจนกว่าแอดมินจะเคลียร์ — คนละเรื่องกับ STATUS
    // STATUS ซ่อม = เบิกไม่ได้ · DEFECT = เบิกได้ แต่รู้ว่าพังตรงไหนอยู่ก่อนแล้ว
    ASSET: { CODE: 1, TYPE: 2, DEPT: 3, STATUS: 4, NOTE: 5, DEFECT: 6 },
    // MASTER!หัวข้อสำรวจ
    TOPIC: { ID: 1, NAME: 2, DESC: 3, ON: 4, ORDER: 5 },
    // MASTER!ช่องถ่ายรูป
    SLOT: { TOPIC: 1, ORDER: 2, TH: 3, EN: 4, REQ: 5, HINT: 6 },
    // MASTER!เงื่อนไข
    RULE: { TOPIC: 1, ID: 2, NAME: 3, VALUE: 4 },
    // DATA!บันทึก
    REC: {
      ID: 1, TS: 2, DATE: 3, SHIFT: 4, EMP_ID: 5, EMP_NAME: 6, DEPT: 7,
      TOPIC: 8, ACTION: 9, QTY: 10, CODES: 11, RESULT: 12, ISSUE: 13,
      NOTE: 14, PHOTO_N: 15, FOLDER: 16, GPS: 17, REF: 18, SENT: 19
    },
    // DATA!รูปภาพ
    PHOTO: { REC: 1, SLOT: 2, URL: 3, TIME: 4, GPS: 5 }
  },

  // ── คำที่ใช้ในชีท (ต้องสะกดตรงกับที่มีอยู่เดิม) ──────────────────────
  V: {
    ACTIVE: 'ใช้งาน',
    SUSPENDED: 'ระงับ',
    ASSET_READY: 'พร้อมใช้',
    ASSET_REPAIR: 'ซ่อม',
    ROLE_ADMIN: 'แอดมิน',
    ROLE_LEAD: 'หัวหน้างาน',
    ROLE_FIELD: 'พนักงานหน้างาน',
    BORROW: 'เบิก',
    RETURN: 'คืน',
    OK: 'ปกติ',
    ISSUE: 'มีปัญหา',
    SENT: 'ส่งแล้ว'
  },

  // แผนกที่เลือกได้ในหน้าแอดมิน (ใช้เมื่อเพิ่มพนักงาน/เครื่องใหม่)
  DEPTS: ['IN LH+BG', 'IN FD', 'BULKY', 'OUT 4W', 'OUT 6W', 'REPACK', 'MINI CS', 'ทุกแผนก'],

  SHIFTS: [
    'กะ 03:00 - 12:00 น.',
    'กะ 09:00 - 18:00 น.',
    'กะ 11:00 - 20:00 น.',
    'กะ 15:00 - 00:00 น.',
    'กะ 18:00 - 03:00 น.'
  ],

  // อาการยอดฮิต (ปุ่มลัดตอนแจ้งปัญหา)
  ISSUE_TAGS: ['แบตไม่เก็บไฟ', 'ยกไม่ขึ้น', 'ล้อชำรุด', 'จอไม่ติด', 'มีเสียงดัง', 'น้ำมันรั่ว'],

  CACHE_SEC: 300 // อายุแคชของข้อมูล MASTER (วินาที)
};
