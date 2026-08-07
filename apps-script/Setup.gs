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
