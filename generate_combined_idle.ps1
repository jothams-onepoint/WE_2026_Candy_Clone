Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing' -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public static class CombinedApng
{
    public static void Write(string path, Bitmap[] frames, int[] delaysMs)
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
            var actl=new byte[8]; WriteUint32BE(actl,0,(uint)n); WriteUint32BE(actl,4,0);
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
    public static Bitmap ExtractContent(Bitmap src, Color bg, int threshold)
    {
        int w=src.Width, h=src.Height;
        var dst=new Bitmap(w,h,PixelFormat.Format32bppArgb);
        var rect=new Rectangle(0,0,w,h);
        var sl=src.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
        var dl=dst.LockBits(rect,ImageLockMode.WriteOnly,PixelFormat.Format32bppArgb);
        int stride=Math.Abs(sl.Stride), bytes=stride*h;
        byte[] sb2=new byte[bytes], db=new byte[bytes];
        Marshal.Copy(sl.Scan0,sb2,0,bytes);
        int tSq=threshold*threshold*3;
        for (int i=0; i<bytes; i+=4)
        {
            byte B=sb2[i],G=sb2[i+1],R=sb2[i+2],A=sb2[i+3];
            int dR=R-bg.R,dG=G-bg.G,dB=B-bg.B;
            if ((A>=64)&&(dR*dR+dG*dG+dB*dB>=tSq))
            { db[i]=B;db[i+1]=G;db[i+2]=R;db[i+3]=A; }
        }
        Marshal.Copy(db,0,dl.Scan0,bytes);
        src.UnlockBits(sl); dst.UnlockBits(dl);
        return dst;
    }
    static void WriteChunk(BinaryWriter bw,string type,byte[] data)
    {
        byte[] tb=Encoding.ASCII.GetBytes(type); int len=data.Length;
        bw.Write((byte)((len>>24)&0xFF));bw.Write((byte)((len>>16)&0xFF));
        bw.Write((byte)((len>>8)&0xFF));bw.Write((byte)(len&0xFF));
        bw.Write(tb);bw.Write(data);
        uint crc=CRC32(tb,data);
        bw.Write((byte)((crc>>24)&0xFF));bw.Write((byte)((crc>>16)&0xFF));
        bw.Write((byte)((crc>>8)&0xFF));bw.Write((byte)(crc&0xFF));
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

# ── Paths ─────────────────────────────────────────────────────────────────────
$menuDir = "c:\Users\OP User\Documents\candyclone\WE_2026_Candy_Clone\assets\menu elements"
$outDir  = "c:\Users\OP User\Documents\candyclone\WE_2026_Candy_Clone\assets\animations\menu animations\combined_preview"
$outFile = Join-Path $outDir "all_idle.png"

# ── Display sizes ─────────────────────────────────────────────────────────────
$SQ   = 150                          # square icons rendered at 150x150
$PAD  = 12                           # gap between icons
$EDGE = 16                           # outer padding

# ── Keyframes (identical to generate_menu_animations.ps1) ─────────────────────
$kSX = [float[]] @( 1.000,1.000,1.000,1.012,1.048,1.065,0.958,0.932,0.955,0.982,1.078,1.042,1.008,0.992,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000 )
$kSY = [float[]] @( 1.000,1.000,0.992,0.958,0.918,0.895,1.095,1.125,1.088,1.012,0.878,0.920,0.995,1.012,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000,1.000 )
$kTY = [float[]] @( 0.0,  0.0,  1.0,  3.5,  5.5,  6.5,-13.0,-19.0,-12.0, -2.5,  5.0,  2.0,  0.0, -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0, -0.5 )
$kD  = [int[]]   @( 150,  150,  100,   70,   55,   50,   48,   58,   45,   40,   58,   55,   65,   80,  120,  150,  150,  150,  150,  150,  150,  150,  150,  130 )
$N   = $kSX.Length

# ── Load sources + extract content layers ─────────────────────────────────────
Write-Host "Loading sources..."

function Load-Icon([string]$path, [bool]$pill=$false) {
    $src    = [System.Drawing.Bitmap]::new($path)
    $sampX  = if ($pill) { [int]($src.Width * 0.04) } else { 8 }
    $bgCol  = $src.GetPixel($sampX, [int]($src.Height / 2))
    $content = [CombinedApng]::ExtractContent($src, $bgCol, 40)
    return @{ src=$src; content=$content; bgCol=$bgCol; pill=$pill }
}

$icHome     = Load-Icon (Join-Path $menuDir "Home.png")
$icQuests   = Load-Icon (Join-Path $menuDir "quests.png")
$icSettings = Load-Icon (Join-Path $menuDir "settings.png")
$icShop     = Load-Icon (Join-Path $menuDir "shop.png")
$icPlay     = Load-Icon (Join-Path $menuDir "play_button.png") $true

# ── Compute layout ────────────────────────────────────────────────────────────
# Square icons all render at $SQ x $SQ.
# Play button scales proportionally to $SQ height.
$playSrcW = $icPlay.src.Width; $playSrcH = $icPlay.src.Height
$playDispH = $SQ
$playDispW = [int]($playSrcW * $playDispH / $playSrcH)

$totalW = $EDGE + $SQ + $PAD + $SQ + $PAD + $SQ + $PAD + $SQ + $PAD + $playDispW + $EDGE
$totalH = $EDGE + $SQ + $EDGE

# X positions for each icon (top-left corner)
$xHome     = $EDGE
$xQuests   = $xHome     + $SQ + $PAD
$xSettings = $xQuests   + $SQ + $PAD
$xShop     = $xSettings + $SQ + $PAD
$xPlay     = $xShop     + $SQ + $PAD
$yTop      = $EDGE
$yPlayTop  = $EDGE + [int](($SQ - $playDispH) / 2)   # vertically centred

Write-Host "Canvas: $totalW x $totalH px"

# ── Helper: build rounded-rect path at canvas position ───────────────────────
function RR-At([int]$x,[int]$y,[int]$w,[int]$h,[int]$r) {
    $p=$([System.Drawing.Drawing2D.GraphicsPath]::new()); $r2=$r*2
    $p.AddArc($x,$y,$r2,$r2,180,90); $p.AddArc($x+$w-$r2,$y,$r2,$r2,270,90)
    $p.AddArc($x+$w-$r2,$y+$h-$r2,$r2,$r2,0,90); $p.AddArc($x,$y+$h-$r2,$r2,$r2,90,90)
    $p.CloseAllFigures(); return $p
}

# ── Helper: stamp one icon onto the main canvas graphics context ──────────────
function Stamp-Icon($gc, $icon, [int]$cx, [int]$cy, [int]$dW, [int]$dH,
                    [float]$sx, [float]$sy, [float]$tySrc, [bool]$pill) {
    $srcH = $icon.src.Height
    $r    = if ($pill) { [int]($dH/2) } else { [int]($dW * 0.165) }
    $shape = RR-At $cx $cy $dW $dH $r

    # Static background — no transform
    $b=[System.Drawing.SolidBrush]::new($icon.bgCol); $gc.FillPath($b,$shape); $b.Dispose()

    # Clip to shape
    $gc.SetClip($shape)

    # Hop transform centred on icon centre
    $tyDisp = [float]($tySrc * $dH / $srcH)
    $gc.TranslateTransform([float]($cx + $dW/2), [float]($cy + $dH/2) + $tyDisp)
    $gc.ScaleTransform($sx, $sy)
    $gc.TranslateTransform([float](-$dW/2), [float](-$dH/2))
    $gc.DrawImage($icon.content, 0, 0, $dW, $dH)

    # Shimmer while airborne
    if ($tySrc -lt -5.0) {
        $air   = [float](([Math]::Abs($tySrc)-5.0)/14.0)
        $shimX = [int]($dW * (20.0/256.0 + $air * (170.0/256.0)))
        $shimW = [int]($dW * 0.20)
        $shimT = [int]($dH * 0.11); $shimH2 = [int]($dH * 0.28)
        $shimA = [int](20 + $air*32)
        $sb=[System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($shimA,255,255,255))
        $gc.FillRectangle($sb,$shimX,$shimT,$shimW,$shimH2); $sb.Dispose()
    }

    $gc.ResetTransform(); $gc.ResetClip()
    $shape.Dispose()
}

# ── Render all frames ─────────────────────────────────────────────────────────
Write-Host "Rendering $N frames..."
$bg    = [System.Drawing.Color]::FromArgb(255, 26, 26, 46)   # #1a1a2e
$frames = [System.Drawing.Bitmap[]]::new($N)

for ($f=0; $f -lt $N; $f++) {
    $bmp = [System.Drawing.Bitmap]::new($totalW, $totalH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gc  = [System.Drawing.Graphics]::FromImage($bmp)
    $gc.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $gc.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gc.CompositingMode   = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $gc.Clear($bg)

    # Each icon uses its own offset into the shared keyframe cycle
    $kH = ($f +  0) % $N;  Stamp-Icon $gc $icHome     $xHome     $yTop    $SQ $SQ $kSX[$kH] $kSY[$kH] $kTY[$kH] $false
    $kQ = ($f +  5) % $N;  Stamp-Icon $gc $icQuests   $xQuests   $yTop    $SQ $SQ $kSX[$kQ] $kSY[$kQ] $kTY[$kQ] $false
    $kS = ($f + 10) % $N;  Stamp-Icon $gc $icSettings $xSettings $yTop    $SQ $SQ $kSX[$kS] $kSY[$kS] $kTY[$kS] $false
    $kSh= ($f + 15) % $N;  Stamp-Icon $gc $icShop     $xShop     $yTop    $SQ $SQ $kSX[$kSh] $kSY[$kSh] $kTY[$kSh] $false
    $kP = ($f + 20) % $N;  Stamp-Icon $gc $icPlay     $xPlay  $yPlayTop $playDispW $playDispH $kSX[$kP] $kSY[$kP] $kTY[$kP] $true

    $gc.Dispose()
    $frames[$f] = $bmp
    Write-Host "  frame $($f+1)/$N"
}

# ── Save APNG ─────────────────────────────────────────────────────────────────
Write-Host "Saving APNG..."
[CombinedApng]::Write($outFile, $frames, $kD)
foreach ($f in $frames) { $f.Dispose() }

# ── Cleanup ───────────────────────────────────────────────────────────────────
foreach ($ic in @($icHome,$icQuests,$icSettings,$icShop,$icPlay)) {
    $ic.src.Dispose(); $ic.content.Dispose()
}

$kb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "Done: all_idle.png  ($kb KB)"
Write-Host "Open: $outFile"
