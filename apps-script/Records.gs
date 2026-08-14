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

/**
 * เขตเวลาของ "ตัวชีท" ไม่ใช่ของโค้ด
 *
 * ชีทเก็บวันเวลาเป็นเลขหน้าปัด (11/8 18:07) ไม่ได้เก็บว่าเป็นเวลาที่ไหน
 * พอ getValues() แปลงกลับเป็น Date มันอ่านเลขนั้นด้วยเขตเวลาของชีท
 * ถ้าเราเอาไปจัดรูปแบบด้วย Asia/Bangkok ทั้งที่ชีทตั้งเป็นเขตอื่น เวลาจะเพี้ยน
 *
 * ของจริงที่เจอ: ชีทโชว์ 11/8/2026 18:07:53 แต่แอพอ่านได้ 12/8/2026 08:07:53
 * เพี้ยนไป 14 ชั่วโมงพอดี เพราะชีทตั้งเขตเวลาเป็นอเมริกา (UTC-7) ส่วนโค้ดอ่านเป็นไทย (UTC+7)
 *
 * แก้ด้วยการอ่านกลับด้วยเขตเวลาของชีทเอง เลขที่ได้จึงตรงกับที่ตาเห็นในชีทเสมอ
 * ไม่ว่าใครจะไปตั้งเขตเวลาของชีทเป็นอะไรก็ไม่พังอีก
 */
function sheetTZ_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('sheettz');
  if (hit) return hit;
  var tz = CFG.TZ;
  try { tz = dataSS_().getSpreadsheetTimeZone() || CFG.TZ; } catch (e) {}
  try { cache.put('sheettz', tz, 21600); } catch (e) {}
  return tz;
}

/** แปลงค่าจากชีทเป็นข้อความวันที่ ไม่ว่าจะเก็บมาเป็น Date หรือ string */
function cellDate_(v, withTime) {
  if (!(v instanceof Date)) return s_(v);
  return Utilities.formatDate(v, sheetTZ_(), withTime ? 'd/M/yyyy, HH:mm:ss' : 'd/M/yyyy');
}

/**
 * คอลัมน์ "เวลา" ของชีทรูปภาพ — ต้องอ่านเป็นเวลา ไม่ใช่วันที่
 *
 * เราเขียนลงไปเป็นข้อความ "09:12:31" แต่ชีทแปลงให้เป็นเซลล์เวลาเอง
 * ซึ่งข้างในคือวันที่ 30/12/1899 บวกเวลานั้น พออ่านกลับด้วย cellDate_
 * ที่จัดรูปแบบเป็น d/M/yyyy จึงได้ "31/12/1899" โผล่มาแทนเวลาจริงในคลังรูป
 */
function cellTime_(v) {
  if (!(v instanceof Date)) return s_(v);
  return Utilities.formatDate(v, sheetTZ_(), 'HH:mm:ss');
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

/** แถวดิบจากชีท "บันทึก" -> ออบเจ็กต์ที่หน้าบ้านใช้ */
function mkRecord_(r) {
  var C = CFG.COL.REC;
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
      sent:     s_(r[C.SENT - 1]),
      by:       s_(r[C.BY - 1])     // แอดมินที่บันทึกแทน ว่าง = เบิกเอง
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  อ่านเฉพาะช่วงที่หน้าแอดมินขอ (แทนการอ่านทั้งใบแล้วค่อยกรองทีหลัง)
//
//  ของเดิม: เลือก "7 วันล่าสุด" ก็ยังอ่านชีทบันทึกทั้งใบครบ 20 คอลัมน์
//  และอ่านชีทรูปทั้งใบ (1 แถวต่อ 1 รูป — โตเร็วกว่าชีทบันทึก 5-6 เท่า)
//  แล้วค่อยเอามาทิ้งใน memory ทีหลัง การเลือกช่วงจึงไม่ได้ช่วยให้เร็วขึ้นเลย
//
//  ของใหม่: อ่านคอลัมน์แคบ ๆ ก่อน (รหัสรายการ + อ้างอิง) เพื่อรู้ว่าต้องการแถวไหนบ้าง
//  แล้วค่อยอ่านข้อมูลเต็มเฉพาะช่วงแถวที่ครอบคลุมแถวเหล่านั้น
//  เพราะแถวถูกต่อท้ายเรียงเวลาอยู่แล้ว ช่วงวันที่จึงมักเป็นแถวท้าย ๆ ก้อนเดียว
//
//  ผลลัพธ์เหมือนเดิมทุกประการ รวมถึงลำดับแถวและการดึง "คู่เบิก-คืน" ข้ามช่วงมาด้วย
//  กรณีแย่ที่สุด (เลือก "ทั้งหมด" หรือมีแถวที่อ่านวันที่จากรหัสไม่ออก) = เท่าของเดิม
// ══════════════════════════════════════════════════════════════════════════

/** วันที่ของรายการจากรหัส (หัวข้อ-yyyyMMdd-เลขรัน) — null ถ้าอ่านไม่ออก */
function dayOfId_(id) {
  var m = /-(\d{4})(\d{2})(\d{2})-/.exec(s_(id));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** แปลงช่วงที่หน้าแอดมินขอ เป็นฟังก์ชันตรวจว่า "วันนี้อยู่ในช่วงไหม" */
function rangeTest_(r) {
  if (r.mode === 'all') return function () { return true; };

  var from = null, one = null;
  if (r.mode === 'days') {
    from = new Date(); from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (r.n - 1));
  }
  if (r.mode === 'day') {
    var g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.d || '');
    if (!g) return function () { return false; };
    one = new Date(Number(g[1]), Number(g[2]) - 1, Number(g[3])).getTime();
  }
  return function (d) {
    if (!d) return false;
    if (r.mode === 'day')   return d.getTime() === one;
    if (r.mode === 'month') return d.getFullYear() === r.y && (d.getMonth() + 1) === r.m;
    if (r.mode === 'year')  return d.getFullYear() === r.y;
    return d >= from;
  };
}

/**
 * @returns {{picked:Array, periods:Object, total:number}}
 */
function recordsForRange_(r) {
  var C = CFG.COL.REC;
  var sh = dataSS_().getSheetByName(CFG.D.RECORDS);
  var empty = { picked: [], periods: { months: [], years: [] }, total: 0 };
  var last = sh.getLastRow();
  if (last < 2) return empty;

  var n = last - 1;
  var full = Math.min(C.BY, sh.getMaxColumns());

  // ขอ "ทั้งหมด" อยู่แล้ว — อ่านรวดเดียวจบ ไม่ต้องเสียเวลาสำรวจว่าต้องการแถวไหน
  if (r.mode === 'all') {
    var every = sh.getRange(2, 1, n, full).getValues()
      .map(mkRecord_).filter(function (x) { return x.id; });
    var amo = {}, ayr = {};
    every.forEach(function (x) {
      var d = recDay_(x);
      if (!d) return;
      var ay = d.getFullYear(), am = d.getMonth() + 1;
      ayr[ay] = true;
      amo[ay + '-' + (am < 10 ? '0' + am : am)] = true;
    });
    return { picked: every, periods: sortPeriods_(amo, ayr), total: every.length };
  }

  var ids  = sh.getRange(2, C.ID,  n, 1).getValues();
  var refs = sh.getRange(2, C.REF, n, 1).getValues();
  var hit = rangeTest_(r);

  var rowOf = {}, inRange = {}, need = {}, unknown = [];
  var mo = {}, yr = {}, total = 0;

  for (var i = 0; i < n; i++) {
    var id = s_(ids[i][0]);
    if (!id) continue;
    total++;
    rowOf[id] = i;

    var d = dayOfId_(id);
    if (d) {
      var y = d.getFullYear(), m = d.getMonth() + 1;
      yr[y] = true;
      mo[y + '-' + (m < 10 ? '0' + m : m)] = true;
      if (hit(d)) { inRange[i] = true; need[i] = true; }
    } else {
      // อ่านวันที่จากรหัสไม่ออก (แถวที่กรอกมือ) — ต้องอ่านข้อมูลเต็มมาตัดสินจากคอลัมน์วันที่
      unknown.push(i);
      need[i] = true;
    }
  }

  // ดึงคู่ที่ขาดมาด้วย — เบิกเดือนก่อนแล้วมาคืนในช่วงนี้ ต้องเห็นทั้งคู่
  // ตรรกะตรงกับของเดิมเป๊ะ: ทำรอบเดียว ไม่ไล่ต่อเป็นทอด ๆ
  var haveId = {};
  Object.keys(need).forEach(function (k) { haveId[s_(ids[k][0])] = true; });
  Object.keys(need).forEach(function (k) {
    var rf = s_(refs[k][0]);
    if (rf && !haveId[rf] && rowOf[rf] !== undefined) need[rowOf[rf]] = true;
  });
  for (var j = 0; j < n; j++) {
    if (need[j]) continue;
    var rf2 = s_(refs[j][0]);
    if (rf2 && haveId[rf2]) need[j] = true;
  }

  var idx = Object.keys(need).map(Number).sort(function (a, b) { return a - b; });
  if (!idx.length) return { picked: [], periods: sortPeriods_(mo, yr), total: total };

  var from = idx[0], to = idx[idx.length - 1];
  var block = sh.getRange(2 + from, 1, to - from + 1, full).getValues();
  var mk = function (i) { return mkRecord_(block[i - from]); };

  // ลำดับต้องเหมือนของเดิม: แถวในช่วงตามลำดับในชีทก่อน แล้วค่อยต่อด้วยคู่ที่ดึงเพิ่ม
  var picked = [], taken = {};
  idx.forEach(function (i) {
    if (!inRange[i] && unknown.indexOf(i) < 0) return;
    var rec = mk(i);
    if (!rec.id) return;
    if (!inRange[i] && !hit(recDay_(rec))) return;   // แถวกรอกมือ — ตัดสินจากคอลัมน์วันที่
    picked.push(rec); taken[i] = true;
  });
  idx.forEach(function (i) {
    if (taken[i]) return;
    var rec = mk(i);
    if (rec.id) picked.push(rec);
  });

  return { picked: picked, periods: sortPeriods_(mo, yr), total: total };
}

function sortPeriods_(mo, yr) {
  return {
    months: Object.keys(mo).sort().reverse(),
    years: Object.keys(yr).sort().reverse()
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  แปะรูปให้รายการที่เขียนแถวไปแล้ว
//
//  ของเดิม "แถวบันทึก + รูป" ต้องสำเร็จพร้อมกันทั้งก้อน
//  รูปอัปไม่ผ่านแม้ใบเดียว = ทั้งรายการไม่ถูกเขียน = เครื่องล็อกค้างในระบบ
//  ทั้งที่ข้อมูลสำคัญจริง ๆ ("เครื่องกลับมาแล้ว") หนักแค่ไม่กี่ร้อยไบต์
//
//  ตอนนี้เขียนแถวก่อนเลย ติดป้าย "รอรูป" ไว้ แล้วรูปตามมาแปะทีหลังได้
//  ครบเมื่อไหร่ป้ายเปลี่ยนเป็น "ส่งแล้ว" — ระหว่างนั้นแอดมินเห็นว่ารายการไหนยังขาด
// ══════════════════════════════════════════════════════════════════════════

/** หาแถวของรหัสรายการ — ไล่จากท้ายขึ้นมา เพราะของที่เพิ่งส่งอยู่ท้ายชีทเสมอ */
function findRecordRow_(sh, recordId) {
  var C = CFG.COL.REC;
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, C.ID, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (s_(ids[i][0]) === s_(recordId)) return i + 2;
  }
  return 0;
}

/**
 * @param {boolean} done  true = ครบแล้ว เปลี่ยนป้ายเป็น "ส่งแล้ว"
 * @returns {{added:number, total:number, done:boolean}}
 */
function addPhotoRows_(recordId, photoRows, done) {
  var id = s_(recordId);
  if (!id) throw new Error('ไม่ได้ระบุรหัสรายการ');

  var ss = dataSS_();
  var shR = ss.getSheetByName(CFG.D.RECORDS);
  var C = CFG.COL.REC;

  var rows = (photoRows || []).filter(function (x) { return x && x.url; });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);   // ใช้ล็อกตัวเดียวกับตอนเขียนแถว กันแถวรูปทับกัน
  try {
    var row = findRecordRow_(shR, id);
    if (!row) throw new Error('ไม่พบรายการ ' + id + ' ในชีท');

    if (rows.length) {
      var shP = ss.getSheetByName(CFG.D.PHOTOS);
      var start = shP.getLastRow() + 1;
      shP.getRange(start, 1, rows.length, 5).setValues(rows.map(function (ph) {
        return [id, s_(ph.slot), s_(ph.url), s_(ph.time), s_(ph.gps)];
      }));
    }

    var total = (Number(shR.getRange(row, C.PHOTO_N).getValue()) || 0) + rows.length;
    shR.getRange(row, C.PHOTO_N).setValue(total);
    shR.getRange(row, C.SENT).setValue(done ? CFG.V.SENT : CFG.V.PENDING);

    return { added: rows.length, total: total, done: !!done };
  } finally {
    lock.releaseLock();
  }
}

/**
 * รายการที่รูปยังมาไม่ครบ — ให้หน้าแอดมินตามเก็บได้ว่าใครยังไม่ส่ง
 * อ่านแค่ 6 คอลัมน์แคบ ๆ ไม่ใช่ทั้งใบ เพราะเรียกทุกครั้งที่เปิดหน้าแอดมิน
 */
function pendingPhotoRecords_() {
  var C = CFG.COL.REC;
  var sh = dataSS_().getSheetByName(CFG.D.RECORDS);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var n = last - 1;
  var sent = sh.getRange(2, C.SENT, n, 1).getValues();
  var hit = [];
  for (var i = 0; i < n; i++) if (s_(sent[i][0]) === CFG.V.PENDING) hit.push(i);
  if (!hit.length) return [];

  // แถวที่ค้างมักกระจุกอยู่ท้ายชีท อ่านเป็นก้อนเดียวคลุมตั้งแต่ตัวแรกถึงตัวสุดท้าย
  var from = hit[0], to = hit[hit.length - 1];
  var block = sh.getRange(2 + from, 1, to - from + 1, Math.min(C.BY, sh.getMaxColumns())).getValues();

  return hit.map(function (i) {
    var r = mkRecord_(block[i - from]);
    return {
      id: r.id, ts: r.ts, date: r.date, action: r.action, topic: r.topic,
      empId: r.empId, empName: r.empName, dept: r.dept,
      codes: r.codes, photoN: r.photoN, folder: r.folder
    };
  }).filter(function (x) { return x.id; }).reverse();
}

/** แถวเดียว + ลิงก์รูปที่ชีทรู้จักอยู่แล้ว — ใช้ตอนซ่อมรายการ */
function recordWithPhotos_(recordId) {
  var C = CFG.COL.REC;
  var sh = dataSS_().getSheetByName(CFG.D.RECORDS);
  var row = findRecordRow_(sh, recordId);
  if (!row) throw new Error('ไม่พบรายการ ' + recordId + ' ในชีท');

  var width = Math.min(C.BY, sh.getMaxColumns());
  var rec = mkRecord_(sh.getRange(row, 1, 1, width).getValues()[0]);

  var keep = {};
  keep[rec.id] = true;
  return { rec: rec, urls: photosForRecords_(keep).map(function (p) { return p.url; }) };
}

/** แถวรูปของรายการที่เลือกไว้ — อ่านเฉพาะช่วงแถวที่มีของจริง ไม่ใช่ทั้งใบ */
function photosForRecords_(keep) {
  var C = CFG.COL.PHOTO;
  var sh = dataSS_().getSheetByName(CFG.D.PHOTOS);
  var last = sh.getLastRow();
  if (last < 2) return [];

  var n = last - 1;
  var recCol = sh.getRange(2, C.REC, n, 1).getValues();
  var from = -1, to = -1;
  for (var i = 0; i < n; i++) {
    if (keep[s_(recCol[i][0])]) { if (from < 0) from = i; to = i; }
  }
  if (from < 0) return [];

  var block = sh.getRange(2 + from, 1, to - from + 1, 5).getValues();
  var out = [];
  for (var j = 0; j < block.length; j++) {
    var row = block[j];
    var rec = s_(row[C.REC - 1]);
    if (!keep[rec]) continue;
    out.push({
      rec:  rec,
      slot: s_(row[C.SLOT - 1]),
      url:  s_(row[C.URL - 1]),
      time: cellTime_(row[C.TIME - 1]),
      gps:  s_(row[C.GPS - 1])
    });
  }
  return out;
}

/**
 * รายการที่ยังไม่คืน — ตรรกะเดียวกับสูตร FILTER ในชีท "ค้างคืน":
 * แถวที่สถานะใช้งาน = "เบิก" และยังไม่มีแถวไหนอ้างอิงรหัสรายการนี้
 *
 * อ่านเฉพาะคอลัมน์ที่ใช้ กรองจากค่าดิบก่อน แล้วค่อยแปลงเป็นออบเจ็กต์
 * เฉพาะแถวที่รอดจริง — รายการค้างคืนมีไม่กี่รายการ แต่แถวสะสมมีเป็นหมื่น
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

/**
 * รายการค้างคืน "สำหรับแสดงบนหน้าจอ" — ผ่านแคชสั้น ๆ
 *
 * ล็อกอิน/รีเฟรช/กดปุ่มหน้าหลัก ล้วนต้องใช้ลิสต์นี้ และของเดิมอ่านชีททั้งใบใหม่ทุกครั้ง
 * กะเปลี่ยนคน 30 คนเปิดแอพพร้อมกัน = อ่านชีทเต็ม 30 รอบใน 5 นาที ทั้งที่ข้อมูลชุดเดียวกัน
 *
 * ห้ามใช้ตัวนี้ตอนตรวจกันเบิกซ้ำเด็ดขาด — ตรงนั้นต้อง assertCodesFree_ ที่อ่านสดในล็อก
 * เพราะข้อมูลช้าไปแม้ครึ่งวินาทีก็ทำให้เครื่องตัวเดียวถูกเบิกซ้อนได้
 *
 * เขียนแถวใหม่เมื่อไหร่ writeRecord_ ล้างแคชให้ทันที หน้าจอจึงไม่ค้างข้อมูลเก่า
 */
function openJobsCached_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('openjobs');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var list = openJobsFast_(null);
  try { cache.put('openjobs', JSON.stringify(list), CFG.OPEN_CACHE_SEC); } catch (e) {}
  return list;
}

function clearOpenJobsCache_() {
  try { CacheService.getScriptCache().remove('openjobs'); } catch (e) {}
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
  row[C.SENT - 1]     = p.sent || CFG.V.SENT;
  row[C.BY - 1]       = p.actedBy || '';

  for (var i = 0; i < C.BY; i++) if (row[i] === undefined) row[i] = '';

  var lock = LockService.getScriptLock();
  lock.waitLock(60000);   // กะเปลี่ยนคนส่งพร้อมกันเยอะ ให้รอคิวได้นานหน่อย
  try {
    if (guard) guard();

    // อยู่ในล็อกแล้ว จึงรู้แน่ว่าไม่มีใครแทรกแถว — คำนวณแถวเป้าหมายเองได้
    // ของเดิมยิงชีท 3 รอบ (appendRow + setNumberFormat + setValue) เหลือ 2 รอบ
    // ตั้งรูปแบบเป็นข้อความก่อนเขียน กันชีทตัดเลข 0 นำหน้าของรหัสพนักงาน
    var at = shR.getLastRow() + 1;
    // appendRow ขยายคอลัมน์ให้เองถ้าชีทแคบกว่าแถวที่เขียน — setValues ไม่ทำให้ ต้องกันไว้เอง
    var wide = shR.getMaxColumns();
    if (wide < C.BY) shR.insertColumnsAfter(wide, C.BY - wide);
    shR.getRange(at, C.EMP_ID).setNumberFormat('@');
    shR.getRange(at, 1, 1, C.BY).setValues([row]);

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
  // มีแถวใหม่แล้ว — ลิสต์ค้างคืนที่แคชไว้ใช้ไม่ได้อีกต่อไป
  clearOpenJobsCache_();
  return p.recordId;
}
