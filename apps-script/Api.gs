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
    apiAdminLoad: apiAdminLoad,
    apiAdminDeletePhotos: apiAdminDeletePhotos,
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
  var recs = allRecords_();

  // พนักงานหน้างานเห็นเฉพาะรายการค้างคืนของตัวเอง แอดมิน/หัวหน้างานเห็นทุกคน
  var mine = openJobs_(recs, isAdmin || u.role === CFG.V.ROLE_LEAD ? null : u.id);

  return {
    user: u,
    isAdmin: isAdmin,
    topics: m.topics.filter(function (t) { return t.on; }),
    allTopics: m.topics,
    assets: m.assets,
    shifts: m.shifts,
    issueTags: m.issueTags,
    openJobs: mine,
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
    var m = getMaster_();
    var u = requireUser_(m, p.empId);

    var topic = null;
    m.topics.forEach(function (t) { if (t.id === s_(p.topicId)) topic = t; });
    if (!topic) throw new Error('ไม่พบหัวข้อ ' + s_(p.topicId) + ' ในชีทหัวข้อสำรวจ');
    if (!topic.on) throw new Error('หัวข้อ "' + topic.name + '" ถูกปิดใช้งานอยู่');

    var action = s_(p.action) || CFG.V.BORROW;
    var isReturn = (action === CFG.V.RETURN);
    var photos = (p.photos || []).filter(function (x) { return x && x.dataUrl; });
    var recs = allRecords_();

    // ── กันส่งซ้ำ (คิวออฟไลน์อาจยิงซ้ำ) ──────────────────────────────
    if (p.clientId) {
      var dup = alreadySubmitted_(p.clientId);
      if (dup) return ok_({ recordId: dup, duplicate: true });
    }

    // ── ตรวจตามเงื่อนไขในชีท "เงื่อนไข" ─────────────────────────────
    var R = topic.rules || {};

    if (R.gps && !s_(p.gps)) {
      throw new Error('หัวข้อนี้บังคับให้เปิดตำแหน่ง (GPS) ก่อนส่ง');
    }

    var result = s_(p.result);
    if (result !== CFG.V.OK && result !== CFG.V.ISSUE) {
      throw new Error('ยังไม่ได้เลือกสถานะเครื่อง (ปกติ / มีปัญหา)');
    }

    if (result === CFG.V.ISSUE) {
      if (!s_(p.issue)) throw new Error('เลือก "มีปัญหา" ต้องอธิบายอาการด้วย');
      if (R.issue) {
        var hasIssuePhoto = photos.some(function (x) {
          return s_(x.slot).indexOf('ปัญหา') >= 0;
        });
        if (!hasIssuePhoto) throw new Error('เลือก "มีปัญหา" ต้องแนบรูปจุดที่มีปัญหา');
      }
    }

    // ช่องถ่ายรูปที่บังคับ
    var need = topic.slots.filter(function (sl) { return sl.req && !sl.onIssue; });
    var have = {};
    photos.forEach(function (x) { have[s_(x.slot)] = true; });
    var missing = need.filter(function (sl) { return !have[sl.th]; });
    if (missing.length) {
      throw new Error('ยังถ่ายไม่ครบ: ' + missing.map(function (x) { return x.th; }).join(', '));
    }

    // จำนวน / รหัสเครื่อง
    var codes = (p.codes || []).map(s_).filter(Boolean);
    var qty = Number(p.qty) || codes.length;
    if (topic.countMode) {
      if (!(qty > 0)) throw new Error('ต้องกรอกจำนวนเครื่องที่เบิก');
    } else {
      if (!codes.length) throw new Error('ต้องเลือกรหัสเครื่องอย่างน้อย 1 รายการ');
      qty = codes.length;
    }

    // ── ตอนคืน: ต้องอ้างอิงรายการเบิกที่ยังค้างอยู่จริง ─────────────
    var ref = '';
    if (isReturn) {
      ref = s_(p.ref);
      if (!ref) throw new Error('ไม่พบรายการเบิกที่จะคืน');
      var open = openJobs_(recs, null);
      var found = open.filter(function (j) { return j.id === ref; })[0];
      if (!found) throw new Error('รายการ ' + ref + ' ถูกคืนไปแล้ว หรือไม่มีอยู่ในชีท');
      if (!codes.length) codes = found.codes ? found.codes.split(/\s*,\s*/) : [];
      if (!topic.countMode) qty = codes.length;
    }

    // ── เตือนกรณีถ่ายนอกกะ (บันทึกเป็นข้อยกเว้น ไม่บล็อก) ───────────
    var note = s_(p.note);
    if (R.shift && !inShift_(s_(p.shift), new Date())) {
      note = (note ? note + ' · ' : '') + '[นอกกะ] ส่งเมื่อ ' + fmtTime_(new Date());
    }

    // ── อัปโหลดรูป ───────────────────────────────────────────────────
    var recordId = makeRecordId_(topic.id, new Date());
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

    // ── เขียนชีท ─────────────────────────────────────────────────────
    writeRecord_({
      recordId: recordId,
      shift: s_(p.shift) || u.shift,
      empId: u.id, empName: u.name, dept: u.dept,
      topicName: topic.name,
      action: action,
      qty: qty,
      codes: codes.join(', '),
      result: result,
      issue: result === CFG.V.ISSUE ? s_(p.issue) : '',
      note: note,
      folderUrl: folderUrl,
      gps: s_(p.gps),
      ref: ref
    }, photoRows);

    if (p.clientId) rememberSubmitted_(p.clientId, recordId);

    return ok_({
      recordId: recordId,
      folderUrl: folderUrl,
      photoCount: photoRows.length,
      ts: fmtStamp_(new Date())
    });
  });
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

function apiAdminLoad(empId) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireAdmin_(m, empId);
    var recs = allRecords_();
    var photos = allPhotos_();

    return ok_({
      user: u,
      canEdit: canWriteMaster_(u),
      master: m,
      pairs: buildPairs_(recs, photos),
      records: recs,
      openJobs: openJobs_(recs, null),
      today: fmtDate_(new Date())
    });
  });
}

/**
 * จับคู่ "เบิก" กับ "คืน" ให้เป็นรายการเดียว เพื่อให้หน้าแอดมินดูรูปสองฝั่งได้
 * แถวคืนจะอ้างอิงรหัสรายการเบิกในคอลัมน์ "อ้างอิงรายการเบิก"
 */
function buildPairs_(recs, photos) {
  var byRec = {};
  photos.forEach(function (ph) {
    (byRec[ph.rec] = byRec[ph.rec] || []).push(ph);
  });

  var side = function (r) {
    if (!r) return null;
    return {
      recordId: r.id, time: (/(\d{1,2}:\d{2})/.exec(r.ts) || [, r.ts])[1],
      ts: r.ts, qty: r.qty, photoN: r.photoN, folder: r.folder,
      deleted: r.folder === 'ลบรูปแล้ว',
      gps: r.gps,
      photos: (byRec[r.id] || []).map(function (ph) {
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
