/**
 * Code.gs — รวมทุกไฟล์ .gs ไว้ที่เดียวเพื่อให้ก๊อปวางง่าย
 *
 * สร้างอัตโนมัติจากโฟลเดอร์ apps-script/ ด้วย build-bundle.ps1
 * อย่าแก้ไฟล์นี้โดยตรง — แก้ที่ apps-script/ แล้วรันสคริปต์ใหม่
 */


// ==========================================================================
//  Config.gs
// ==========================================================================

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
    STAFF: { ID: 1, NAME: 2, DEPT: 3, SHIFT: 4, ROLE: 5, STATUS: 6 },
    // MASTER!เครื่อง
    ASSET: { CODE: 1, TYPE: 2, DEPT: 3, STATUS: 4, NOTE: 5 },
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


// ==========================================================================
//  Master.gs
// ==========================================================================

/**
 * Master.gs — อ่าน/เขียนไฟล์ตั้งค่า (MASTER)
 *
 * ทุกอย่างที่หน้าจอแสดง (หัวข้อ, ช่องถ่ายรูป, เงื่อนไข, ทะเบียนพนักงาน,
 * ทะเบียนเครื่อง) มาจากชีทล้วน ๆ — ไม่มี hard-code ในโค้ดหน้าบ้าน
 */

function masterSS_() { return SpreadsheetApp.openById(CFG.MASTER_ID); }
function dataSS_()   { return SpreadsheetApp.openById(CFG.DATA_ID); }

/** อ่านชีทเป็น array of array โดยตัดหัวตารางและแถวว่างออก */
function readRows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('ไม่พบชีท "' + name + '" ในไฟล์ ' + ss.getName());
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  return vals.filter(function (r) {
    return r.join('').toString().trim() !== '';
  });
}

function s_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

/** ชีทเก็บ TRUE/FALSE บ้าง ข้อความบ้าง — แปลงให้เป็น boolean ทางเดียว */
function truthy_(v) {
  if (v === true) return true;
  if (v === false) return false;
  var t = s_(v).toUpperCase();
  return t === 'TRUE' || t === 'ใช่' || t === 'YES' || t === '1' || t === 'เปิด';
}

// ══════════════════════════════════════════════════════════════════════════
//  อ่าน MASTER (มีแคช 5 นาที เพื่อไม่ให้พนักงาน 30 คนยิงชีทพร้อมกันแล้วช้า)
// ══════════════════════════════════════════════════════════════════════════

function getMaster_(force) {
  var cache = CacheService.getScriptCache();
  if (!force) {
    var hit = cache.get('master');
    if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  }
  var m = buildMaster_();
  try { cache.put('master', JSON.stringify(m), CFG.CACHE_SEC); } catch (e) {}
  return m;
}

function buildMaster_() {
  var ss = masterSS_(), C = CFG.COL;

  var staff = readRows_(ss, CFG.M.STAFF).map(function (r) {
    return {
      id: s_(r[C.STAFF.ID - 1]),
      name: s_(r[C.STAFF.NAME - 1]),
      dept: s_(r[C.STAFF.DEPT - 1]),
      shift: s_(r[C.STAFF.SHIFT - 1]),
      role: s_(r[C.STAFF.ROLE - 1]) || CFG.V.ROLE_FIELD,
      status: s_(r[C.STAFF.STATUS - 1]) || CFG.V.ACTIVE
    };
  }).filter(function (p) { return p.id; });

  var assets = readRows_(ss, CFG.M.ASSETS).map(function (r) {
    return {
      code: s_(r[C.ASSET.CODE - 1]),
      type: s_(r[C.ASSET.TYPE - 1]),
      dept: s_(r[C.ASSET.DEPT - 1]),
      status: s_(r[C.ASSET.STATUS - 1]) || CFG.V.ASSET_READY,
      note: s_(r[C.ASSET.NOTE - 1])
    };
  }).filter(function (a) { return a.code; });

  var slots = readRows_(ss, CFG.M.SLOTS).map(function (r) {
    var req = r[C.SLOT.REQ - 1];
    var reqTxt = s_(req);
    return {
      topic: s_(r[C.SLOT.TOPIC - 1]),
      order: Number(r[C.SLOT.ORDER - 1]) || 0,
      th: s_(r[C.SLOT.TH - 1]),
      en: s_(r[C.SLOT.EN - 1]),
      // "บังคับ" มีได้ 3 ค่า: TRUE / FALSE / "เมื่อมีปัญหา"
      req: truthy_(req),
      onIssue: reqTxt.indexOf('ปัญหา') >= 0,
      hint: s_(r[C.SLOT.HINT - 1])
    };
  }).filter(function (x) { return x.topic && x.th; })
    .sort(function (a, b) { return a.order - b.order; });

  var rules = readRows_(ss, CFG.M.RULES).map(function (r) {
    return {
      topic: s_(r[C.RULE.TOPIC - 1]),
      id: s_(r[C.RULE.ID - 1]),
      name: s_(r[C.RULE.NAME - 1]),
      on: truthy_(r[C.RULE.VALUE - 1]),
      value: s_(r[C.RULE.VALUE - 1])   // ค่าดิบ — บางเงื่อนไขเก็บข้อความ ไม่ใช่แค่ TRUE/FALSE
    };
  }).filter(function (x) { return x.topic && x.id; });

  var topics = readRows_(ss, CFG.M.TOPICS).map(function (r) {
    var id = s_(r[C.TOPIC.ID - 1]);
    var tSlots = slots.filter(function (x) { return x.topic === id; });
    var tRules = {}, tRuleText = {};
    rules.forEach(function (x) {
      if (x.topic !== id) return;
      tRules[x.id] = x.on;
      tRuleText[x.id] = x.value;
    });
    return {
      id: id,
      name: s_(r[C.TOPIC.NAME - 1]),
      desc: s_(r[C.TOPIC.DESC - 1]),
      on: truthy_(r[C.TOPIC.ON - 1]),
      order: Number(r[C.TOPIC.ORDER - 1]) || 0,
      abbr: id.slice(0, 2),
      // ประเภทเครื่องในทะเบียนที่ผูกกับหัวข้อนี้
      assetType: s_(r[C.TOPIC.NAME - 1]).indexOf('ไอดาต้า') >= 0 || id === 'IDATA'
        ? 'ไอดาต้า' : s_(r[C.TOPIC.NAME - 1]),
      slots: tSlots,
      rules: tRules,
      ruleText: tRuleText,
      // เงื่อนไข extra เก็บ "ประเภทอุปกรณ์เสริม" ที่เบิกพ่วงได้ (เช่น เลเซอร์ลบ)
      // ว่าง = ไม่มีอุปกรณ์เสริม
      extraType: (function () {
        var v = tRuleText.extra || '';
        return (v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'FALSE') ? '' : v;
      })(),
      // เงื่อนไข tags เก็บ "อาการที่พบบ่อย" ของหัวข้อนั้น คั่นด้วยจุลภาค
      // ว่าง = ใช้ชุดกลางใน Config.gs
      issueTags: (function () {
        var v = tRuleText.tags || '';
        if (!v || v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'FALSE') return [];
        return v.split(/\s*,\s*/).map(s_).filter(Boolean);
      })(),
      // เงื่อนไข alldept เก็บรายชื่อแผนกที่ให้เห็นเครื่องของทุกแผนก คั่นด้วยจุลภาค
      // ปกติพนักงานจะเห็นเฉพาะเครื่องของแผนกตัวเอง
      allDepts: (function () {
        var v = tRuleText.alldept || '';
        if (!v || v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'FALSE') return [];
        return v.split(/\s*,\s*/).map(s_).filter(Boolean);
      })(),
      // หัวข้อที่นับจำนวนเครื่องเอง (ไม่ได้เลือกทีละรหัส) เช่น IDATA
      countMode: !!tRules.count
    };
  }).filter(function (t) { return t.id; })
    .sort(function (a, b) { return a.order - b.order; });

  return {
    staff: staff, assets: assets, topics: topics, slots: slots, rules: rules,
    depts: CFG.DEPTS, shifts: CFG.SHIFTS, issueTags: CFG.ISSUE_TAGS
  };
}

function clearMasterCache_() {
  try { CacheService.getScriptCache().remove('master'); } catch (e) {}
}

// ══════════════════════════════════════════════════════════════════════════
//  เขียน MASTER (ใช้จากหน้าเว็บแอดมิน)
// ══════════════════════════════════════════════════════════════════════════

/** หาแถวจากค่าในคอลัมน์คีย์ คืน row number (1-based) หรือ 0 ถ้าไม่เจอ */
function findRow_(sh, keyCol, keyVal) {
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var col = sh.getRange(2, keyCol, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    if (s_(col[i][0]) === s_(keyVal)) return i + 2;
  }
  return 0;
}

function masterUpsert_(sheetName, keyCol, keyVal, rowValues) {
  var sh = masterSS_().getSheetByName(sheetName);
  if (!sh) throw new Error('ไม่พบชีท ' + sheetName);
  var row = findRow_(sh, keyCol, keyVal);
  if (!row) row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
  clearMasterCache_();
  return row;
}

function masterDelete_(sheetName, keyCol, keyVal) {
  var sh = masterSS_().getSheetByName(sheetName);
  var row = findRow_(sh, keyCol, keyVal);
  if (row) { sh.deleteRow(row); clearMasterCache_(); }
  return !!row;
}


// ==========================================================================
//  Records.gs
// ==========================================================================

/**
 * Records.gs — อ่าน/เขียนไฟล์บันทึกหน้างาน (DATA)
 *
 * ชีท "บันทึก"  = 1 แถว ต่อ 1 ครั้งที่กดส่ง (ทั้งเบิกและคืน)
 * ชีท "รูปภาพ"  = 1 แถว ต่อ 1 รูป
 * ชีท "ค้างคืน" = สูตร FILTER ในชีท (เราไม่เขียนทับ) — ฝั่งแอพคำนวณเองจาก "บันทึก"
 */

function fmtDate_(d)  { return Utilities.formatDate(d, CFG.TZ, 'd/M/yyyy'); }
function fmtTime_(d)  { return Utilities.formatDate(d, CFG.TZ, 'HH:mm:ss'); }
function fmtStamp_(d) { return Utilities.formatDate(d, CFG.TZ, 'd/M/yyyy, HH:mm:ss'); }

/** แปลงค่าจากชีทเป็นข้อความวันที่ ไม่ว่าจะเก็บมาเป็น Date หรือ string */
function cellDate_(v, withTime) {
  if (v instanceof Date) return withTime ? fmtStamp_(v) : fmtDate_(v);
  return s_(v);
}

// ── เลขรันของรหัสรายการ ───────────────────────────────────────────────────

function nextSeq_() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var cur = Number(props.getProperty('seq') || 0);
    if (!cur) cur = scanMaxSeq_();
    cur = cur + 1;
    props.setProperty('seq', String(cur));
    return cur;
  } finally {
    lock.releaseLock();
  }
}

/** ครั้งแรกสุด: ไล่ดูรหัสรายการเดิมในชีทเพื่อหาเลขล่าสุด */
function scanMaxSeq_() {
  var sh = dataSS_().getSheetByName(CFG.D.RECORDS);
  var max = 1000;
  var last = sh.getLastRow();
  if (last >= 2) {
    sh.getRange(2, CFG.COL.REC.ID, last - 1, 1).getValues().forEach(function (r) {
      var m = /-(\d+)$/.exec(s_(r[0]));
      if (m) max = Math.max(max, Number(m[1]));
    });
  }
  return max;
}

function makeRecordId_(topicId, when) {
  return topicId + '-' + Utilities.formatDate(when, CFG.TZ, 'yyyyMMdd') + '-' + nextSeq_();
}

// ── อ่านบันทึกทั้งหมด ─────────────────────────────────────────────────────

function allRecords_() {
  var C = CFG.COL.REC;
  return readRows_(dataSS_(), CFG.D.RECORDS).map(function (r) {
    return {
      id:       s_(r[C.ID - 1]),
      ts:       cellDate_(r[C.TS - 1], true),
      date:     cellDate_(r[C.DATE - 1], false),
      shift:    s_(r[C.SHIFT - 1]),
      empId:    s_(r[C.EMP_ID - 1]),
      empName:  s_(r[C.EMP_NAME - 1]),
      dept:     s_(r[C.DEPT - 1]),
      topic:    s_(r[C.TOPIC - 1]),
      action:   s_(r[C.ACTION - 1]),
      qty:      Number(r[C.QTY - 1]) || 0,
      codes:    s_(r[C.CODES - 1]),
      result:   s_(r[C.RESULT - 1]),
      issue:    s_(r[C.ISSUE - 1]),
      note:     s_(r[C.NOTE - 1]),
      photoN:   Number(r[C.PHOTO_N - 1]) || 0,
      folder:   s_(r[C.FOLDER - 1]),
      gps:      s_(r[C.GPS - 1]),
      ref:      s_(r[C.REF - 1]),
      sent:     s_(r[C.SENT - 1])
    };
  }).filter(function (x) { return x.id; });
}

function allPhotos_() {
  var C = CFG.COL.PHOTO;
  return readRows_(dataSS_(), CFG.D.PHOTOS).map(function (r) {
    return {
      rec:  s_(r[C.REC - 1]),
      slot: s_(r[C.SLOT - 1]),
      url:  s_(r[C.URL - 1]),
      time: cellDate_(r[C.TIME - 1], false),
      gps:  s_(r[C.GPS - 1])
    };
  }).filter(function (x) { return x.rec; });
}

/**
 * รายการที่ยังไม่คืน — ตรรกะเดียวกับสูตร FILTER ในชีท "ค้างคืน":
 * แถวที่สถานะใช้งาน = "เบิก" และยังไม่มีแถวไหนอ้างอิงรหัสรายการนี้
 */
function openJobs_(records, empId) {
  var referenced = {};
  records.forEach(function (r) { if (r.ref) referenced[r.ref] = true; });
  return records.filter(function (r) {
    if (r.action !== CFG.V.BORROW) return false;
    if (referenced[r.id]) return false;
    if (empId && r.empId !== empId) return false;
    return true;
  }).map(function (r) {
    return {
      id: r.id, codes: r.codes, qty: r.qty, topic: r.topic,
      empId: r.empId, empName: r.empName, dept: r.dept,
      date: r.date, ts: r.ts,
      time: (/(\d{1,2}:\d{2})/.exec(r.ts) || [, ''])[1]
    };
  }).reverse();
}

/**
 * รายการค้างคืน แบบไม่ต้องอ่านชีททั้งใบ — ใช้ในแอพหน้างานตอนล็อกอิน/รีเฟรช
 *
 * ของเดิมเรียก allRecords_() ซึ่งอ่านครบ 19 คอลัมน์แล้วแปลงเป็นออบเจ็กต์ทุกแถว
 * รวมถึงจัดรูปแบบวันที่ทีละแถว ยิ่งข้อมูลสะสมยิ่งช้าขึ้นเรื่อย ๆ ทั้งที่
 * รายการค้างคืนจริง ๆ มีแค่ไม่กี่รายการ
 *
 * ตัวนี้อ่านเฉพาะคอลัมน์ที่ใช้ กรองจากตัวเลขดิบก่อน แล้วค่อยแปลงเป็นออบเจ็กต์
 * เฉพาะแถวที่รอดจริง — ผลลัพธ์เหมือนเดิมทุกประการ
 */
function openJobsFast_(empId) {
  var C = CFG.COL.REC;
  var sh = dataSS_().getSheetByName(CFG.D.RECORDS);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var n = last - 1;
  var head = sh.getRange(2, 1, n, C.CODES).getValues();   // รหัสรายการ .. รหัสเครื่อง
  var refs = sh.getRange(2, C.REF, n, 1).getValues();     // อ้างอิงรายการเบิก

  var referenced = {};
  for (var i = 0; i < n; i++) {
    var rf = s_(refs[i][0]);
    if (rf) referenced[rf] = true;
  }

  var out = [];
  for (var j = 0; j < n; j++) {
    var r = head[j];
    var id = s_(r[C.ID - 1]);
    if (!id) continue;
    if (s_(r[C.ACTION - 1]) !== CFG.V.BORROW) continue;
    if (referenced[id]) continue;
    if (empId && s_(r[C.EMP_ID - 1]) !== empId) continue;

    var ts = cellDate_(r[C.TS - 1], true);
    out.push({
      id: id,
      codes: s_(r[C.CODES - 1]),
      qty: Number(r[C.QTY - 1]) || 0,
      topic: s_(r[C.TOPIC - 1]),
      empId: s_(r[C.EMP_ID - 1]),
      empName: s_(r[C.EMP_NAME - 1]),
      dept: s_(r[C.DEPT - 1]),
      date: cellDate_(r[C.DATE - 1], false),
      ts: ts,
      time: (/(\d{1,2}:\d{2})/.exec(ts) || [, ''])[1]
    });
  }
  return out.reverse();
}

/** รหัสเครื่องที่ยังไม่ได้คืน -> รายการที่เบิกไป { รหัสเครื่อง: งาน } */
function busyCodes_(openList) {
  var busy = {};
  (openList || []).forEach(function (j) {
    s_(j.codes).split(/\s*,\s*/).forEach(function (c) {
      if (c && !busy[c]) busy[c] = j;
    });
  });
  return busy;
}

/** วันที่ของรายการ — อ่านจากรหัสรายการ (หัวข้อ-yyyyMMdd-เลขรัน) ไม่ต้องแปลงข้อความ */
function recDay_(r) {
  var m = /-(\d{4})(\d{2})(\d{2})-/.exec(s_(r.id));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s_(r.date));
  return d ? new Date(Number(d[3]), Number(d[2]) - 1, Number(d[1])) : null;
}

// ── เขียนบันทึก ───────────────────────────────────────────────────────────

/**
 * @param {Object} p  ข้อมูลรายการ (ผ่านการตรวจสอบมาแล้วจาก Api.gs)
 * @param {Array}  photoRows  [{slot,url,time,gps}, ...]
 */
/**
 * @param {Function} [guard]  ตรวจซ้ำ "ในล็อก" ก่อนเขียนจริง โยน Error เพื่อยกเลิกได้
 *   จำเป็นตอนคนกดพร้อมกัน เพราะที่ตรวจไว้ก่อนหน้านั้นอาจล้าสมัยไปแล้ว
 */
function writeRecord_(p, photoRows, guard) {
  var ss = dataSS_();
  var shR = ss.getSheetByName(CFG.D.RECORDS);
  var C = CFG.COL.REC;
  var now = new Date();

  var row = [];
  row[C.ID - 1]       = p.recordId;
  row[C.TS - 1]       = fmtStamp_(now);
  row[C.DATE - 1]     = fmtDate_(now);
  row[C.SHIFT - 1]    = p.shift;
  row[C.EMP_ID - 1]   = p.empId;
  row[C.EMP_NAME - 1] = p.empName;
  row[C.DEPT - 1]     = p.dept;
  row[C.TOPIC - 1]    = p.topicName;
  row[C.ACTION - 1]   = p.action;
  row[C.QTY - 1]      = p.qty;
  row[C.CODES - 1]    = p.codes;
  row[C.RESULT - 1]   = p.result;
  row[C.ISSUE - 1]    = p.issue || '';
  row[C.NOTE - 1]     = p.note || '';
  row[C.PHOTO_N - 1]  = photoRows.length;
  row[C.FOLDER - 1]   = p.folderUrl || '';
  row[C.GPS - 1]      = p.gps || '';
  row[C.REF - 1]      = p.ref || '';
  row[C.SENT - 1]     = CFG.V.SENT;

  for (var i = 0; i < C.SENT; i++) if (row[i] === undefined) row[i] = '';

  var lock = LockService.getScriptLock();
  lock.waitLock(60000);   // กะเปลี่ยนคนส่งพร้อมกันเยอะ ให้รอคิวได้นานหน่อย
  try {
    if (guard) guard();
    shR.appendRow(row);
    // บังคับให้รหัสพนักงานเป็นข้อความ กันชีทตัดเลข 0 นำหน้า
    shR.getRange(shR.getLastRow(), C.EMP_ID).setNumberFormat('@').setValue(p.empId);

    if (photoRows.length) {
      var shP = ss.getSheetByName(CFG.D.PHOTOS);
      var start = shP.getLastRow() + 1;
      var vals = photoRows.map(function (ph) {
        return [p.recordId, ph.slot, ph.url, ph.time, ph.gps || ''];
      });
      shP.getRange(start, 1, vals.length, 5).setValues(vals);
    }
  } finally {
    lock.releaseLock();
  }
  return p.recordId;
}


// ==========================================================================
//  Photos.gs
// ==========================================================================

/**
 * Photos.gs — เก็บรูปลง Google Drive
 *
 * โครงโฟลเดอร์:  <โฟลเดอร์แม่>/รูปถ่ายหน้างาน/2026-08-06/PP-20260806-1275/
 * รูปถูกประทับวันเวลา+พิกัด+รหัสเครื่องมาแล้วจากฝั่งมือถือ (canvas) ก่อนอัปโหลด
 */

function folderChild_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function photoRoot_() {
  var parent = DriveApp.getFolderById(CFG.DRIVE_PARENT_ID);
  return folderChild_(parent, CFG.PHOTO_ROOT_NAME);
}

/** โฟลเดอร์ของรายการหนึ่ง ๆ — สร้างเมื่อเรียกครั้งแรก */
function recordFolder_(recordId, when) {
  var day = Utilities.formatDate(when || new Date(), CFG.TZ, 'yyyy-MM-dd');
  return folderChild_(folderChild_(photoRoot_(), day), recordId);
}

/**
 * บันทึกรูป 1 ใบ
 *
 * รับ folder เข้ามาเลย เพราะการหาโฟลเดอร์ซ้ำทุกใบทำให้ช้ามาก
 * (การส่ง 1 ครั้งมี 5–6 รูป — เรียก Drive API ซ้ำหลายสิบครั้งโดยไม่จำเป็น)
 *
 * @param {Folder} folder    โฟลเดอร์ของรายการ จาก recordFolder_()
 * @param {string} recordId
 * @param {string} slot      ชื่อช่องถ่าย เช่น "กุญแจ"
 * @param {string} dataUrl   "data:image/jpeg;base64,...."
 * @returns {{url:string, id:string}}
 */
function savePhoto_(folder, recordId, slot, dataUrl, seq) {
  var m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('รูปไม่ถูกต้อง (' + slot + ')');

  var mime = m[1];
  var bytes = Utilities.base64Decode(m[2]);
  var ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
  var name = recordId + '-' + pad2_(seq || 1) + '-' + safeName_(slot) + '.' + ext;

  var file = folder.createFile(Utilities.newBlob(bytes, mime, name));

  return {
    id: file.getId(),
    url: 'https://drive.google.com/open?id=' + file.getId()
  };
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function safeName_(s) {
  return String(s || 'photo').replace(/[\\\/:*?"<>|]+/g, '-').slice(0, 40);
}

/**
 * ลบรูปทั้งหมดของรายการ (ปุ่ม "ลบรูป" ในหน้าแอดมิน) เพื่อคืนพื้นที่ Drive
 *
 * เก็บร่องรอยไว้ครบ: แถวในชีท "รูปภาพ" ไม่ถูกลบ ลิงก์รูปเดิมยังอยู่
 * พร้อมช่องถ่าย เวลา และพิกัด — ใช้เป็นหลักฐานย้อนหลังได้ว่าเคยถ่ายอะไรไว้
 * แค่กดลิงก์แล้วจะไม่เห็นภาพหลังไฟล์ถูกลบถาวรจากถังขยะ (Drive ล้างเองใน 30 วัน)
 */
function deleteRecordPhotos_(recordId) {
  var r = deleteRecordPhotosBulk_([s_(recordId)]);
  if (r.failed.length) throw new Error('ไม่พบรายการ ' + recordId);
  return r.deleted;
}

/**
 * ลบรูปหลายรายการในทีเดียว — ตัวที่ทำให้หน้าแอดมินลบได้ไว
 *
 * ของเดิมช้าเพราะทำงานซ้ำทุกรายการ:
 *   อ่านชีทบันทึกทั้งใบใหม่ 1 รอบ + ไล่หาแถวอีก 1 รอบ + สั่งทิ้งไฟล์ทีละใบ
 *   25 รายการ รายการละ 6 รูป = อ่านชีท 50 รอบ + เรียก Drive ราว 175 ครั้ง
 *
 * ของใหม่ทำทีเดียวจบ:
 *   อ่านชีทรอบเดียว · ทิ้งทั้งโฟลเดอร์ (ไฟล์ข้างในติดไปเอง) · เขียนชีทกลับรอบเดียว
 *   เหลือเรียก Drive 2 ครั้งต่อรายการ ไม่ว่าจะมีรูปกี่ใบ
 *
 * เก็บร่องรอยไว้ครบเหมือนเดิม: แถวในชีท "รูปภาพ" ไม่ถูกแตะ ลิงก์รูปเดิมยังอยู่
 * พร้อมช่องถ่าย เวลา และพิกัด — ใช้เป็นหลักฐานย้อนหลังได้ว่าเคยถ่ายอะไรไว้
 */
function deleteRecordPhotosBulk_(recordIds) {
  var C = CFG.COL.REC;
  var ids = (recordIds || []).map(s_).filter(Boolean);
  if (!ids.length) return { deleted: 0, records: 0, failed: [] };

  var shR = dataSS_().getSheetByName(CFG.D.RECORDS);
  var last = shR.getLastRow();
  if (last < 2) return { deleted: 0, records: 0, failed: ids };

  // อ่านเฉพาะคอลัมน์ที่ใช้จริง แล้วเขียนกลับเฉพาะคอลัมน์โฟลเดอร์
  // ไม่แตะคอลัมน์อื่นเลย ข้อมูลที่หน้างานกรอกมาจึงไม่มีทางเพี้ยน
  var idCol  = shR.getRange(2, C.ID, last - 1, 1).getValues();
  var folRng = shR.getRange(2, C.FOLDER, last - 1, 1);
  var folCol = folRng.getValues();
  var nCol   = shR.getRange(2, C.PHOTO_N, last - 1, 1).getValues();

  var rowOf = {};
  for (var i = 0; i < idCol.length; i++) rowOf[s_(idCol[i][0])] = i;

  var deleted = 0, records = 0, failed = [], touched = false;

  ids.forEach(function (id) {
    var i = rowOf[id];
    if (i === undefined) { failed.push(id); return; }

    var fid = (/[-\w]{25,}/.exec(s_(folCol[i][0])) || [])[0];
    if (fid) {
      try {
        // ทิ้งทั้งโฟลเดอร์ทีเดียว ไฟล์ข้างในลงถังขยะตามไปเอง
        DriveApp.getFolderById(fid).setTrashed(true);
      } catch (e) { /* โฟลเดอร์ถูกลบไปแล้ว ถือว่าลบสำเร็จ */ }
      // จำนวนรูปเอาจากที่ชีทจดไว้ตอนส่ง ไม่ต้องไล่นับไฟล์ใน Drive ให้เสียเวลา
      deleted += Number(nCol[i][0]) || 0;
    }

    folCol[i][0] = 'ลบรูปแล้ว';
    touched = true;
    records++;
  });

  if (touched) folRng.setValues(folCol);
  return { deleted: deleted, records: records, failed: failed };
}


// ==========================================================================
//  Api.gs
// ==========================================================================

/**
 * Api.gs — ทางเข้าเดียวของเว็บแอพ + ฟังก์ชันที่หน้าบ้านเรียกผ่าน google.script.run
 *
 * ทุกฟังก์ชัน api* คืนค่าเป็น {ok:true, ...} หรือ {ok:false, error:'ข้อความไทย'}
 * ไม่มีการโยน exception ข้ามไปหน้าบ้าน เพื่อให้หน้าจอแสดงข้อความที่อ่านรู้เรื่อง
 */

function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) || 'app';
  var file = page === 'admin' ? 'admin' : 'app';
  var t = HtmlService.createTemplateFromFile(file);
  t.webAppUrl = ScriptApp.getService().getUrl();
  return t.evaluate()
    .setTitle(page === 'admin' ? 'เว็บแอดมิน · ระบบถ่ายรูปอัพเดทงาน' : 'ระบบถ่ายรูปอัพเดทงาน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * doPost — ทางเข้าสำหรับหน้าเว็บที่โฮสต์อยู่ที่อื่น (GitHub Pages)
 *
 * หน้าเว็บที่เสิร์ฟจาก Apps Script เองใช้ google.script.run ได้ตรง ๆ
 * แต่หน้าเว็บที่อยู่คนละโดเมนต้องยิง fetch เข้ามาที่นี่แทน
 *
 * body: {"fn":"apiLogin","args":["730075"]}
 * ส่งมาเป็น Content-Type: text/plain เพื่อไม่ให้เบราว์เซอร์ยิง preflight (OPTIONS)
 * ซึ่ง Apps Script ตอบไม่ได้
 */
function doPost(e) {
  var out;
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var body = JSON.parse(raw);
    var fn = apiDispatch_(String(body.fn || ''));
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง "' + s_(body.fn) + '"');
    out = fn.apply(null, body.args || []);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    out = err_((err && err.message) ? err.message : err);
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** รายชื่อฟังก์ชันที่ยอมให้เรียกจากภายนอกได้ (อย่างอื่นเรียกไม่ได้) */
function apiDispatch_(name) {
  var map = {
    apiHello: apiHello,
    apiLogin: apiLogin,
    apiRefresh: apiRefresh,
    apiSubmit: apiSubmit,
    apiBeginSubmit: apiBeginSubmit,
    apiReserve: apiReserve,
    apiUploadPhoto: apiUploadPhoto,
    apiCommitSubmit: apiCommitSubmit,
    apiAdminLoad: apiAdminLoad,
    apiAdminHidePhotos: apiAdminHidePhotos,
    apiAdminDeletePhotos: apiAdminDeletePhotos,
    apiAdminDeletePhotosBulk: apiAdminDeletePhotosBulk,
    apiSaveStaff: apiSaveStaff,
    apiDeleteStaff: apiDeleteStaff,
    apiSaveAsset: apiSaveAsset,
    apiDeleteAsset: apiDeleteAsset,
    apiSaveTopic: apiSaveTopic,
    apiDeleteTopic: apiDeleteTopic,
    apiSaveSlots: apiSaveSlots,
    apiSetRule: apiSetRule
  };
  return Object.prototype.hasOwnProperty.call(map, name) ? map[name] : null;
}

function ok_(obj)  { return Object.assign({ ok: true }, obj || {}); }
function err_(msg) { return { ok: false, error: String(msg) }; }

function wrap_(fn) {
  try { return fn(); }
  catch (e) {
    console.error(e && e.stack ? e.stack : e);
    return err_((e && e.message) ? e.message : e);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ผู้ใช้
// ══════════════════════════════════════════════════════════════════════════

function findUser_(master, empId) {
  var id = s_(empId);
  if (!id) return null;
  for (var i = 0; i < master.staff.length; i++) {
    if (master.staff[i].id === id) return master.staff[i];
  }
  return null;
}

function requireUser_(master, empId) {
  var u = findUser_(master, empId);
  if (!u) throw new Error('ไม่พบรหัสนี้ในชีททะเบียนพนักงาน');
  if (u.status === CFG.V.SUSPENDED) throw new Error('รหัสนี้ถูกระงับการใช้งาน ติดต่อแอดมิน');
  return u;
}

function requireAdmin_(master, empId) {
  var u = requireUser_(master, empId);
  if (u.role !== CFG.V.ROLE_ADMIN && u.role !== CFG.V.ROLE_LEAD) {
    throw new Error('บัญชีนี้ไม่มีสิทธิ์เข้าเว็บแอดมิน');
  }
  return u;
}

function canWriteMaster_(u) { return u.role === CFG.V.ROLE_ADMIN; }

// ══════════════════════════════════════════════════════════════════════════
//  แอพมือถือ
// ══════════════════════════════════════════════════════════════════════════

/**
 * ข้อมูลตั้งต้นของหน้าล็อกอิน — ไม่ต้องมีรหัสก็เรียกได้
 *
 * รายชื่อ "รหัสสำหรับทดลอง" จะโผล่เฉพาะตอนเปิดโหมดสาธิตเท่านั้น
 * (รหัสพนักงานคือรหัสผ่าน จึงไม่ควรโชว์บนหน้าที่ใครก็เปิดได้)
 * เปิดโหมดสาธิตด้วยการรัน enableDemoPins() ใน Apps Script editor
 */
function apiHello() {
  return wrap_(function () {
    var demo = [];
    if (PropertiesService.getScriptProperties().getProperty('SHOW_DEMO') === 'true') {
      var m = getMaster_();
      demo = m.staff.slice(0, 2).concat(m.staff.filter(function (p) {
        return p.role === CFG.V.ROLE_ADMIN;
      }).slice(0, 1)).map(function (p) {
        return { id: p.id, name: p.name, role: p.role };
      });
    }
    return ok_({
      serverTime: fmtStamp_(new Date()),
      today: fmtDate_(new Date()),
      demo: demo
    });
  });
}

function enableDemoPins()  { PropertiesService.getScriptProperties().setProperty('SHOW_DEMO', 'true'); }
function disableDemoPins() { PropertiesService.getScriptProperties().deleteProperty('SHOW_DEMO'); }

/** เข้าสู่ระบบด้วยรหัสพนักงาน แล้วส่งข้อมูลทุกอย่างที่แอพต้องใช้กลับไปทีเดียว */
function apiLogin(empId) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireUser_(m, empId);
    return ok_(sessionPayload_(m, u));
  });
}

/** เรียกซ้ำเพื่อรีเฟรชรายการค้างคืน/ทะเบียนเครื่อง โดยไม่ต้องล็อกอินใหม่ */
function apiRefresh(empId) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireUser_(m, empId);
    return ok_(sessionPayload_(m, u));
  });
}

function sessionPayload_(m, u) {
  var isAdmin = (u.role === CFG.V.ROLE_ADMIN);

  // อ่านรายการค้างคืนของทุกคนรอบเดียว แล้วค่อยแยกใช้ 2 ทาง
  // ใช้ตัวที่อ่านเฉพาะคอลัมน์ที่ใช้ ไม่งั้นล็อกอินจะช้าลงเรื่อย ๆ ตามข้อมูลที่สะสม
  var open = openJobsFast_(null);

  // พนักงานหน้างานเห็นเฉพาะรายการค้างคืนของตัวเอง แอดมิน/หัวหน้างานเห็นทุกคน
  var seeAll = isAdmin || u.role === CFG.V.ROLE_LEAD;
  var mine = seeAll ? open : open.filter(function (j) { return j.empId === u.id; });

  // เครื่องที่คนอื่นเบิกไปแล้วยังไม่คืน — ส่งไปให้หน้าจอปิดปุ่มไว้
  // จะได้ไม่ติ๊กไปจนถ่ายรูปเสร็จแล้วค่อยมาโดนปฏิเสธตอนกดส่ง
  var busy = {}, b = busyCodes_(open);
  Object.keys(b).forEach(function (c) {
    busy[c] = { by: b[c].empName, id: b[c].empId, date: b[c].date, time: b[c].time };
  });

  return {
    user: u,
    isAdmin: isAdmin,
    topics: m.topics.filter(function (t) { return t.on; }),
    allTopics: m.topics,
    assets: m.assets,
    shifts: m.shifts,
    issueTags: m.issueTags,
    openJobs: mine,
    busyCodes: busy,
    today: fmtDate_(new Date()),
    serverTime: fmtStamp_(new Date())
  };
}

/**
 * ส่งรายการเข้าชีท — ทำทีเดียวจบ: อัปโหลดรูป → เขียนแถวบันทึก → เขียนแถวรูป
 *
 * payload = {
 *   empId, topicId, action, ref, shift, qty, codes:[], result, issue, note, gps,
 *   photos: [{slot, dataUrl, time, gps}], clientId
 * }
 */
function apiSubmit(payload) {
  return wrap_(function () {
    var p = payload || {};

    if (p.clientId) {
      var dup = alreadySubmitted_(p.clientId);
      if (dup) return ok_({ recordId: dup, duplicate: true });
    }

    var ctx = prepareSubmit_(p);
    var photos = (p.photos || []).filter(function (x) { return x && x.dataUrl; });
    checkPhotoSlots_(ctx, photos.map(function (x) { return s_(x.slot); }));

    var recordId = makeRecordId_(ctx.topic.id, new Date());
    var photoRows = [], folderUrl = '';
    if (photos.length) {
      var folder = recordFolder_(recordId);
      folderUrl = folder.getUrl();
      photos.forEach(function (ph, i) {
        var saved = savePhoto_(folder, recordId, s_(ph.slot), ph.dataUrl, i + 1);
        photoRows.push({
          slot: s_(ph.slot), url: saved.url,
          time: s_(ph.time) || fmtTime_(new Date()),
          gps: s_(ph.gps) || s_(p.gps)
        });
      });
    }

    return ok_(finishSubmit_(ctx, p, recordId, folderUrl, photoRows));
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  ส่งแบบ 3 จังหวะ — ให้หน้าบ้านอัปโหลดรูปหลายใบพร้อมกันได้
//
//  ส่งรูป 6 ใบในคำขอเดียว เซิร์ฟเวอร์ต้องสร้างไฟล์ใน Drive ทีละใบเรียงกัน
//  ใบสุดท้ายจึงต้องรอ 5 ใบแรกเสร็จก่อน รวมแล้วเกือบนาที
//
//  แยกเป็น เริ่ม → อัปโหลด (ขนาน) → ปิดงาน ทำให้ทั้งการส่งผ่านเน็ต
//  และการสร้างไฟล์เกิดพร้อมกัน เหลือราว 1 ใน 4 ของเดิม
//
//  apiSubmit เดิมยังอยู่ ใช้กับคิวออฟไลน์ที่ต้องส่งซ้ำทั้งก้อนในครั้งเดียว
// ══════════════════════════════════════════════════════════════════════════

/** จังหวะ 1 — ตรวจข้อมูล จองรหัสรายการ และเตรียมโฟลเดอร์ */
function apiBeginSubmit(payload) {
  return wrap_(function () {
    var p = payload || {};
    if (p.clientId) {
      var dup = alreadySubmitted_(p.clientId);
      if (dup) return ok_({ recordId: dup, duplicate: true });
    }
    var ctx = prepareSubmit_(p);
    var recordId = makeRecordId_(ctx.topic.id, new Date());
    var folder = recordFolder_(recordId);
    return ok_({ recordId: recordId, folderId: folder.getId(), folderUrl: folder.getUrl() });
  });
}

/**
 * จองรหัสรายการ + โฟลเดอร์ ตั้งแต่ถ่ายรูปใบแรก
 *
 * ตรวจแค่ผู้ใช้กับหัวข้อเท่านั้น เพราะตอนถ่ายรูปใบแรกยังกรอกข้อมูลไม่ครบ
 * (ยังไม่เลือกสถานะเครื่อง ยังไม่มีอาการ ฯลฯ) — การตรวจเต็มไปเกิดตอน apiCommitSubmit
 *
 * มีไว้ให้หน้าบ้านทยอยอัปโหลดรูประหว่างที่พนักงานยังถ่ายจุดอื่นอยู่
 * พอกดส่งจริงรูปขึ้นไปหมดแล้ว เหลือแค่เขียนแถวลงชีท
 */
function apiReserve(empId, topicId) {
  return wrap_(function () {
    var m = getMaster_();
    requireUser_(m, empId);
    var topic = null;
    m.topics.forEach(function (t) { if (t.id === s_(topicId)) topic = t; });
    if (!topic) throw new Error('ไม่พบหัวข้อ ' + s_(topicId) + ' ในชีทหัวข้อสำรวจ');
    if (!topic.on) throw new Error('หัวข้อ "' + topic.name + '" ถูกปิดใช้งานอยู่');

    var recordId = makeRecordId_(topic.id, new Date());
    var folder = recordFolder_(recordId);
    return ok_({ recordId: recordId, folderId: folder.getId(), folderUrl: folder.getUrl() });
  });
}

/** จังหวะ 2 — บันทึกรูป 1 ใบ (หน้าบ้านยิงพร้อมกันหลายคำขอได้) */
function apiUploadPhoto(empId, recordId, folderId, slot, dataUrl, time, gps, seq) {
  return wrap_(function () {
    requireUser_(getMaster_(), empId);
    var folder = DriveApp.getFolderById(s_(folderId));
    var saved = savePhoto_(folder, s_(recordId), s_(slot), dataUrl, Number(seq) || 1);
    return ok_({
      slot: s_(slot), url: saved.url,
      time: s_(time) || fmtTime_(new Date()),
      gps: s_(gps)
    });
  });
}

/** จังหวะ 3 — ตรวจว่ารูปครบ แล้วเขียนลงชีท */
function apiCommitSubmit(payload, photoRows, recordId, folderUrl) {
  return wrap_(function () {
    var p = payload || {};
    var rows = (photoRows || []).filter(function (x) { return x && x.url; });
    var ctx = prepareSubmit_(p);
    checkPhotoSlots_(ctx, rows.map(function (x) { return s_(x.slot); }));
    return ok_(finishSubmit_(ctx, p, s_(recordId), s_(folderUrl), rows));
  });
}

// ── ส่วนที่ใช้ร่วมกันทั้ง 2 เส้นทาง ───────────────────────────────────────

/** ตรวจทุกอย่างที่ไม่ต้องใช้รูป แล้วคืนค่าที่ผ่านการตรวจแล้ว */
function prepareSubmit_(p) {
  var m = getMaster_();
  var u = requireUser_(m, p.empId);

  var topic = null;
  m.topics.forEach(function (t) { if (t.id === s_(p.topicId)) topic = t; });
  if (!topic) throw new Error('ไม่พบหัวข้อ ' + s_(p.topicId) + ' ในชีทหัวข้อสำรวจ');
  if (!topic.on) throw new Error('หัวข้อ "' + topic.name + '" ถูกปิดใช้งานอยู่');

  var R = topic.rules || {};
  var action = s_(p.action) || CFG.V.BORROW;

  if (R.gps && !s_(p.gps)) throw new Error('หัวข้อนี้บังคับให้เปิดตำแหน่ง (GPS) ก่อนส่ง');

  var result = s_(p.result);
  if (result !== CFG.V.OK && result !== CFG.V.ISSUE) {
    throw new Error('ยังไม่ได้เลือกสถานะเครื่อง (ปกติ / มีปัญหา)');
  }
  if (result === CFG.V.ISSUE && !s_(p.issue)) {
    throw new Error('เลือก "มีปัญหา" ต้องอธิบายอาการด้วย');
  }

  // จำนวนเครื่องนับจากรหัสที่ติ๊ก ไม่ให้กรอกเองแล้ว (ตัวเลขจะได้ตรงกับรหัสเสมอ)
  // ยังรับ p.qty ไว้เผื่อรายการเก่าที่ค้างในคิวออฟไลน์ตั้งแต่ก่อนเปลี่ยน
  var codes = (p.codes || []).map(s_).filter(Boolean);

  // อุปกรณ์เสริมที่เบิกพ่วง (เช่น เลเซอร์ลบ) เป็นเครื่องเหมือนกัน แค่แยกรายการไว้
  // เพราะทุกแผนกเบิกเสริมได้ — จึงนับรวมเป็นจำนวนเดียวกันกับเครื่องหลัก
  var extra = (p.extraCodes || []).map(s_).filter(Boolean);
  var all = codes.concat(extra);

  var qty = all.length || Number(p.qty) || 0;
  if (!qty) throw new Error('ต้องติ๊กรหัสเครื่องอย่างน้อย 1 ตัว');

  // ตอนคืน: ต้องอ้างอิงรายการเบิกที่ยังค้างอยู่จริง
  // (อ่านชีทเฉพาะตอนคืนเท่านั้น ตอนเบิกไม่ต้องอ่าน จะได้เร็วขึ้น)
  var ref = '';
  if (action === CFG.V.RETURN) {
    ref = s_(p.ref);
    if (!ref) throw new Error('ไม่พบรายการเบิกที่จะคืน');
    var found = openJobsFast_(null).filter(function (j) { return j.id === ref; })[0];
    if (!found) throw new Error('รายการ ' + ref + ' ถูกคืนไปแล้ว หรือไม่มีอยู่ในชีท');
    if (!all.length) all = found.codes ? found.codes.split(/\s*,\s*/).filter(Boolean) : [];
    qty = all.length || qty;
  }

  // ถ่ายนอกกะยังส่งได้ แต่ต่อท้ายหมายเหตุไว้เป็นข้อยกเว้น
  var note = s_(p.note);
  if (R.shift && !inShift_(s_(p.shift), new Date())) {
    note = (note ? note + ' · ' : '') + '[นอกกะ] ส่งเมื่อ ' + fmtTime_(new Date());
  }

  return {
    u: u, topic: topic, action: action, result: result,
    codes: all, qty: qty, ref: ref, note: note
  };
}

/** ตรวจว่าถ่ายครบตามช่องบังคับในชีท "ช่องถ่ายรูป" หรือยัง */
function checkPhotoSlots_(ctx, slotNames) {
  var have = {};
  (slotNames || []).forEach(function (n) { have[s_(n)] = true; });

  var need = ctx.topic.slots.filter(function (sl) { return sl.req && !sl.onIssue; });

  if (ctx.topic.countMode) {
    // หัวข้อแบบนับจำนวน (เช่น IDATA) ไม่ล็อกว่าต้องมีช่องไหนบ้าง
    // เพราะเบิกไปหลายเครื่องแล้วกระจายกันไป ขอแค่มีรูปอุปกรณ์อย่างน้อย 1 ใบ
    var nonIssue = Object.keys(have).filter(function (n) { return n.indexOf('ปัญหา') < 0; });
    if (need.length && !nonIssue.length) throw new Error('ต้องแนบรูปอุปกรณ์อย่างน้อย 1 รูป');
  } else {
    var missing = need.filter(function (sl) { return !have[sl.th]; });
    if (missing.length) {
      throw new Error('ยังถ่ายไม่ครบ: ' + missing.map(function (x) { return x.th; }).join(', '));
    }
  }

  if (ctx.result === CFG.V.ISSUE && ctx.topic.rules && ctx.topic.rules.issue) {
    var hasIssuePhoto = Object.keys(have).some(function (n) { return n.indexOf('ปัญหา') >= 0; });
    if (!hasIssuePhoto) throw new Error('เลือก "มีปัญหา" ต้องแนบรูปจุดที่มีปัญหา');
  }
}

/**
 * กันเบิกเครื่องเดียวกันซ้ำซ้อน
 *
 * ต้องเรียก "ตอนกำลังจะเขียนจริง และอยู่ในล็อก" เท่านั้น
 * ถ้าไปตรวจตั้งแต่ตอนเปิดหน้าจอ สองคนที่กดส่งพร้อมกันจะผ่านทั้งคู่
 * เพราะต่างคนต่างเห็นว่าเครื่องยังว่างอยู่
 */
function assertCodesFree_(codes) {
  if (!codes || !codes.length) return;
  var busy = busyCodes_(openJobsFast_(null));
  var clash = codes.filter(function (c) { return busy[c]; });
  if (!clash.length) return;

  var j = busy[clash[0]];
  throw new Error('เครื่อง ' + clash.join(', ') + ' ถูกเบิกไปแล้วโดย ' + j.empName +
    ' (' + j.date + ' ' + j.time + ' น.) ยังไม่คืน\n\nติ๊กเครื่องนั้นออกแล้วกดส่งใหม่ รูปที่ถ่ายไว้ไม่หาย');
}

/** เขียนแถวลงชีทแล้วคืนผลให้หน้าบ้าน */
function finishSubmit_(ctx, p, recordId, folderUrl, photoRows) {
  writeRecord_({
    recordId: recordId,
    shift: s_(p.shift) || ctx.u.shift,
    empId: ctx.u.id, empName: ctx.u.name, dept: ctx.u.dept,
    topicName: ctx.topic.name,
    action: ctx.action,
    qty: ctx.qty,
    codes: ctx.codes.join(', '),
    result: ctx.result,
    issue: ctx.result === CFG.V.ISSUE ? s_(p.issue) : '',
    note: ctx.note,
    folderUrl: folderUrl,
    gps: s_(p.gps),
    ref: ctx.ref
  }, photoRows, function () {
    if (ctx.action === CFG.V.BORROW) assertCodesFree_(ctx.codes);
  });

  if (p.clientId) rememberSubmitted_(p.clientId, recordId);

  return {
    recordId: recordId,
    folderUrl: folderUrl,
    photoCount: photoRows.length,
    ts: fmtStamp_(new Date())
  };
}

/** true ถ้าเวลาปัจจุบันอยู่ในกะที่ระบุ (รองรับกะข้ามเที่ยงคืน) */
function inShift_(shiftText, when) {
  var m = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(shiftText || '');
  if (!m) return true; // อ่านกะไม่ออก = ไม่เตือน
  var mins = Number(Utilities.formatDate(when, CFG.TZ, 'H')) * 60 +
             Number(Utilities.formatDate(when, CFG.TZ, 'm'));
  var a = Number(m[1]) * 60 + Number(m[2]);
  var b = Number(m[3]) * 60 + Number(m[4]);
  return a <= b ? (mins >= a && mins <= b) : (mins >= a || mins <= b);
}

// กันส่งซ้ำ: จำ clientId ที่ส่งสำเร็จแล้ว 6 ชั่วโมง
function rememberSubmitted_(clientId, recordId) {
  try { CacheService.getScriptCache().put('sub:' + clientId, recordId, 21600); } catch (e) {}
}
function alreadySubmitted_(clientId) {
  try { return CacheService.getScriptCache().get('sub:' + clientId); } catch (e) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  เว็บแอดมิน
// ══════════════════════════════════════════════════════════════════════════

/**
 * ข้อมูลทั้งหมดของหน้าเว็บแอดมิน
 *
 * ส่งเฉพาะช่วงเวลาที่เลือก (ค่าเริ่มต้น 7 วันล่าสุด) ไม่ได้ส่งทั้งหมดตั้งแต่วันแรก
 * ไม่งั้นข้อมูลที่ต้องโหลดจะโตขึ้นทุกวันไม่มีที่สิ้นสุด จนสุดท้ายเปิดหน้าไม่ไหว
 *
 * ยกเว้น "ค้างคืน" ที่ยังดูจากทั้งหมดเสมอ เพราะของที่เบิกไปนานแล้วยังไม่คืน
 * ต้องเห็นตลอดไม่ว่าจะเลือกช่วงไหน
 */
function apiAdminLoad(empId, range) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireAdmin_(m, empId);
    var recs = allRecords_();

    var r = normRange_(range);
    var picked = filterRecords_(recs, r);

    var keep = {};
    picked.forEach(function (x) { keep[x.id] = true; });
    var photos = allPhotos_().filter(function (ph) { return keep[ph.rec]; });

    return ok_({
      user: u,
      canEdit: canWriteMaster_(u),
      master: m,
      range: r,
      periods: periods_(recs),
      totalRecords: recs.length,
      pairs: buildPairs_(picked, photos, hiddenIds_()),
      records: picked,
      openJobs: openJobs_(recs, null),
      today: fmtDate_(new Date())
    });
  });
}

/** ช่วงเวลาที่หน้าแอดมินขอมา — ไม่ส่งอะไรมาถือว่า 7 วันล่าสุด */
function normRange_(range) {
  var r = range || {};
  var mode = s_(r.mode) || 'days';
  if (mode === 'month') return { mode: 'month', y: Number(r.y), m: Number(r.m) };
  if (mode === 'year')  return { mode: 'year',  y: Number(r.y) };
  if (mode === 'all')   return { mode: 'all' };
  return { mode: 'days', n: Number(r.n) || 7 };
}

function filterRecords_(recs, r) {
  if (r.mode === 'all') return recs;

  var from = null;
  if (r.mode === 'days') {
    from = new Date(); from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (r.n - 1));
  }

  var keep = recs.filter(function (x) {
    var d = recDay_(x);
    if (!d) return false;
    if (r.mode === 'month') return d.getFullYear() === r.y && (d.getMonth() + 1) === r.m;
    if (r.mode === 'year')  return d.getFullYear() === r.y;
    return d >= from;
  });

  // ดึงคู่ที่ขาดมาด้วย — เบิกเดือนก่อนแล้วมาคืนในช่วงนี้ ต้องเห็นทั้งคู่
  var have = {}, need = {};
  keep.forEach(function (x) { have[x.id] = true; });
  keep.forEach(function (x) { if (x.ref && !have[x.ref]) need[x.ref] = true; });
  recs.forEach(function (x) {
    if (have[x.id]) return;
    if (need[x.id] || (x.ref && have[x.ref])) { keep.push(x); have[x.id] = true; }
  });
  return keep;
}

/** เดือน/ปีที่มีข้อมูลจริง เอาไปทำดร็อปดาวน์ให้เลือกย้อนหลัง */
function periods_(recs) {
  var mo = {}, yr = {};
  recs.forEach(function (x) {
    var d = recDay_(x);
    if (!d) return;
    var y = d.getFullYear(), m = d.getMonth() + 1;
    yr[y] = true;
    mo[y + '-' + (m < 10 ? '0' + m : m)] = true;
  });
  return {
    months: Object.keys(mo).sort().reverse(),
    years: Object.keys(yr).sort().reverse()
  };
}

/**
 * จับคู่ "เบิก" กับ "คืน" ให้เป็นรายการเดียว เพื่อให้หน้าแอดมินดูรูปสองฝั่งได้
 * แถวคืนจะอ้างอิงรหัสรายการเบิกในคอลัมน์ "อ้างอิงรายการเบิก"
 */
function buildPairs_(recs, photos, hidden) {
  var byRec = {};
  photos.forEach(function (ph) {
    (byRec[ph.rec] = byRec[ph.rec] || []).push(ph);
  });
  hidden = hidden || {};

  var side = function (r) {
    if (!r) return null;
    // ซ่อนไว้ = ไม่ส่งรูปไปให้หน้าเว็บ แต่ข้อมูลในชีทและไฟล์ในไดรฟ์ยังอยู่ครบ
    var hide = !!hidden[r.id];
    return {
      recordId: r.id, time: (/(\d{1,2}:\d{2})/.exec(r.ts) || [, r.ts])[1],
      ts: r.ts, qty: r.qty, photoN: r.photoN, folder: r.folder,
      deleted: r.folder === 'ลบรูปแล้ว',
      hidden: hide,
      gps: r.gps,
      photos: hide ? [] : (byRec[r.id] || []).map(function (ph) {
        return { slot: ph.slot, url: ph.url, time: ph.time, gps: ph.gps };
      })
    };
  };

  var returns = {};
  recs.forEach(function (r) { if (r.ref) returns[r.ref] = r; });

  return recs.filter(function (r) { return r.action === CFG.V.BORROW; })
    .map(function (r) {
      var back = returns[r.id] || null;
      return {
        id: r.id, topic: r.topic, date: r.date, shift: r.shift,
        empId: r.empId, name: r.empName, dept: r.dept,
        codes: (back && back.codes) || r.codes,
        qty: r.qty, qtyBack: back ? back.qty : null,
        status: (back && back.result === CFG.V.ISSUE) ? CFG.V.ISSUE : r.result,
        issue: (back && back.issue) || r.issue,
        note: [r.note, back && back.note].filter(Boolean).join(' · '),
        out: side(r), back: side(back)
      };
    }).reverse();
}

function apiAdminDeletePhotos(empId, recordId) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireAdmin_(m, empId);
    if (!canWriteMaster_(u)) throw new Error('หัวหน้างานดูได้อย่างเดียว ลบรูปไม่ได้');
    var n = deleteRecordPhotos_(s_(recordId));
    return ok_({ deleted: n });
  });
}

// ── ซ่อนรูปจากหน้าเว็บ (ไม่ลบอะไรทั้งสิ้น) ────────────────────────────
//
// เก็บรายชื่อที่ซ่อนไว้ใน Script Properties ของโปรเจกต์
// จงใจไม่เก็บในชีท เพราะต้องการให้ชีทคงข้อมูลและลิงก์รูปไว้ครบเหมือนเดิมทุกอย่าง
// และไม่แตะไฟล์ใน Drive เลย — กดผิดก็เอากลับมาแสดงได้ทันที

var HIDE_PREFIX = 'h:';

function hiddenIds_() {
  var all = PropertiesService.getScriptProperties().getProperties();
  var out = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(HIDE_PREFIX) === 0) out[k.slice(HIDE_PREFIX.length)] = true;
  });
  return out;
}

/**
 * @param {boolean} show  true = เอากลับมาแสดง, false/ไม่ส่ง = ซ่อน
 */
function apiAdminHidePhotos(empId, recordIds, show) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireAdmin_(m, empId);
    if (!canWriteMaster_(u)) throw new Error('หัวหน้างานดูได้อย่างเดียว ซ่อนรูปไม่ได้');

    var ids = (recordIds || []).map(s_).filter(Boolean);
    if (!ids.length) throw new Error('ยังไม่ได้เลือกรายการ');
    if (ids.length > 300) throw new Error('ทำได้ครั้งละไม่เกิน 300 รายการ (เลือกมา ' + ids.length + ')');

    var props = PropertiesService.getScriptProperties();
    if (show) {
      ids.forEach(function (id) { props.deleteProperty(HIDE_PREFIX + id); });
    } else {
      var add = {};
      ids.forEach(function (id) { add[HIDE_PREFIX + id] = '1'; });
      props.setProperties(add, false);
    }
    return ok_({ n: ids.length, show: !!show });
  });
}

/**
 * ลบรูปหลายรายการในครั้งเดียว (ติ๊กเลือกจากหน้าคลังรูป)
 *
 * จำกัดครั้งละ 150 รายการ กันชนเพดานเวลาทำงาน 6 นาทีของ Apps Script
 * (เดิมจำกัด 25 เพราะลบไฟล์ทีละใบ ตอนนี้ทิ้งทั้งโฟลเดอร์ทีเดียวเลยไปได้ไกลกว่า)
 */
function apiAdminDeletePhotosBulk(empId, recordIds) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireAdmin_(m, empId);
    if (!canWriteMaster_(u)) throw new Error('หัวหน้างานดูได้อย่างเดียว ลบรูปไม่ได้');

    var ids = (recordIds || []).map(s_).filter(Boolean);
    if (!ids.length) throw new Error('ยังไม่ได้เลือกรายการ');
    if (ids.length > 150) throw new Error('ลบได้ครั้งละไม่เกิน 150 รายการ (เลือกมา ' + ids.length + ')');

    var r = deleteRecordPhotosBulk_(ids);
    return ok_({ deleted: r.deleted, records: r.records, failed: r.failed });
  });
}

// ── แก้ทะเบียน/หัวข้อ/เงื่อนไข ────────────────────────────────────────────

function adminGuard_(empId) {
  var m = getMaster_();
  var u = requireAdmin_(m, empId);
  if (!canWriteMaster_(u)) throw new Error('บัญชีนี้แก้ไขข้อมูลตั้งค่าไม่ได้');
  return m;
}

function apiSaveStaff(empId, p) {
  return wrap_(function () {
    adminGuard_(empId);
    if (!s_(p.id) || !s_(p.name)) throw new Error('ต้องมีรหัสพนักงานและชื่อ');
    masterUpsert_(CFG.M.STAFF, CFG.COL.STAFF.ID, s_(p.id), [
      s_(p.id), s_(p.name), s_(p.dept), s_(p.shift),
      s_(p.role) || CFG.V.ROLE_FIELD, s_(p.status) || CFG.V.ACTIVE
    ]);
    return ok_({ master: getMaster_(true) });
  });
}

function apiDeleteStaff(empId, id) {
  return wrap_(function () {
    adminGuard_(empId);
    if (s_(id) === s_(empId)) throw new Error('ลบบัญชีตัวเองไม่ได้');
    masterDelete_(CFG.M.STAFF, CFG.COL.STAFF.ID, s_(id));
    return ok_({ master: getMaster_(true) });
  });
}

function apiSaveAsset(empId, p) {
  return wrap_(function () {
    adminGuard_(empId);
    if (!s_(p.code)) throw new Error('ต้องมีรหัสเครื่อง');
    masterUpsert_(CFG.M.ASSETS, CFG.COL.ASSET.CODE, s_(p.code), [
      s_(p.code), s_(p.type), s_(p.dept),
      s_(p.status) || CFG.V.ASSET_READY, s_(p.note)
    ]);
    return ok_({ master: getMaster_(true) });
  });
}

function apiDeleteAsset(empId, code) {
  return wrap_(function () {
    adminGuard_(empId);
    masterDelete_(CFG.M.ASSETS, CFG.COL.ASSET.CODE, s_(code));
    return ok_({ master: getMaster_(true) });
  });
}

function apiSaveTopic(empId, p) {
  return wrap_(function () {
    adminGuard_(empId);
    if (!s_(p.id)) throw new Error('ต้องมีรหัสหัวข้อ');
    masterUpsert_(CFG.M.TOPICS, CFG.COL.TOPIC.ID, s_(p.id), [
      s_(p.id), s_(p.name), s_(p.desc), p.on ? 'TRUE' : 'FALSE', Number(p.order) || 99
    ]);
    return ok_({ master: getMaster_(true) });
  });
}

function apiDeleteTopic(empId, id) {
  return wrap_(function () {
    adminGuard_(empId);
    masterDelete_(CFG.M.TOPICS, CFG.COL.TOPIC.ID, s_(id));
    return ok_({ master: getMaster_(true) });
  });
}

/** ช่องถ่ายรูป: คีย์คือ รหัสหัวข้อ + ชื่อช่อง (ไทย) — เขียนทับทั้งหัวข้อทีเดียว */
function apiSaveSlots(empId, topicId, slots) {
  return wrap_(function () {
    adminGuard_(empId);
    var sh = masterSS_().getSheetByName(CFG.M.SLOTS);
    var C = CFG.COL.SLOT;
    var last = sh.getLastRow();

    // ลบของเดิมของหัวข้อนี้
    if (last >= 2) {
      var col = sh.getRange(2, C.TOPIC, last - 1, 1).getValues();
      for (var r = col.length - 1; r >= 0; r--) {
        if (s_(col[r][0]) === s_(topicId)) sh.deleteRow(r + 2);
      }
    }
    // เขียนของใหม่ต่อท้าย
    var rows = (slots || []).map(function (sl, i) {
      return [
        s_(topicId), i + 1, s_(sl.th), s_(sl.en),
        sl.onIssue ? 'เมื่อมีปัญหา' : (sl.req ? 'TRUE' : 'FALSE'),
        s_(sl.hint)
      ];
    });
    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    }
    clearMasterCache_();
    return ok_({ master: getMaster_(true) });
  });
}

function apiSetRule(empId, topicId, ruleId, ruleName, on) {
  return wrap_(function () {
    adminGuard_(empId);
    var sh = masterSS_().getSheetByName(CFG.M.RULES);
    var C = CFG.COL.RULE;
    var last = sh.getLastRow();
    var row = 0;
    if (last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, 4).getValues();
      for (var i = 0; i < vals.length; i++) {
        if (s_(vals[i][C.TOPIC - 1]) === s_(topicId) && s_(vals[i][C.ID - 1]) === s_(ruleId)) {
          row = i + 2; break;
        }
      }
    }
    if (!row) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 4).setValues([[
      s_(topicId), s_(ruleId), s_(ruleName), on ? 'TRUE' : 'FALSE'
    ]]);
    clearMasterCache_();
    return ok_({ master: getMaster_(true) });
  });
}


// ==========================================================================
//  Setup.gs
// ==========================================================================

/**
 * Setup.gs — รันครั้งเดียวตอนติดตั้ง แล้วใช้ตรวจสุขภาพระบบภายหลัง
 *
 * วิธีใช้: เปิด Apps Script editor → เลือกฟังก์ชัน → กด Run
 */

/** ตรวจว่าชีทและคอลัมน์ทุกอันตรงกับที่โค้ดคาดไว้ */
function checkSetup() {
  var out = [];
  var expect = [
    [CFG.MASTER_ID, CFG.M.STAFF,  ['รหัสพนักงาน', 'ชื่อ-สกุล', 'แผนก', 'กะการทำงาน', 'บทบาท', 'สถานะ']],
    [CFG.MASTER_ID, CFG.M.ASSETS, ['รหัสเครื่อง', 'ประเภท', 'แผนกประจำ', 'สถานะ', 'หมายเหตุ']],
    [CFG.MASTER_ID, CFG.M.TOPICS, ['รหัสหัวข้อ', 'ชื่อหัวข้อ', 'คำอธิบาย', 'เปิดใช้งาน', 'ลำดับ']],
    [CFG.MASTER_ID, CFG.M.SLOTS,  ['รหัสหัวข้อ', 'ลำดับ', 'ชื่อช่อง (ไทย)', 'ชื่อช่อง (EN)', 'บังคับ', 'คำแนะนำบนจอ']],
    [CFG.MASTER_ID, CFG.M.RULES,  ['รหัสหัวข้อ', 'รหัสเงื่อนไข', 'ชื่อเงื่อนไข', 'ค่า']],
    [CFG.DATA_ID,   CFG.D.RECORDS, ['รหัสรายการ', 'ประทับเวลา', 'วันที่เบิกคืน', 'กะการทำงาน', 'รหัสพนักงาน',
       'ชื่อผู้เบิก', 'แผนก', 'หัวข้อ', 'สถานะใช้งาน', 'จำนวนเครื่อง', 'รหัสเครื่อง', 'ผลตรวจ', 'อาการ',
       'ข้อมูลเพิ่มเติม', 'จำนวนรูป', 'ลิงก์โฟลเดอร์รูป', 'พิกัด GPS', 'อ้างอิงรายการเบิก', 'สถานะส่ง']],
    [CFG.DATA_ID,   CFG.D.PHOTOS, ['รหัสรายการ', 'ช่องถ่าย', 'ลิงก์รูป', 'เวลาถ่าย', 'พิกัด']]
  ];

  expect.forEach(function (row) {
    var ssId = row[0], name = row[1], cols = row[2];
    try {
      var sh = SpreadsheetApp.openById(ssId).getSheetByName(name);
      if (!sh) { out.push('✗ ไม่พบชีท "' + name + '"'); return; }
      var head = sh.getRange(1, 1, 1, cols.length).getValues()[0].map(function (x) { return String(x).trim(); });
      var bad = [];
      cols.forEach(function (c, i) { if (head[i] !== c) bad.push((i + 1) + ': คาดว่า "' + c + '" แต่เจอ "' + head[i] + '"'); });
      out.push((bad.length ? '✗ ' : '✓ ') + name + (bad.length ? ' — ' + bad.join(' | ') : ''));
    } catch (e) {
      out.push('✗ ' + name + ' — ' + e.message);
    }
  });

  try {
    var f = DriveApp.getFolderById(CFG.DRIVE_PARENT_ID);
    out.push('✓ โฟลเดอร์ Drive: ' + f.getName());
  } catch (e) {
    out.push('✗ เปิดโฟลเดอร์ Drive ไม่ได้ — ' + e.message);
  }

  try {
    var m = getMaster_(true);
    out.push('✓ อ่าน MASTER ได้: พนักงาน ' + m.staff.length + ' คน, เครื่อง ' + m.assets.length +
             ', หัวข้อเปิดใช้ ' + m.topics.filter(function (t) { return t.on; }).length + '/' + m.topics.length);
    m.topics.forEach(function (t) {
      out.push('   · ' + t.id + ' "' + t.name + '" — ช่องบังคับ ' +
        t.slots.filter(function (x) { return x.req && !x.onIssue; }).length +
        ', เงื่อนไขเปิด ' + Object.keys(t.rules).filter(function (k) { return t.rules[k]; }).join(','));
    });
  } catch (e) {
    out.push('✗ อ่าน MASTER ไม่ได้ — ' + e.message);
  }

  try {
    out.push('✓ URL เว็บแอพ: ' + (ScriptApp.getService().getUrl() || '(ยังไม่ได้ deploy)'));
  } catch (e) {}

  var msg = out.join('\n');
  console.log(msg);
  return msg;
}

/** วางสูตร FILTER ในชีท "ค้างคืน" และลบแถวคำอธิบายทิ้ง */
function installOpenReturnsFormula() {
  var sh = dataSS_().getSheetByName(CFG.D.OPEN);
  if (!sh) throw new Error('ไม่พบชีท ' + CFG.D.OPEN);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  sh.getRange('A2').setFormula(
    '=FILTER({บันทึก!A2:A, บันทึก!K2:K, บันทึก!F2:F, บันทึก!G2:G, บันทึก!B2:B}, ' +
    'บันทึก!I2:I="เบิก", COUNTIF(บันทึก!R2:R, บันทึก!A2:A)=0, บันทึก!A2:A<>"")'
  );
  return 'วางสูตรแล้ว';
}

/** ล้างแคช MASTER — ใช้เมื่อแก้ชีทเองแล้วอยากให้แอพเห็นทันที */
function refreshCache() {
  clearMasterCache_();
  return 'ล้างแคชแล้ว — แอพจะอ่านชีทใหม่ในการเรียกครั้งถัดไป';
}

/** ตั้งเลขรันของรหัสรายการใหม่ (ปกติไม่ต้องแตะ) */
function resetSequence() {
  PropertiesService.getScriptProperties().deleteProperty('seq');
  return 'จะไล่หาเลขล่าสุดจากชีทใหม่ในการส่งครั้งถัดไป (ล่าสุดตอนนี้: ' + scanMaxSeq_() + ')';
}

/** เมนูในชีท MASTER เพื่อกดใช้งานได้โดยไม่ต้องเปิด Apps Script editor */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ระบบถ่ายรูป')
    .addItem('ตรวจการติดตั้ง', 'menuCheck')
    .addItem('ล้างแคชตั้งค่า', 'menuRefresh')
    .addSeparator()
    .addItem('เปิดเว็บแอดมิน', 'menuAdmin')
    .addToUi();
}
function menuCheck()   { SpreadsheetApp.getUi().alert(checkSetup()); }
function menuRefresh() { SpreadsheetApp.getUi().alert(refreshCache()); }
function menuAdmin() {
  var url = ScriptApp.getService().getUrl() + '?page=admin';
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput('<a href="' + url + '" target="_blank">เปิดเว็บแอดมิน</a>').setHeight(80),
    'เว็บแอดมิน'
  );
}
