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

// ── รหัสลับ 3 หลัก สำหรับบัญชีที่ตั้งไว้ในชีท (ช่อง PIN2) ──────────────
//
// ยืนยันรหัสผ่านแล้วเซิร์ฟเวอร์ออก "ตั๋ว" ให้เครื่องนั้นเก็บไว้แทนตัวรหัส
// ตัวรหัสจริงไม่เคยถูกเก็บในมือถือและไม่เคยถูกส่งกลับไปหน้าจอเลย
//
// ตั๋วมีอายุ 8 ชม. นับจากครั้งล่าสุดที่ใช้ ใช้งานอยู่เรื่อย ๆ ก็ไม่ถามซ้ำ
// ทิ้งไว้ไม่แตะเกิน 8 ชม. หรือกดออกระบบ = ต้องใส่รหัสใหม่

var PIN_TICKET_MS = 8 * 3600 * 1000;

function ticketKey_(t) { return 'pt:' + s_(t); }

function issueTicket_(empId) {
  var t = Utilities.getUuid();
  PropertiesService.getScriptProperties()
    .setProperty(ticketKey_(t), s_(empId) + '|' + (Date.now() + PIN_TICKET_MS));
  return t;
}

/** ตั๋วนี้ยังใช้ได้กับคนนี้ไหม — ใช้ได้ก็ต่ออายุออกไปอีก 8 ชม. */
function useTicket_(empId, t) {
  if (!s_(t)) return false;
  var props = PropertiesService.getScriptProperties();
  var v = props.getProperty(ticketKey_(t));
  if (!v) return false;
  var p = String(v).split('|');
  if (p[0] !== s_(empId) || Number(p[1]) < Date.now()) {
    props.deleteProperty(ticketKey_(t));
    return false;
  }
  props.setProperty(ticketKey_(t), p[0] + '|' + (Date.now() + PIN_TICKET_MS));
  return true;
}

/**
 * ด่านรหัสลับ — คืน {} ถ้าผ่าน, {needPin:true} ถ้ายังต้องถาม, {ticket} ถ้าเพิ่งยืนยันสำเร็จ
 * คนที่ไม่ได้ตั้งรหัสไว้ในชีทจะผ่านทันที ไม่มีอะไรเปลี่ยน
 */
function pinGate_(u, pin2, ticket) {
  var need = staffPin2_(u.id);
  if (!need) return {};
  if (useTicket_(u.id, ticket)) return {};
  var got = s_(pin2);
  if (!got) return { needPin: true };
  if (got !== need) throw new Error('รหัสลับไม่ถูกต้อง');
  return { ticket: issueTicket_(u.id) };
}

/** เข้าสู่ระบบด้วยรหัสพนักงาน แล้วส่งข้อมูลทุกอย่างที่แอพต้องใช้กลับไปทีเดียว */
function apiLogin(empId, pin2, ticket) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireUser_(m, empId);

    var gate = pinGate_(u, pin2, ticket);
    if (gate.needPin) return ok_({ needPin: true, name: u.name });

    var out = sessionPayload_(m, u);
    if (gate.ticket) out.ticket = gate.ticket;
    return ok_(out);
  });
}

/** เรียกซ้ำเพื่อรีเฟรชรายการค้างคืน/ทะเบียนเครื่อง โดยไม่ต้องล็อกอินใหม่ */
function apiRefresh(empId, pin2, ticket) {
  return wrap_(function () {
    var m = getMaster_();
    var u = requireUser_(m, empId);

    var gate = pinGate_(u, pin2, ticket);
    if (gate.needPin) return ok_({ needPin: true, name: u.name });

    var out = sessionPayload_(m, u);
    if (gate.ticket) out.ticket = gate.ticket;
    return ok_(out);
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

  // เครื่องที่แจ้งว่าเสีย — ต้องรู้ว่าตัวไหน ไม่งั้นเบิกทีละ 5 ตัวแล้วจดไม่ได้ว่าใครพัง
  // ไม่ระบุมา = ถือว่าเป็นอาการของทั้งชุด (รองรับข้อมูลเก่าและคิวออฟไลน์รุ่นก่อน)
  var badCodes = (p.issueCodes || []).map(s_).filter(Boolean);

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
    codes: all, qty: qty, ref: ref, note: note,
    badCodes: badCodes.filter(function (c) { return all.indexOf(c) >= 0; })
  };
}

/** ข้อความอาการที่จะลงชีท — ใส่รหัสเครื่องนำหน้าเพื่อให้รู้ว่าตัวไหนเสีย */
function issueText_(ctx, raw) {
  var t = s_(raw);
  if (!t || !ctx.badCodes.length) return t;
  return ctx.badCodes.map(function (c) { return c + ': ' + t; }).join(' · ');
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
    issue: ctx.result === CFG.V.ISSUE ? issueText_(ctx, p.issue) : '',
    note: ctx.note,
    folderUrl: folderUrl,
    gps: s_(p.gps),
    ref: ctx.ref
  }, photoRows, function () {
    if (ctx.action === CFG.V.BORROW) assertCodesFree_(ctx.codes);
  });

  if (p.clientId) rememberSubmitted_(p.clientId, recordId);

  // จดอาการค้างใส่ตัวเครื่อง เพื่อให้คนเบิกคนถัดไปรู้ว่าพังตรงไหนอยู่ก่อนแล้ว
  // ค้างไว้จนกว่าแอดมินจะเคลียร์ — ไม่หายเองแม้จะคืนมาแล้วแจ้งว่าปกติ
  // ทำนอกล็อกและกลืน error ไว้ เพราะแถวบันทึกลงไปแล้ว ห้ามให้พังย้อนหลัง
  if (ctx.result === CFG.V.ISSUE && ctx.badCodes.length) {
    try {
      setAssetDefects_(ctx.badCodes,
        s_(p.issue) + ' · แจ้ง ' + fmtDate_(new Date()) + ' ตอน' + ctx.action + ' โดย ' + ctx.u.name);
    } catch (e) { /* จดไม่ได้ก็ไม่เป็นไร ข้อมูลหลักลงชีทแล้ว */ }
  }

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
  if (mode === 'day')   return { mode: 'day',   d: s_(r.d) };   // เจาะจงวันเดียว YYYY-MM-DD
  if (mode === 'month') return { mode: 'month', y: Number(r.y), m: Number(r.m) };
  if (mode === 'year')  return { mode: 'year',  y: Number(r.y) };
  if (mode === 'all')   return { mode: 'all' };
  return { mode: 'days', n: Number(r.n) || 7 };
}

function filterRecords_(recs, r) {
  if (r.mode === 'all') return recs;

  var from = null, one = null;
  if (r.mode === 'days') {
    from = new Date(); from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (r.n - 1));
  }
  if (r.mode === 'day') {
    var g = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.d || '');
    if (!g) return [];
    one = new Date(Number(g[1]), Number(g[2]) - 1, Number(g[3])).getTime();
  }

  var keep = recs.filter(function (x) {
    var d = recDay_(x);
    if (!d) return false;
    if (r.mode === 'day')   return d.getTime() === one;
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
      // ส่งผลตรวจ/อาการ/หมายเหตุ แยกรายฝั่ง เพราะเบิกกับคืนคนละคนคนละเวลา
      // ของเดิมรวมกันแล้วฝั่งเบิกโดนฝั่งคืนทับจนหายไป
      empName: r.empName, dept: r.dept,
      result: r.result, issue: r.issue, note: r.note,
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
    // ส่ง defect มาเป็นค่าว่างคือสั่งเคลียร์อาการค้าง
    masterUpsert_(CFG.M.ASSETS, CFG.COL.ASSET.CODE, s_(p.code), [
      s_(p.code), s_(p.type), s_(p.dept),
      s_(p.status) || CFG.V.ASSET_READY, s_(p.note), s_(p.defect)
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
