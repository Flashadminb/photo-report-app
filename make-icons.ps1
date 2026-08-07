# สร้างไอคอนแอพ (PWA) จากสีของดีไซน์ซิสเต็ม — รันใหม่เมื่ออยากเปลี่ยนหน้าตาไอคอน
Add-Type -AssemblyName System.Drawing

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $here 'docs\icons'
New-Item -ItemType Directory -Force $out | Out-Null

$accent = [System.Drawing.ColorTranslator]::FromHtml('#ec3013')
$ink    = [System.Drawing.ColorTranslator]::FromHtml('#201e1d')
$paper  = [System.Drawing.ColorTranslator]::FromHtml('#f3f2f2')

function New-Icon([int]$size, [string]$file, [double]$inset) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'

  # พื้นหลังเต็มพื้นที่ (maskable ต้องมีสีเต็มขอบ ระบบจะครอบมุมเอง)
  $g.Clear($accent)

  # กรอบเนื้อหาอยู่ในเขตปลอดภัย
  $pad = [int]($size * $inset)
  $box = $size - ($pad * 2)

  # แถบสีหมึกด้านล่าง = แถบประทับวันเวลาบนรูป (สื่อถึงตัวระบบ)
  $barH = [int]($box * 0.20)
  $brInk = New-Object System.Drawing.SolidBrush($ink)
  $g.FillRectangle($brInk, $pad, $pad + $box - $barH, $box, $barH)

  # ตัวอักษร PR = Photo Report
  $fontSize = [float]($box * 0.46)
  $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $brPaper = New-Object System.Drawing.SolidBrush($paper)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF($pad, $pad, $box, ($box - $barH))
  $g.DrawString('PR', $font, $brPaper, $rect, $fmt)

  $g.Dispose()
  $path = Join-Path $out $file
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  '{0,-24} {1}x{1}' -f $file, $size
}

New-Icon 192 'icon-192.png'          0.08
New-Icon 512 'icon-512.png'          0.08
New-Icon 512 'icon-maskable-512.png' 0.20   # เผื่อขอบให้ระบบครอบเป็นวงกลม/สี่เหลี่ยมมน
New-Icon 180 'apple-touch-icon.png'  0.08
