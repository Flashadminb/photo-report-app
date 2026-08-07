# สร้างชุดไฟล์สำหรับก๊อปวางลง Apps Script — รวมจาก apps-script/ ให้เหลือ 3 ไฟล์
#
#   bundle/Code.gs      = .gs ทั้ง 6 ไฟล์ต่อกัน
#   bundle/app.html     = app.html + css + js-common + js-app  (แทน include() แล้ว)
#   bundle/admin.html   = admin.html + css + js-common + js-admin
#
# แก้โค้ดที่ apps-script/ เสมอ แล้วรันไฟล์นี้ใหม่ อย่าแก้ใน bundle/ โดยตรง

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$src    = Join-Path $here 'apps-script'
$out    = Join-Path $here 'bundle'
$utf8   = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force $out | Out-Null

# ── Code.gs ────────────────────────────────────────────────────────────
$order = @('Config', 'Master', 'Records', 'Photos', 'Api', 'Setup')
$parts = @(
  '/**',
  ' * Code.gs — รวมทุกไฟล์ .gs ไว้ที่เดียวเพื่อให้ก๊อปวางง่าย',
  ' *',
  ' * สร้างอัตโนมัติจากโฟลเดอร์ apps-script/ ด้วย build-bundle.ps1',
  ' * อย่าแก้ไฟล์นี้โดยตรง — แก้ที่ apps-script/ แล้วรันสคริปต์ใหม่',
  ' */',
  ''
)
foreach ($n in $order) {
  $parts += ''
  $parts += ('// ' + ('=' * 74))
  $parts += ("//  $n.gs")
  $parts += ('// ' + ('=' * 74))
  $parts += ''
  $parts += [IO.File]::ReadAllText((Join-Path $src "$n.gs"))
}
[IO.File]::WriteAllText((Join-Path $out 'Code.gs'), ($parts -join "`r`n"), $utf8)

# ── app.html / admin.html ──────────────────────────────────────────────
foreach ($page in @('app', 'admin')) {
  $t = [IO.File]::ReadAllText((Join-Path $src "$page.html"))
  $t = [regex]::Replace($t, "<\?!=\s*include\('([a-z\-]+)'\);\s*\?>", {
    param($m)
    $f = $m.Groups[1].Value
    "<!-- ===== $f.html ===== -->`r`n" + [IO.File]::ReadAllText((Join-Path $src "$f.html"))
  })
  [IO.File]::WriteAllText((Join-Path $out "$page.html"), $t, $utf8)
}

Get-ChildItem $out | ForEach-Object {
  '{0,-12} {1,8:N0} bytes' -f $_.Name, $_.Length
}
