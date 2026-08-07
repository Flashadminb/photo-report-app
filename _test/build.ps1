# สร้างหน้าเว็บทดสอบจากไฟล์ใน apps-script/ โดยแทน include() และใส่ mock ฝั่งเซิร์ฟเวอร์
# ใช้ดูหน้าจอในเบราว์เซอร์โดยไม่ต้อง deploy — ไม่ใช่ส่วนหนึ่งของระบบจริง
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = Join-Path (Split-Path -Parent $here) 'apps-script'
$mock = [IO.File]::ReadAllText((Join-Path $here 'mock.js'))

foreach ($page in @('app', 'admin')) {
  $t = [IO.File]::ReadAllText((Join-Path $src "$page.html"))
  $t = [regex]::Replace($t, "<\?!=\s*include\('([a-z\-]+)'\);\s*\?>", {
    param($m) [IO.File]::ReadAllText((Join-Path $src ($m.Groups[1].Value + '.html')))
  })
  $t = $t.Replace("<?!= JSON.stringify(webAppUrl) ?>", "'https://example.test/exec'")
  $i = $t.IndexOf('<body>') + 6
  $t = $t.Insert($i, "`n<script>`n$mock`n</script>`n")
  [IO.File]::WriteAllText((Join-Path $here "$page.html"), $t, (New-Object Text.UTF8Encoding($false)))
  Write-Host "built $page.html"
}
