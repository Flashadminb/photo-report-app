/**
 * Photos.gs — เก็บรูปลง Google Drive
 *
 * โครงโฟลเดอร์:  <โฟลเดอร์แม่>/รูปถ่ายหน้างาน/2026-08-06/PP-20260806-1275/
 * รูปถูกประทับวันเวลา+พิกัด+รหัสเครื่องมาแล้วจากฝั่งมือถือ (canvas) ก่อนอัปโหลด
 */

function folderChild_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function photoRoot_() {
  var parent = DriveApp.getFolderById(CFG.DRIVE_PARENT_ID);
  return folderChild_(parent, CFG.PHOTO_ROOT_NAME);
}

/** โฟลเดอร์ของรายการหนึ่ง ๆ — สร้างเมื่อเรียกครั้งแรก */
function recordFolder_(recordId, when) {
  var day = Utilities.formatDate(when || new Date(), CFG.TZ, 'yyyy-MM-dd');
  return folderChild_(folderChild_(photoRoot_(), day), recordId);
}

/**
 * บันทึกรูป 1 ใบ
 *
 * รับ folder เข้ามาเลย เพราะการหาโฟลเดอร์ซ้ำทุกใบทำให้ช้ามาก
 * (การส่ง 1 ครั้งมี 5–6 รูป — เรียก Drive API ซ้ำหลายสิบครั้งโดยไม่จำเป็น)
 *
 * @param {Folder} folder    โฟลเดอร์ของรายการ จาก recordFolder_()
 * @param {string} recordId
 * @param {string} slot      ชื่อช่องถ่าย เช่น "กุญแจ"
 * @param {string} dataUrl   "data:image/jpeg;base64,...."
 * @returns {{url:string, id:string}}
 */
function savePhoto_(folder, recordId, slot, dataUrl, seq) {
  var m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('รูปไม่ถูกต้อง (' + slot + ')');

  var mime = m[1];
  var bytes = Utilities.base64Decode(m[2]);
  var ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
  var name = recordId + '-' + pad2_(seq || 1) + '-' + safeName_(slot) + '.' + ext;

  var file = folder.createFile(Utilities.newBlob(bytes, mime, name));

  return {
    id: file.getId(),
    url: 'https://drive.google.com/open?id=' + file.getId()
  };
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function safeName_(s) {
  return String(s || 'photo').replace(/[\\\/:*?"<>|]+/g, '-').slice(0, 40);
}

/**
 * ลบรูปทั้งหมดของรายการ (ปุ่ม "ลบรูป" ในหน้าแอดมิน) เพื่อคืนพื้นที่ Drive
 *
 * เก็บร่องรอยไว้ครบ: แถวในชีท "รูปภาพ" ไม่ถูกลบ ลิงก์รูปเดิมยังอยู่
 * พร้อมช่องถ่าย เวลา และพิกัด — ใช้เป็นหลักฐานย้อนหลังได้ว่าเคยถ่ายอะไรไว้
 * แค่กดลิงก์แล้วจะไม่เห็นภาพหลังไฟล์ถูกลบถาวรจากถังขยะ (Drive ล้างเองใน 30 วัน)
 */
function deleteRecordPhotos_(recordId) {
  var recs = allRecords_();
  var rec = null;
  for (var i = 0; i < recs.length; i++) if (recs[i].id === recordId) rec = recs[i];
  if (!rec) throw new Error('ไม่พบรายการ ' + recordId);

  var n = 0;
  if (rec.folder) {
    var fid = (/[-\w]{25,}/.exec(rec.folder) || [])[0];
    if (fid) {
      try {
        var folder = DriveApp.getFolderById(fid);
        var files = folder.getFiles();
        while (files.hasNext()) { files.next().setTrashed(true); n++; }
      } catch (e) { /* โฟลเดอร์ถูกลบไปแล้ว */ }
    }
  }

  // ทำเครื่องหมายในชีทบันทึกว่ารูปถูกลบแล้ว — คงจำนวนรูปเดิมไว้ให้รู้ว่าเคยมีกี่ใบ
  var shR = dataSS_().getSheetByName(CFG.D.RECORDS);
  var row = findRow_(shR, CFG.COL.REC.ID, recordId);
  if (row) shR.getRange(row, CFG.COL.REC.FOLDER).setValue('ลบรูปแล้ว');

  return n;
}
