Add-Type -AssemblyName System.Drawing

# ──────────────────────────────────────────────────────────────────────────────
# Inline C#: writes a proper APNG (Animated PNG) file
# Full 32-bit RGBA, variable per-frame delays, infinite loop
# ──────────────────────────────────────────────────────────────────────────────
Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;

public static class ApngWriter
{
    public static void Write(string path, Bitmap[] frames, int[] delaysMs)
    {
        int n = frames.Length;

        // Encode every frame as individual PNG bytes
        byte[][] pngData = new byte[n][];
        for (int i = 0; i < n; i++)
        {
            using (var ms = new MemoryStream())
            {
                frames[i].Save(ms, ImageFormat.Png);
                pngData[i] = ms.ToArray();
            }
        }

        using (var fs  = new FileStream(path, FileMode.Create))
        using (var bw  = new BinaryWriter(fs))
        {
            // PNG signature
            bw.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });

            // IHDR  (copy from frame 0)
            WriteChunk(bw, "IHDR", ExtractChunk(pngData[0], "IHDR"));

            // acTL  (animation control: n frames, loop forever)
            var actl = new byte[8];
            WriteUint32BE(actl, 0, (uint)n);
            WriteUint32BE(actl, 4, 0);            // num_plays = 0 → infinite
            WriteChunk(bw, "acTL", actl);

            uint seq = 0;
            for (int i = 0; i < n; i++)
            {
                // fcTL
                var fctl = new byte[26];
                WriteUint32BE(fctl, 0,  seq++);
                WriteUint32BE(fctl, 4,  (uint)frames[i].Width);
                WriteUint32BE(fctl, 8,  (uint)frames[i].Height);
                WriteUint32BE(fctl, 12, 0);       // x offset
                WriteUint32BE(fctl, 16, 0);       // y offset
                WriteUint16BE(fctl, 20, (ushort)delaysMs[i]);  // delay numerator
                WriteUint16BE(fctl, 22, 1000);    // delay denominator (ms)
                fctl[24] = 1;                     // dispose = background (clear to transparent)
                fctl[25] = 0;                     // blend = source (overwrite)
                WriteChunk(bw, "fcTL", fctl);

                byte[] idat = ExtractAllIDAT(pngData[i]);
                if (i == 0)
                {
                    // First frame: standard IDAT (decoders without APNG see this)
                    WriteChunk(bw, "IDAT", idat);
                }
                else
                {
                    // Subsequent frames: fdAT with sequence number prepended
                    var fdat = new byte[4 + idat.Length];
                    WriteUint32BE(fdat, 0, seq++);
                    Buffer.BlockCopy(idat, 0, fdat, 4, idat.Length);
                    WriteChunk(bw, "fdAT", fdat);
                }
            }

            // IEND
            WriteChunk(bw, "IEND", new byte[0]);
        }
    }

    // ── Chunk helpers ──────────────────────────────────────────────────────────

    static void WriteChunk(BinaryWriter bw, string type, byte[] data)
    {
        byte[] tb = Encoding.ASCII.GetBytes(type);
        int    len = data.Length;
        bw.Write((byte)((len >> 24) & 0xFF));
        bw.Write((byte)((len >> 16) & 0xFF));
        bw.Write((byte)((len >>  8) & 0xFF));
        bw.Write((byte)( len        & 0xFF));
        bw.Write(tb);
        bw.Write(data);
        uint crc = CRC32(tb, data);
        bw.Write((byte)((crc >> 24) & 0xFF));
        bw.Write((byte)((crc >> 16) & 0xFF));
        bw.Write((byte)((crc >>  8) & 0xFF));
        bw.Write((byte)( crc        & 0xFF));
    }

    static byte[] ExtractChunk(byte[] png, string type)
    {
        int pos = 8;
        while (pos < png.Length - 12)
        {
            int len = (int)(((uint)png[pos]<<24)|((uint)png[pos+1]<<16)|((uint)png[pos+2]<<8)|png[pos+3]);
            pos += 4;
            string t = Encoding.ASCII.GetString(png, pos, 4);
            pos += 4;
            if (t == type) { var d = new byte[len]; Buffer.BlockCopy(png, pos, d, 0, len); return d; }
            pos += len + 4;
            if (t == "IEND") break;
        }
        return null;
    }

    static byte[] ExtractAllIDAT(byte[] png)
    {
        var chunks = new List<byte[]>();
        int total  = 0;
        int pos    = 8;
        while (pos < png.Length - 12)
        {
            int len = (int)(((uint)png[pos]<<24)|((uint)png[pos+1]<<16)|((uint)png[pos+2]<<8)|png[pos+3]);
            pos += 4;
            string t = Encoding.ASCII.GetString(png, pos, 4);
            pos += 4;
            if (t == "IDAT") { var d = new byte[len]; Buffer.BlockCopy(png, pos, d, 0, len); chunks.Add(d); total += len; }
            pos += len + 4;
            if (t == "IEND") break;
        }
        var result = new byte[total];
        int off = 0;
        foreach (var c in chunks) { Buffer.BlockCopy(c, 0, result, off, c.Length); off += c.Length; }
        return result;
    }

    static void WriteUint32BE(byte[] b, int o, uint v)
    { b[o]=(byte)(v>>24); b[o+1]=(byte)(v>>16); b[o+2]=(byte)(v>>8); b[o+3]=(byte)v; }

    static void WriteUint16BE(byte[] b, int o, ushort v)
    { b[o]=(byte)(v>>8); b[o+1]=(byte)v; }

    static uint CRC32(byte[] a, byte[] b)
    {
        uint[] t = new uint[256];
        for (uint i = 0; i < 256; i++) { uint c=i; for(int j=0;j<8;j++) c=(c&1)!=0?(0xEDB88320^(c>>1)):(c>>1); t[i]=c; }
        uint crc = 0xFFFFFFFF;
        foreach (byte x in a) crc = t[(crc^x)&0xFF]^(crc>>8);
        foreach (byte x in b) crc = t[(crc^x)&0xFF]^(crc>>8);
        return crc^0xFFFFFFFF;
    }
}
"@

# ──────────────────────────────────────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────────────────────────────────────
$baseDir    = "c:\Users\OP User\Documents\candyclone\WE_2026_Candy_Clone"
$assetsDir  = Join-Path $baseDir "assets"
$outputBase = Join-Path $assetsDir "animations\tile icons animations"

foreach ($c in @("blue","gold","red")) {
    New-Item -ItemType Directory -Force -Path (Join-Path $outputBase $c) | Out-Null
}

$TILE_SIZE   = 256
$FRAME_SIZE  = 256
$TILE_OFFSET = 0
$NUM_FRAMES  = 14

# Per-frame delays in milliseconds
# normal×2 | glow×3 | flash×2 | crack×2 | shatter×4 | hold
$FRAME_DELAYS_MS = [int[]] @(200, 200, 80, 80, 80, 50, 50, 80, 80, 70, 70, 70, 50, 350)

# ──────────────────────────────────────────────────────────────────────────────
# Shard polygons (tile-local 0-255 space, 6 wedges from centre 128,128)
# ──────────────────────────────────────────────────────────────────────────────
$rawShards = @(
    @{ xy=@(0,0, 95,0, 128,128, 0,105);          cx=55.0;  cy=58.0  },
    @{ xy=@(95,0, 256,0, 256,35, 128,128);        cx=183.0; cy=40.0  },
    @{ xy=@(256,35, 256,145, 128,128);            cx=213.0; cy=102.0 },
    @{ xy=@(256,145, 256,256, 175,256, 128,128);  cx=203.0; cy=196.0 },
    @{ xy=@(175,256, 75,256, 128,128);            cx=126.0; cy=213.0 },
    @{ xy=@(75,256, 0,256, 0,105, 128,128);       cx=50.0;  cy=186.0 }
)

$SHARDS = foreach ($s in $rawShards) {
    $list = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
    $flat = $s.xy
    for ($i = 0; $i -lt $flat.Count; $i += 2) {
        $list.Add([System.Drawing.PointF]::new($flat[$i], $flat[$i+1]))
    }
    $dx = $s.cx - 128.0; $dy = $s.cy - 128.0
    $len = [Math]::Sqrt($dx*$dx + $dy*$dy)
    [PSCustomObject]@{
        pts = $list.ToArray()
        nx  = if ($len -gt 0) { $dx/$len } else { 0.0 }
        ny  = if ($len -gt 0) { $dy/$len } else { 0.0 }
    }
}

$SETS = @(
    @{ color="blue"; dir="Tile_icons_blue"; gR=100; gG=200; gB=255 },
    @{ color="gold"; dir="Tile_icons_gold"; gR=255; gG=215; gB=40  },
    @{ color="red";  dir="tile_icons_red";  gR=255; gG=80;  gB=80  }
)
$ICONS = @("grass","ant","blue_flower","red_flower","potted_plant","shovel")

# ──────────────────────────────────────────────────────────────────────────────
# Drawing helpers
# ──────────────────────────────────────────────────────────────────────────────
function Draw-Glow($g, $strength, $gR, $gG, $gB) {
    $rings = 14
    for ($r = $rings; $r -ge 1; $r--) {
        $t     = $r / $rings
        $alpha = [Math]::Min(255, [int](180 * (1.0 - $t) * $strength))
        if ($alpha -le 2) { continue }
        $exp = ($rings - $r + 1) * 9
        $x = [float]($TILE_OFFSET - $exp);  $y = [float]($TILE_OFFSET - $exp)
        $w = [float]($TILE_SIZE + $exp*2);  $h = [float]($TILE_SIZE + $exp*2)
        $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, $gR, $gG, $gB))
        $g.FillEllipse($brush, $x, $y, $w, $h)
        $brush.Dispose()
    }
}

function Draw-Bloom($g, $strength, $gR, $gG, $gB) {
    if ($strength -le 0) { return }
    $pad  = 20
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddEllipse($TILE_OFFSET-$pad, $TILE_OFFSET-$pad, $TILE_SIZE+$pad*2, $TILE_SIZE+$pad*2)
    $pgb  = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
    $pgb.CenterPoint  = [System.Drawing.PointF]::new($TILE_OFFSET+$TILE_SIZE/2, $TILE_OFFSET+$TILE_SIZE/2)
    $pgb.CenterColor  = [System.Drawing.Color]::FromArgb([int]([Math]::Min(255,220*$strength)), $gR, $gG, $gB)
    $pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $gR, $gG, $gB))
    $g.FillRectangle($pgb, $TILE_OFFSET-$pad, $TILE_OFFSET-$pad, $TILE_SIZE+$pad*2, $TILE_SIZE+$pad*2)
    $pgb.Dispose(); $path.Dispose()
}

function Draw-Star($g, $cx, $cy, $sz, $a) {
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($a,255,255,255), [float]([Math]::Max(1,$sz*0.25)))
    for ($i = 0; $i -lt 4; $i++) {
        $angle = $i * [Math]::PI / 4
        $g.DrawLine($pen, [float]($cx-[Math]::Cos($angle)*$sz), [float]($cy-[Math]::Sin($angle)*$sz),
                          [float]($cx+[Math]::Cos($angle)*$sz), [float]($cy+[Math]::Sin($angle)*$sz))
    }
    $pen.Dispose()
    $dot = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($a,255,255,255))
    $r = [float]($sz*0.2)
    $g.FillEllipse($dot, [float]($cx-$r), [float]($cy-$r), $r*2, $r*2)
    $dot.Dispose()
}

function Draw-Sparkles($g, $strength, $seed) {
    $rng   = [Random]::new($seed)
    $count = [int](12 * $strength)
    $alpha = [int](220 * $strength)
    for ($i = 0; $i -lt $count; $i++) {
        $sx = $TILE_OFFSET + $rng.Next(10, $TILE_SIZE-10)
        $sy = $TILE_OFFSET + $rng.Next(10, $TILE_SIZE-10)
        $sz = $rng.Next(5, 18)
        Draw-Star $g $sx $sy $sz $alpha
    }
}

function Draw-EdgeSparkles($g, $strength, $seed, $gR, $gG, $gB) {
    $rng    = [Random]::new($seed+100)
    $count  = [int](10 * $strength)
    $alpha  = [int](200 * $strength)
    $alphaD = [int](140 * $strength)
    for ($i = 0; $i -lt $count; $i++) {
        $side = $rng.Next(0,4)
        switch ($side) {
            0 { $sx=$rng.Next(0,$FRAME_SIZE); $sy=$rng.Next(0,20) }
            1 { $sx=$rng.Next(0,$FRAME_SIZE); $sy=$rng.Next($FRAME_SIZE-20,$FRAME_SIZE) }
            2 { $sx=$rng.Next(0,20);           $sy=$rng.Next(0,$FRAME_SIZE) }
            3 { $sx=$rng.Next($FRAME_SIZE-20,$FRAME_SIZE); $sy=$rng.Next(0,$FRAME_SIZE) }
        }
        $sz = $rng.Next(6, 20)
        Draw-Star $g $sx $sy $sz $alpha
        $db = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alphaD,$gR,$gG,$gB))
        $g.FillEllipse($db,[float]($sx-2),[float]($sy-2),4.0,4.0)
        $db.Dispose()
    }
}

function Draw-Cracks($g, $crackAlpha, $width) {
    $O = $TILE_OFFSET
    $lines = @(@(128,128,95,0),@(128,128,256,35),@(128,128,256,145),@(128,128,175,256),@(128,128,75,256),@(128,128,0,105))
    $shadow = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb([int]($crackAlpha*0.35),255,240,200),[float]($width*0.6))
    foreach ($c in $lines) { $g.DrawLine($shadow,$O+$c[0]+1,$O+$c[1]+1,$O+$c[2]+1,$O+$c[3]+1) }
    $shadow.Dispose()
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($crackAlpha,18,8,4),[float]$width)
    foreach ($c in $lines) { $g.DrawLine($pen,$O+$c[0],$O+$c[1],$O+$c[2],$O+$c[3]) }
    $pen.Dispose()
    $subA = [int]($crackAlpha*0.75)
    $sp   = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($subA,18,8,4),[float]($width*0.6))
    $g.DrawLine($sp,$O+95,$O+0,$O+55,$O+35); $g.DrawLine($sp,$O+256,$O+35,$O+210,$O+85)
    $g.DrawLine($sp,$O+175,$O+256,$O+145,$O+210); $g.DrawLine($sp,$O+75,$O+256,$O+110,$O+205)
    $sp.Dispose()
}

function Draw-ImageAlpha($g, $src, $x, $y, $w, $h, $alphaF) {
    if ($alphaF -ge 0.999) { $g.DrawImage($src,[int]$x,[int]$y,[int]$w,[int]$h); return }
    $cm = [System.Drawing.Imaging.ColorMatrix]::new()
    $cm.Matrix33 = [float]$alphaF
    $ia = [System.Drawing.Imaging.ImageAttributes]::new()
    $ia.SetColorMatrix($cm)
    $dr = [System.Drawing.Rectangle]::new([int]$x,[int]$y,[int]$w,[int]$h)
    $g.DrawImage($src,$dr,0,0,$src.Width,$src.Height,[System.Drawing.GraphicsUnit]::Pixel,$ia)
    $ia.Dispose()
}

# ──────────────────────────────────────────────────────────────────────────────
# Generate one animation frame (returns Bitmap, caller disposes)
# ──────────────────────────────────────────────────────────────────────────────
function Generate-Frame($src, $frameIndex, $gR, $gG, $gB) {
    $bmp = [System.Drawing.Bitmap]::new($FRAME_SIZE, $FRAME_SIZE,
           [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.Clear([System.Drawing.Color]::Transparent)

    $TO = $TILE_OFFSET; $TS = $TILE_SIZE

    if ($frameIndex -le 1) {
        $g.DrawImage($src,$TO,$TO,$TS,$TS)
        if ($frameIndex -eq 1) { Draw-Glow $g 0.12 $gR $gG $gB; $g.DrawImage($src,$TO,$TO,$TS,$TS) }
    }
    elseif ($frameIndex -le 4) {
        $t = ($frameIndex-1)/4.0
        Draw-Glow $g $t $gR $gG $gB
        $g.DrawImage($src,$TO,$TO,$TS,$TS)
        Draw-Bloom $g ($t*0.6) $gR $gG $gB
        $cA = [int](55*$t)
        $cb = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($cA,[Math]::Min(255,$gR+80),[Math]::Min(255,$gG+60),[Math]::Min(255,$gB+60)))
        $g.FillRectangle($cb,$TO,$TO,$TS,$TS); $cb.Dispose()
    }
    elseif ($frameIndex -le 6) {
        $t = if ($frameIndex -eq 5) { 1.4 } else { 1.8 }
        Draw-Glow $g $t $gR $gG $gB
        $g.DrawImage($src,$TO,$TO,$TS,$TS)
        Draw-Bloom $g 1.0 $gR $gG $gB
        $wA = if ($frameIndex -eq 5) { 110 } else { 200 }
        $wb = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($wA,255,255,255))
        $g.FillRectangle($wb,$TO,$TO,$TS,$TS); $wb.Dispose()
        Draw-Sparkles $g 0.9 ($frameIndex*31)
        Draw-EdgeSparkles $g 0.8 ($frameIndex*17) $gR $gG $gB
    }
    elseif ($frameIndex -le 8) {
        $cp = $frameIndex-6
        $gs = 0.9-$cp*0.25
        $cA = if ($cp -eq 1) { 160 } else { 240 }
        $cW = if ($cp -eq 1) { [float]1.8 } else { [float]3.2 }
        Draw-Glow $g $gs $gR $gG $gB
        $g.DrawImage($src,$TO,$TO,$TS,$TS)
        Draw-Cracks $g $cA $cW
        if ($cp -eq 2) { Draw-Sparkles $g 0.35 ($frameIndex*13) }
    }
    else {
        $phase  = $frameIndex-9
        $dist   = 10+$phase*50
        $alphaF = [Math]::Max(0.0, 1.0-($phase/3.8))

        foreach ($shard in $SHARDS) {
            $ofX = [float]($shard.nx*$dist); $ofY = [float]($shard.ny*$dist)
            $fPts = [System.Drawing.PointF[]] ($shard.pts | ForEach-Object {
                [System.Drawing.PointF]::new($_.X+$TO+$ofX, $_.Y+$TO+$ofY)
            })
            $shPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
            $shPath.AddPolygon($fPts)
            $region = [System.Drawing.Region]::new($shPath)
            $g.SetClip($region, [System.Drawing.Drawing2D.CombineMode]::Replace)
            Draw-ImageAlpha $g $src ($TO+$ofX) ($TO+$ofY) $TS $TS $alphaF
            $g.ResetClip(); $region.Dispose(); $shPath.Dispose()
        }
        if ($phase -le 1) {
            $g.ResetClip()
            Draw-Sparkles $g (0.7-$phase*0.3) ($frameIndex*41+7)
        }
    }

    $g.Dispose()
    return $bmp
}

# ──────────────────────────────────────────────────────────────────────────────
# Generate APNG for one tile icon
# ──────────────────────────────────────────────────────────────────────────────
function Generate-Apng($srcPath, $outPath, $gR, $gG, $gB) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $frameArr = [System.Drawing.Bitmap[]]::new($NUM_FRAMES)
    for ($f = 0; $f -lt $NUM_FRAMES; $f++) {
        $frameArr[$f] = Generate-Frame $src $f $gR $gG $gB
    }
    $src.Dispose()
    [ApngWriter]::Write($outPath, $frameArr, $FRAME_DELAYS_MS)
    foreach ($f in $frameArr) { $f.Dispose() }
}

# ──────────────────────────────────────────────────────────────────────────────
# HTML preview (uses <img> — browsers play APNG automatically)
# ──────────────────────────────────────────────────────────────────────────────
function Generate-Preview($color, $icons, $outDir) {
    $tiles = ""
    foreach ($icon in $icons) {
        $file  = "${icon}_break_anim.png"
        $label = ($icon -replace '_',' ').ToUpper()
        $tiles += "  <div class='wrap'><img src='$file' width='256' height='256'><div class='lbl'>$label</div></div>`n"
    }
    $html = @"
<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>$($color.ToUpper()) Break Animations</title>
<style>
  body { margin:0; background:#1a1a2e; display:flex; flex-direction:column; align-items:center; padding:32px; font-family:sans-serif; }
  h1   { color:#fff; letter-spacing:3px; margin-bottom:28px; }
  .row { display:flex; gap:20px; flex-wrap:wrap; justify-content:center; }
  .wrap{ display:flex; flex-direction:column; align-items:center; gap:8px; }
  .lbl { color:#888; font-size:11px; letter-spacing:1px; }
  img  { display:block; }
</style>
</head><body>
<h1>$($color.ToUpper()) TILE BREAK ANIMATIONS</h1>
<div class='row'>
$tiles</div>
<p style='color:#555;font-size:12px;margin-top:24px'>APNG — plays automatically in Chrome, Firefox, Edge, Safari</p>
</body></html>
"@
    [System.IO.File]::WriteAllText((Join-Path $outDir "preview_$color.html"), $html)
    Write-Host "  preview: preview_$color.html"
}

# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────
foreach ($set in $SETS) {
    Write-Host "`nGenerating $($set.color.ToUpper()) set..."
    $outDir = Join-Path $outputBase $set.color
    foreach ($icon in $ICONS) {
        $srcPath = Join-Path $assetsDir "tile icons\$($set.dir)\$icon.png"
        if (-not (Test-Path $srcPath)) { Write-Warning "Not found: $srcPath"; continue }
        $outPath = Join-Path $outDir "${icon}_break_anim.png"
        Write-Host "  $icon..." -NoNewline
        Generate-Apng $srcPath $outPath $set.gR $set.gG $set.gB
        Write-Host " done"
    }
    Generate-Preview $set.color $ICONS $outDir
}

Write-Host "`nAll APNGs saved to: $outputBase"
Write-Host "Open preview_blue.html / preview_gold.html / preview_red.html in a browser."
Write-Host "Animations play automatically (APNG format)."
Write-Host "Each file: $NUM_FRAMES frames, $($TILE_SIZE)x$($TILE_SIZE)px, full RGBA"
