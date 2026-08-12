# สร้างหน้าเว็บสำหรับ GitHub Pages ลงโฟลเดอร์ docs/
#
#   docs/index.html   = แอพมือถือ    (จาก apps-script/app.html)
#   docs/admin.html   = เว็บแอดมิน   (จาก apps-script/admin.html)
#
# ต่างจากชุดที่รันบน Apps Script ตรงที่:
#   · ผูก manifest + ไอคอน + Service Worker (ติดตั้งเป็นแอพได้ เปิดได้ตอนไม่มีเน็ต)
#   · ใส่ API_URL เพื่อให้ rpc() ยิง fetch ไปที่ doPost ของ Apps Script แทน google.script.run
#
# แก้โค้ดที่ apps-script/ เสมอ แล้วรันไฟล์นี้ใหม่ อย่าแก้ใน docs/ โดยตรง

$API_URL = 'https://script.google.com/macros/s/AKfycbzyDZ_cZ6FxLz9OSmeOr4KOTPq0qX2kZesGQU8lvwbj3Il38KR-UGmvp4SQkoLSiX-H/exec'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path $here 'apps-script'
$out  = Join-Path $here 'docs'
$utf8 = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force $out | Out-Null

$headExtra = @'
<link rel="manifest" href="manifest.json">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="theme-color" content="#201e1d">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="ถ่ายรูปงาน">
'@

$swReg = @'
<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* ไม่รองรับก็ใช้งานได้ปกติ */ });
  });
  // เวอร์ชันใหม่มาถึงตอนไหนก็รีเฟรชให้เลย ไม่ต้องปิดแอพเปิดใหม่เอง
  // แต่ห้ามรีตอนกำลังทำงานค้างอยู่ เดี๋ยวรูปที่ถ่ายไว้หาย — รอรอบหน้าแทน
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (reloading) return;
    var cur = document.querySelector('[data-screen]:not(.hide)');
    var at = cur ? cur.getAttribute('data-screen') : '';
    if (at !== 'login' && at !== 'home' && at !== 'queue') return;
    reloading = true;
    location.reload();
  });

  // เช็คเวอร์ชันใหม่ตอนสลับกลับมาที่แอพด้วย ไม่ใช่แค่ตอนเปิดใหม่
  //
  // ปกติเบราว์เซอร์เช็คไฟล์ Service Worker เฉพาะตอน "โหลดหน้าใหม่จริง ๆ"
  // คนที่กดปุ่มโฮมออกไปแล้วสลับกลับมา ไม่นับเป็นการโหลดใหม่
  // ถ้าเขาไม่เคยรูดแอพทิ้งเลย จะติดอยู่กับเวอร์ชันเก่าได้เป็นสัปดาห์
  // เช็คไม่เกิน 15 นาทีครั้ง (ไฟล์แค่ 3 KB) เจอของใหม่เมื่อไหร่รีเฟรชให้เองตามกติกาข้างบน
  var lastCheck = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastCheck < 900000) return;
    lastCheck = Date.now();
    navigator.serviceWorker.getRegistration()
      .then(function (reg) { if (reg) reg.update(); })
      .catch(function () { /* เช็คไม่ได้ก็ใช้ของเดิมไปก่อน */ });
  });
}
</script>
'@

$pages = @{ 'app' = 'index.html'; 'admin' = 'admin.html' }

foreach ($page in $pages.Keys) {
  $t = [IO.File]::ReadAllText((Join-Path $src "$page.html"))

  # 1) แทน include() ด้วยเนื้อไฟล์จริง
  $t = [regex]::Replace($t, "<\?!=\s*include\('([a-z\-]+)'\);\s*\?>", {
    param($m)
    $f = $m.Groups[1].Value
    "<!-- ===== $f.html ===== -->`r`n" + [IO.File]::ReadAllText((Join-Path $src ($f + '.html')))
  })

  # 2) เปลี่ยนตัวแปรฝั่ง Apps Script เป็นค่าคงที่ของเว็บ
  $t = $t.Replace(
    '<script>var WEBAPP_URL = <?!= JSON.stringify(webAppUrl) ?>;</script>',
    "<script>`r`nwindow.API_URL   = '$API_URL';`r`nwindow.ADMIN_URL = './admin.html';`r`nvar WEBAPP_URL   = './';`r`n</script>")

  # 3) ผูก manifest / ไอคอน / theme-color เข้ากับ <head>
  $t = $t.Replace('<base target="_top">', "<base target=`"_top`">`r`n$headExtra")

  # 4) จดทะเบียน Service Worker ท้ายหน้า
  $t = $t.Replace('</body>', "$swReg`r`n</body>")

  [IO.File]::WriteAllText((Join-Path $out $pages[$page]), $t, $utf8)
}

Get-ChildItem $out -File | ForEach-Object { '{0,-16} {1,8:N0} bytes' -f $_.Name, $_.Length }
