Add-Type -AssemblyName System.Drawing

# ──────────────────────────────────────────────────────────────────────────────
# C# helpers: APNG writer + content-layer extractor
# ──────────────────────────────────────────────────────────────────────────────
Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
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
            bw.Write(new byte[]{ 137,80,78,71,13,10,26,10 });
            WriteChunk(bw,"IHDR",ExtractChunk(pngData[0],"IHDR"));
            var actl=new byte[8]; WriteUint32BE(actl,0,(uint)n); WriteUint32BE(actl,4,numPlays);
            WriteChunk(bw,"acTL",actl);
            uint seq=0;
            for (int i=0; i<n; i++)
            {
                var fctl=new byte[26];
                WriteUint32BE(fctl,0,seq++); WriteUint32BE(fctl,4,(uint)frames[i].Width);
                WriteUint32BE(fctl,8,(uint)frames[i].Height); WriteUint32BE(fctl,12,0); WriteUint32BE(fctl,16,0);
                WriteUint16BE(fctl,20,(ushort)delaysMs[i]); WriteUint16BE(fctl,22,1000);
                fctl[24]=1; fctl[25]=0;
                WriteChunk(bw,"fcTL",fctl);
                byte[] idat=ExtractAllIDAT(pngData[i]);
                if (i==0) { WriteChunk(bw,"IDAT",idat); }
                else
                {
                    var fdat=new byte[4+idat.Length]; WriteUint32BE(fdat,0,seq++);
                    Buffer.BlockCopy(idat,0,fdat,4,idat.Length); WriteChunk(bw,"fdAT",fdat);
                }
            }
            WriteChunk(bw,"IEND",new byte[0]);
        }
    }

    // Background pixels (close to bgColor) become transparent; content survives.
    public static Bitmap ExtractContent(Bitmap src, Color bgColor, int threshold)
    {
        int w = src.Width, h = src.Height;
        var dst  = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, w, h);
        var srcLk = src.LockBits(rect, ImageLockMode.ReadOnly,  PixelFormat.Format32bppArgb);
        var dstLk = dst.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        int stride = Math.Abs(srcLk.Stride);
        int bytes  = stride * h;
        byte[] srcBuf = new byte[bytes];
        byte[] dstBuf = new byte[bytes];
        Marshal.Copy(srcLk.Scan0, srcBuf, 0, bytes);
        int tSq = threshold * threshold * 3;
        for (int i = 0; i < bytes; i += 4)
        {
            byte pixB=srcBuf[i], pixG=srcBuf[i+1], pixR=srcBuf[i+2], pixA=srcBuf[i+3];
            int dR=pixR-bgColor.R, dG=pixG-bgColor.G, dB=pixB-bgColor.B;
            if ((pixA >= 64) && (dR*dR + dG*dG + dB*dB >= tSq))
            { dstBuf[i]=pixB; dstBuf[i+1]=pixG; dstBuf[i+2]=pixR; dstBuf[i+3]=pixA; }
        }
        Marshal.Copy(dstBuf, 0, dstLk.Scan0, bytes);
        src.UnlockBits(srcLk); dst.UnlockBits(dstLk);
        return dst;
    }

    static void WriteChunk(BinaryWriter bw,string type,byte[] data)
    {
        byte[] tb=Encoding.ASCII.GetBytes(type); int len=data.Length;
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
        while(pos<png.Length-12)
        {
            int len=(int)(((uint)png[pos]<<24)|((uint)png[pos+1]<<16)|((uint)png[pos+2]<<8)|png[pos+3]); pos+=4;
            string t=Encoding.ASCII.GetString(png,pos,4); pos+=4;
            if(t==type){var d=new byte[len];Buffer.BlockCopy(png,pos,d,0,len);return d;}
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
$baseDir = "c:\Users\OP User\Documents\candyclone\WE_2026_Candy_Clone"
$menuDir = Join-Path $baseDir "assets\menu elements"
$outDir  = Join-Path $baseDir "assets\animations\menu animations"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────
function New-Frame([int]$w,[int]$h) {
    $bmp = [System.Drawing.Bitmap]::new($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.CompositingMode   = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    return @{ bmp=$bmp; g=$g }
}

function Make-RRPath([int]$w,[int]$h,[int]$r) {
    $p=$([System.Drawing.Drawing2D.GraphicsPath]::new()); $r2=$r*2
    $p.AddArc(0,0,$r2,$r2,180,90); $p.AddArc($w-$r2,0,$r2,$r2,270,90)
    $p.AddArc($w-$r2,$h-$r2,$r2,$r2,0,90); $p.AddArc(0,$h-$r2,$r2,$r2,90,90)
    $p.CloseAllFigures(); return $p
}

function Draw-StaticBg($g,$bgCol,$shapePath) {
    $b=[System.Drawing.SolidBrush]::new($bgCol); $g.FillPath($b,$shapePath); $b.Dispose()
}

function Begin-Content($g,[System.Drawing.Image]$content,[int]$w,[int]$h,
    [float]$sx=1,[float]$sy=1,[float]$rot=0,[float]$tx=0,[float]$ty=0) {
    $g.TranslateTransform([float]($w/2)+$tx,[float]($h/2)+$ty)
    $g.ScaleTransform($sx,$sy); $g.RotateTransform($rot)
    $g.TranslateTransform([float](-$w/2),[float](-$h/2))
    $g.DrawImage($content,0,0,$w,$h)
}

function End-Content($g) { $g.ResetTransform(); $g.ResetClip() }

function Save-Apng([string]$outPath,$frames,$delays,$loops=0) {
    [MenuApng]::Write($outPath,[System.Drawing.Bitmap[]]$frames,[int[]]$delays,[UInt32]$loops)
    foreach ($f in $frames) { $f.Dispose() }
}

function Add-Tint($g,[int]$w,[int]$h,[int]$alpha) {
    if ($alpha -le 0) { return }
    $b=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb([Math]::Min(255,$alpha),255,255,255))
    $g.FillRectangle($b,0,0,$w,$h); $b.Dispose()
}

# ──────────────────────────────────────────────────────────────────────────────
# SHARED HOP IDLE  — identical keyframe animation applied to every icon
#
# Shape stays absolutely static (FillPath, no transform ever).
# Content-only layer (bg stripped to transparent) does the hop inside the clip.
#
# Pass -Pill for the play button (corner radius = H/2 for full pill ends).
# All other icons use the standard rounded-square radius.
# ──────────────────────────────────────────────────────────────────────────────
function Gen-HopIdle([string]$srcPath,[string]$outPath,[switch]$Pill,[int]$Offset=0) {
    $src = [System.Drawing.Bitmap]::new($srcPath)
    $W=$src.Width; $H=$src.Height

    if ($Pill) {
        $radius  = [int]($H / 2)           # full pill ends
        $bgSampX = [int]($W * 0.04)        # sample inside pill, away from letters
    } else {
        $radius  = [int]($W * 0.165)       # ~42 px for 256-px square
        $bgSampX = 8
    }

    $bgCol   = $src.GetPixel($bgSampX, [int]($H/2))
    $content = [MenuApng]::ExtractContent($src, $bgCol, 40)

    # ── Keyframes (24 frames) — exact copy of shop_idle ──────────────────────
    # still → squat anticipation → launch → peak → descend → land → settle → still
    $kSX = [float[]] @( 1.000,1.000,1.000,1.012,1.048,1.065,0.958,0.932,0.955,0.982,1.078,1.042,1.008,0.992,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000 )
    $kSY = [float[]] @( 1.000,1.000,0.992,0.958,0.918,0.895,1.095,1.125,1.088,1.012,0.878,0.920,0.995,1.012,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000 )
    $kTY = [float[]] @( 0.0,  0.0,  1.0,  3.5,  5.5,  6.5,-13.0,-19.0,-12.0, -2.5,  5.0,  2.0,  0.0, -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5 )
    $kD  = [int[]]   @( 150,  150,  100,   70,   55,   50,   48,   58,   45,   40,   58,   55,   65,   80,  120,  150,  150,  150,  150,  150,  150,  150,  150,  130 )

    $N=$kSX.Length; $frames=[System.Drawing.Bitmap[]]::new($N)
    $shimTop=[int]($H*0.11); $shimHt=[int]($H*0.28)

    for ($f=0; $f -lt $N; $f++) {
        $k=($f+$Offset)%$N; $sx=$kSX[$k]; $sy=$kSY[$k]; $ty=$kTY[$k]
        $fr=New-Frame $W $H; $g=$fr.g
        $shape=Make-RRPath $W $H $radius

        # 1. Static shape — zero transform, never moves
        Draw-StaticBg $g $bgCol $shape

        # 2. Clip so content is contained within the shape
        $g.SetClip($shape)

        # 3. Content-only layer animated with hop transform
        Begin-Content $g $content $W $H $sx $sy 0 0 $ty

        # 4. Highlight shimmer while airborne (same as shop)
        if ($ty -lt -5.0) {
            $air  = [float](([Math]::Abs($ty)-5.0)/14.0)
            $shimX= [int](20+$air*170); $shimW=[int]($W*0.20)
            $shimA= [int](20+$air*32)
            $sb=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($shimA,255,255,255))
            $g.FillRectangle($sb,$shimX,$shimTop,$shimW,$shimHt); $sb.Dispose()
        }

        End-Content $g
        $shape.Dispose(); $g.Dispose(); $frames[$f]=$fr.bmp
    }
    $content.Dispose(); $src.Dispose()
    Save-Apng $outPath $frames $kD 0
    Write-Host "    saved: $(Split-Path $outPath -Leaf)"
}

# ──────────────────────────────────────────────────────────────────────────────
# CLICK  — whole element squashes + white flash, plays ONCE
# ──────────────────────────────────────────────────────────────────────────────
function Gen-Click([string]$srcPath,[string]$outPath) {
    $src=[System.Drawing.Bitmap]::new($srcPath); $W=$src.Width; $H=$src.Height
    $scales=[float[]] @(1.00,0.95,0.90,0.88,0.88,0.88,0.91,0.95,0.98,1.00)
    $tints =[int[]]   @(0,   20,  55,  80,  80,  80,  55,  25,   8,   0)
    $delays=[int[]]   @(30,  30,  30,  40,  50,  40,  35,  35,  35,  60)
    $frames=[System.Drawing.Bitmap[]]::new(10)
    for ($f=0; $f -lt 10; $f++) {
        $s=$scales[$f]; $fr=New-Frame $W $H; $g=$fr.g
        $g.TranslateTransform([float]($W/2),[float]($H/2))
        $g.ScaleTransform($s,$s)
        $g.TranslateTransform([float](-$W/2),[float](-$H/2))
        $g.DrawImage($src,0,0,$W,$H); $g.ResetTransform()
        Add-Tint $g $W $H $tints[$f]; $g.Dispose(); $frames[$f]=$fr.bmp
    }
    $src.Dispose()
    Save-Apng $outPath $frames $delays 1
    Write-Host "    saved: $(Split-Path $outPath -Leaf)"
}

# ──────────────────────────────────────────────────────────────────────────────
# HTML preview
# ──────────────────────────────────────────────────────────────────────────────
function Gen-Preview {
    $items=@(
        @{label="HOME idle";      file="home_idle.png";      w=256;h=256},
        @{label="HOME click";     file="home_click.png";     w=256;h=256},
        @{label="QUESTS idle";    file="quests_idle.png";    w=256;h=256},
        @{label="QUESTS click";   file="quests_click.png";   w=256;h=256},
        @{label="SETTINGS idle";  file="settings_idle.png";  w=256;h=256},
        @{label="SETTINGS click"; file="settings_click.png"; w=256;h=256},
        @{label="SHOP idle";      file="shop_idle.png";      w=256;h=256},
        @{label="SHOP click";     file="shop_click.png";     w=256;h=256},
        @{label="PLAY idle";      file="play_idle.png";      w=512;h=128}
    )
    $tiles=""
    foreach ($it in $items) {
        $tiles+="  <div class='wrap'><img src='$($it.file)' width='$($it.w)' height='$($it.h)'><div class='lbl'>$($it.label)</div></div>`n"
    }
    $html=@"
<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Menu Animations</title>
<style>
  body{margin:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:32px;font-family:sans-serif;}
  h1{color:#fff;letter-spacing:3px;margin-bottom:28px;}
  .row{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;}
  .wrap{display:flex;flex-direction:column;align-items:center;gap:8px;}
  .lbl{color:#888;font-size:11px;letter-spacing:1px;}
  img{display:block;border-radius:4px;}
</style></head><body>
<h1>MENU ELEMENT ANIMATIONS</h1>
<div class='row'>
$tiles</div>
<p style='color:#555;font-size:12px;margin-top:24px'>All idle animations share the shop hop. Squares locked. Click = once.</p>
</body></html>
"@
    [System.IO.File]::WriteAllText((Join-Path $outDir "preview.html"),$html)
    Write-Host "  preview.html saved"
}

# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────
Write-Host "`nGenerating menu animations (shared hop idle)..."

Write-Host "  HOME (offset 0)..."
Gen-HopIdle  (Join-Path $menuDir "Home.png")         (Join-Path $outDir "home_idle.png")     -Offset 0
Gen-Click    (Join-Path $menuDir "Home.png")         (Join-Path $outDir "home_click.png")

Write-Host "  QUESTS (offset 5)..."
Gen-HopIdle  (Join-Path $menuDir "quests.png")       (Join-Path $outDir "quests_idle.png")   -Offset 5
Gen-Click    (Join-Path $menuDir "quests.png")       (Join-Path $outDir "quests_click.png")

Write-Host "  SETTINGS (offset 10)..."
Gen-HopIdle  (Join-Path $menuDir "settings.png")     (Join-Path $outDir "settings_idle.png") -Offset 10
Gen-Click    (Join-Path $menuDir "settings.png")     (Join-Path $outDir "settings_click.png")

Write-Host "  SHOP (offset 15)..."
Gen-HopIdle  (Join-Path $menuDir "shop.png")         (Join-Path $outDir "shop_idle.png")     -Offset 15
Gen-Click    (Join-Path $menuDir "shop.png")         (Join-Path $outDir "shop_click.png")

Write-Host "  PLAY BUTTON (offset 20)..."
Gen-HopIdle  (Join-Path $menuDir "play_button.png")  (Join-Path $outDir "play_idle.png") -Pill -Offset 20

Gen-Preview

Write-Host "`nDone. All idle animations use the shop hop keyframes."
Write-Host "Output: $outDir"
