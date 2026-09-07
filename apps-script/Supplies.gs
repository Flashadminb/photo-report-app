/**
 * Supplies.gs — เบิกวัสดุสิ้นเปลือง
 *
 * เขียนลงไฟล์ "วัสดุสิ้นเปลือง" (CFG.SUP_ID) คนละไฟล์กับชีทงานประจำวัน
 *
 * กติกาหลัก: ยอดคงเหลือไม่ได้เก็บไว้ที่ไหน — คำนวณจากสมุดทุกครั้ง
 *
 *   คงเหลือ = ยอดตั้งต้น + รับเข้า + ปรับเพิ่ม − เบิก − ปรับลด
 *
 * ถ้าเก็บตัวเลข "คงเหลือ" ไว้ในช่องแล้วลบทีละครั้ง สักวันมันจะเพี้ยน
 * (คนแก้ชีทมือ · เขียนสำเร็จแต่ตอบกลับหาย · สองคนกดพร้อมกัน)
 * แล้วจะไม่มีใครรู้ว่าเพี้ยนตอนไหน เพราะไม่มีอะไรให้เทียบ
 * แบบนี้ทุกตัวเลขอธิบายได้เสมอว่ามาจากแถวไหนบ้าง — หลักเดียวกับ "ค้างคืน"
 */

function supSS_() { return SpreadsheetApp.openById(CFG.SUP_ID); }

/** จำนวนที่อ่านจากชีท — กันค่าติดลบและค่าที่ไม่ใช่ตัวเลขไม่ให้ทำยอดเพี้ยน */
function supNum_(v) {
  var n = Number(v);
  return (isFinite(n) && n > 0) ? n : 0;
}

// ── ทะเบียนของ ────────────────────────────────────────────────────────

/**
 * รายการวัสดุจากชีทคงคลัง — ยังไม่มียอดคงเหลือ (ต้องเอาไปรวมกับสมุดก่อน)
 * แถวที่สถานะ "ยกเลิก" ไม่ส่งออกไป หน้างานจะได้ไม่เห็นของที่เลิกใช้แล้ว
 */
function supItems_() {
  var sh = supSS_().getSheetByName(CFG.SUP.STOCK);
  if (!sh) return [];
  var head = CFG.SUP_HEAD.STOCK;
  var last = sh.getLastRow();
  if (last <= head) return [];

  var C = CFG.COL.SSTOCK;
  var vals = sh.getRange(head + 1, 1, last - head, C.NOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    var code = s_(r[C.CODE - 1]);
    if (!code || s_(r[C.STATUS - 1]) === 'ยกเลิก') continue;
    out.push({
      row:     head + 1 + i,
      code:    code,
      name:    s_(r[C.NAME - 1]) || code,
      unit:    s_(r[C.UNIT - 1]),
      cat:     s_(r[C.CAT - 1]),
      start:   supNum_(r[C.START - 1]),
      reorder: supNum_(r[C.REORDER - 1]),
      note:    s_(r[C.NOTE - 1])
    });
  }
  return out;
}

// ── ยอดคงเหลือ ────────────────────────────────────────────────────────

/**
 * รวมยอดเคลื่อนไหวของทุกรหัสจากสมุด → { รหัส: ยอดสุทธิ }
 * อ่านแค่ 3 คอลัมน์ (ชนิด · รหัส · จำนวน) ไม่ต้องลากทั้งแถวมา
 */
function supMoves_() {
  var sh = supSS_().getSheetByName(CFG.SUP.LOG);
  var net = {};
  if (!sh) return net;
  var head = CFG.SUP_HEAD.LOG;
  var last = sh.getLastRow();
  if (last <= head) return net;

  var C = CFG.COL.SLOG;
  var n = last - head;
  var kinds = sh.getRange(head + 1, C.KIND, n, 1).getValues();
  var codes = sh.getRange(head + 1, C.CODE, n, 1).getValues();
  var qtys  = sh.getRange(head + 1, C.QTY,  n, 1).getValues();

  for (var i = 0; i < n; i++) {
    var code = s_(codes[i][0]);
    if (!code) continue;
    var q = supNum_(qtys[i][0]);
    if (!q) continue;
    var k = s_(kinds[i][0]);
    var sign = (k === CFG.V.SUP_IN || k === CFG.V.SUP_UP) ? 1
             : (k === CFG.V.SUP_OUT || k === CFG.V.SUP_DN) ? -1 : 0;
    if (!sign) continue;   // ชนิดที่ไม่รู้จัก ไม่เอามาคิด ดีกว่าเดาแล้วยอดผิด
    net[code] = (net[code] || 0) + sign * q;
  }
  return net;
}

/** ทะเบียนของ + ยอดคงเหลือ พร้อมธงว่าใกล้หมด/หมด/ติดลบ */
function supStock_() {
  var items = supItems_();
  var net = supMoves_();
  return items.map(function (it) {
    var left = it.start + (net[it.code] || 0);
    return {
      code: it.code, name: it.name, unit: it.unit, cat: it.cat,
      reorder: it.reorder, left: left,
      low: (it.reorder > 0 && left <= it.reorder), neg: (left < 0)
    };
  });
}

/**
 * แคชสั้น ๆ — หน้าแอพเปิดทีก็อ่านสมุดทั้งใบที ถ้าไม่แคชจะช้าเปล่า
 * ล้างทันทีที่มีการเขียนแถว จึงไม่มีทางเห็นยอดข้ามการเปลี่ยนแปลง
 */
function supStockCached_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('supstock');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var list = supStock_();
  try { cache.put('supstock', JSON.stringify(list), CFG.OPEN_CACHE_SEC); } catch (e) {}
  return list;
}

function clearSupCache_() {
  try { CacheService.getScriptCache().remove('supstock'); } catch (e) {}
}

// ── เขียนสมุด ─────────────────────────────────────────────────────────

/**
 * เขียนแถวเคลื่อนไหว — 1 รายการ = 1 แถว
 *
 * @param {string} kind  CFG.V.SUP_OUT / SUP_IN / SUP_UP / SUP_DN
 * @param {Array}  items [{code, qty, note}]
 * @param {Object} u     ผู้ทำรายการ {id, name, dept}
 * @param {string} proof ลิงก์โฟลเดอร์รูป
 * @param {string} note  หมายเหตุร่วมของทั้งชุด
 * @returns {{wrote:number, lines:Array}}
 *
 * คำนวณยอดใหม่ "ในล็อก" เท่านั้น — ยอดที่หน้าแอพเห็นตอนกดอาจเก่าไปแล้ว
 * ถ้าเอาเลขจากมือถือมาเขียนลงช่องคงเหลือ สมุดจะเล่าเรื่องผิดทันที
 */
function writeSupMove_(kind, items, u, proof, note) {
  var ss = supSS_();
  var sh = ss.getSheetByName(CFG.SUP.LOG);
  if (!sh) throw new Error('ไม่พบชีท "' + CFG.SUP.LOG + '" ในไฟล์วัสดุสิ้นเปลือง');

  var C = CFG.COL.SLOG;
  var now = new Date();
  var day = fmtDate_(now), tm = Utilities.formatDate(now, CFG.TZ, 'HH:mm');
  var sign = (kind === CFG.V.SUP_IN || kind === CFG.V.SUP_UP) ? 1 : -1;

  // ยอดสด ณ วินาทีนี้ ไม่ใช่ยอดจากแคช
  var by = {};
  supStock_().forEach(function (x) { by[x.code] = x; });

  var rows = [], lines = [];
  items.forEach(function (x) {
    var it = by[s_(x.code)];
    if (!it) throw new Error('ไม่พบวัสดุรหัส ' + s_(x.code) + ' ในทะเบียน');
    var q = supNum_(x.qty);
    if (!q) throw new Error('จำนวนของ ' + it.name + ' ต้องมากกว่า 0');

    var left = it.left + sign * q;
    it.left = left;   // เบิกของชิ้นเดียวกันสองบรรทัดในชุดเดียว ต้องหักต่อกัน

    var row = [];
    for (var i = 0; i < C.REF; i++) row.push('');
    row[C.DATE - 1]     = day;
    row[C.TIME - 1]     = tm;
    row[C.KIND - 1]     = kind;
    row[C.CODE - 1]     = it.code;
    row[C.NAME - 1]     = it.name;
    row[C.QTY - 1]      = q;
    row[C.UNIT - 1]     = it.unit;
    row[C.LEFT - 1]     = left;
    row[C.EMP_ID - 1]   = s_(u.id);
    row[C.EMP_NAME - 1] = s_(u.name);
    row[C.DEPT - 1]     = s_(u.dept);
    row[C.NOTE - 1]     = s_(x.note) || s_(note);
    row[C.PROOF - 1]    = s_(proof);
    row[C.REF - 1]      = '';   // เติมหลังจองเลขรัน
    rows.push(row);
    lines.push({ code: it.code, name: it.name, qty: q, unit: it.unit, left: left, neg: left < 0 });
  });

  var ref = 'MAT-' + Utilities.formatDate(now, CFG.TZ, 'yyyyMMdd') + '-' + nextSeq_();
  rows.forEach(function (r) { r[C.REF - 1] = ref; });

  var start = Math.max(sh.getLastRow(), CFG.SUP_HEAD.LOG) + 1;
  // ตั้งรูปแบบเป็นข้อความก่อนเขียน กันชีทตัดเลข 0 นำหน้าของรหัสพนักงาน
  sh.getRange(start, C.EMP_ID, rows.length, 1).setNumberFormat('@');
  sh.getRange(start, 1, rows.length, C.REF).setValues(rows);
  return { wrote: rows.length, lines: lines, ref: ref };
}

// ── สถิติสำหรับหน้าแอดมิน ─────────────────────────────────────────────

/**
 * อ่านสมุดทั้งใบครั้งเดียวแล้วสรุปหลายมุมพร้อมกัน
 * แยกเป็นหลายฟังก์ชันจะอ่านชีทซ้ำหลายรอบโดยไม่ได้อะไรเพิ่ม
 */
function supHistory_(days) {
  var sh = supSS_().getSheetByName(CFG.SUP.LOG);
  if (!sh) return [];
  var head = CFG.SUP_HEAD.LOG;
  var last = sh.getLastRow();
  if (last <= head) return [];

  var C = CFG.COL.SLOG;
  var vals = sh.getRange(head + 1, 1, last - head, C.REF).getValues();
  var from = null;
  if (days > 0) {
    from = new Date(); from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
  }

  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (!s_(r[C.CODE - 1])) continue;
    var d = supRowDay_(r[C.DATE - 1]);
    if (from && (!d || d < from)) continue;
    out.push({
      row: head + 1 + i,
      date: cellDate_(r[C.DATE - 1], false),
      time: cellTime_(r[C.TIME - 1]),
      kind: s_(r[C.KIND - 1]),
      code: s_(r[C.CODE - 1]),
      name: s_(r[C.NAME - 1]),
      qty:  supNum_(r[C.QTY - 1]),
      unit: s_(r[C.UNIT - 1]),
      left: Number(r[C.LEFT - 1]) || 0,
      empId: s_(r[C.EMP_ID - 1]),
      empName: s_(r[C.EMP_NAME - 1]),
      dept: s_(r[C.DEPT - 1]),
      note: s_(r[C.NOTE - 1]),
      proof: s_(r[C.PROOF - 1]),
      ref: s_(r[C.REF - 1])
    });
  }
  return out.reverse();   // ใหม่สุดขึ้นก่อน
}

/** ช่องวันที่ในสมุด — เป็นได้ทั้ง Date และข้อความ "7/9/2026" */
function supRowDay_(v) {
  if (v instanceof Date) { var d = new Date(v); d.setHours(0, 0, 0, 0); return d; }
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s_(v));
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

/**
 * สรุปสถิติจากประวัติที่อ่านมาแล้ว
 *
 * "หมดในอีกกี่วัน" คิดจากอัตราเบิกจริงในช่วงที่ดู ไม่ต้องเก็บข้อมูลเพิ่ม
 * ไม่มีการเบิกเลย = ไม่รู้ ส่ง null ไป หน้าเว็บจะได้ไม่โชว์เลขมั่ว
 */
function supStats_(hist, days, stock) {
  var perItem = {}, perUser = {}, perDept = {}, perMonth = {};
  hist.forEach(function (h) {
    if (h.kind !== CFG.V.SUP_OUT) return;
    perItem[h.code] = (perItem[h.code] || 0) + h.qty;
    var uk = h.empId + '|' + h.empName;
    perUser[uk] = (perUser[uk] || 0) + h.qty;
    if (h.dept) perDept[h.dept] = (perDept[h.dept] || 0) + h.qty;
    var d = supRowDay_(h.date);
    if (d) {
      var mk = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      perMonth[mk] = (perMonth[mk] || 0) + h.qty;
    }
  });

  var seen = {};
  hist.forEach(function (h) { if (!seen[h.code]) seen[h.code] = h.date; });

  var items = stock.map(function (x) {
    var used = perItem[x.code] || 0;
    var perDay = (days > 0 && used > 0) ? used / days : 0;
    return {
      code: x.code, name: x.name, unit: x.unit, cat: x.cat,
      left: x.left, reorder: x.reorder, low: x.low, neg: x.neg,
      used: used,
      perMonth: perDay ? Math.round(perDay * 30 * 10) / 10 : 0,
      daysLeft: (perDay > 0 && x.left > 0) ? Math.floor(x.left / perDay) : null,
      lastMove: seen[x.code] || ''
    };
  });

  var top = function (obj) {
    return Object.keys(obj).map(function (k) { return { key: k, qty: obj[k] }; })
      .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 10);
  };

  return {
    items: items,
    topUsers: top(perUser).map(function (x) {
      var p = x.key.split('|');
      return { id: p[0], name: p[1], qty: x.qty };
    }),
    topDepts: top(perDept).map(function (x) { return { dept: x.key, qty: x.qty }; }),
    months: Object.keys(perMonth).sort().map(function (k) { return { month: k, qty: perMonth[k] }; })
  };
}

// ── ติดตั้งชีท ────────────────────────────────────────────────────────

/**
 * setupSupplies() — รันครั้งเดียวเพื่อวางหัวตารางในไฟล์วัสดุสิ้นเปลือง
 *
 * ปลอดภัยกับข้อมูลเดิม: สร้างชีทที่ยังไม่มี · เขียนหัวตารางเฉพาะตอนที่แถว 1
 * ยังว่างหรือมีแต่หัวเก่าที่สั้นกว่า · ไม่แตะแถวข้อมูลใด ๆ ทั้งสิ้น
 * รันซ้ำกี่รอบก็ได้ผลเหมือนเดิม
 */
function setupSupplies() {
  var ss = supSS_();
  var msg = [];

  var plan = [
    { name: CFG.SUP.STOCK, head: ['รหัส', 'ชื่อวัสดุ', 'หน่วย', 'หมวด', 'ยอดตั้งต้น', 'จุดสั่งซื้อ', 'สถานะ', 'หมายเหตุ'],
      widths: [90, 220, 70, 130, 90, 90, 80, 220] },
    { name: CFG.SUP.LOG, head: ['วันที่', 'เวลา', 'รายการ', 'รหัส', 'ชื่อวัสดุ', 'จำนวน', 'หน่วย', 'คงเหลือหลังทำ',
        'รหัสพนักงาน', 'ชื่อผู้เบิก', 'แผนก', 'หมายเหตุ', 'หลักฐาน', 'รหัสอ้างอิง'],
      widths: [90, 65, 80, 90, 200, 70, 70, 110, 100, 160, 110, 220, 220, 160] }
  ];

  plan.forEach(function (p) {
    var sh = ss.getSheetByName(p.name);
    if (!sh) { sh = ss.insertSheet(p.name); msg.push('สร้างชีท "' + p.name + '"'); }

    var n = p.head.length;
    if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());

    var cur = sh.getRange(1, 1, 1, n).getValues()[0].map(s_);
    var filled = cur.filter(Boolean).length;
    if (filled < n) {
      sh.getRange(1, 1, 1, n).setValues([p.head])
        .setFontWeight('bold').setBackground('#f1f3f4').setVerticalAlignment('middle');
      sh.setFrozenRows(1);
      p.widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
      msg.push('วางหัวตาราง "' + p.name + '" ' + n + ' คอลัมน์');
    } else {
      msg.push('"' + p.name + '" มีหัวตารางครบแล้ว ไม่แตะ');
    }
  });

  // รหัสพนักงานต้องเป็นข้อความ ไม่งั้นชีทตัด 0 นำหน้าทิ้ง
  var lg = ss.getSheetByName(CFG.SUP.LOG);
  lg.getRange(2, CFG.COL.SLOG.EMP_ID, Math.max(lg.getMaxRows() - 1, 1), 1).setNumberFormat('@');

  clearSupCache_();
  return msg.join('\n');
}
