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

/**
 * โฟลเดอร์ประจำวัน — จำรหัสไว้ในแคช
 *
 * ของเดิมทุกครั้งที่จองงานต้องไล่หาโฟลเดอร์ใหม่ทั้งสายตั้งแต่ต้น
 * (เปิดโฟลเดอร์แม่ → ค้นหา "รูปถ่ายหน้างาน" → ค้นหาโฟลเดอร์วันที่)
 * ทั้งที่ทั้งวันมันคือโฟลเดอร์เดิมตัวเดียว — เรียก Drive ฟรี ๆ 3 ครั้งต่องาน
 */
function dayFolder_(day) {
  var cache = CacheService.getScriptCache();
  var key = 'fld:' + day;
  var id = cache.get(key);
  if (id) {
    try { return DriveApp.getFolderById(id); }
    catch (e) { /* โฟลเดอร์ถูกลบ/ย้าย — ตกไปสร้างใหม่ข้างล่าง */ }
  }
  var f = folderChild_(photoRoot_(), day);
  try { cache.put(key, f.getId(), CFG.FOLDER_CACHE_SEC); } catch (e) {}
  return f;
}

/** โฟลเดอร์ของรายการหนึ่ง ๆ — สร้างเมื่อเรียกครั้งแรก */
function recordFolder_(recordId, when) {
  var day = Utilities.formatDate(when || new Date(), CFG.TZ, 'yyyy-MM-dd');
  return folderChild_(dayFolder_(day), recordId);
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
  var r = deleteRecordPhotosBulk_([s_(recordId)]);
  if (r.failed.length) throw new Error('ไม่พบรายการ ' + recordId);
  return r.deleted;
}

/**
 * ลบรูปหลายรายการในทีเดียว — ตัวที่ทำให้หน้าแอดมินลบได้ไว
 *
 * ของเดิมช้าเพราะทำงานซ้ำทุกรายการ:
 *   อ่านชีทบันทึกทั้งใบใหม่ 1 รอบ + ไล่หาแถวอีก 1 รอบ + สั่งทิ้งไฟล์ทีละใบ
 *   25 รายการ รายการละ 6 รูป = อ่านชีท 50 รอบ + เรียก Drive ราว 175 ครั้ง
 *
 * ของใหม่ทำทีเดียวจบ:
 *   อ่านชีทรอบเดียว · ทิ้งทั้งโฟลเดอร์ (ไฟล์ข้างในติดไปเอง) · เขียนชีทกลับรอบเดียว
 *   เหลือเรียก Drive 2 ครั้งต่อรายการ ไม่ว่าจะมีรูปกี่ใบ
 *
 * เก็บร่องรอยไว้ครบเหมือนเดิม: แถวในชีท "รูปภาพ" ไม่ถูกแตะ ลิงก์รูปเดิมยังอยู่
 * พร้อมช่องถ่าย เวลา และพิกัด — ใช้เป็นหลักฐานย้อนหลังได้ว่าเคยถ่ายอะไรไว้
 */
function deleteRecordPhotosBulk_(recordIds) {
  var C = CFG.COL.REC;
  var ids = (recordIds || []).map(s_).filter(Boolean);
  if (!ids.length) return { deleted: 0, records: 0, failed: [] };

  var shR = dataSS_().getSheetByName(CFG.D.RECORDS);
  var last = shR.getLastRow();
  if (last < 2) return { deleted: 0, records: 0, failed: ids };

  // อ่านเฉพาะคอลัมน์ที่ใช้จริง แล้วเขียนกลับเฉพาะคอลัมน์โฟลเดอร์
  // ไม่แตะคอลัมน์อื่นเลย ข้อมูลที่หน้างานกรอกมาจึงไม่มีทางเพี้ยน
  var idCol  = shR.getRange(2, C.ID, last - 1, 1).getValues();
  var folRng = shR.getRange(2, C.FOLDER, last - 1, 1);
  var folCol = folRng.getValues();
  var nCol   = shR.getRange(2, C.PHOTO_N, last - 1, 1).getValues();

  var rowOf = {};
  for (var i = 0; i < idCol.length; i++) rowOf[s_(idCol[i][0])] = i;

  var deleted = 0, records = 0, failed = [], touched = false;

  ids.forEach(function (id) {
    var i = rowOf[id];
    if (i === undefined) { failed.push(id); return; }

    var fid = (/[-\w]{25,}/.exec(s_(folCol[i][0])) || [])[0];
    if (fid) {
      try {
        // ทิ้งทั้งโฟลเดอร์ทีเดียว ไฟล์ข้างในลงถังขยะตามไปเอง
        DriveApp.getFolderById(fid).setTrashed(true);
      } catch (e) { /* โฟลเดอร์ถูกลบไปแล้ว ถือว่าลบสำเร็จ */ }
      // จำนวนรูปเอาจากที่ชีทจดไว้ตอนส่ง ไม่ต้องไล่นับไฟล์ใน Drive ให้เสียเวลา
      deleted += Number(nCol[i][0]) || 0;
    }

    folCol[i][0] = 'ลบรูปแล้ว';
    touched = true;
    records++;
  });

  if (touched) folRng.setValues(folCol);
  return { deleted: deleted, records: records, failed: failed };
}
