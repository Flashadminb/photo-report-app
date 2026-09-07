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
  { id: '600112', name: 'ธนกฤต ศรีสุข', dept: 'ทุกแผนก', shift: 'กะ 09:00 - 18:00 น.', role: 'แอดมิน', status: 'ใช้งาน' },
  { id: '710001', name: 'มานะ หัวหน้ากะ', dept: 'IN LH+BG', shift: 'กะ 03:00 - 12:00 น.', role: 'หัวหน้างาน', status: 'ใช้งาน' },
  { id: '720002', name: 'สมศรี ลูกทีม', dept: 'IN LH+BG', shift: 'กะ 03:00 - 12:00 น.', role: 'พนักงานหน้างาน', status: 'ใช้งาน' }
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
var OPEN = [
  { id: 'PP-20260806-1250', codes: 'PP-INLHBG-02', qty: 1, topic: 'Power Pallet',
    empId: '730075', empName: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG', date: '6/8/2026', ts: '6/8/2026, 09:12:31', time: '09:12' },
  { id: 'PP-20260806-1251', codes: 'PP-INLHBG-01', qty: 1, topic: 'Power Pallet',
    empId: '720002', empName: 'สมศรี ลูกทีม', dept: 'IN LH+BG', date: '6/8/2026', ts: '6/8/2026, 09:40:02', time: '09:40' },
  { id: 'PP-20260806-1252', codes: 'PP-BULKY-01', qty: 1, topic: 'Power Pallet',
    empId: '703481', empName: 'จงดี พ่วงแพ', dept: 'BULKY', date: '6/8/2026', ts: '6/8/2026, 10:05:19', time: '10:05' },
  { id: 'PP-20260806-1253', codes: 'PP-OUT4W-01', qty: 1, topic: 'Power Pallet',
    empId: '617613', empName: 'พีรยา บุญอยู่', dept: 'OUT 4W', date: '6/8/2026', ts: '6/8/2026, 10:22:47', time: '10:22' }
];

/** จำลองการกรองฝั่งเซิร์ฟเวอร์ตามบทบาท (ต้องตรงกับ sessionPayload_ ใน Api.gs) */
function openFor(u) {
  if (u.role === 'แอดมิน' || (u.role === 'หัวหน้างาน' && u.dept === 'ทุกแผนก')) return OPEN;
  if (u.role === 'หัวหน้างาน') return OPEN.filter(function (j) { return j.dept === u.dept; });
  return OPEN.filter(function (j) { return j.empId === u.id; });
}

function session(u) {
  return {
    ok: true, user: u, isAdmin: u.role === 'แอดมิน',
    topics: [TOPIC_PP, TOPIC_ID], allTopics: [TOPIC_PP, TOPIC_ID],
    assets: ASSETS, shifts: ['กะ 03:00 - 12:00 น.', 'กะ 09:00 - 18:00 น.', 'กะ 15:00 - 00:00 น.'],
    issueTags: ['แบตไม่เก็บไฟ', 'ยกไม่ขึ้น', 'ล้อชำรุด'],
    openJobs: openFor(u), today: '6/8/2026', serverTime: '6/8/2026, 16:12:04',
    // คนแผนกอื่นถือเครื่องของแผนกเราอยู่ — เซิร์ฟเวอร์ตัดชื่อออกแล้วถ้าไม่ใช่แผนกเจ้าของ
    crossUse: u.dept === 'IN LH+BG' ? [
      { code: 'PP-INLHBG-01', type: 'Power Pallet', name: 'ฟาริ เจะเลาะ', dept: 'OUT 4W', date: '6/8/2026', time: '06:02' },
      { code: 'PP-INLHBG-02', type: 'Power Pallet', name: 'สุนิสา ประยงค์กลิ่น', dept: 'BULKY', date: '5/8/2026', time: '22:15' }
    ] : [],
    staffList: u.role === 'แอดมิน'
      ? STAFF.map(function (p) { return { id: p.id, name: p.name, dept: p.dept, shift: p.shift }; }) : [],
    // บัตรชั่วคราวที่ยังไม่คืน — ส่งเหมือนกันทุกคน โชว์ที่หน้าแรกรวมกับของค้างคืน
    cardsOut: CARDS_OUT.slice(),
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
    photos: SLOTS_PP.slice(0, n).map(function (s) { return { slot: s.th, fid: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', time: t, gps: '' }; }) },
    extra || {});
};

// คงคลังวัสดุจำลอง — ถุงมือกับสเปรย์ตั้งใจให้ต่ำกว่าจุดสั่งซื้อ ไว้ทดสอบป้ายเตือน
var SUP_STOCK = [
  { code: 'MAT-01', name: 'เทปใส 2 นิ้ว',  unit: 'ม้วน',    cat: 'เทป/กาว',        left: 117, reorder: 20 },
  { code: 'MAT-02', name: 'ถุงมือผ้า',      unit: 'คู่',      cat: 'อุปกรณ์ป้องกัน', left: 12,  reorder: 50 },
  { code: 'MAT-03', name: 'ปากกาเคมี',      unit: 'ด้าม',     cat: 'เครื่องเขียน',   left: 60,  reorder: 10 },
  { code: 'MAT-04', name: 'คัตเตอร์',       unit: 'ด้าม',     cat: 'เครื่องเขียน',   left: 8,   reorder: 15 },
  { code: 'MAT-05', name: 'สเปรย์หล่อลื่น', unit: 'กระป๋อง', cat: 'ซ่อมบำรุง',      left: 0,   reorder: 5 }
];

// ประวัติการเบิกวัสดุจำลอง — ใหม่สุดขึ้นก่อน เหมือนที่เซิร์ฟเวอร์ส่งมา
var SUP_HIST = [
  { date:'7/9/2026', time:'09:12', kind:'เบิก', code:'MAT-02', name:'ถุงมือผ้า', qty:30, unit:'คู่', left:12,
    empId:'730075', empName:'สุพัตรา แก้วมณี', dept:'IN LH+BG', note:'งานแพ็ค', proof:'https://drive.google.com/drive/folders/xxx', ref:'MAT-20260907-2790' },
  { date:'6/9/2026', time:'14:40', kind:'เบิก', code:'MAT-01', name:'เทปใส 2 นิ้ว', qty:12, unit:'ม้วน', left:117,
    empId:'720002', empName:'สมศรี ลูกทีม', dept:'IN LH+BG', note:'', proof:'https://drive.google.com/drive/folders/xxx', ref:'MAT-20260906-2770' },
  { date:'5/9/2026', time:'08:05', kind:'รับเข้า', code:'MAT-01', name:'เทปใส 2 นิ้ว', qty:100, unit:'ม้วน', left:129,
    empId:'600112', empName:'ธนกฤต ศรีสุข', dept:'ทุกแผนก', note:'PO-2026-118', proof:'', ref:'MAT-20260905-2740' },
  { date:'3/9/2026', time:'16:20', kind:'เบิก', code:'MAT-04', name:'คัตเตอร์', qty:6, unit:'ด้าม', left:8,
    empId:'730075', empName:'สุพัตรา แก้วมณี', dept:'IN LH+BG', note:'', proof:'', ref:'MAT-20260903-2700' },
  { date:'1/9/2026', time:'10:00', kind:'เบิก', code:'MAT-05', name:'สเปรย์หล่อลื่น', qty:4, unit:'กระป๋อง', left:0,
    empId:'710001', empName:'มานะ หัวหน้ากะ', dept:'BULKY', note:'ซ่อมรถลาก', proof:'', ref:'MAT-20260901-2650' }
];

// สมุดบัตรชั่วคราวจำลอง — TEMP-05 ถูกจ่ายออกไปแล้วยังไม่คืน
var CARD_ROW = 5;
var CARDS_OUT = [
  { row: 5, card: 'TEMP-05', name: 'Aung Ko', dept: 'Do3', sub: 'AK',
    why: 'ลืมบัตร', date: '29/8/2026', out: '06:10', giver: 'หัวหน้า ก.' }
];

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
  // จำลอง "งานถึงชีทแล้วหรือยัง" — ตั้ง window.MOCK_FOUND = true เพื่อทดสอบเคสใบตอบกลับหาย
  apiCheckSubmit: function (clientId) {
    MOCK_CALLS.push('check:' + clientId);
    return window.MOCK_FOUND
      ? { ok: true, found: true, recordId: 'PP-20260806-1275' }
      : { ok: true, found: false, recordId: '' };
  },
  // เข้าระบบแบบเบา — ตั้ง window.MOCK_NO_BOOT = true เพื่อจำลองเซิร์ฟเวอร์เก่าที่ยังไม่รู้จักคำสั่งนี้
  apiAdminBoot: function (id) {
    if (window.MOCK_NO_BOOT) return { ok: false, error: 'ไม่รู้จักคำสั่ง apiAdminBoot' };
    var u = STAFF.filter(function (p) { return p.id === String(id); })[0];
    if (!u || u.role !== 'แอดมิน') return { ok: false, error: 'บัญชีนี้ไม่มีสิทธิ์เข้าเว็บแอดมิน' };
    MOCK_CALLS.push('adminBoot');
    return { ok: true, user: u, canEdit: true, today: '6/8/2026',
      master: { staff: STAFF, assets: ASSETS, topics: [TOPIC_PP, TOPIC_ID], slots: SLOTS_PP, rules: [],
        depts: ['IN LH+BG', 'REPACK', 'ทุกแผนก'], shifts: ['กะ 03:00 - 12:00 น.', 'กะ 09:00 - 18:00 น.'],
        issueTags: ['แบตไม่เก็บไฟ'] } };
  },
  // ── วัสดุสิ้นเปลือง ── ยอดคงเหลือเดินจริงในตัวจำลอง เบิกแล้วยอดต้องลด
  apiSupBoot: function (empId) {
    MOCK_CALLS.push('supBoot');
    return { ok: true, user: { id: empId, name: 'ธนกฤต ศรีสุข', dept: 'ทุกแผนก' },
      stock: SUP_STOCK.map(function (x) {
        return { code: x.code, name: x.name, unit: x.unit, cat: x.cat, reorder: x.reorder,
          left: x.left, low: (x.reorder > 0 && x.left <= x.reorder), neg: x.left < 0 };
      }),
      today: '7/9/2026' };
  },
  apiSupIssue: function (p) {
    MOCK_CALLS.push('supIssue:' + (p.items || []).map(function (x) { return x.code + '×' + x.qty; }).join(','));
    window.MOCK_LAST_SUP = p;
    if (!p.proof) return { ok: false, error: 'ต้องแนบรูปหลักฐานอย่างน้อย 1 รูป' };
    var lines = [];
    (p.items || []).forEach(function (x) {
      var it = SUP_STOCK.filter(function (y) { return y.code === x.code; })[0];
      if (!it) return;
      it.left -= Number(x.qty) || 0;
      lines.push({ code: it.code, name: it.name, qty: Number(x.qty), unit: it.unit,
        left: it.left, neg: it.left < 0 });
    });
    return { ok: true, wrote: lines.length, lines: lines, ref: 'MAT-20260907-2801' };
  },

  // ── บัตรชั่วคราว ──
  // สมุดบัตรจำลอง — จ่าย/คืนแล้วเปลี่ยนจริง เหมือนแถวในชีท
  apiCardBoot: function (empId) {
    MOCK_CALLS.push('cardBoot');
    return { ok: true,
      user: { id: empId, name: 'ธนกฤต ศรีสุข', dept: 'ทุกแผนก' },
      people: [
        { card: 'BPL-007', name: 'Myo Thet Khaing', sub: 'AK',  dept: 'Bulky', train: 'อบรมเต็ม' },
        { card: 'BPL-011', name: 'Min Lwin',        sub: 'AK',  dept: 'Bulky', train: 'อบรมเต็ม' },
        { card: 'BPL-021', name: 'Aung Ko',         sub: 'AK',  dept: 'Do3',   train: 'อบรมเต็ม' },
        { card: 'BPL-030', name: 'Aung Thu',        sub: 'SVT', dept: 'Do3',   train: 'อบรมเต็ม' }
      ],
      cards: [
        { code: 'TEMP-01', dept: '', keeper: 'STD' }, { code: 'TEMP-02', dept: '', keeper: 'STD' },
        { code: 'TEMP-03', dept: '', keeper: 'STD' }, { code: 'TEMP-04', dept: '', keeper: 'STD' },
        { code: 'TEMP-05', dept: '', keeper: 'STD' }, { code: 'TEMP-06', dept: '', keeper: 'STD' },
        { code: 'TEMP-07', dept: '', keeper: 'STD' }
      ],
      out: CARDS_OUT,
      today: '29/8/2026' };
  },
  // จ่ายจริงในตัวจำลองด้วย ไม่งั้นทดสอบ "จ่ายแล้วใบนั้นต้องหายจากตัวเลือก" ไม่ได้
  apiCardIssue: function (p) {
    MOCK_CALLS.push('cardIssue:' + (p.items || []).map(function (x) { return x.card + '=' + x.name; }).join(','));
    window.MOCK_LAST_ISSUE = p;
    var items = p.items || [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i];
      if (CARDS_OUT.some(function (o) { return o.card === x.card; })) {
        return { ok: false, error: 'บัตร ' + x.card + ' ยังไม่ได้คืน' };
      }
      CARDS_OUT.push({ row: ++CARD_ROW, card: x.card, name: x.name, dept: x.dept, sub: x.sub,
        why: p.why, date: '29/8/2026', out: '08:30', giver: 'ธนกฤต ศรีสุข' });
    }
    return { ok: true, wrote: items.length };
  },
  apiCardReturn: function (p) {
    MOCK_CALLS.push('cardReturn:' + (p.rows || []).join(',') + (p.proof ? ' +รูป' : ' ไม่มีรูป'));
    window.MOCK_LAST_RETURN = p;
    var rows = (p.rows || []).map(Number);
    var n = CARDS_OUT.length;
    CARDS_OUT = CARDS_OUT.filter(function (o) { return rows.indexOf(o.row) < 0; });
    return { ok: true, closed: n - CARDS_OUT.length };
  },
  apiAssetHistory: function (id, code) {
    MOCK_CALLS.push('history:' + code);
    return { ok: true, code: code, rows: [
      { id:'IDATA-20260816-1888', ts:'16/8/2026, 18:04:11', date:'16/8/2026', action:'คืน',
        empName:'นางสาว พีรยา บุญอยู่', dept:'OUT 4W', by:'', issue:'หน้าจอแตก · Errors', note:'',
        folder:'https://drive.google.com/drive/folders/xxx' },
      { id:'IDATA-20260814-1770', ts:'14/8/2026, 09:12:03', date:'14/8/2026', action:'คืน',
        empName:'นาย ฟาริ เจะเลาะ', dept:'OUT 4W', by:'', issue:'หน้าจอแตกกดไม่ได้', note:'[นอกกะ]',
        folder:'' },
      { id:'IDATA-20260812-1501', ts:'12/8/2026, 20:41:55', date:'12/8/2026', action:'เบิก',
        empName:'นาย อับดุลลาฟิก อาแว', dept:'OUT 4W', by:'อนุชา นิสสัยกล้า (713570)',
        issue:'หน้าจอแตกเบอร์ 11/05', note:'', folder:'https://drive.google.com/drive/folders/yyy' }
    ] };
  },
  // หน้าแอดมินวัสดุ — สร้างสถิติจากประวัติจำลอง เหมือนที่เซิร์ฟเวอร์คิดจริง
  apiSupAdmin: function (empId, days) {
    MOCK_CALLS.push('supAdmin:' + days);
    var d = Number(days) || 30;
    var hist = SUP_HIST.slice();
    var perItem = {}, perUser = {}, perDept = {}, perMonth = {};
    hist.forEach(function (h) {
      if (h.kind !== 'เบิก') return;
      perItem[h.code] = (perItem[h.code] || 0) + h.qty;
      var uk = h.empId + '|' + h.empName;
      perUser[uk] = (perUser[uk] || 0) + h.qty;
      if (h.dept) perDept[h.dept] = (perDept[h.dept] || 0) + h.qty;
      var m = /^(\d+)\/(\d+)\/(\d+)$/.exec(h.date);
      if (m) { var k = m[3] + '-' + ('0' + m[2]).slice(-2); perMonth[k] = (perMonth[k] || 0) + h.qty; }
    });
    var seen = {};
    hist.forEach(function (h) { if (!seen[h.code]) seen[h.code] = h.date; });
    var items = SUP_STOCK.map(function (x) {
      var usedN = perItem[x.code] || 0;
      var perDay = usedN ? usedN / d : 0;
      return { code: x.code, name: x.name, unit: x.unit, cat: x.cat, left: x.left,
        reorder: x.reorder, low: (x.reorder > 0 && x.left <= x.reorder), neg: x.left < 0,
        used: usedN, perMonth: perDay ? Math.round(perDay * 30 * 10) / 10 : 0,
        daysLeft: (perDay > 0 && x.left > 0) ? Math.floor(x.left / perDay) : null,
        lastMove: seen[x.code] || '' };
    });
    var top = function (o) {
      return Object.keys(o).map(function (k) { return { key: k, qty: o[k] }; })
        .sort(function (a, b) { return b.qty - a.qty; }).slice(0, 10);
    };
    return { ok: true, days: d, stock: items, history: hist, today: '7/9/2026',
      stats: { items: items,
        topUsers: top(perUser).map(function (x) { var p = x.key.split('|'); return { id: p[0], name: p[1], qty: x.qty }; }),
        topDepts: top(perDept).map(function (x) { return { dept: x.key, qty: x.qty }; }),
        months: Object.keys(perMonth).sort().map(function (k) { return { month: k, qty: perMonth[k] }; }) } };
  },
  apiSupReceive: function (p) {
    MOCK_CALLS.push('supReceive:' + p.kind + ':' + (p.items || []).map(function (x) { return x.code + '×' + x.qty; }).join(','));
    var sign = (p.kind === 'รับเข้า' || p.kind === 'ปรับเพิ่ม') ? 1 : -1;
    (p.items || []).forEach(function (x) {
      var it = SUP_STOCK.filter(function (y) { return y.code === x.code; })[0];
      if (!it) return;
      it.left += sign * (Number(x.qty) || 0);
      SUP_HIST.unshift({ date: '7/9/2026', time: '10:40', kind: p.kind, code: it.code, name: it.name,
        qty: Number(x.qty), unit: it.unit, left: it.left, empId: '600112', empName: 'ธนกฤต ศรีสุข',
        dept: 'ทุกแผนก', note: p.note || '', proof: '', ref: 'MAT-20260907-2900' });
    });
    return { ok: true, wrote: (p.items || []).length };
  },
  apiSupSaveItem: function (empId, it) {
    MOCK_CALLS.push('supSaveItem:' + it.code);
    var f = SUP_STOCK.filter(function (y) { return y.code === it.code; })[0];
    if (f) { f.name = it.name; f.unit = it.unit; f.cat = it.cat; f.reorder = it.reorder; }
    else SUP_STOCK.push({ code: it.code, name: it.name, unit: it.unit, cat: it.cat,
      left: Number(it.start) || 0, reorder: Number(it.reorder) || 0 });
    return { ok: true, code: it.code, added: !f };
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
        // เบิก 10 คืน 9 ตอนบ่าย อีก 1 ตอนเย็น — ต้องอยู่ในการ์ดเดียว เห็นสองท่อน
        { id: 'PP-20260806-1300', topic: 'Power Pallet', date: '6/8/2026', shift: 'กะ 03:00 - 12:00 น.',
          empId: '730075', name: 'สุพัตรา แก้วมณี', dept: 'IN LH+BG',
          codes: 'PP-01, PP-02, PP-03, PP-04, PP-05, PP-06, PP-07, PP-08, PP-09, PP-10',
          qty: 10, qtyBack: 10, status: 'ปกติ', issue: '', note: '',
          out:  SIDE('08:00', 2, 'PP-20260806-1300', { empName: 'สุพัตรา แก้วมณี', result: 'ปกติ' }),
          back: SIDE('18:00', 1, 'PP-20260806-1322', { empName: 'สุพัตรา แก้วมณี', result: 'ปกติ', qty: 1 }),
          backs: [
            SIDE('15:00', 2, 'PP-20260806-1311', { empName: 'สุพัตรา แก้วมณี', result: 'ปกติ', qty: 9 }),
            SIDE('18:00', 1, 'PP-20260806-1322', { empName: 'สุพัตรา แก้วมณี', result: 'ปกติ', qty: 1 })
          ] },
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
