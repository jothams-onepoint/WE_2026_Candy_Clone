Add-Type -AssemblyName System.Drawing

# ──────────────────────────────────────────────────────────────────────────────
# APNG writer (supports numPlays: 0=infinite, 1=once, etc.)
# ──────────────────────────────────────────────────────────────────────────────
Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Text;

public static class MenuApng
{
    public static void Write(string path, Bitmap[] frames, int[] delaysMs, uint numPlays)
    {
        int n = frames.Length;
        byte[][] pngData = new byte[n][];
        for (int i = 0; i < n; i++)
        {
            using (var ms = new MemoryStream())
            { frames[i].Save(ms, ImageFormat.Png); pngData[i] = ms.ToArray(); }
        }
        using (var fs = new FileStream(path, FileMode.Create))
        using (var bw = new BinaryWriter(fs))
        {
            bw.Write(new byte[] { 137,80,78,71,13,10,26,10 });
            WriteChunk(bw,"IHDR",ExtractChunk(pngData[0],"IHDR"));
            var actl = new byte[8]; WriteUint32BE(actl,0,(uint)n); WriteUint32BE(actl,4,numPlays);
            WriteChunk(bw,"acTL",actl);
            uint seq = 0;
            for (int i = 0; i < n; i++)
            {
                var fctl = new byte[26];
                WriteUint32BE(fctl,0,seq++); WriteUint32BE(fctl,4,(uint)frames[i].Width);
                WriteUint32BE(fctl,8,(uint)frames[i].Height); WriteUint32BE(fctl,12,0); WriteUint32BE(fctl,16,0);
                WriteUint16BE(fctl,20,(ushort)delaysMs[i]); WriteUint16BE(fctl,22,1000);
                fctl[24]=1; fctl[25]=0;
                WriteChunk(bw,"fcTL",fctl);
                byte[] idat = ExtractAllIDAT(pngData[i]);
                if (i == 0) { WriteChunk(bw,"IDAT",idat); }
                else
                {
                    var fdat = new byte[4+idat.Length]; WriteUint32BE(fdat,0,seq++);
                    Buffer.BlockCopy(idat,0,fdat,4,idat.Length); WriteChunk(bw,"fdAT",fdat);
                }
            }
            WriteChunk(bw,"IEND",new byte[0]);
        }
    }
    static void WriteChunk(BinaryWriter bw,string type,byte[] data)
    {
        byte[] tb = Encoding.ASCII.GetBytes(type); int len=data.Length;
        bw.Write((byte)((len>>24)&0xFF)); bw.Write((byte)((len>>16)&0xFF));
        bw.Write((byte)((len>>8)&0xFF));  bw.Write((byte)(len&0xFF));
        bw.Write(tb); bw.Write(data);
        uint crc=CRC32(tb,data);
        bw.Write((byte)((crc>>24)&0xFF)); bw.Write((byte)((crc>>16)&0xFF));
        bw.Write((byte)((crc>>8)&0xFF));  bw.Write((byte)(crc&0xFF));
    }
    static byte[] ExtractChunk(byte[] png,string type)
    {
        int pos=8;
        while (pos<png.Length-12)
        {
            int len=(int)(((uint)png[pos]<<24)|((uint)png[pos+1]<<16)|((uint)png[pos+2]<<8)|png[pos+3]); pos+=4;
            string t=Encoding.ASCII.GetString(png,pos,4); pos+=4;
            if (t==type){var d=new byte[len];Buffer.BlockCopy(png,pos,d,0,len);return d;}
            pos+=len+4; if(t=="IEND")break;
        }
        return null;
    }
    static byte[] ExtractAllIDAT(byte[] png)
    {
        var chunks=new List<byte[]>(); int total=0,pos=8;
        while(pos<png.Length-12)
        {
            int len=(int)(((uint)png[pos]<<24)|((uint)png[pos+1]<<16)|((uint)png[pos+2]<<8)|png[pos+3]); pos+=4;
            string t=Encoding.ASCII.GetString(png,pos,4); pos+=4;
            if(t=="IDAT"){var d=new byte[len];Buffer.BlockCopy(png,pos,d,0,len);chunks.Add(d);total+=len;}
            pos+=len+4; if(t=="IEND")break;
        }
        var r=new byte[total]; int off=0;
        foreach(var c in chunks){Buffer.BlockCopy(c,0,r,off,c.Length);off+=c.Length;}
        return r;
    }
    static void WriteUint32BE(byte[] b,int o,uint v){b[o]=(byte)(v>>24);b[o+1]=(byte)(v>>16);b[o+2]=(byte)(v>>8);b[o+3]=(byte)v;}
    static void WriteUint16BE(byte[] b,int o,ushort v){b[o]=(byte)(v>>8);b[o+1]=(byte)v;}
    static uint CRC32(byte[] a,byte[] b)
    {
        uint[] t=new uint[256];
        for(uint i=0;i<256;i++){uint c=i;for(int j=0;j<8;j++)c=(c&1)!=0?(0xEDB88320^(c>>1)):(c>>1);t[i]=c;}
        uint crc=0xFFFFFFFF;
        foreach(byte x in a)crc=t[(crc^x)&0xFF]^(crc>>8);
        foreach(byte x in b)crc=t[(crc^x)&0xFF]^(crc>>8);
        return crc^0xFFFFFFFF;
    }
}
"@

# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────
$baseDir  = "c:\Users\OP User\Documents\candyclone\WE_2026_Candy_Clone"
$menuDir  = Join-Path $baseDir "assets\menu elements"
$outDir   = Join-Path $baseDir "assets\animations\menu animations"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# ──────────────────────────────────────────────────────────────────────────────
# Frame utilities
# ──────────────────────────────────────────────────────────────────────────────
function New-Frame([int]$w, [int]$h) {
    $bmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    return @{ bmp=$bmp; g=$g }
}

# Draw src scaled/rotated/translated around its own centre (cx=w/2, cy=h/2)
function Draw-XForm($g, $src, [int]$w, [int]$h, [float]$sx=1, [float]$sy=1, [float]$rot=0, [float]$tx=0, [float]$ty=0) {
    $g.ResetTransform()
    $g.TranslateTransform([float]($w/2) + $tx, [float]($h/2) + $ty)
    $g.ScaleTransform($sx, $sy)
    $g.RotateTransform($rot)
    $g.TranslateTransform([float](-$w/2), [float](-$h/2))
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.ResetTransform()
}

# White tint overlay
function Add-Tint($g, [int]$w, [int]$h, [int]$alpha) {
    if ($alpha -le 0) { return }
    $b = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([Math]::Min(255,$alpha), 255, 255, 255))
    $g.FillRectangle($b, 0, 0, $w, $h)
    $b.Dispose()
}

function Save-Apng([string]$outPath, $frames, $delays, $loops=0) {
    [MenuApng]::Write($outPath, [System.Drawing.Bitmap[]]$frames, [int[]]$delays, [UInt32]$loops)
    foreach ($f in $frames) { $f.Dispose() }
}

# ──────────────────────────────────────────────────────────────────────────────
# CLICK animation  (shared — squash + white flash, plays ONCE)
# ──────────────────────────────────────────────────────────────────────────────
function Gen-Click([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    # scales / tints for 10 frames: squeeze in → hold → spring back
    $scales = [float[]] @(1.00, 0.95, 0.90, 0.88, 0.88, 0.88, 0.91, 0.95, 0.98, 1.00)
    $tints  = [int[]]   @(0,    20,   55,   80,   80,   80,   55,   25,   8,    0)
    $delays = [int[]]   @(30,   30,   30,   40,   50,   40,   35,   35,   35,   60)

    $frames = [System.Drawing.Bitmap[]]::new(10)
    for ($f = 0; $f -lt 10; $f++) {
        $fr = New-Frame $W $H; $g = $fr.g
        $s = $scales[$f]
        Draw-XForm $g $src $W $H $s $s 0 0 0
        Add-Tint $g $W $H $tints[$f]
        $g.Dispose()
        $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 1   # plays ONCE
    Write-Host "    click saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# HOME idle
# House bobs up/down; door panel slides open revealing dark interior, then closes
# Door approx: left=108 top=168 width=40 height=44 (from image inspection)
# ──────────────────────────────────────────────────────────────────────────────
function Gen-HomeIdle([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    # Sample wall colour near door for interior shade
    $wallCol = $src.GetPixel(128, 160)   # red wall
    $interiorCol = [System.Drawing.Color]::FromArgb(220,
        [Math]::Max(0, [int]($wallCol.R * 0.35)),
        [Math]::Max(0, [int]($wallCol.G * 0.25)),
        [Math]::Max(0, [int]($wallCol.B * 0.20)))
    # Sample door colour
    $doorCol = $src.GetPixel(128, 190)   # yellow door

    $N = 30; $delays = [int[]] (@(75) * $N)
    $frames = [System.Drawing.Bitmap[]]::new($N)

    for ($f = 0; $f -lt $N; $f++) {
        $t     = [float]($f) / $N          # 0..1
        $angle = $t * [Math]::PI * 2

        $ty    = [float]([Math]::Sin($angle) * 4.5)         # bob ±4.5px
        $scale = [float](1.0 + [Math]::Sin($angle * 2) * 0.008)  # subtle breathe

        $fr = New-Frame $W $H; $g = $fr.g

        # Draw icon with bob + breathe (transform active while drawing overlays)
        $g.TranslateTransform([float]($W/2), [float]($H/2) + $ty)
        $g.ScaleTransform($scale, $scale)
        $g.TranslateTransform([float](-$W/2), [float](-$H/2))
        $g.DrawImage($src, 0, 0, $W, $H)

        # Door opening overlay (drawn in image-space so it bobs/scales with house)
        $doorL = 108; $doorT = 168; $doorW = 40; $doorH = 44
        # doorOpen: 0→1→0 in second half of cycle (opens from t=0.3 to 0.7)
        $rawOpen = [Math]::Sin([Math]::PI * ($t - 0.25) * 2)  # peaks at t=0.5
        $openAmt = [float]([Math]::Max(0.0, $rawOpen))

        if ($openAmt -gt 0.01) {
            # Interior (dark) shows full door rect
            $ib = [System.Drawing.SolidBrush]::new($interiorCol)
            $g.FillRectangle($ib, $doorL, $doorT, $doorW, $doorH)
            $ib.Dispose()
            # Door panel: yellow rect shrinks from right as it "opens"
            $panelW = [int]($doorW * (1.0 - $openAmt) + 0.5)
            if ($panelW -gt 1) {
                $db = [System.Drawing.SolidBrush]::new($doorCol)
                $g.FillRectangle($db, $doorL, $doorT, $panelW, $doorH)
                $db.Dispose()
                # Door outline
                $dp = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(200, 20, 10, 5), [float]2.5)
                $g.DrawRectangle($dp, $doorL, $doorT, $doorW, $doorH)
                $dp.Dispose()
            }
        }

        $g.ResetTransform(); $g.Dispose()
        $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 0
    Write-Host "    home_idle saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# QUESTS idle
# Whole icon sways left/right (quill writing motion) with gentle bob
# ──────────────────────────────────────────────────────────────────────────────
function Gen-QuestsIdle([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    $N = 28; $delays = [int[]] (@(75) * $N)
    $frames = [System.Drawing.Bitmap[]]::new($N)

    for ($f = 0; $f -lt $N; $f++) {
        $t     = [float]($f) / $N
        $angle = $t * [Math]::PI * 2

        # Quill sway: slow rotation oscillation
        $rot   = [float]([Math]::Sin($angle) * 11.0)         # ±11°
        # Bob: slightly faster than rotation for personality
        $ty    = [float]([Math]::Sin($angle * 1.5) * 3.5)
        $tx    = [float]([Math]::Sin($angle) * 3.0)
        # Slight scale squish at extremes
        $sx    = [float](1.0 - [Math]::Abs([Math]::Sin($angle)) * 0.012)
        $sy    = [float](1.0 + [Math]::Abs([Math]::Sin($angle)) * 0.012)

        $fr = New-Frame $W $H; $g = $fr.g
        Draw-XForm $g $src $W $H $sx $sy $rot $tx $ty
        $g.Dispose(); $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 0
    Write-Host "    quests_idle saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# SETTINGS idle
# Gear rotates continuously; background painted fresh each frame so it stays stable
# ──────────────────────────────────────────────────────────────────────────────
function Gen-SettingsIdle([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    # Sample background colour and corner radius
    $bgCol  = $src.GetPixel(8, [int]($H / 2))
    $radius = [int]($W * 0.165)   # ≈42px for 256px icon

    $N = 36; $delays = [int[]] (@(50) * $N)   # 36 × 50ms = 1.8s / full rotation
    $frames = [System.Drawing.Bitmap[]]::new($N)

    for ($f = 0; $f -lt $N; $f++) {
        $rot = [float]($f * 360.0 / $N)   # 0→360°

        $fr = New-Frame $W $H; $g = $fr.g

        # 1. Paint solid background (covers transparent corners after rotation)
        $bgBrush = [System.Drawing.SolidBrush]::new($bgCol)
        $g.FillRectangle($bgBrush, 0, 0, $W, $H)
        $bgBrush.Dispose()

        # 2. Clip to rounded rectangle (matches original icon shape)
        $rrPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $r2 = $radius * 2
        $rrPath.AddArc(0, 0, $r2, $r2, 180, 90)
        $rrPath.AddArc($W-$r2, 0, $r2, $r2, 270, 90)
        $rrPath.AddArc($W-$r2, $H-$r2, $r2, $r2, 0, 90)
        $rrPath.AddArc(0, $H-$r2, $r2, $r2, 90, 90)
        $rrPath.CloseAllFigures()
        $g.SetClip($rrPath)

        # 3. Draw source rotated around centre
        $g.TranslateTransform([float]($W/2), [float]($H/2))
        $g.RotateTransform($rot)
        $g.TranslateTransform([float](-$W/2), [float](-$H/2))
        $g.DrawImage($src, 0, 0, $W, $H)
        $g.ResetTransform()
        $g.ResetClip()

        $rrPath.Dispose()
        $g.Dispose(); $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 0
    Write-Host "    settings_idle saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# SHOP idle
# Building squashes + stretches (breathing), slight vertical bob, awning swing
# ──────────────────────────────────────────────────────────────────────────────
function Gen-ShopIdle([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    $N = 26; $delays = [int[]] (@(80) * $N)
    $frames = [System.Drawing.Bitmap[]]::new($N)

    for ($f = 0; $f -lt $N; $f++) {
        $t     = [float]($f) / $N
        $angle = $t * [Math]::PI * 2

        # Squash/stretch: Y grows while X shrinks (organic breathe)
        $sy   = [float](1.0 + [Math]::Sin($angle) * 0.045)
        $sx   = [float](1.0 - [Math]::Sin($angle) * 0.022)
        # Slight bob: settle down when squashed (pushes to floor on squash)
        $ty   = [float]([Math]::Sin($angle) * 4.0)
        # Secondary wobble on X (tilting character)
        $tilt = [float]([Math]::Sin($angle * 2 + 0.5) * 1.8)

        $fr = New-Frame $W $H; $g = $fr.g

        # Draw main body squash/stretch
        Draw-XForm $g $src $W $H $sx $sy 0 $tilt $ty

        # Awning highlight sweep (subtle shimmer across the awning stripes)
        $awningTop = [int]($H * 0.11)
        $awningH   = [int]($H * 0.28)
        $shimmerX  = [int]($W * (0.3 + [Math]::Sin($angle) * 0.35))
        $shimmerW  = [int]($W * 0.18)
        $shimAlpha = [int](30 + [Math]::Sin($angle * 2) * 20)
        $shimBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($shimAlpha, 255, 255, 255))
        $g.FillRectangle($shimBrush, $shimmerX, $awningTop, $shimmerW, $awningH)
        $shimBrush.Dispose()

        $g.Dispose(); $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 0
    Write-Host "    shop_idle saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# PLAY BUTTON idle
# Bouncy pop: scale pulse + wave lean + colour bloom sweep
# ──────────────────────────────────────────────────────────────────────────────
function Gen-PlayIdle([string]$srcPath, [string]$outPath) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W = $src.Width; $H = $src.Height

    $N = 24; $delays = [int[]] (@(70) * $N)
    $frames = [System.Drawing.Bitmap[]]::new($N)

    for ($f = 0; $f -lt $N; $f++) {
        $t     = [float]($f) / $N
        $angle = $t * [Math]::PI * 2

        # Overall bounce scale
        $scale  = [float](1.0 + [Math]::Sin($angle) * 0.04)
        $ty     = [float]([Math]::Sin($angle) * -4.0)   # pop upward on expand

        # Wave lean: slight X shear simulating letters jiggling
        $leanSx = [float](1.0 + [Math]::Sin($angle * 2) * 0.015)
        $leanSy = [float](1.0 - [Math]::Sin($angle * 2) * 0.010)

        $fr = New-Frame $W $H; $g = $fr.g

        Draw-XForm $g $src $W $H ($scale*$leanSx) ($scale*$leanSy) 0 0 $ty

        # Sweeping highlight across letters (left→right→left over one cycle)
        $sweepX  = [int]($W * (0.5 + [Math]::Sin($angle) * 0.55))
        $sweepW  = [int]($W * 0.22)
        $sweepA  = [int](18 + [Math]::Sin($angle * 2) * 12)
        $sweepB  = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($sweepA, 255, 255, 255))
        $g.FillRectangle($sweepB, $sweepX - $sweepW/2, 0, $sweepW, $H)
        $sweepB.Dispose()

        $g.Dispose(); $frames[$f] = $fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 0
    Write-Host "    play_idle saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# HTML preview
# ──────────────────────────────────────────────────────────────────────────────
function Gen-Preview {
    $items = @(
        @{ label="HOME idle";     file="home_idle.png";     w=256; h=256 },
        @{ label="HOME click";    file="home_click.png";    w=256; h=256 },
        @{ label="QUESTS idle";   file="quests_idle.png";   w=256; h=256 },
        @{ label="QUESTS click";  file="quests_click.png";  w=256; h=256 },
        @{ label="SETTINGS idle"; file="settings_idle.png"; w=256; h=256 },
        @{ label="SETTINGS click";file="settings_click.png";w=256; h=256 },
        @{ label="SHOP idle";     file="shop_idle.png";     w=256; h=256 },
        @{ label="SHOP click";    file="shop_click.png";    w=256; h=256 },
        @{ label="PLAY idle";     file="play_idle.png";     w=512; h=128 }
    )
    $tiles = ""
    foreach ($it in $items) {
        $tiles += "  <div class='wrap'><img src='$($it.file)' width='$($it.w)' height='$($it.h)'><div class='lbl'>$($it.label)</div></div>`n"
    }
    $html = @"
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menu Animations</title>
<style>
  body{margin:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:32px;font-family:sans-serif;}
  h1{color:#fff;letter-spacing:3px;margin-bottom:28px;}
  .row{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
  .lbl{color:#888;font-size:11px;letter-spacing:1px;}
  img{display:block;border-radius:8px;}
</style></head><body>
<h1>MENU ELEMENT ANIMATIONS</h1>
<div class='row'>
$tiles</div>
<p style='color:#555;font-size:12px;margin-top:24px'>APNG — plays automatically. Click files play once per trigger.</p>
</body></html>
"@
    [System.IO.File]::WriteAllText((Join-Path $outDir "preview.html"), $html)
    Write-Host "  preview.html saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────
Write-Host "`nGenerating menu element animations..."

Write-Host "  HOME..."
Gen-HomeIdle    (Join-Path $menuDir "Home.png")    (Join-Path $outDir "home_idle.png")
Gen-Click       (Join-Path $menuDir "Home.png")    (Join-Path $outDir "home_click.png")

Write-Host "  QUESTS..."
Gen-QuestsIdle  (Join-Path $menuDir "quests.png")  (Join-Path $outDir "quests_idle.png")
Gen-Click       (Join-Path $menuDir "quests.png")  (Join-Path $outDir "quests_click.png")

Write-Host "  SETTINGS..."
Gen-SettingsIdle (Join-Path $menuDir "settings.png") (Join-Path $outDir "settings_idle.png")
Gen-Click        (Join-Path $menuDir "settings.png") (Join-Path $outDir "settings_click.png")

Write-Host "  SHOP..."
Gen-ShopIdle    (Join-Path $menuDir "shop.png")    (Join-Path $outDir "shop_idle.png")
Gen-Click       (Join-Path $menuDir "shop.png")    (Join-Path $outDir "shop_click.png")

Write-Host "  PLAY BUTTON..."
Gen-PlayIdle    (Join-Path $menuDir "play_button.png") (Join-Path $outDir "play_idle.png")

Gen-Preview

Write-Host "`nAll menu animations saved to:"
Write-Host "  $outDir"
Write-Host "Open preview.html in a browser to see everything playing."
Write-Host "Idle files loop forever. Click files play once (trigger via JS)."
