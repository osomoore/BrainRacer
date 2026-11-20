# Generates the TV banner (320x180) and launcher icon (144x144). Run from anywhere.
Add-Type -AssemblyName System.Drawing
$res = Join-Path $PSScriptRoot '..\app\src\main\res'

function New-Art([int]$w, [int]$h, [string]$path, [single]$fontSize) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::FromArgb(11, 30, 74))
    $stripeH = [int]($h * 0.08)
    $g.FillRectangle([System.Drawing.Brushes]::Gold, 0, [int]($h * 0.72), $w, $stripeH)
    $font = New-Object System.Drawing.Font 'Arial', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $rect = New-Object System.Drawing.RectangleF 0, 0, $w, ($h * 0.72)
    $g.DrawString('BrainRacer', $font, [System.Drawing.Brushes]::White, $rect, $sf)
    $g.Dispose()
    New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

New-Art 320 180 (Join-Path $res 'drawable-xhdpi\banner.png') 46
New-Art 144 144 (Join-Path $res 'mipmap-xxhdpi\ic_launcher.png') 24
