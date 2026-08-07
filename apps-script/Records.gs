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
