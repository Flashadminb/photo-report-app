/**
 * Cards.gs — บัตรชั่วคราวของ BPL HUB
 *
 * เขียนลงไฟล์คนละไฟล์กับระบบถ่ายรูป (CFG.CARD_ID) เพราะเป็นทะเบียนตามสัญญา
 * จ้างเหมาแบบ B ที่แอดมิน HUB ดูแลอยู่ก่อนแล้ว ไม่ควรลากมารวมกับชีทงานประจำวัน
 *
 * กติกาหลักที่ยึด: 1 ใบบัตร = 1 แถวในสมุด
 * จ่ายทีเดียว 10 ใบให้ 10 คน ก็เขียน 10 แถว ไม่ยัดรวมแถวเดียว
 * ไม่งั้นตอบคำถามเดียวที่ระบบนี้มีไว้ตอบไม่ได้ — "TEMP-03 อยู่กับใคร"
 */

function cardSS_() { return SpreadsheetApp.openById(CFG.CARD_ID); }

/** แถวว่างเปล่าทั้งแถวไหม — ชีทนี้มีแถวเปล่าคั่นเยอะ ต้องข้ามให้หมด */
function blankRow_(r) {
  for (var i = 0; i < r.length; i++) if (s_(r[i])) return false;
  return true;
}

/**
 * แถวตัวอย่างที่ไฟล์แถมมาให้ดูรูปแบบ — ไฟล์เขียนเองว่าให้ลบก่อนใช้จริง
 * แต่ถ้ายังไม่ได้ลบ ก็ต้องไม่เอาไปโผล่ในรายการให้หน้างานเลือก
 */
function sampleRow_(txt) { return /ตัวอย่าง/.test(s_(txt)); }

/**
 * ทะเบียนผู้ได้รับอนุญาต — ใช้เป็นรายชื่อให้แตะเลือก
 *
 * เลือกด้วยรหัสบัตรจริง ไม่ใช่ชื่อ เพราะมีชื่อซ้ำกันอยู่ (Tun Win มี 2 คน)
 * เอาเฉพาะแถวที่มีชื่อจริง — ไฟล์จองรหัส BPL-031 ขึ้นไปไว้ล่วงหน้าโดยยังไม่มีคน
 */
function cardPeople_() {
  var sh = cardSS_().getSheetByName(CFG.C.PEOPLE);
  if (!sh) return [];
  var head = CFG.CARD_HEAD.PEOPLE;
  var last = sh.getLastRow();
  if (last <= head) return [];

  var C = CFG.COL.CPERSON;
  var vals = sh.getRange(head + 1, 1, last - head, C.NOTE).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (blankRow_(r)) continue;
    var name = s_(r[C.NAME - 1]);
    if (!name || sampleRow_(name)) continue;
    if (s_(r[C.STATUS - 1]) === 'พ้นสภาพ') continue;   // คนออกแล้ว ไม่ต้องขึ้นให้เลือก
    out.push({
      card:  s_(r[C.CARD - 1]),
      name:  name,
      sub:   s_(r[C.SUB - 1]),
      dept:  s_(r[C.DEPT - 1]),
      train: s_(r[C.TRAIN - 1])
    });
  }
  return out;
}

/**
 * บัตรชั่วคราวที่มีอยู่ — อ่านจากชีท ไม่ฝังไว้ในโค้ด
 * เพิ่มใบใหม่ให้เพิ่มแถวในทะเบียนบัตร ประเภท = บัตรชั่วคราว แล้วขึ้นในแอพเอง
 *
 * ถ้าในชีทยังไม่มีสักใบ ใช้ TEMP-01..07 ไปก่อนตามที่ตกลงกันไว้
 * จะได้ใช้งานได้ทันทีโดยไม่ต้องรอคีย์ทะเบียนบัตรให้เสร็จ
 */
function cardList_() {
  var out = [];
  var sh = cardSS_().getSheetByName(CFG.C.CARDS);
  if (sh) {
    var head = CFG.CARD_HEAD.CARDS;
    var last = sh.getLastRow();
    if (last > head) {
      var C = CFG.COL.CCARD;
      var vals = sh.getRange(head + 1, 1, last - head, C.NOTE).getValues();
      for (var i = 0; i < vals.length; i++) {
        var r = vals[i];
        if (blankRow_(r)) continue;
        var code = s_(r[C.CODE - 1]);
        if (!code || sampleRow_(code) || sampleRow_(r[C.NOTE - 1])) continue;
        if (s_(r[C.KIND - 1]).indexOf('ชั่วคราว') < 0) continue;
        if (s_(r[C.STATUS - 1]) === 'ยกเลิก') continue;
        out.push({ code: code, dept: s_(r[C.DEPT - 1]), keeper: s_(r[C.KEEPER - 1]) });
      }
    }
  }
  if (!out.length) {
    for (var n = 1; n <= 7; n++) {
      out.push({ code: 'TEMP-' + (n < 10 ? '0' : '') + n, dept: '', keeper: '' });
    }
  }
  return out;
}

/**
 * บัตรที่จ่ายออกไปแล้วยังไม่คืน — คือแถวที่ช่อง "เวลาคืน" ยังว่าง
 * ไม่ต้องเก็บสถานะไว้ที่อื่นเลย ตัวสมุดบอกได้เอง
 */
function cardsOut_() {
  var sh = cardSS_().getSheetByName(CFG.C.LOG);
  if (!sh) return [];
  var head = CFG.CARD_HEAD.LOG;
  var last = sh.getLastRow();
  if (last <= head) return [];

  var C = CFG.COL.CLOG;
  var vals = sh.getRange(head + 1, 1, last - head, C.PROOF).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var r = vals[i];
    if (blankRow_(r)) continue;
    var code = s_(r[C.CARD - 1]);
    if (!code || sampleRow_(r[C.NAME - 1])) continue;
    if (s_(r[C.BACK_T - 1])) continue;              // คืนแล้ว
    out.push({
      row:   head + 1 + i,                          // ไว้เขียนเวลาคืนกลับลงแถวเดิม
      card:  code,
      name:  s_(r[C.NAME - 1]),
      dept:  s_(r[C.DEPT - 1]),
      sub:   s_(r[C.SUB - 1]),
      why:   s_(r[C.WHY - 1]),
      date:  cellDate_(r[C.DATE - 1], false),
      out:   cellTime_(r[C.OUT_T - 1]),
      giver: s_(r[C.GIVER - 1])
    });
  }
  return out.reverse();
}

/**
 * เขียนการจ่ายบัตรลงสมุด — 1 ใบ = 1 แถว
 * @param {Array} items [{card, name, realCard, sub, dept, train}]
 */
function writeCardIssue_(items, why, giver, trained, proof) {
  var sh = cardSS_().getSheetByName(CFG.C.LOG);
  if (!sh) throw new Error('ไม่พบชีท "' + CFG.C.LOG + '" ในไฟล์บัตรชั่วคราว');

  var C = CFG.COL.CLOG;
  var now = new Date();
  var day = fmtDate_(now), tm = Utilities.formatDate(now, CFG.TZ, 'HH:mm');

  var rows = items.map(function (x) {
    var row = [];
    for (var i = 0; i < C.PROOF; i++) row.push('');
    row[C.DATE - 1]      = day;
    row[C.DEPT - 1]      = s_(x.dept);
    row[C.CARD - 1]      = s_(x.card);
    row[C.NAME - 1]      = s_(x.name);
    row[C.REAL_CARD - 1] = s_(x.realCard);
    row[C.SUB - 1]       = s_(x.sub);
    row[C.WHY - 1]       = s_(why);
    row[C.OUT_T - 1]     = tm;
    row[C.GIVER - 1]     = s_(giver);
    // ติ๊กว่าอบรมแล้ว = บันทึกว่าอบรมย่อ B3 ให้รอบนี้ · ไม่ติ๊ก = ใช้ค่าเดิมจากทะเบียน
    row[C.TRAIN - 1]     = trained ? 'อบรมย่อ B3' : s_(x.train);
    row[C.PROOF - 1]     = s_(proof);
    return row;
  });

  var start = Math.max(sh.getLastRow(), CFG.CARD_HEAD.LOG) + 1;
  sh.getRange(start, 1, rows.length, C.PROOF).setValues(rows);
  return rows.length;
}

/** เติมเวลาคืนกลับลงแถวเดิม — รับเลขแถวที่ได้จาก cardsOut_() */
function writeCardReturn_(rowNos) {
  var sh = cardSS_().getSheetByName(CFG.C.LOG);
  if (!sh) throw new Error('ไม่พบชีท "' + CFG.C.LOG + '"');
  var C = CFG.COL.CLOG;
  var tm = Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm');
  var n = 0;
  (rowNos || []).forEach(function (r) {
    var row = Number(r);
    if (!row || row <= CFG.CARD_HEAD.LOG) return;
    // กันเขียนทับแถวที่คืนไปแล้ว (เผื่อสองคนกดพร้อมกัน)
    if (s_(sh.getRange(row, C.BACK_T).getValue())) return;
    sh.getRange(row, C.BACK_T).setValue(tm);
    n++;
  });
  return n;
}
