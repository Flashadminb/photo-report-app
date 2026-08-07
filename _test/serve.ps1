# เซิร์ฟเวอร์ไฟล์นิ่งเล็ก ๆ สำหรับทดสอบหน้าจอในเบราว์เซอร์ (ไม่เกี่ยวกับระบบจริง)
# เสิร์ฟจากรากโปรเจกต์ เพื่อให้ทดสอบได้ทั้ง /_test/ (ข้อมูลจำลอง) และ /docs/ (ของจริง)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8777/')
$listener.Start()
Write-Host "serving $root on http://localhost:8777/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if ([string]::IsNullOrEmpty($path)) { $path = 'docs/index.html' }
  $ctx.Response.AddHeader('Access-Control-Allow-Origin', '*')
  $file = Join-Path $root $path
  # ขอโฟลเดอร์มา ให้เสิร์ฟ index.html ข้างในเหมือนโฮสต์จริง
  if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
  if (Test-Path $file -PathType Leaf) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $ext = [System.IO.Path]::GetExtension($file)
    $ctx.Response.ContentType = @{
      '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
      '.css'  = 'text/css; charset=utf-8';  '.json' = 'application/manifest+json; charset=utf-8'
      '.png'  = 'image/png'
    }[$ext]
    if (-not $ctx.Response.ContentType) { $ctx.Response.ContentType = 'application/octet-stream' }
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
