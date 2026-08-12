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
 * ── กันรูปหลุดตอนส่งซ้ำ ────────────────────────────────────────────
 *
 * เน็ตหน้างานสะดุดบ่อย: ไฟล์ขึ้นไดรฟ์สำเร็จแล้ว แต่คำตอบหายกลางทาง
 * แอปนึกว่าล้มเหลวเลยส่งใหม่ → ได้ไฟล์ซ้ำในไดรฟ์ และใบแรกกลายเป็นไฟล์ลอย
 * ที่ชีทไม่รู้จัก (เป็นต้นเหตุของรายการที่ค้าง "รอรูป")
 *
 * แก้ด้วยการตั้งชื่อไฟล์จาก "รหัสรูปฝั่งแอป" ซึ่งคงที่ตลอดไม่ว่าจะส่งกี่รอบ
 * ถ้าเจอว่ามีไฟล์ชื่อนี้อยู่แล้วก็ใช้ใบเดิม ไม่สร้างซ้ำ — ส่งกี่ครั้งผลก็เหมือนเดิม
 *
 * @param {string} [key]  รหัสรูปฝั่งแอป (คงที่ข้ามการส่งซ้ำ) — ไม่ส่งมาก็ยังทำงานได้
 * @returns {{url:string, id:string, reused:boolean}}
 */
function savePhoto_(folder, recordId, slot, dataUrl, seq, key) {
  var m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl || '');
  if (!m) throw new Error('รูปไม่ถูกต้อง (' + slot + ')');

  var mime = m[1];
  var ext = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
  // มีรหัสรูป = ไม่ใส่เลขลำดับในชื่อ เพราะเลขลำดับเปลี่ยนทุกครั้งที่ส่งใหม่
  // ชื่อจะได้คงที่และจับคู่ของเดิมเจอ (เลขลำดับไม่ได้ใช้ทำอะไร ลำดับจริงอยู่ในชีท)
  var k = safeName_(key);
  var name = k
    ? recordId + '-' + safeName_(slot) + '~' + k + '.' + ext
    : recordId + '-' + pad2_(seq || 1) + '-' + safeName_(slot) + '.' + ext;

  // มีไฟล์ชื่อนี้อยู่แล้ว = เคยอัปใบนี้สำเร็จไปแล้ว ใช้ของเดิม
  if (k) {
    var it = folder.getFilesByName(name);
    if (it.hasNext()) {
      var old = it.next();
      return { id: old.getId(), url: driveUrl_(old.getId()), reused: true };
    }
  }

  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), mime, name));
  return { id: file.getId(), url: driveUrl_(file.getId()), reused: false };
}

function driveUrl_(id) { return 'https://drive.google.com/open?id=' + id; }

/** ดึงรหัสไฟล์ออกจากลิงก์ที่เก็บในชีท */
function fileIdFromUrl_(url) {
  var m = /[-\w]{25,}/.exec(s_(url));
  return m ? m[0] : '';
}

/**
 * ซ่อมรายการ: ไล่ดูไฟล์ในโฟลเดอร์ของรายการ แล้วเติมใบที่ชีทยังไม่รู้จัก
 *
 * ใช้ได้กับ 2 กรณีที่เจอจริง:
 *   1. ไฟล์ขึ้นไดรฟ์แล้วแต่แถวไม่ได้ถูกเขียน (คำตอบหายกลางทาง) — รายการค้าง "รอรูป"
 *   2. คนเอารูปไปใส่ในโฟลเดอร์เองจากไดรฟ์ตรง ๆ — เว็บไม่มีทางรู้ ต้องมาดึงเข้าระบบ
 *
 * ชื่อช่องถ่ายอ่านจากชื่อไฟล์ที่ระบบตั้งไว้ตอนอัป (รหัสรายการ-ลำดับ-ชื่อช่อง)
 * ไฟล์ที่คนตั้งชื่อเองอ่านไม่ออกก็ยังดึงเข้ามา แต่ทำเครื่องหมายว่ามาจากไดรฟ์
 *
 * @returns {{added:number, total:number, skipped:number}}
 */
function syncPhotosFromDrive_(recordId, folderUrl, knownUrls) {
  var id = s_(recordId);
  var fid = fileIdFromUrl_(folderUrl);
  if (!fid) throw new Error('รายการ ' + id + ' ไม่มีโฟลเดอร์รูปในชีท');

  var folder;
  try { folder = DriveApp.getFolderById(fid); }
  catch (e) { throw new Error('เปิดโฟลเดอร์ของรายการ ' + id + ' ไม่ได้ (อาจถูกลบไปแล้ว)'); }

  var have = {};
  (knownUrls || []).forEach(function (u) {
    var f = fileIdFromUrl_(u);
    if (f) have[f] = true;
  });

  var rows = [], skipped = 0;
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (have[f.getId()]) { skipped++; continue; }
    if (String(f.getMimeType() || '').indexOf('image/') !== 0) { skipped++; continue; }

    rows.push({
      slot: slotFromFileName_(f.getName(), id),
      url: driveUrl_(f.getId()),
      time: Utilities.formatDate(f.getDateCreated(), CFG.TZ, 'HH:mm:ss'),
      gps: ''
    });
  }

  if (!rows.length) return { added: 0, total: (knownUrls || []).length, skipped: skipped };

  var r = addPhotoRows_(id, rows, true);
  return { added: r.added, total: r.total, skipped: skipped };
}

/**
 * แกะชื่อช่องถ่ายออกจากชื่อไฟล์ "รหัสรายการ-ลำดับ-ชื่อช่อง[~รหัสรูป].นามสกุล"
 * อ่านไม่ออก = ไฟล์ที่คนเอามาใส่เอง บอกไปตรง ๆ ว่ามาจากไดรฟ์
 */
function slotFromFileName_(name, recordId) {
  var n = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  if (n.indexOf(recordId + '-') === 0) {
    var rest = n.slice(recordId.length + 1).replace(/^\d+-/, '').split('~')[0];
    if (rest) return rest;
  }
  return 'เพิ่มจากไดรฟ์';
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
