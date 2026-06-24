// Animated background rendering system
// Usage: window.BgSystem.start(index)  /  window.BgSystem.stop()
window.BgSystem = (function () {
  const W = 1920, H = 1080;
  let canvas = null, ctx = null, raf = null;
  let currentIndex = -1;
  const staticLayers = [];
  const flowerLists = [];

  /* ═══ STATIC HELPERS ═══ */
  function tri(x) { x = ((x % 1) + 1) % 1; return x < 0.5 ? x * 2 : (1 - x) * 2; }

  function drawForest(ctx, bYR, ampR, col, f1, f2, p1, p2) {
    const by = bYR * H, amp = ampR * H;
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, by);
    for (let i = 0; i <= 700; i++) {
      const t = i / 700;
      const pk = (tri(t * f1 + p1) * 0.54 + tri(t * f2 + p2) * 0.30 + Math.abs(Math.sin(t * Math.PI * f1 * 1.4 + p1 + 0.3)) * 0.16) * amp;
      ctx.lineTo(t * W, by - pk);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }

  function drawMound(ctx, bYR, ampR, col, freq, phase) {
    const by = bYR * H, amp = ampR * H;
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, by);
    for (let i = 0; i <= 500; i++) {
      const t = i / 500;
      ctx.lineTo(t * W, by - Math.abs(Math.sin(t * Math.PI * freq + phase)) * amp);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }

  function drawBushClump(ctx, cx, cy, size, color) {
    [[0, 0, 1], [-.52, .12, .74], [.52, .12, .74], [0, .18, .80], [-.27, -.18, .58], [.27, -.18, .58], [-.80, .22, .55], [.80, .22, .55]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(cx + dx * size, cy + dy * size * .65, r * size, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    });
  }

  function drawCanopyHighlights(ctx, bYR, color) {
    for (let i = 0; i < 22; i++) {
      const x = ((i * 89 + 30) % (W - 120)) + 60, y = bYR * H - 30 + ((i * 47) % 90);
      ctx.save(); ctx.globalAlpha = 0.06 + (i % 4) * 0.02;
      ctx.beginPath(); ctx.ellipse(x, y, 38 + (i % 5) * 18, 18 + (i % 4) * 9, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
    }
  }

  function drawBlades(ctx, yR, density, maxH, colors) {
    [{ yO: maxH * .18, hM: .68, dM: .90, wB: 3.2 }, { yO: 0, hM: 1, dM: 1, wB: 4.2 }, { yO: -maxH * .08, hM: .52, dM: .65, wB: 2.6 }].forEach((p, pi) => {
      const by = yR * H + p.yO, n = Math.floor(density * p.dM), step = W / n;
      for (let i = 0; i < n; i++) {
        const x = (i + .5) * step + ((i * 7 + pi * 17) % step - step * .5) * .6;
        const h = maxH * p.hM * (.46 + ((i * 19 + pi * 11) % 60) / 100);
        const lean = ((i * 7 + pi * 5) % 15) - 7, w = p.wB + (i % 3) * .7;
        ctx.beginPath(); ctx.moveTo(x - w, by);
        ctx.quadraticCurveTo(x + lean * .3 - w * .2, by - h * .55, x + lean, by - h);
        ctx.quadraticCurveTo(x + lean * .7 + w * .2, by - h * .55, x + w, by);
        ctx.closePath(); ctx.fillStyle = colors[(i + pi * 3) % colors.length]; ctx.fill();
      }
    });
  }

  function drawMushroom(ctx, x, y, s) {
    ctx.fillStyle = '#c8b888'; ctx.fillRect(x - 5.5 * s, y - 17 * s, 11 * s, 19 * s);
    ctx.beginPath(); ctx.ellipse(x, y - 16 * s, 14 * s, 10 * s, 0, Math.PI, 0, true); ctx.fillStyle = '#c03020'; ctx.fill();
    [[0, -20], [-5.5, -26], [5, -27], [-2, -31]].forEach(([dx, dy]) => {
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 2 * s, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fill();
    });
  }

  function drawRock(ctx, x, y, rx, ry) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = '#5e6870'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - rx * .22, y - ry * .22, rx * .4, ry * .36, 0, 0, Math.PI * 2); ctx.fillStyle = '#7a8892'; ctx.fill();
  }

  function drawLeafStatic(ctx, x, y, r, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * .46, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }

  function drawPond(ctx, x, y, rx, ry) {
    const g = ctx.createLinearGradient(x - rx, y, x + rx, y);
    g.addColorStop(0, '#5ab8d8'); g.addColorStop(.45, '#80d4e8'); g.addColorStop(1, '#50a8c8');
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.globalAlpha = .32; ctx.fillStyle = '#cceeff';
    ctx.beginPath(); ctx.ellipse(x - rx * .18, y - ry * .28, rx * .32, ry * .18, -.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function drawSun(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
    g.addColorStop(0, 'rgba(255,252,200,.55)'); g.addColorStop(.25, 'rgba(255,242,160,.22)'); g.addColorStop(1, 'rgba(255,242,160,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#fff8d0'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r * .7, 0, Math.PI * 2); ctx.fillStyle = '#fffde8'; ctx.fill();
  }

  function drawMoon(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.5);
    g.addColorStop(0, 'rgba(200,215,255,.18)'); g.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#d8dcff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + r * .28, y - r * .1, r * .88, 0, Math.PI * 2); ctx.fillStyle = '#162050'; ctx.fill();
  }

  function drawReed(ctx, x, baseY, h) {
    ctx.strokeStyle = '#4a7050'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x + h * .08, baseY - h); ctx.stroke();
    ctx.fillStyle = '#7a4828'; ctx.beginPath(); ctx.ellipse(x + h * .08, baseY - h + 14, 6, 20, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawBranches(ctx, x, y) {
    function br(x1, y1, ang, len, d) {
      if (d === 0 || len < 6) return;
      const x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
      ctx.strokeStyle = `rgba(35,20,8,${.5 + d * .06})`; ctx.lineWidth = d * 1.8;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      br(x2, y2, ang - .42, len * .63, d - 1); br(x2, y2, ang + .37, len * .60, d - 1);
    }
    br(x, y, -Math.PI / 2, 130, 5);
  }

  /* ═══ ANIMATED HELPERS ═══ */
  function drawCloud(ctx, x, y, sc, alpha, tint) {
    ctx.save(); ctx.globalAlpha = alpha;
    const s = sc * 62;
    [[0, 0, 1], [-.68, .18, .70], [.68, .18, .70], [-.38, -.22, .56], [.38, -.22, .56], [0, -.28, .66], [.25, .1, .58], [-.25, .1, .58]].forEach(([dx, dy, r]) => {
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); ctx.fillStyle = tint || 'rgba(255,255,255,.93)'; ctx.fill();
    });
    ctx.restore();
  }

  function drawBee(ctx, x, y, t, sz) {
    ctx.save(); ctx.translate(x, y);
    ctx.globalAlpha = .45 + Math.abs(Math.sin(t * 20)) * .2;
    ctx.fillStyle = 'rgba(215,235,255,.88)';
    ctx.beginPath(); ctx.ellipse(-sz * .2, -sz * .55, sz * 1.05, sz * .42, -.45, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sz * .2, -sz * .55, sz * .9, sz * .38, .45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * .52, sz, 0, 0, Math.PI * 2); ctx.fillStyle = '#f5c000'; ctx.fill();
    ctx.fillStyle = 'rgba(18,12,0,.72)';
    [-1, 0, 1].forEach(s => { ctx.fillRect(-sz * .52, s * sz * .3 - sz * .1, sz * 1.04, sz * .22); });
    ctx.beginPath(); ctx.arc(0, -sz, sz * .36, 0, Math.PI * 2); ctx.fillStyle = '#1a1000'; ctx.fill();
    ctx.restore();
  }

  function drawButterfly(ctx, x, y, t, sz) {
    ctx.save(); ctx.translate(x, y);
    const flap = Math.sin(t * 5.5) * 0.55;
    // Right wings
    ctx.save(); ctx.rotate(flap);
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.15);
    ctx.bezierCurveTo(sz * 0.5, -sz * 1.3, sz * 1.8, -sz * 0.4, sz * 1.4, sz * 0.5);
    ctx.bezierCurveTo(sz * 0.9, sz * 0.7, sz * 0.1, sz * 0.2, 0, -sz * 0.15);
    ctx.fillStyle = '#f06090'; ctx.globalAlpha = 0.88; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, sz * 0.1);
    ctx.bezierCurveTo(sz * 0.7, sz * 0.0, sz * 1.3, sz * 0.9, sz * 0.9, sz * 1.2);
    ctx.bezierCurveTo(sz * 0.4, sz * 1.35, sz * 0.08, sz * 0.8, 0, sz * 0.1);
    ctx.fillStyle = '#9030d0'; ctx.globalAlpha = 0.80; ctx.fill();
    ctx.restore();
    // Left wings (mirrored)
    ctx.save(); ctx.scale(-1, 1); ctx.rotate(flap);
    ctx.beginPath();
    ctx.moveTo(0, -sz * 0.15);
    ctx.bezierCurveTo(sz * 0.5, -sz * 1.3, sz * 1.8, -sz * 0.4, sz * 1.4, sz * 0.5);
    ctx.bezierCurveTo(sz * 0.9, sz * 0.7, sz * 0.1, sz * 0.2, 0, -sz * 0.15);
    ctx.fillStyle = '#f06090'; ctx.globalAlpha = 0.88; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, sz * 0.1);
    ctx.bezierCurveTo(sz * 0.7, sz * 0.0, sz * 1.3, sz * 0.9, sz * 0.9, sz * 1.2);
    ctx.bezierCurveTo(sz * 0.4, sz * 1.35, sz * 0.08, sz * 0.8, 0, sz * 0.1);
    ctx.fillStyle = '#9030d0'; ctx.globalAlpha = 0.80; ctx.fill();
    ctx.restore();
    // Body
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.12, sz * 0.9, 0, 0, Math.PI * 2); ctx.fillStyle = '#1a0a2a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -sz * 0.95, sz * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ═══ FLOWERS ═══ */
  function drawFlower(ctx, x, baseY, r, petal, center, n, stemH, sway) {
    sway = sway || 0;
    const fx = x + sway, fy = baseY - stemH;
    ctx.strokeStyle = 'rgba(28,62,18,.85)'; ctx.lineWidth = Math.max(1.5, r * .18);
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + sway * .45, baseY - stemH * .55, fx, fy); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r * .60, 0, Math.PI * 2); ctx.fillStyle = petal; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(fx, fy, r * .36, 0, Math.PI * 2); ctx.fillStyle = center; ctx.fill();
  }

  function buildFlowerList(groups, fgYR) {
    return groups.flatMap((g, gi) =>
      Array.from({ length: g.count }, (_, li) => {
        const h = gi * 997 + li * 137 + (gi + li) * 41;
        return {
          x: 80 + ((h * 47 + li * 173 + gi * 311) % (W - 160)),
          baseY: fgYR * H + ((h * 3 + li * 7) % 220),
          r: g.rMin + ((h * 11) % (g.rMax - g.rMin + 1)),
          petal: g.color, center: g.center, n: g.petals || 5,
          stemH: g.rMin * 1.8 + ((h * 5) % 32), phase: h * .01
        };
      })
    );
  }

  function drawFlowers(ctx, list, t) {
    list.forEach(f => {
      const sway = Math.sin(t * 1.9 + f.x * .0038 + f.phase) * f.stemH * .14;
      drawFlower(ctx, f.x, f.baseY, f.r, f.petal, f.center, f.n, f.stemH, sway);
    });
  }

  /* ═══ CONFIGS ═══ */
  const CONFIGS = [
    { name: 'bg_lush_meadow',
      sky: [0, '#7dd4f0', .5, '#a8dcc0', 1, '#c0e8c0'],
      layers: [[.415, .093, '#2d5a27', 32, 52, 0.0, .55], [.505, .081, '#376e2c', 36, 58, .45, 1.15], [.590, .069, '#4a8f38', 40, 65, .90, 1.80], [.655, .056, '#5aa040', 44, 70, 1.30, 2.30]],
      canopyHL: '#90d860',
      mounds: [[.698, .056, '#4a9838', 18, .3], [.732, .048, '#58aa42', 22, 1.1], [.765, .040, '#65b848', 26, .7], [.798, .032, '#72c452', 30, 1.8], [.830, .025, '#7ed05e', 34, .4]],
      bushes: [[180, .80, 42, '#4a9030'], [520, .79, 36, '#52a038'], [890, .81, 48, '#45882c'], [1260, .80, 40, '#50a035'], [1580, .79, 44, '#4a9030'], [1840, .81, 35, '#55a83a'], [350, .82, 30, '#5aac40'], [730, .83, 32, '#4ea034'], [1100, .82, 34, '#52a838'], [1440, .83, 28, '#5aac40'], [1720, .82, 32, '#4a9030']],
      blades: { y: .853, n: 600, h: 92, c: ['#1e5a1a', '#2a6020', '#163814', '#306828', '#1a4a16', '#246024', '#0e3010', '#3a7028'] },
      flowers: [{ color: '#ffffff', center: '#f5e000', count: 35, rMin: 6, rMax: 10, petals: 6 }, { color: '#f8f4c0', center: '#e8c800', count: 22, rMin: 4, rMax: 8, petals: 5 }, { color: '#fffde8', center: '#f0d820', count: 14, rMin: 3, rMax: 6, petals: 5 }],
      fgY: .820, quirk: 'pond',
      anim: {
        clouds: [{ sx: 100, y: 88, sc: 1.5, a: .87, spd: 22, tint: 'rgba(255,255,255,.93)' }, { sx: 750, y: 155, sc: 1.1, a: .76, spd: 14, tint: 'rgba(255,255,255,.88)' }, { sx: 1450, y: 78, sc: 1.8, a: .82, spd: 18, tint: 'rgba(255,255,255,.90)' }, { sx: 1200, y: 185, sc: .9, a: .70, spd: 11, tint: 'rgba(255,255,255,.82)' }],
        bees: [{ cx: 620, cy: 660, rx: 220, ry: 88, spd: .80, ph: 0, sz: 15 }, { cx: 1220, cy: 710, rx: 160, ry: 65, spd: 1.10, ph: 2.1, sz: 12 }, { cx: 950, cy: 590, rx: 190, ry: 95, spd: .65, ph: 4.2, sz: 17 }],
      },
    },

    { name: 'bg_autumn_garden',
      sky: [0, '#8090b0', .55, '#c09060', 1, '#d4a050'],
      layers: [[.415, .093, '#2a5018', 30, 50, .20, .75], [.505, .081, '#386020', 34, 55, .65, 1.30], [.590, .069, '#508030', 38, 62, 1.10, 1.95], [.653, .056, '#5e9038', 42, 68, 1.55, 2.45]],
      canopyHL: '#88b858',
      mounds: [[.690, .056, '#4a8030', 18, .5], [.724, .047, '#558838', 22, 1.3], [.757, .039, '#609040', 26, .9], [.789, .030, '#6a9848', 30, 2.0], [.820, .024, '#74a050', 34, .6]],
      bushes: [[200, .79, 40, '#486020'], [560, .78, 35, '#50682a'], [920, .80, 46, '#426018'], [1280, .79, 38, '#4e6825'], [1600, .78, 42, '#486020'], [1860, .80, 33, '#527030'], [380, .81, 28, '#567030'], [760, .82, 30, '#4e6825'], [1120, .81, 32, '#507228'], [1460, .82, 27, '#567030'], [1740, .81, 30, '#486020']],
      blades: { y: .850, n: 580, h: 88, c: ['#3a4818', '#4a5820', '#2e3e14', '#563618', '#3e3a10', '#4e4c18', '#2a3010', '#504420'] },
      flowers: [{ color: '#e03808', center: '#a01800', count: 22, rMin: 7, rMax: 11, petals: 5 }, { color: '#f07820', center: '#c04000', count: 18, rMin: 5, rMax: 9, petals: 5 }, { color: '#f0c820', center: '#c07800', count: 14, rMin: 5, rMax: 8, petals: 6 }, { color: '#e85010', center: '#901800', count: 9, rMin: 4, rMax: 7, petals: 5 }],
      fgY: .815, quirk: 'branches',
      anim: {
        clouds: [{ sx: 300, y: 95, sc: 1.3, a: .72, spd: 16, tint: 'rgba(210,195,175,.80)' }, { sx: 1100, y: 145, sc: 1.6, a: .65, spd: 12, tint: 'rgba(220,200,170,.75)' }],
        fallingLeaves: Array.from({ length: 22 }, (_, i) => ({ x: ((i * 613) % (W - 100)) + 50, r: 6 + (i % 8), offset: i * 0.7, dur: 9 + ((i * 7) % 8), sway: (i % 3) * .8 + .4, rot: (i * .37) % (Math.PI * 2), color: ['#c83808', '#e04018', '#e07020', '#c02808', '#d06010', '#b84020', '#d05818'][i % 7] })),
      },
    },

    { name: 'bg_morning_dew',
      sky: [0, '#e898b8', .5, '#b8d8c8', 1, '#a0d0b8'],
      layers: [[.428, .087, '#1e5040', 28, 46, .30, .90], [.518, .075, '#286050', 32, 52, .80, 1.50], [.603, .064, '#347a60', 36, 58, 1.30, 2.05], [.665, .053, '#408870', 40, 64, 1.75, 2.55]],
      canopyHL: '#60b890',
      mounds: [[.700, .053, '#3a8858', 18, .4], [.732, .045, '#459460', 22, 1.2], [.763, .038, '#52a068', 26, .8], [.793, .030, '#5eaa72', 30, 1.9], [.823, .024, '#6ab47c', 34, .5]],
      bushes: [[160, .79, 38, '#388058'], [510, .78, 33, '#409060'], [870, .80, 44, '#347858'], [1230, .79, 36, '#3e8860'], [1560, .78, 40, '#388058'], [1840, .80, 31, '#429065'], [340, .81, 27, '#489868'], [710, .82, 28, '#3e8860'], [1080, .81, 30, '#409065'], [1430, .82, 25, '#489868'], [1710, .81, 28, '#388058']],
      blades: { y: .854, n: 565, h: 84, c: ['#1a4038', '#224840', '#1e3830', '#2a5040', '#163828', '#305848', '#122e28', '#284a3a'] },
      flowers: [{ color: '#90b8f8', center: '#f0f0ff', count: 30, rMin: 5, rMax: 9, petals: 5 }, { color: '#e8f0ff', center: '#c8d4f8', count: 20, rMin: 4, rMax: 7, petals: 6 }, { color: '#c0d8ff', center: '#e8f0ff', count: 12, rMin: 3, rMax: 6, petals: 5 }],
      fgY: .820, quirk: 'reeds',
      anim: {
        clouds: [{ sx: 200, y: 80, sc: 1.2, a: .68, spd: 13, tint: 'rgba(240,200,225,.72)' }, { sx: 900, y: 140, sc: 1.5, a: .58, spd: 9, tint: 'rgba(230,205,220,.65)' }, { sx: 1600, y: 90, sc: 1.0, a: .60, spd: 11, tint: 'rgba(235,210,225,.68)' }],
        mist: Array.from({ length: 40 }, (_, i) => ({ x: ((i * 71) % (W - 40)) + 20, baseY: (.86 + ((i * 3) % 4) * .01) * H, r: 12 + (i % 8) * 5, offset: i * .4, dur: 7 + (i % 5), phase: i * .7 })),
      },
    },

    { name: 'bg_shaded_grove',
      sky: [0, '#181c60', .45, '#162838', 1, '#143020'],
      layers: [[.385, .103, '#081208', 28, 46, .10, .65], [.493, .091, '#0e1c10', 32, 52, .55, 1.20], [.595, .079, '#162415', 36, 58, 1.00, 1.85], [.680, .065, '#1e3020', 40, 65, 1.50, 2.40]],
      canopyHL: '#203828',
      mounds: [[.715, .049, '#182818', 18, .6], [.745, .041, '#1c2e1c', 22, 1.4], [.773, .034, '#203420', 26, 1.0], [.800, .027, '#243a24', 30, 2.1], [.827, .021, '#283e28', 34, .7]],
      bushes: [[170, .79, 36, '#182818'], [500, .78, 30, '#1c2e1c'], [850, .80, 42, '#162618'], [1200, .79, 33, '#1a2c1a'], [1530, .78, 38, '#182818'], [1820, .80, 28, '#1e3020'], [330, .81, 24, '#1e3020'], [690, .82, 25, '#1a2c1a'], [1050, .81, 27, '#1c2e1c'], [1390, .82, 22, '#1e3020'], [1680, .81, 25, '#182818']],
      blades: { y: .856, n: 530, h: 78, c: ['#0e1c10', '#121e12', '#0a1808', '#141f12', '#0c1a0e', '#162014', '#081608', '#101810'] },
      flowers: null, fgY: .848, quirk: 'moon',
      anim: {
        stars: Array.from({ length: 32 }, (_, i) => ({ x: ((i * 137) % (W - 80)) + 40, y: ((i * 83) % (H * .38)) + 30, r: 1.2 + (i % 3) * .8, spd: .8 + (i % 5) * .3, ph: i * .7 })),
        fireflies: Array.from({ length: 12 }, (_, i) => ({ x: ((i * 113) % (W - 100)) + 50, y: (.68 + (i % 4) * .05) * H + (((i * 29) % 80) - 40), spd: .6 + (i % 4) * .25, ph: i * 1.1 })),
      },
    },

    { name: 'bg_sunlit_garden',
      sky: [0, '#b0d8f0', .5, '#d4eccc', 1, '#e8f4c4'],
      layers: [[.415, .093, '#2d6020', 32, 52, .50, 1.10], [.505, .081, '#3a7828', 36, 58, 1.00, 1.70], [.590, .069, '#4a8830', 40, 65, 1.50, 2.25], [.653, .056, '#589838', 44, 70, 1.95, 2.75]],
      canopyHL: '#8cd860',
      mounds: [[.688, .056, '#52a030', 18, .2], [.722, .047, '#60aa38', 22, 1.0], [.754, .040, '#6cb840', 26, .6], [.785, .031, '#76c248', 30, 1.7], [.816, .024, '#80cc52', 34, .3]],
      bushes: [[190, .79, 42, '#4a9030'], [540, .78, 36, '#549838'], [900, .80, 48, '#469030'], [1270, .79, 40, '#509838'], [1600, .78, 44, '#4a9030'], [1860, .80, 35, '#56a03a'], [360, .81, 30, '#5caa40'], [740, .82, 33, '#52a238'], [1110, .81, 35, '#56a83a'], [1460, .82, 28, '#5caa40'], [1730, .81, 32, '#4a9030']],
      blades: { y: .850, n: 610, h: 93, c: ['#2a5420', '#1e4a18', '#304e20', '#245024', '#203e18', '#386028', '#163a14', '#3c6830'] },
      flowers: [{ color: '#f8d800', center: '#b86000', count: 32, rMin: 7, rMax: 12, petals: 8 }, { color: '#f05000', center: '#a82000', count: 16, rMin: 5, rMax: 9, petals: 5 }, { color: '#fce800', center: '#c07000', count: 12, rMin: 4, rMax: 7, petals: 6 }],
      fgY: .815, quirk: 'sun',
      sunOvals: [[340, 625, 215, 128, .17], [785, 555, 268, 152, .14], [1258, 605, 200, 120, .16], [605, 695, 238, 140, .13], [1548, 640, 222, 132, .15], [1058, 725, 258, 150, .12], [185, 752, 190, 112, .14], [1765, 712, 208, 122, .13], [472, 745, 172, 102, .11], [1342, 665, 192, 114, .12]],
      anim: {
        clouds: [{ sx: 250, y: 75, sc: 1.4, a: .78, spd: 19, tint: 'rgba(255,255,255,.88)' }, { sx: 1000, y: 135, sc: 1.8, a: .70, spd: 14, tint: 'rgba(255,255,255,.82)' }, { sx: 1650, y: 82, sc: 1.1, a: .75, spd: 16, tint: 'rgba(255,255,255,.85)' }],
        bees: [{ cx: 700, cy: 680, rx: 230, ry: 90, spd: .85, ph: 1.0, sz: 14 }, { cx: 1350, cy: 650, rx: 180, ry: 75, spd: .70, ph: 3.5, sz: 16 }],
        pollen: Array.from({ length: 28 }, (_, i) => ({ x: ((i * 97) % (W - 60)) + 30, baseY: (.78 + (i % 3) * .025) * H, r: 2 + (i % 3), offset: i * .5, dur: 6 + (i % 5), phase: i * .8 })),
      },
    },

    { name: 'bg_wildflower_patch',
      sky: [0, '#48c0f8', .48, '#80d4b4', 1, '#a0e0a0'],
      layers: [[.415, .093, '#2a5820', 32, 52, .70, 1.30], [.505, .081, '#367030', 36, 58, 1.20, 1.95], [.590, .069, '#488038', 40, 65, 1.70, 2.45], [.653, .056, '#579040', 44, 70, 2.15, 2.95]],
      canopyHL: '#88d865',
      mounds: [[.688, .056, '#52a038', 18, .1], [.722, .047, '#5eac42', 22, .9], [.754, .040, '#6ab84a', 26, .5], [.785, .031, '#74c252', 30, 1.6], [.816, .024, '#7ecc5c', 34, .2]],
      bushes: [[175, .79, 40, '#489030'], [515, .78, 34, '#52a038'], [875, .80, 46, '#449030'], [1245, .79, 38, '#509838'], [1575, .78, 42, '#489030'], [1850, .80, 33, '#54a23a'], [345, .81, 28, '#58ac40'], [715, .82, 30, '#50a038'], [1085, .81, 32, '#54a83a'], [1435, .82, 26, '#58ac40'], [1715, .81, 30, '#489030']],
      blades: { y: .848, n: 590, h: 85, c: ['#244c1e', '#1e4418', '#2a5022', '#183e14', '#204618', '#305228', '#163810', '#2c5020'] },
      flowers: [{ color: '#f00000', center: '#800000', count: 16, rMin: 6, rMax: 10, petals: 5 }, { color: '#3838f8', center: '#f8e800', count: 18, rMin: 5, rMax: 9, petals: 5 }, { color: '#f88000', center: '#b04000', count: 14, rMin: 6, rMax: 10, petals: 5 }, { color: '#ffffff', center: '#f0d800', count: 16, rMin: 5, rMax: 9, petals: 6 }, { color: '#d800d8', center: '#f0c800', count: 10, rMin: 5, rMax: 8, petals: 5 }, { color: '#f0d800', center: '#a86800', count: 18, rMin: 5, rMax: 9, petals: 6 }, { color: '#ff80a0', center: '#f0e000', count: 9, rMin: 4, rMax: 7, petals: 5 }],
      fgY: .808, quirk: null,
      anim: {
        clouds: [{ sx: 400, y: 82, sc: 1.3, a: .82, spd: 17, tint: 'rgba(255,255,255,.90)' }, { sx: 1200, y: 148, sc: 1.6, a: .74, spd: 12, tint: 'rgba(255,255,255,.85)' }],
        bees: [{ cx: 500, cy: 650, rx: 200, ry: 80, spd: .90, ph: 0, sz: 13 }, { cx: 1100, cy: 690, rx: 160, ry: 65, spd: 1.15, ph: 2.3, sz: 15 }, { cx: 1600, cy: 640, rx: 140, ry: 70, spd: .75, ph: 4.6, sz: 11 }, { cx: 800, cy: 720, rx: 190, ry: 85, spd: .60, ph: 1.5, sz: 14 }],
        butterfly: { cx: 960, cy: 620, rx: 320, ry: 130, spd: .42, ph: .8, sz: 22 },
      },
    },
  ];

  /* ═══ RENDER STATIC ═══ */
  function renderStatic(cfg) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const sg = ctx.createLinearGradient(0, 0, 0, H * .70);
    for (let i = 0; i < cfg.sky.length; i += 2) sg.addColorStop(cfg.sky[i], cfg.sky[i + 1]);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    cfg.layers.forEach(([bY, amp, col, f1, f2, p1, p2]) => drawForest(ctx, bY, amp, col, f1, f2, p1, p2));
    if (cfg.canopyHL) drawCanopyHighlights(ctx, cfg.layers[1][0], cfg.canopyHL);
    if (cfg.quirk === 'pond') { drawPond(ctx, W * .42, .82 * H, 180, 55); drawPond(ctx, W * .78, .845 * H, 110, 34); }
    if (cfg.quirk === 'sun') drawSun(ctx, 240, 80, 55);
    if (cfg.quirk === 'moon') drawMoon(ctx, 1680, 95, 65);
    if (cfg.quirk === 'branches') { drawBranches(ctx, 80, .43 * H); drawBranches(ctx, W - 80, .43 * H); }
    if (cfg.sunOvals) cfg.sunOvals.forEach(([x, y, rx, ry, a]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, '#b8e888'); g.addColorStop(.6, '#a0d870'); g.addColorStop(1, 'rgba(160,216,112,0)');
      ctx.save(); ctx.globalAlpha = a * .6; ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    cfg.mounds.forEach(([bY, amp, col, freq, phase]) => drawMound(ctx, bY, amp, col, freq, phase));
    cfg.bushes.forEach(([bx, byR, size, color]) => drawBushClump(ctx, bx, byR * H, size, color));
    if (cfg.name === 'bg_autumn_garden') {
      const lc = ['#c83808', '#e04018', '#e07020', '#c02808', '#d06010', '#b84020', '#d05818'];
      for (let i = 0; i < 18; i++) drawLeafStatic(ctx, ((i * 557) % (W - 100)) + 50, cfg.fgY * H + ((i * 37) % 200), 5 + (i % 6), (i * .53) % (Math.PI * 2), lc[i % lc.length]);
    }
    if (cfg.quirk === 'reeds') {
      [[280, .85], [540, .83], [820, .86], [1100, .84], [1380, .85], [1660, .83], [1900, .85]].forEach(([x, yR]) => drawReed(ctx, x, yR * H, 100 + (x % 4) * 18));
    }
    if (cfg.name === 'bg_shaded_grove') {
      [[145, .900], [270, .882], [395, .916], [542, .892], [698, .906], [885, .878], [1072, .900], [1258, .888], [1414, .913], [1586, .883], [1768, .898], [462, .892], [1154, .875], [724, .905], [1340, .883], [960, .900]].forEach(([mx, myR], i) => drawMushroom(ctx, mx, myR * H, .85 + (i % 4) * .12));
      [[312, .928, 32, 18], [682, .931, 40, 22], [1062, .924, 26, 15], [1364, .929, 34, 19], [1714, .925, 28, 16], [842, .917, 44, 24], [492, .934, 22, 13], [1224, .926, 30, 17], [1520, .930, 35, 20], [230, .932, 25, 14], [1080, .935, 38, 21]].forEach(([rx, ry, rrx, rry]) => drawRock(ctx, rx, ry * H, rrx, rry));
    }
    drawBlades(ctx, cfg.blades.y, cfg.blades.n, cfg.blades.h, cfg.blades.c);
    return c;
  }

  /* ═══ RENDER FRAME ═══ */
  function renderFrame(displayCtx, cfg, staticBg, flowerList, t) {
    displayCtx.drawImage(staticBg, 0, 0, W, H);
    const a = cfg.anim;
    if (a.stars) a.stars.forEach(s => {
      const al = (Math.sin(t * s.spd + s.ph) + 1) * .45;
      displayCtx.save(); displayCtx.globalAlpha = al;
      displayCtx.fillStyle = 'rgba(255,255,255,1)';
      displayCtx.beginPath(); displayCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2); displayCtx.fill();
      displayCtx.globalAlpha = al * .4;
      displayCtx.beginPath(); displayCtx.arc(s.x, s.y, s.r * 2.2, 0, Math.PI * 2); displayCtx.fill();
      displayCtx.restore();
    });
    if (a.fireflies) a.fireflies.forEach(f => {
      const al = Math.pow((Math.sin(t * f.spd + f.ph) + 1) * .5, 1.5) * .85;
      const fx = f.x + Math.sin(t * .4 + f.ph) * 42, fy = f.y + Math.cos(t * .28 + f.ph * 1.4) * 26;
      const g = displayCtx.createRadialGradient(fx, fy, 0, fx, fy, 11);
      g.addColorStop(0, `rgba(160,255,70,${al})`); g.addColorStop(1, 'rgba(80,200,30,0)');
      displayCtx.fillStyle = g; displayCtx.beginPath(); displayCtx.arc(fx, fy, 11, 0, Math.PI * 2); displayCtx.fill();
      displayCtx.fillStyle = `rgba(210,255,140,${al})`; displayCtx.beginPath(); displayCtx.arc(fx, fy, 2.5, 0, Math.PI * 2); displayCtx.fill();
    });
    if (a.clouds) a.clouds.forEach(c => {
      const x = ((c.sx + c.spd * t * 60) % (W + 380)) - 190;
      drawCloud(displayCtx, x, c.y, c.sc, c.a, c.tint);
    });
    if (cfg.sunOvals) cfg.sunOvals.forEach(([x, y, rx, ry, baseA], i) => {
      const pulse = (Math.sin(t * .8 + i * .7) + 1) * .5;
      const al = baseA * (.5 + pulse * .5);
      const g = displayCtx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      g.addColorStop(0, '#b8e888'); g.addColorStop(.6, '#a0d870'); g.addColorStop(1, 'rgba(160,216,112,0)');
      displayCtx.save(); displayCtx.globalAlpha = al; displayCtx.fillStyle = g;
      displayCtx.beginPath(); displayCtx.ellipse(x, y, rx * (1 + pulse * .06), ry * (1 + pulse * .06), 0, 0, Math.PI * 2);
      displayCtx.fill(); displayCtx.restore();
    });
    if (a.fallingLeaves) a.fallingLeaves.forEach(l => {
      const cyc = ((t + l.offset) % l.dur) / l.dur;
      drawLeafStatic(displayCtx, l.x + Math.sin(cyc * Math.PI * 4 + l.sway) * 85, cyc * (H + 220) - 100, l.r, cyc * Math.PI * 6 + l.rot, l.color);
    });
    if (a.mist) a.mist.forEach(p => {
      const cyc = ((t + p.offset) % p.dur) / p.dur;
      const al = Math.sin(cyc * Math.PI) * .22;
      displayCtx.fillStyle = `rgba(200,225,218,${al})`;
      displayCtx.beginPath(); displayCtx.arc(p.x + Math.sin(cyc * Math.PI * 2 + p.phase) * 28, p.baseY - cyc * 230, p.r, 0, Math.PI * 2); displayCtx.fill();
    });
    if (a.pollen) a.pollen.forEach(p => {
      const cyc = ((t + p.offset) % p.dur) / p.dur;
      const al = Math.sin(cyc * Math.PI) * .65;
      displayCtx.fillStyle = `rgba(255,242,100,${al})`;
      displayCtx.beginPath(); displayCtx.arc(p.x + Math.sin(cyc * Math.PI * 3 + p.phase) * 32, p.baseY - cyc * 320, p.r, 0, Math.PI * 2); displayCtx.fill();
    });
    if (flowerList) drawFlowers(displayCtx, flowerList, t);
    if (a.bees) a.bees.forEach(b => {
      const ang = t * b.spd + b.ph;
      const x = b.cx + Math.cos(ang) * b.rx + Math.sin(ang * .37) * b.rx * .38;
      const y = b.cy + Math.sin(ang * .8) * b.ry;
      if (Math.cos(ang) < 0) {
        displayCtx.save(); displayCtx.translate(x * 2, 0); displayCtx.scale(-1, 1); drawBee(displayCtx, x, y, t, b.sz); displayCtx.restore();
      } else { drawBee(displayCtx, x, y, t, b.sz); }
    });
    if (a.butterfly) {
      const b = a.butterfly, ang = t * b.spd + b.ph;
      drawButterfly(displayCtx, b.cx + Math.cos(ang * .7) * b.rx + Math.sin(ang * .31) * 120, b.cy + Math.sin(ang * .5) * b.ry, t, b.sz);
    }
  }

  /* ═══ PUBLIC API ═══ */
  function init() {
    canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d');
    CONFIGS.forEach((cfg, i) => {
      staticLayers[i] = renderStatic(cfg);
      flowerLists[i] = cfg.flowers ? buildFlowerList(cfg.flowers, cfg.fgY) : null;
    });
  }

  function start(index) {
    if (!canvas) init();
    if (!canvas) return;
    currentIndex = index;
    if (raf) cancelAnimationFrame(raf);
    let last = 0;
    function loop(ts) {
      if (ts - last > 32) {
        last = ts;
        renderFrame(ctx, CONFIGS[index], staticLayers[index], flowerLists[index], ts / 1000);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function count() { return CONFIGS.length; }

  return { init, start, stop, count };
})();

// BgSystem is now fully initialized - menu and game will explicitly call start() with the equipped background
