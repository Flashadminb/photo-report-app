var MOCK_CALLS = [];
/* ตัวจำลองฝั่งเซิร์ฟเวอร์ Apps Script สำหรับทดสอบหน้าจอในเบราว์เซอร์ */
window.__ERRORS = [];
window.addEventListener('error', function (e) { window.__ERRORS.push(String(e.message) + ' @ ' + e.lineno); });
window.addEventListener('unhandledrejection', function (e) { window.__ERRORS.push('reject: ' + (e.reason && e.reason.message)); });

var SLOTS_PP = [
  { topic: 'PP', order: 1, th: 'กุญแจ', en: 'Key', req: true, onIssue: false, hint: 'ให้เห็นกุญแจเสียบที่เครื่อง + เลขตัวเครื่อง' },
  { topic: 'PP', order: 2, th: 'ด้านหน้า', en: 'Front', req: true, onIssue: false, hint: 'ยืนห่าง 2 เมตร ให้เห็นทั้งคัน' },
  { topic: 'PP', order: 3, th: 'ด้านหลัง', en: 'Rear', req: true, onIssue: false, hint: 'ยืนห่าง 2 เมตร ให้เห็นทั้งคัน' },
  { topic: 'PP', order: 4, th: 'ด้านซ้าย', en: 'Left', req: true, onIssue: false, hint: 'ยืนห่าง 2 เมตร ให้เห็นทั้งคัน' },
  { topic: 'PP', order: 5, th: 'ด้านขวา', en: 'Right', req: true, onIssue: false, hint: 'ยืนห่าง 2 เมตร ให้เห็นทั้งคัน' },
  { topic: 'PP', order: 6, th: 'จุดที่มีปัญหา', en: 'Issue', req: true, onIssue: true, hint: 'ถ่ายใกล้จุดเสีย' }
];
var TOPIC_PP = {
  id: 'PP', name: 'Power Pallet', desc: 'ตรวจเครื่อง + กุญแจ + รอบคัน', on: true, order: 1,
  abbr: 'PP', assetType: 'Power Pallet', slots: SLOTS_PP,
  rules: { live: true, gps: true, stamp: true, shift: true, issue: true, draft: true }, countMode: false,
  seeIds: ['730075']
};
var TOPIC_ID = {
  id: 'IDATA', name: 'IDATA / ไอดาต้า', desc: 'เบิก–คืนเครื่องยิงบาร์โค้ด', on: true, order: 2,
  abbr: 'ID', assetType: 'ไอดาต้า',
  slots: [
    { topic: 'IDATA', order: 1, th: 'ชุดเครื่องที่เบิก', en: 'Device set', req: true, onIssue: false, hint: 'วางเรียงให้เห็นครบ' },
    { topic: 'IDATA', order: 2, th: 'หน้าจอเปิดติด', en: 'Screen on', req: true, onIssue: false, hint: 'ให้เห็นหน้าจอสว่าง' },
    { topic: 'IDATA', order: 3, th: 'จุดที่มีปัญหา', en: 'Issue', req: true, onIssue: true, hint: 'ถ่ายใกล้เครื่องที่เสีย' }
  ],
  rules: { live: true, gps: false, stamp: true, count: true, issue: true, draft: true }, countMode: true,
  extraType: 'เลเซอร์ลบ', allDepts: ['IN LH', 'IN LH+BG'],
  issueTags: ['หน้าจอแตก', 'แบตบวม', 'ฝาหาย', 'ความจำเต็ม']
};

var STAFF = [
  { id: '730075', name: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG', shift: 'กะ 03:00 - 12:00 น.', role: 'พนักงานหน้างาน', status: 'ใช้งาน' },
  { id: '600112', name: 'ธนกฤต ศรีสุข', dept: 'ทุกแผนก', shift: 'กะ 09:00 - 18:00 น.', role: 'แอดมิน', status: 'ใช้งาน' }
];
var ASSETS = [
  { code: 'PP-INLHBG-01', type: 'Power Pallet', dept: 'IN LH+BG', status: 'พร้อมใช้', note: '' },
  { code: 'PP-INLHBG-02', type: 'Power Pallet', dept: 'IN LH+BG', status: 'พร้อมใช้', note: '' },
  { code: 'PP-OUT4W-01', type: 'Power Pallet', dept: 'OUT 4W', status: 'พร้อมใช้', note: '' },
  { code: 'PP-OUT4W-02', type: 'Power Pallet', dept: 'OUT 4W', status: 'พร้อมใช้', note: '',
    defect: 'ที่เหยียบชำรุด · แจ้ง 5/8/2026 ตอนคืน โดย ฟาริ เจะเลาะ' },
  { code: 'PP-BULKY-01', type: 'Power Pallet', dept: 'BULKY', status: 'พร้อมใช้', note: '' },
  { code: 'PP-BULKY-02', type: 'Power Pallet', dept: 'BULKY', status: 'พร้อมใช้', note: '' },
  { code: 'REPACK 01', type: 'ไอดาต้า', dept: 'REPACK', status: 'พร้อมใช้', note: '',
    defect: 'หน้าจอแตก · แจ้ง 9/8/2026 ตอนคืน โดย สุนิสา ประยงค์กลิ่น' },
  { code: 'REPACK 02', type: 'ไอดาต้า', dept: 'REPACK', status: 'พร้อมใช้', note: '' },
  { code: 'REPACK 04', type: 'ไอดาต้า', dept: 'REPACK', status: 'พร้อมใช้', note: '' },
  { code: 'BPL 01', type: 'เลเซอร์ลบ', dept: 'ทุกแผนก', status: 'พร้อมใช้', note: '' },
  { code: 'BPL 02', type: 'เลเซอร์ลบ', dept: 'ทุกแผนก', status: 'พร้อมใช้', note: '' },
  { code: 'BPL 03', type: 'เลเซอร์ลบ', dept: 'ทุกแผนก', status: 'พร้อมใช้', note: '' }
];
var OPEN = [{ id: 'PP-20260806-1250', codes: 'PP-INLHBG-02', qty: 1, topic: 'Power Pallet',
  empId: '730075', empName: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG', date: '6/8/2026', ts: '6/8/2026, 09:12:31', time: '09:12' }];

function session(u) {
  return {
    ok: true, user: u, isAdmin: u.role === 'แอดมิน',
    topics: [TOPIC_PP, TOPIC_ID], allTopics: [TOPIC_PP, TOPIC_ID],
    assets: ASSETS, shifts: ['กะ 03:00 - 12:00 น.', 'กะ 09:00 - 18:00 น.', 'กะ 15:00 - 00:00 น.'],
    issueTags: ['แบตไม่เก็บไฟ', 'ยกไม่ขึ้น', 'ล้อชำรุด'],
    openJobs: OPEN, today: '6/8/2026', serverTime: '6/8/2026, 16:12:04',
    // คนแผนกอื่นถือเครื่องของแผนกเราอยู่ — เซิร์ฟเวอร์ตัดชื่อออกแล้วถ้าไม่ใช่แผนกเจ้าของ
    crossUse: u.dept === 'IN LH+BG' ? [
      { code: 'PP-INLHBG-01', type: 'Power Pallet', name: 'ฟาริ เจะเลาะ', dept: 'OUT 4W', date: '6/8/2026', time: '06:02' },
      { code: 'PP-INLHBG-02', type: 'Power Pallet', name: 'สุนิสา ประยงค์กลิ่น', dept: 'BULKY', date: '5/8/2026', time: '22:15' }
    ] : [],
    staffList: u.role === 'แอดมิน'
      ? STAFF.map(function (p) { return { id: p.id, name: p.name, dept: p.dept, shift: p.shift }; }) : [],
    // จำลองว่ามีคนอื่นเบิกไปแล้วยังไม่คืน
    busyCodes: {
      'PP-INLHBG-02': { by: 'สุพัตรา แก้วมณี', id: '730075', date: '6/8/2026', time: '09:12' },
      'REPACK 02':    { by: 'ธนกฤต ศรีสุข',   id: '600112', date: '6/8/2026', time: '10:05' },
      'BPL 02':       { by: 'ธนกฤต ศรีสุข',   id: '600112', date: '6/8/2026', time: '10:05' }
    }
  };
}

var SIDE = function (t, n, id, extra) {
  return Object.assign({ recordId: id || 'PP-20260806-1250', time: t, ts: '6/8/2026, ' + t, qty: 1, photoN: n,
    folder: 'https://drive.google.com/drive/folders/xxx', deleted: false, gps: '13.6812, 100.6109',
    photos: SLOTS_PP.slice(0, n).map(function (s) { return { slot: s.th, url: 'https://drive.google.com/open?id=x', time: t, gps: '' }; }) },
    extra || {});
};

var API = {
  apiHello: function () { return { ok: true, serverTime: '6/8/2026, 16:12:04', today: '6/8/2026',
    demo: STAFF.map(function (p) { return { id: p.id, name: p.name, role: p.role }; }) }; },
  // จำลองรหัสลับ 3 หลัก: 600112 (แอดมิน) ตั้งไว้ 456 · คนอื่นไม่ได้ตั้ง
  apiLogin: function (pin, pin2, ticket) {
    var u = STAFF.filter(function (p) { return p.id === String(pin); })[0];
    if (!u) return { ok: false, error: 'ไม่พบรหัสนี้ในชีททะเบียนพนักงาน' };
    var need = (u.id === '600112') ? '456' : '';
    if (need && ticket !== 'TICKET-OK') {
      if (!pin2) return { ok: true, needPin: true, name: u.name };
      if (String(pin2) !== need) return { ok: false, error: 'รหัสลับไม่ถูกต้อง' };
      var s = session(u); s.ticket = 'TICKET-OK'; return s;
    }
    return session(u);
  },
  apiRefresh: function (id, pin2, ticket) { return API.apiLogin(id, pin2, ticket); },
  apiReserve: function(empId, topicId){ MOCK_CALLS.push('reserve'); return { ok:true, recordId:'PP-20260806-1275', folderId:'FOLDER1', folderUrl:'https://drive.google.com/drive/folders/yyy' }; },
  apiUploadPhoto: function(empId, recId, folderId, slot, dataUrl, time, gps, seq){ MOCK_CALLS.push('upload:'+slot); return { ok:true, slot:slot, url:'https://drive.google.com/open?id=p'+seq, time:time||'00:00:00', gps:gps||'' }; },
  apiCommitSubmit: function(p, rows, recId, folderUrl){ MOCK_CALLS.push('commit:'+(rows||[]).length); return { ok:true, recordId:recId, folderUrl:folderUrl, photoCount:(rows||[]).length, ts:'6/8/2026, 16:12:04' }; },  apiSubmit: function (p) {
    console.log('SUBMIT', JSON.parse(JSON.stringify(p, function (k, v) {
      return k === 'dataUrl' ? '<' + String(v).length + ' bytes>' : v; })));
    return { ok: true, recordId: 'PP-20260806-1275', folderUrl: 'https://drive.google.com/drive/folders/yyy',
      photoCount: (p.photos || []).length, ts: '6/8/2026, 16:12:04' };
  },
  apiAdminLoad: function (id, range) {
    var u = STAFF.filter(function (p) { return p.id === String(id); })[0];
    if (!u || u.role !== 'แอดมิน') return { ok: false, error: 'บัญชีนี้ไม่มีสิทธิ์เข้าเว็บแอดมิน' };
    MOCK_CALLS.push('adminLoad:' + JSON.stringify(range || null));
    return { ok: true, user: u, canEdit: true,
      range: range || { mode: 'days', n: 7 },
      periods: { months: ['2026-08', '2026-07', '2026-06'], years: ['2026', '2025'] },
      totalRecords: 4,
      master: { staff: STAFF, assets: ASSETS, topics: [TOPIC_PP, TOPIC_ID], slots: SLOTS_PP, rules: [],
        depts: ['IN LH+BG', 'REPACK', 'ทุกแผนก'], shifts: ['กะ 03:00 - 12:00 น.', 'กะ 09:00 - 18:00 น.'],
        issueTags: ['แบตไม่เก็บไฟ'] },
      pairs: [{ id: 'PP-20260806-1250', topic: 'Power Pallet', date: '6/8/2026', shift: 'กะ 03:00 - 12:00 น.',
        empId: '730075', name: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG', codes: 'PP-INLHBG-02',
        qty: 1, qtyBack: 1, status: 'มีปัญหา', issue: 'แบตไม่เก็บไฟ', note: 'จอดช่อง B2',
        out: SIDE('09:12', 5, 'PP-20260806-1250',
              { empName: 'สุพัตรา แก้วมณี', result: 'มีปัญหา', issue: 'ยกไม่ขึ้น', note: 'จอดช่อง B2' }),
        back: SIDE('16:12', 6, 'PP-20260806-1291',
              { empName: 'จิตตรา รัตนวรรณ์', result: 'มีปัญหา', issue: 'แบตไม่เก็บไฟ', note: 'ส่งซ่อมแล้ว' }) },
        { id: 'PP-20260806-1268', topic: 'Power Pallet', date: '6/8/2026', shift: 'กะ 03:00 - 12:00 น.',
          empId: '730075', name: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG', codes: 'PP-INLHBG-05',
          qty: 2, qtyBack: null, status: 'ปกติ', issue: '', note: '',
          out: SIDE('09:40', 5, 'PP-20260806-1268',
                { empName: 'สุพัตรา แก้วมณี', result: 'ปกติ', issue: '', note: 'เติมน้ำมันแล้ว' }), back: null }],
      records: [], openJobs: OPEN, today: '6/8/2026' };
  },
  apiAdminHidePhotos: function (empId, ids, show) {
    MOCK_CALLS.push('hide:' + (show ? 'show' : 'hide') + ':' + (ids || []).join('|'));
    return { ok: true, n: (ids || []).length, show: !!show };
  },
  apiSaveStaff: function () { return { ok: true }; },
  apiSaveAsset: function () { return { ok: true }; },
  apiSaveTopic: function () { return { ok: true }; },
  apiSaveSlots: function () { return { ok: true }; },
  apiSetRule: function () { return { ok: true }; },
  apiDeleteStaff: function () { return { ok: true }; },
  apiDeleteAsset: function () { return { ok: true }; },
  apiDeleteTopic: function () { return { ok: true }; },
  apiAdminDeletePhotos: function () { return { ok: true, deleted: 5 }; },
  apiAdminDeletePhotosBulk: function (e, ids) { return { ok: true, deleted: (ids||[]).length*5, records: (ids||[]).length, failed: [] }; },
};

window.google = { script: { run: (function () {
  var okCb = null, failCb = null;
  var runner = {
    withSuccessHandler: function (f) { okCb = f; return runner; },
    withFailureHandler: function (f) { failCb = f; return runner; }
  };
  Object.keys(API).forEach(function (k) {
    runner[k] = function () {
      var args = arguments, s = okCb, f = failCb;
      okCb = null; failCb = null;
      setTimeout(function () {
        try { s && s(API[k].apply(null, args)); }
        catch (e) { f && f(e); }
      }, 30);
    };
  });
  return runner;
})() } };
