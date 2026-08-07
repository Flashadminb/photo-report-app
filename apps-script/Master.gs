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
