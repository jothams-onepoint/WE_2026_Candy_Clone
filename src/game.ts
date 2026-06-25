type IconName = 'ant' | 'blue_flower' | 'grass' | 'potted_plant' | 'red_flower' | 'shovel';

const ICONS: IconName[] = ['ant', 'blue_flower', 'grass', 'potted_plant', 'red_flower', 'shovel'];
const ICON_SETS = ['tile_icons_red', 'Tile_icons_blue'] as const;
const BACKGROUNDS = [
  'assets/backgrounds/bg_autumn_garden.png',
  'assets/backgrounds/bg_lush_meadow.png',
  'assets/backgrounds/bg_morning_dew.png',
  'assets/backgrounds/bg_shaded_grove.png',
  'assets/backgrounds/bg_sunlit_garden.png',
  'assets/backgrounds/bg_wildflower_patch.png',
];
type IconSet = typeof ICON_SETS[number];
let GRID_SIZE = 8;

let gameGrid: (IconName | null)[][] = [];
let goldGrid: boolean[][] = [];
let gameIconSet: IconSet;
let points = 0;
let winTarget = 500;
let isAnimating = false;
let moveCap = 0;
let movesUsed = 0;
let timeLeft = 40;
let timerInterval: number | null = null;

let savedGrid: (IconName | null)[][] = [];
let savedGoldGrid: boolean[][] = [];
let savedIconSet: IconSet = 'tile_icons_red';
let savedMoveCap = 0;
let savedMaxTime = 120;
let savedBackground = '';
let savedBgIndex = 0;

let gridShape: boolean[][] | null = null;
let savedGridShape: boolean[][] | null = null;

function recalcCellSize(): void {
  const n = GRID_SIZE || 8;
  const availW = Math.max(window.innerWidth - 360, n * 48);
  const availH = Math.max(window.innerHeight - 220, n * 48);
  const cell = Math.max(48, Math.min(88, Math.floor(Math.min(availW / n, availH / n))));
  document.documentElement.style.setProperty('--cell', `${cell}px`);
}

function updateQuestProgress(questId: string, value: number, mode: 'increment' | 'max' = 'increment'): void {
  const dailyQuests: string[] = JSON.parse(localStorage.getItem('dailyQuests') || '[]');
  if (!dailyQuests.includes(questId)) return;
  const progress: Record<string, number> = JSON.parse(localStorage.getItem('questProgress') || '{}');
  if (mode === 'max') {
    progress[questId] = Math.max(progress[questId] || 0, value);
  } else {
    progress[questId] = (progress[questId] || 0) + value;
  }
  localStorage.setItem('questProgress', JSON.stringify(progress));
}

let bombModeActive = false;
let bombCursorMoveHandler: ((e: MouseEvent) => void) | null = null;
let lightningModeActive = false;
let lightningCursorMoveHandler: ((e: MouseEvent) => void) | null = null;
let lossReason = 'moves';

const BOOSTERS = [
  { id: 'bomb',        emoji: '💣' },
  { id: 'lightning',   emoji: '⚡' },
  { id: 'extra-life',  emoji: '❤️' },
  { id: 'color-blast', emoji: '🌈' },
];

function cancelBombModeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') cancelBombMode();
}

function enterBombMode(): void {
  bombModeActive = true;
  document.getElementById('game-grid')?.classList.add('bomb-mode');
  const cursor = document.createElement('div');
  cursor.id = 'bomb-cursor';
  cursor.textContent = '💣';
  document.body.appendChild(cursor);
  bombCursorMoveHandler = (e: MouseEvent) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  };
  document.addEventListener('mousemove', bombCursorMoveHandler);
  document.addEventListener('keydown', cancelBombModeKey);
}

function cancelBombMode(): void {
  bombModeActive = false;
  document.getElementById('game-grid')?.classList.remove('bomb-mode');
  document.getElementById('bomb-cursor')?.remove();
  clearBombHighlight();
  if (bombCursorMoveHandler) {
    document.removeEventListener('mousemove', bombCursorMoveHandler);
    bombCursorMoveHandler = null;
  }
  document.removeEventListener('keydown', cancelBombModeKey);
}

function clearBombHighlight(): void {
  document.querySelectorAll('.bomb-highlight').forEach(el => el.classList.remove('bomb-highlight'));
}

function highlightBombArea(centerRow: number, centerCol: number): void {
  clearBombHighlight();
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (isCellActive(r, c)) {
        getCellElement(r, c)?.classList.add('bomb-highlight');
      }
    }
  }
}

async function fireBomb(centerRow: number, centerCol: number): Promise<void> {
  if (!bombModeActive) return;
  const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv['bomb'] || inv['bomb'] <= 0) { cancelBombMode(); return; }
  inv['bomb']--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  updateQuestProgress('booster3', 1);
  cancelBombMode();
  isAnimating = true;

  const affected: { row: number; col: number }[] = [];
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (isCellActive(r, c)) {
        affected.push({ row: r, col: c });
      }
    }
  }

  affected.forEach(({ row, col }) => {
    const scored = goldGrid[row][col] ? 600 : 200;
    points += scored;
    showScoreFlash([{ row, col }], scored);
  });
  updateScoreDisplay();

  if (isSoundOn()) { crunchSound.currentTime = 0.8; crunchSound.play().catch(() => {}); }
  affected.forEach(({ row, col }) => showBreakAnimation(row, col));
  await sleep(520);

  const removedSet = new Set<string>(affected.map(({ row, col }) => `${row},${col}`));
  const newCells = new Set<string>();
  for (let col = 0; col < GRID_SIZE; col++) {
    const activeRows: number[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      if (isCellActive(row, col)) activeRows.push(row);
    }
    if (activeRows.length === 0) continue;
    const keepIcons: (IconName | null)[] = [];
    const keepGolds: boolean[] = [];
    for (const row of activeRows) {
      if (!removedSet.has(`${row},${col}`)) {
        keepIcons.push(gameGrid[row][col]);
        keepGolds.push(goldGrid[row][col]);
      }
    }
    const newCount = activeRows.length - keepIcons.length;
    const newIcons: IconName[] = [];
    const newGolds: boolean[] = [];
    for (let i = 0; i < newCount; i++) {
      newIcons.push(ICONS[Math.floor(Math.random() * ICONS.length)]);
      newGolds.push(Math.random() < 0.01);
      newCells.add(`${activeRows[i]},${col}`);
    }
    const allIcons = [...newIcons, ...keepIcons];
    const allGolds = [...newGolds, ...keepGolds];
    for (let i = 0; i < activeRows.length; i++) {
      gameGrid[activeRows[i]][col] = allIcons[i] as IconName;
      goldGrid[activeRows[i]][col] = allGolds[i];
    }
  }

  renderGrid(newCells);
  await sleep(320);

  if (points >= winTarget) {
    stopTimer();
    showWinScreen();
    return;
  }

  await processMatches();
  renderBoosterBar();
  isAnimating = false;
}

function cancelLightningModeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') cancelLightningMode();
}

function enterLightningMode(): void {
  lightningModeActive = true;
  document.getElementById('game-grid')?.classList.add('lightning-mode');
  const cursor = document.createElement('div');
  cursor.id = 'lightning-cursor';
  cursor.textContent = '⚡';
  document.body.appendChild(cursor);
  lightningCursorMoveHandler = (e: MouseEvent) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  };
  document.addEventListener('mousemove', lightningCursorMoveHandler);
  document.addEventListener('keydown', cancelLightningModeKey);
}

function cancelLightningMode(): void {
  lightningModeActive = false;
  document.getElementById('game-grid')?.classList.remove('lightning-mode');
  document.getElementById('lightning-cursor')?.remove();
  clearLightningHighlight();
  if (lightningCursorMoveHandler) {
    document.removeEventListener('mousemove', lightningCursorMoveHandler);
    lightningCursorMoveHandler = null;
  }
  document.removeEventListener('keydown', cancelLightningModeKey);
}

function clearLightningHighlight(): void {
  document.querySelectorAll('.lightning-highlight').forEach(el => el.classList.remove('lightning-highlight'));
}

function highlightLightningArea(row: number, col: number): void {
  clearLightningHighlight();
  for (let c = 0; c < GRID_SIZE; c++) {
    if (isCellActive(row, c)) getCellElement(row, c)?.classList.add('lightning-highlight');
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    if (isCellActive(r, col)) getCellElement(r, col)?.classList.add('lightning-highlight');
  }
}

function showLightningBurst(cx: number, cy: number): void {
  const SIZE = 660;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.style.cssText = `position:fixed;left:${cx - SIZE / 2}px;top:${cy - SIZE / 2}px;pointer-events:none;z-index:99;`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const CX = SIZE / 2, CY = SIZE / 2;

  function makeBolt(angleDeg: number, minLen: number, maxLen: number, segs: number): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [{ x: CX, y: CY }];
    const total = minLen + Math.random() * (maxLen - minLen);
    const segLen = total / segs;
    let angle = angleDeg * Math.PI / 180;
    for (let i = 0; i < segs; i++) {
      angle += (Math.random() - 0.5) * 0.85;
      const prev = pts[pts.length - 1];
      pts.push({ x: prev.x + Math.cos(angle) * segLen, y: prev.y + Math.sin(angle) * segLen });
    }
    return pts;
  }

  const bolts: { x: number; y: number }[][] = [];
  for (let i = 0; i < 8; i++) bolts.push(makeBolt((i / 8) * 360, 90, 190, 5 + Math.floor(Math.random() * 4)));
  for (let i = 0; i < 8; i++) bolts.push(makeBolt((i / 8) * 360 + 22.5, 45, 100, 3 + Math.floor(Math.random() * 3)));

  const sparkDots = Array.from({ length: 38 }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 230 + 30;
    return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r, r: Math.random() * 3.5 + 0.8 };
  });

  const START = performance.now();
  const DURATION = 560;

  function frame(now: number) {
    const t = Math.min((now - START) / DURATION, 1);
    const opacity = t < 0.12 ? t / 0.12 : t < 0.52 ? 1 : 1 - (t - 0.52) / 0.48;
    canvas.style.opacity = String(Math.min(1, opacity));
    ctx.clearRect(0, 0, SIZE, SIZE);

    const outerGlow = ctx.createRadialGradient(CX, CY, 20, CX, CY, 270);
    outerGlow.addColorStop(0, 'rgba(0,180,255,0)');
    outerGlow.addColorStop(0.4, 'rgba(0,140,255,0.16)');
    outerGlow.addColorStop(1, 'rgba(0,60,180,0)');
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const coreGlow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 105);
    coreGlow.addColorStop(0, 'rgba(255,255,255,1)');
    coreGlow.addColorStop(0.12, 'rgba(200,242,255,0.92)');
    coreGlow.addColorStop(0.38, 'rgba(0,180,255,0.48)');
    coreGlow.addColorStop(1, 'rgba(0,80,200,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, 105, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();

    bolts.forEach((pts, idx) => {
      const isMain = idx < 8;
      ctx.save();
      ctx.shadowColor = '#00ccff';
      ctx.shadowBlur = isMain ? 24 : 14;
      ctx.strokeStyle = isMain ? 'rgba(160,235,255,0.95)' : 'rgba(120,215,255,0.75)';
      ctx.lineWidth = isMain ? 2.2 : 1.3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(230,250,255,0.65)';
      ctx.lineWidth = isMain ? 0.8 : 0.5;
      ctx.stroke();
      ctx.restore();
    });

    sparkDots.forEach(s => {
      ctx.save();
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(80,200,255,0.85)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 5;
      ctx.fillStyle = 'rgba(220,248,255,0.9)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (t < 1) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

async function fireLightning(row: number, col: number): Promise<void> {
  if (!lightningModeActive) return;
  const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv['lightning'] || inv['lightning'] <= 0) { cancelLightningMode(); return; }
  inv['lightning']--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  updateQuestProgress('booster3', 1);
  cancelLightningMode();
  isAnimating = true;

  const cellEl = getCellElement(row, col);
  if (cellEl) {
    const rect = cellEl.getBoundingClientRect();
    showLightningBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  const removedSet = new Set<string>();
  for (let c = 0; c < GRID_SIZE; c++) { if (isCellActive(row, c)) removedSet.add(`${row},${c}`); }
  for (let r = 0; r < GRID_SIZE; r++) { if (isCellActive(r, col)) removedSet.add(`${r},${col}`); }
  const affectedArr = [...removedSet].map(k => { const [r, c] = k.split(',').map(Number); return { row: r, col: c }; });

  let totalScore = 0;
  affectedArr.forEach(({ row: r, col: c }) => { totalScore += goldGrid[r][c] ? 80 : 40; });
  points += totalScore;
  showScoreFlash([{ row, col }], totalScore);
  updateScoreDisplay();

  if (isSoundOn()) { crunchSound.currentTime = 0.8; crunchSound.play().catch(() => {}); }
  affectedArr.forEach(({ row: r, col: c }) => showBreakAnimation(r, c));
  await sleep(520);

  const newCells = new Set<string>();
  for (let c = 0; c < GRID_SIZE; c++) {
    const activeRows: number[] = [];
    for (let r = 0; r < GRID_SIZE; r++) { if (isCellActive(r, c)) activeRows.push(r); }
    if (activeRows.length === 0) continue;
    const keepIcons: (IconName | null)[] = [], keepGolds: boolean[] = [];
    for (const r of activeRows) {
      if (!removedSet.has(`${r},${c}`)) { keepIcons.push(gameGrid[r][c]); keepGolds.push(goldGrid[r][c]); }
    }
    const newCount = activeRows.length - keepIcons.length;
    const newIcons: IconName[] = [], newGolds: boolean[] = [];
    for (let i = 0; i < newCount; i++) {
      newIcons.push(ICONS[Math.floor(Math.random() * ICONS.length)]);
      newGolds.push(Math.random() < 0.01);
      newCells.add(`${activeRows[i]},${c}`);
    }
    const allIcons = [...newIcons, ...keepIcons];
    const allGolds = [...newGolds, ...keepGolds];
    for (let i = 0; i < activeRows.length; i++) {
      gameGrid[activeRows[i]][c] = allIcons[i];
      goldGrid[activeRows[i]][c] = allGolds[i];
    }
  }

  renderGrid(newCells);
  await sleep(320);

  if (points >= winTarget) { stopTimer(); showWinScreen(); return; }
  await processMatches();
  renderBoosterBar();
  isAnimating = false;
}

function activateBooster(id: string): void {
  if (isAnimating || bombModeActive || lightningModeActive) return;
  if (id === 'extra-life') return;
  const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv[id] || inv[id] <= 0) return;
  if (id === 'bomb') { enterBombMode(); return; }
  if (id === 'lightning') { enterLightningMode(); return; }
  inv[id]--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  updateQuestProgress('booster3', 1);
  switch (id) {
    case 'color-blast': moveCap += 15; updateMovesDisplay(); break;
  }
  renderBoosterBar();
}

function renderBoosterBar(): void {
  const bar = document.getElementById('booster-bar');
  if (!bar) return;
  const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  bar.innerHTML = '';
  BOOSTERS.forEach(b => {
    const count = inv[b.id] || 0;
    if (count <= 0) return;
    const slot = document.createElement('div');
    slot.className = 'booster-slot';
    slot.innerHTML = `<span class="booster-slot-emoji">${b.emoji}</span><span class="booster-slot-count">×${count}</span>`;
    slot.addEventListener('click', () => activateBooster(b.id));
    bar.appendChild(slot);
  });
}

const isSoundOn = () => localStorage.getItem('soundEnabled') !== 'false';
const whooshSound = new Audio('assets/Sounds/whoosh.mp3');
const invalidSwapSound = new Audio('assets/Sounds/invalidswap.mp3');

const bgMusic = new Audio('assets/Sounds/backgroundsong.mp3');

bgMusic.addEventListener('timeupdate', () => {
  if (!bgMusic.duration) return;
  const remaining = bgMusic.duration - bgMusic.currentTime;
  if (remaining > 0 && remaining <= 3) {
    bgMusic.volume = remaining / 3;
  }
});

bgMusic.addEventListener('ended', () => {
  if (localStorage.getItem('musicEnabled') === 'false') return;
  bgMusic.currentTime = 0;
  bgMusic.volume = 0;
  bgMusic.play().catch(() => {});
  const start = performance.now();
  function fadeIn(now: number): void {
    const t = Math.min((now - start) / 3000, 1);
    bgMusic.volume = t;
    if (t < 1) requestAnimationFrame(fadeIn);
  }
  requestAnimationFrame(fadeIn);
});

function startBgMusic(): void {
  if (localStorage.getItem('musicEnabled') === 'false') return;
  bgMusic.volume = 1;
  bgMusic.play().catch(() => {});
}
const crunchSound = new Audio('assets/Sounds/crunch.mp3');
const chimeSound = new Audio('assets/Sounds/chime.mp3');

let dragStartCell: HTMLElement | null = null;
let dragStartX = 0;
let dragStartY = 0;

function pickIconSet(): IconSet {
  return ICON_SETS[Math.floor(Math.random() * ICON_SETS.length)];
}

function isCellActive(row: number, col: number): boolean {
  if (!gridShape) return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
  return row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE && gridShape[row][col];
}

function generateGridShape(level: number): boolean[][] | null {
  if (level <= 4 || Math.random() < 0.5) {
    GRID_SIZE = 8;
    return null;
  }

  GRID_SIZE = 7;
  const shape = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(true) as boolean[]);
  const shapeType = Math.random() < 0.5 ? 'triangle' : 'valley';

  for (let col = 0; col < GRID_SIZE; col++) {
    const edgeDist = Math.min(col, GRID_SIZE - 1 - col);
    let disabledBottom = 0;
    if (shapeType === 'triangle') {
      disabledBottom = Math.max(0, 3 - edgeDist);
    } else {
      const distFromCenter = Math.abs(col - (GRID_SIZE / 2 - 0.5));
      disabledBottom = distFromCenter < 1 ? 2 : distFromCenter < 2 ? 1 : 0;
    }
    for (let row = GRID_SIZE - disabledBottom; row < GRID_SIZE; row++) {
      shape[row][col] = false;
    }
  }

  if (Math.random() < 0.5) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const edgeDist = Math.min(col, GRID_SIZE - 1 - col);
      let disabledTop = 0;
      if (shapeType === 'triangle') {
        disabledTop = Math.max(0, 2 - edgeDist);
      } else {
        const distFromCenter = Math.abs(col - (GRID_SIZE / 2 - 0.5));
        disabledTop = distFromCenter < 1 ? 2 : distFromCenter < 2 ? 1 : 0;
      }
      for (let row = 0; row < disabledTop; row++) {
        shape[row][col] = false;
      }
    }
  }

  return shape;
}

function generateGrid(): (IconName | null)[][] {
  const grid: (IconName | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<IconName | null>(GRID_SIZE).fill(null)
  );
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (!isCellActive(row, col)) continue;
      const blocked = new Set<IconName>();
      if (col >= 2 && grid[row][col - 1] !== null && grid[row][col - 2] !== null && grid[row][col - 1] === grid[row][col - 2]) {
        blocked.add(grid[row][col - 1] as IconName);
      }
      if (row >= 2 && grid[row - 1][col] !== null && grid[row - 2][col] !== null && grid[row - 1][col] === grid[row - 2][col]) {
        blocked.add(grid[row - 1][col] as IconName);
      }
      const valid = ICONS.filter(icon => !blocked.has(icon));
      grid[row][col] = valid[Math.floor(Math.random() * valid.length)];
    }
  }
  return grid;
}

function generateGoldGrid(): boolean[][] {
  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) =>
      isCellActive(row, col) ? Math.random() < 0.01 : false
    )
  );
}

function renderGrid(newCells?: Set<string>): void {
  const container = document.getElementById('game-grid');
  if (!container) return;
  (container as HTMLElement).style.gridTemplateColumns = `repeat(${GRID_SIZE}, var(--cell))`;
  container.innerHTML = '';
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const active = isCellActive(row, col);
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);

      if (!active) {
        cell.classList.add('disabled');
        container.appendChild(cell);
        continue;
      }

      const icon = gameGrid[row][col] as IconName;
      const isGold = goldGrid[row][col];
      const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;

      cell.dataset.icon = icon;
      if (isGold) cell.dataset.gold = 'true';
      if (newCells?.has(`${row},${col}`)) cell.classList.add('tile-new');

      const img = document.createElement('img');
      img.src = `assets/tile icons/${cellSet}/${icon}.png`;
      img.alt = icon;
      img.draggable = false;

      cell.appendChild(img);
      container.appendChild(cell);
    }
  }
}

function getCellElement(row: number, col: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
}

function updateCellDOM(row: number, col: number): void {
  const cell = getCellElement(row, col);
  if (!cell) return;
  const icon = gameGrid[row][col];
  const isGold = goldGrid[row][col];
  const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;
  const img = cell.querySelector('img') as HTMLImageElement;
  img.src = `assets/tile icons/${cellSet}/${icon}.png`;
  img.alt = icon;
  cell.dataset.icon = icon;
  if (isGold) cell.dataset.gold = 'true'; else delete cell.dataset.gold;
}

function updateScoreDisplay(): void {
  const el = document.getElementById('score-display');
  if (el) el.textContent = String(points);
}

function updateTimerDisplay(): void {
  const el = document.getElementById('timer-display');
  if (!el) return;
  el.textContent = String(timeLeft);
  el.classList.toggle('low', timeLeft <= 10);
  updateStopwatch();
}

function updateStopwatch(): void {
  const canvas = document.getElementById('stopwatch-canvas') as HTMLCanvasElement | null;
  const timeText = document.getElementById('time-text');
  if (!canvas || !timeText) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  const W = canvas.width;
  const cx = W / 2, cy = W / 2;
  const radius = W * 0.38;
  const lw = W * 0.085;
  const fraction = Math.max(0, Math.min(1, timeLeft / savedMaxTime));

  ctx.clearRect(0, 0, W, W);

  // Track ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = lw;
  ctx.stroke();

  if (fraction > 0) {
    const color = fraction > 0.5 ? '#7af0b0' : fraction > 0.25 ? '#f0c040' : '#ff5555';
    const startA = -Math.PI / 2;
    const endA = startA + fraction * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startA, endA);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, endA - 0.001, endA);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.arc(cx, cy, W * 0.045, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c040';
  ctx.fill();
}

function show10SecondWarning(): void {
  if (document.getElementById('ten-second-warning')) return;
  const el = document.createElement('div');
  el.id = 'ten-second-warning';
  el.textContent = '⚠️ 10 SECONDS LEFT! ⚠️';
  document.body.appendChild(el);
}

function ensureUrgencyVignette(): void {
  if (document.getElementById('urgency-vignette')) return;
  const el = document.createElement('div');
  el.id = 'urgency-vignette';
  document.body.appendChild(el);
}

function removeUrgencyEffects(): void {
  document.getElementById('ten-second-warning')?.remove();
  document.getElementById('urgency-vignette')?.remove();
}

function startTimer(): void {
  if (timerInterval !== null) clearInterval(timerInterval);
  timerInterval = window.setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft === 10) {
      show10SecondWarning();
    }
    if (timeLeft <= 10 && timeLeft > 0) {
      ensureUrgencyVignette();
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval!);
      timerInterval = null;
      showLossScreen('time');
    }
  }, 1000);
}

function stopTimer(): void {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateMovesDisplay(): void {
  const el = document.getElementById('moves-display');
  if (!el) return;
  const remaining = moveCap - movesUsed;
  el.textContent = String(remaining);
  el.classList.toggle('low', remaining <= 3);
}

type MatchGroup = { cells: { row: number; col: number }[]; size: number };

function findAllMatchGroups(): MatchGroup[] {
  const groups: MatchGroup[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    let col = 0;
    while (col < GRID_SIZE) {
      const icon = gameGrid[row][col];
      let len = 1;
      while (col + len < GRID_SIZE && gameGrid[row][col + len] === icon) len++;
      if (icon !== null && len >= 3) {
        const cells: { row: number; col: number }[] = [];
        for (let i = 0; i < len; i++) cells.push({ row, col: col + i });
        groups.push({ cells, size: len });
      }
      col += len;
    }
  }

  for (let col = 0; col < GRID_SIZE; col++) {
    let row = 0;
    while (row < GRID_SIZE) {
      const icon = gameGrid[row][col];
      let len = 1;
      while (row + len < GRID_SIZE && gameGrid[row + len][col] === icon) len++;
      if (icon !== null && len >= 3) {
        const cells: { row: number; col: number }[] = [];
        for (let i = 0; i < len; i++) cells.push({ row: row + i, col });
        groups.push({ cells, size: len });
      }
      row += len;
    }
  }

  return groups;
}

function hasMatchAt(row: number, col: number): boolean {
  const icon = gameGrid[row][col];
  if (icon === null) return false;

  let hCount = 1;
  for (let c = col - 1; c >= 0 && gameGrid[row][c] === icon; c--) hCount++;
  for (let c = col + 1; c < GRID_SIZE && gameGrid[row][c] === icon; c++) hCount++;
  if (hCount >= 3) return true;

  let vCount = 1;
  for (let r = row - 1; r >= 0 && gameGrid[r][col] === icon; r--) vCount++;
  for (let r = row + 1; r < GRID_SIZE && gameGrid[r][col] === icon; r++) vCount++;
  return vCount >= 3;
}

function getAnimDir(): string {
  return gameIconSet === 'tile_icons_red' ? 'red' : 'blue';
}

function showBreakAnimation(row: number, col: number): void {
  const cell = getCellElement(row, col);
  if (!cell) return;
  const icon = gameGrid[row][col];
  const isGold = goldGrid[row][col];
  const animDir = isGold ? 'gold' : getAnimDir();
  const img = cell.querySelector('img') as HTMLImageElement;
  if (img) {
    img.src = `assets/animations/tile icons animations/${animDir}/${icon}_break_anim.png`;
  }
  cell.classList.add('breaking');
}

function showPortalRing(cx: number, cy: number): void {
  const SIZE = 800;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.style.cssText = `position:fixed;left:${cx - SIZE/2}px;top:${cy - SIZE/2}px;pointer-events:none;z-index:98;transform-origin:center;`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  const CX = SIZE / 2, CY = SIZE / 2, R = 285;

  const strands = Array.from({ length: 36 }, () => {
    const isPurple = Math.random() > 0.42;
    const baseAngle = Math.random() * Math.PI * 2;
    const span = (Math.random() * 0.7 + 0.3) * Math.PI;
    const r = R + (Math.random() - 0.5) * 38;
    const w = Math.random() * 7 + 2;
    const alpha = Math.random() * 0.7 + 0.3;
    const color = isPurple
      ? `rgba(${180 + Math.floor(Math.random()*60)},${Math.floor(Math.random()*60)},${220 + Math.floor(Math.random()*35)},${alpha})`
      : `rgba(${220 + Math.floor(Math.random()*35)},${80 + Math.floor(Math.random()*80)},${Math.floor(Math.random()*40)},${alpha})`;
    return { baseAngle, span, r, w, color };
  });

  const hotspots = Array.from({ length: 10 }, () => ({
    angle: Math.random() * Math.PI * 2,
    size: Math.random() * 5 + 2,
  }));

  const sparks = Array.from({ length: 45 }, () => {
    const a = Math.random() * Math.PI * 2;
    const isPurple = Math.random() > 0.45;
    return {
      x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R,
      vx: (Math.random() - 0.5) * 3.5, vy: (Math.random() - 0.5) * 3.5,
      size: Math.random() * 2.5 + 0.5,
      color: isPurple ? '#dd66ff' : '#ff7722',
    };
  });

  const START = performance.now();
  const DURATION = 1000;

  function frame(now: number): void {
    const t = Math.min((now - START) / DURATION, 1);
    const scale   = t < 0.45 ? t / 0.45 : 1;
    const opacity = t < 0.25 ? t / 0.25 : (t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1);
    canvas.style.transform = `scale(${scale})`;
    canvas.style.opacity   = String(opacity);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const bg = ctx.createRadialGradient(CX, CY, 60, CX, CY, R + 40);
    bg.addColorStop(0,   'rgba(10,0,20,0.35)');
    bg.addColorStop(0.6, 'rgba(40,0,80,0.12)');
    bg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(CX, CY, R + 40, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.fill();

    strands.forEach(s => {
      ctx.save();
      ctx.shadowColor = s.color; ctx.shadowBlur = 18;
      ctx.strokeStyle = s.color; ctx.lineWidth = s.w; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(CX, CY, s.r, s.baseAngle, s.baseAngle + s.span);
      ctx.stroke();
      ctx.restore();
    });

    ([
      { color: '#cc00ff', start: Math.PI * 0.85, end: Math.PI * 2.3,  w: 6 },
      { color: '#ff44bb', start: Math.PI * 1.0,  end: Math.PI * 2.15, w: 3 },
      { color: '#ff5500', start: -Math.PI * 0.15, end: Math.PI * 0.95, w: 6 },
      { color: '#ffaa22', start: -Math.PI * 0.1,  end: Math.PI * 0.8,  w: 3 },
    ] as { color: string; start: number; end: number; w: number }[]).forEach(({ color, start, end, w }) => {
      ctx.save();
      ctx.shadowColor = color; ctx.shadowBlur = 28;
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(CX, CY, R, start, end); ctx.stroke();
      ctx.restore();
    });

    hotspots.forEach(h => {
      const hx = CX + Math.cos(h.angle) * R, hy = CY + Math.sin(h.angle) * R;
      ctx.save();
      ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(hx, hy, h.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    sparks.forEach(s => {
      s.x += s.vx; s.y += s.vy;
      ctx.save();
      ctx.shadowColor = s.color; ctx.shadowBlur = 10;
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    if (t < 1) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function showGlitterBurst(cx: number, cy: number): void {
  const SIZE = 640;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  canvas.style.cssText = `position:fixed;left:${cx - SIZE / 2}px;top:${cy - SIZE / 2}px;pointer-events:none;z-index:99;transform-origin:center;`;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;

  const COLORS = ['#ffffff','#aae8ff','#33bbff','#0077ff','#4433ff','#9922ff','#cc44ff','#ff99ff'];
  const particles = Array.from({ length: 260 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2.2 + 0.3;
    const size  = Math.random() * 3.5 + 0.5;
    const dist  = Math.random() * 140 + 10;
    return { x: SIZE / 2, y: SIZE / 2, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: size, color: COLORS[Math.floor(Math.random() * COLORS.length)], maxDist: dist, traveled: 0 };
  });

  const START = performance.now();
  const DURATION = 720;

  function frame(now: number): void {
    const t = Math.min((now - START) / DURATION, 1);
    const scale   = t < 0.35 ? t / 0.35 : 1;
    const opacity = t > 0.55 ? 1 - (t - 0.55) / 0.45 : 1;
    canvas.style.transform = `scale(${scale})`;
    canvas.style.opacity   = String(opacity);

    ctx.clearRect(0, 0, SIZE, SIZE);

    const grd = ctx.createRadialGradient(SIZE/2, SIZE/2, 0, SIZE/2, SIZE/2, 60 * scale);
    grd.addColorStop(0,   'rgba(255,255,255,0.85)');
    grd.addColorStop(0.3, 'rgba(160,230,255,0.5)');
    grd.addColorStop(1,   'rgba(0,120,255,0)');
    ctx.beginPath();
    ctx.arc(SIZE/2, SIZE/2, 60, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    particles.forEach(p => {
      if (p.traveled < p.maxDist) {
        p.x += p.vx;
        p.y += p.vy;
        p.traveled += Math.hypot(p.vx, p.vy);
      }
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (t < 1) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}

function showScoreFlash(cells: { row: number; col: number }[], amount: number): void {
  let sumX = 0, sumY = 0, count = 0;
  cells.forEach(({ row, col }) => {
    const el = getCellElement(row, col);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    sumX += rect.left + rect.width / 2;
    sumY += rect.top + rect.height / 2;
    count++;
  });
  if (count === 0) return;

  const flash = document.createElement('div');
  flash.className = 'score-flash';
  flash.textContent = `+${amount}`;
  flash.style.left = `${sumX / count}px`;
  flash.style.top = `${sumY / count}px`;
  if (cells.length === 4) {
    flash.style.fontSize = '3.24rem';
    flash.style.color = gameIconSet === 'tile_icons_red' ? '#1a6bff' : '#ff2020';
    showGlitterBurst(sumX / count, sumY / count);
  } else if (cells.length === 5) {
    flash.style.fontSize = '5.4rem';
    flash.style.color = '#aa00ff';
    showPortalRing(sumX / count, sumY / count);
  }
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 900);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processMatches(depth = 0): Promise<void> {
  if (depth > 20) return;

  const groups = findAllMatchGroups();
  if (groups.length === 0) return;

  const matchedSet = new Set<string>();
  groups.forEach(g => g.cells.forEach(c => matchedSet.add(`${c.row},${c.col}`)));

  let playChime = false;
  groups.forEach(group => {
    if (group.size >= 5) playChime = true;
    const hasGold = group.cells.some(c => goldGrid[c.row][c.col]);
    const baseScore = group.size >= 5 ? 200 : group.size === 4 ? 100 : 50;
    const scored = hasGold ? baseScore * 2 : baseScore;
    points += scored;
    showScoreFlash(group.cells, scored);
  });

  updateScoreDisplay();

  if (points >= winTarget) {
    stopTimer();
    isAnimating = true;
    showWinScreen();
    return;
  }

  // Flash matched tiles briefly before breaking
  matchedSet.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    const cell = getCellElement(r, c);
    if (cell) cell.classList.add('matched-flash');
  });

  if (isSoundOn()) {
    if (playChime) {
      chimeSound.currentTime = 0;
      chimeSound.play().catch(() => {});
    } else {
      crunchSound.currentTime = 0.8;
      crunchSound.play().catch(() => {});
    }
  }

  await sleep(100);

  matchedSet.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    showBreakAnimation(r, c);
  });

  await sleep(300);

  // Apply gravity and refill — only within active cells per column
  const newCells = new Set<string>();
  for (let col = 0; col < GRID_SIZE; col++) {
    const activeRows: number[] = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      if (isCellActive(row, col)) activeRows.push(row);
    }
    if (activeRows.length === 0) continue;
    const keepIcons: (IconName | null)[] = [];
    const keepGolds: boolean[] = [];
    for (const row of activeRows) {
      if (!matchedSet.has(`${row},${col}`)) {
        keepIcons.push(gameGrid[row][col]);
        keepGolds.push(goldGrid[row][col]);
      }
    }
    const newCount = activeRows.length - keepIcons.length;
    const newIcons: IconName[] = [];
    const newGolds: boolean[] = [];
    for (let i = 0; i < newCount; i++) {
      newIcons.push(ICONS[Math.floor(Math.random() * ICONS.length)]);
      newGolds.push(Math.random() < 0.01);
      newCells.add(`${activeRows[i]},${col}`);
    }
    const allIcons = [...newIcons, ...keepIcons];
    const allGolds = [...newGolds, ...keepGolds];
    for (let i = 0; i < activeRows.length; i++) {
      gameGrid[activeRows[i]][col] = allIcons[i] as IconName;
      goldGrid[activeRows[i]][col] = allGolds[i];
    }
  }

  renderGrid(newCells);
  await sleep(320);

  await processMatches(depth + 1);
}

function flashInvalid(r1: number, c1: number): void {
  const cell = getCellElement(r1, c1);
  if (!cell) return;
  cell.classList.add('invalid-swap');
  setTimeout(() => cell.classList.remove('invalid-swap'), 350);
  if (isSoundOn()) { invalidSwapSound.currentTime = 0; invalidSwapSound.play().catch(() => {}); }
}

const SWAP_DURATION = 180;

async function animateSwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
  const cell1 = getCellElement(r1, c1);
  const cell2 = getCellElement(r2, c2);
  if (!cell1 || !cell2) {
    updateCellDOM(r1, c1);
    updateCellDOM(r2, c2);
    return;
  }

  const rect1 = cell1.getBoundingClientRect();
  const rect2 = cell2.getBoundingClientRect();
  const dx = rect2.left - rect1.left;
  const dy = rect2.top - rect1.top;

  const ease = `transform ${SWAP_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
  cell1.style.transition = ease;
  cell2.style.transition = ease;
  cell1.style.zIndex = '5';
  cell2.style.zIndex = '4';

  // Force reflow so transition is active before transform changes
  void cell1.getBoundingClientRect();

  // Slide each cell to the other's position (icons unchanged during slide)
  cell1.style.transform = `translate(${dx}px, ${dy}px)`;
  cell2.style.transform = `translate(${-dx}px, ${-dy}px)`;

  await sleep(SWAP_DURATION);

  // Snap back to actual grid positions and update icons
  cell1.style.transition = 'none';
  cell2.style.transition = 'none';
  cell1.style.transform = '';
  cell2.style.transform = '';
  cell1.style.zIndex = '';
  cell2.style.zIndex = '';
  updateCellDOM(r1, c1);
  updateCellDOM(r2, c2);

  // Restore CSS transition on next frame
  requestAnimationFrame(() => {
    cell1.style.transition = '';
    cell2.style.transition = '';
  });
}

async function trySwap(r1: number, c1: number, r2: number, c2: number): Promise<void> {
  if (isAnimating) return;
  if (!isCellActive(r1, c1) || !isCellActive(r2, c2)) return;

  const tmpIcon = gameGrid[r1][c1];
  const tmpGold = goldGrid[r1][c1];
  gameGrid[r1][c1] = gameGrid[r2][c2];
  gameGrid[r2][c2] = tmpIcon;
  goldGrid[r1][c1] = goldGrid[r2][c2];
  goldGrid[r2][c2] = tmpGold;

  if (hasMatchAt(r1, c1) || hasMatchAt(r2, c2)) {
    isAnimating = true;
    if (isSoundOn()) { whooshSound.currentTime = 0; whooshSound.play().catch(() => {}); }
    await animateSwap(r1, c1, r2, c2);
    movesUsed++;
    updateMovesDisplay();
    if (movesUsed >= moveCap) {
      await processMatches();
      showLossScreen('moves');
      return;
    }
    await processMatches();
    isAnimating = false;
  } else {
    gameGrid[r2][c2] = gameGrid[r1][c1];
    gameGrid[r1][c1] = tmpIcon;
    goldGrid[r2][c2] = goldGrid[r1][c1];
    goldGrid[r1][c1] = tmpGold;
    flashInvalid(r1, c1);
  }
}

function handleDragEnd(endX: number, endY: number): void {
  if (!dragStartCell) return;

  const dx = endX - dragStartX;
  const dy = endY - dragStartY;
  dragStartCell.classList.remove('dragging');

  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
    dragStartCell = null;
    return;
  }

  const row = parseInt(dragStartCell.dataset.row!);
  const col = parseInt(dragStartCell.dataset.col!);
  let targetRow: number;
  let targetCol: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    targetRow = row;
    targetCol = col + (dx > 0 ? 1 : -1);
  } else {
    targetRow = row + (dy > 0 ? 1 : -1);
    targetCol = col;
  }

  dragStartCell = null;

  if (isCellActive(targetRow, targetCol)) {
    trySwap(row, col, targetRow, targetCol);
  }
}

function showLevelUpFlourish(oldLevel: number, newLevel: number): void {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes levelFade {
      0% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 0px rgba(255,255,255,0.8)); }
      100% { transform: scale(0.5); opacity: 0; filter: drop-shadow(0 0 30px rgba(255,200,0,1)); }
    }
    @keyframes levelExplode {
      0% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: translate(0, 0) scale(0); opacity: 0; }
    }
    @keyframes goldGlide {
      0% { transform: translate(0, 0) scale(1); opacity: 1; filter: drop-shadow(0 0 30px rgba(255,200,0,1)); }
      80% { transform: translate(var(--glide-x), var(--glide-y)) scale(0.9); opacity: 1; filter: drop-shadow(0 0 20px rgba(255,200,0,0.8)); }
      100% { transform: translate(var(--glide-x), var(--glide-y)) scale(1); opacity: 1; filter: drop-shadow(0 0 10px rgba(255,200,0,0.6)); }
    }
    @keyframes progressShake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      75% { transform: translateX(6px); }
    }
    .flourish-old-level {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 120px;
      font-weight: 900;
      color: #f0c040;
      text-shadow: 0 0 30px rgba(240, 192, 64, 0.8);
      animation: levelFade 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      pointer-events: none;
      z-index: 5000;
    }
    .flourish-level-particle {
      position: fixed;
      pointer-events: none;
      z-index: 5000;
      font-size: 24px;
    }
    .flourish-new-level {
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      font-size: 120px;
      font-weight: 900;
      color: #ffd700;
      text-shadow: 0 0 40px rgba(255, 215, 0, 1), 0 0 20px rgba(255, 200, 0, 0.6);
      animation: goldGlide 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      pointer-events: none;
      z-index: 5001;
    }
    .flourish-progress-bar {
      animation: progressShake 0.6s ease-in-out 1.2s;
    }
  `;
  document.head.appendChild(style);

  const levelDisplay = document.getElementById('level-number-display');
  const progressBar = document.getElementById('level-progress-bar-container');

  if (!levelDisplay) return;

  // Snapshot center NOW for the old-level and particles (screen-center based, always safe)
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  const oldLevelEl = document.createElement('div');
  oldLevelEl.className = 'flourish-old-level';
  oldLevelEl.textContent = String(oldLevel);
  document.body.appendChild(oldLevelEl);

  const particles = ['✨', '⭐', '🌟', '💫', '🎉', '🎊'];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const distance = 150;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const particle = document.createElement('div');
    particle.className = 'flourish-level-particle';
    particle.textContent = particles[Math.floor(Math.random() * particles.length)];
    particle.style.left = centerX + 'px';
    particle.style.top = centerY + 'px';
    particle.style.animation = `levelExplode 0.8s ease-out forwards`;
    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    document.body.appendChild(particle);
  }

  setTimeout(() => {
    // Re-measure at animation time so window resize/maximize is accounted for
    const liveRect = levelDisplay.getBoundingClientRect();
    const liveTargetX = liveRect.left + liveRect.width / 2;
    const liveTargetY = liveRect.top + liveRect.height / 2;
    const liveCenterX = window.innerWidth / 2;
    const liveCenterY = window.innerHeight / 2;

    const newLevelEl = document.createElement('div');
    newLevelEl.className = 'flourish-new-level';
    newLevelEl.textContent = String(newLevel);
    newLevelEl.style.setProperty('--glide-x', (liveTargetX - liveCenterX) + 'px');
    newLevelEl.style.setProperty('--glide-y', (liveTargetY - liveCenterY) + 'px');
    document.body.appendChild(newLevelEl);

    if (progressBar) {
      progressBar.classList.add('flourish-progress-bar');
    }

    setTimeout(() => {
      oldLevelEl.remove();
      document.querySelectorAll('.flourish-level-particle').forEach(el => el.remove());
      newLevelEl.remove();
      style.remove();
      if (progressBar) progressBar.classList.remove('flourish-progress-bar');
    }, 2000);
  }, 500);
}

function celebrateWin(leveledUp: boolean): void {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes celebrationPop {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
    }
    .celebration-particle {
      position: fixed;
      pointer-events: none;
      font-size: 24px;
      animation: celebrationPop 1.2s ease-out forwards;
      z-index: 4999;
    }
  `;
  document.head.appendChild(style);

  const emojis = ['🎉', '✨', '⭐', '🌟', '💫', '🎊', '💥', '🎁'];
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const particleCount = 40;

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const distance = 300 + Math.random() * 200;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];

    const particle = document.createElement('div');
    particle.className = 'celebration-particle';
    particle.textContent = emoji;
    particle.style.left = centerX + 'px';
    particle.style.top = centerY + 'px';
    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    document.body.appendChild(particle);

    setTimeout(() => particle.remove(), 1200);
  }

  if (localStorage.getItem('soundEnabled') !== 'false') {
    const victorySound = new Audio('assets/Sounds/win.mp3');
    victorySound.volume = 0.7;
    victorySound.play().catch(() => {});

    if (leveledUp) {
      setTimeout(() => {
        const fanfareSound = new Audio('assets/Sounds/chime.mp3');
        fanfareSound.volume = 0.8;
        fanfareSound.play().catch(() => {});
      }, 400);
    }
  }
}

const BG_COIN_MULTIPLIERS: Record<string, number> = {
  'bg_lush_meadow':      1.0,
  'bg_autumn_garden':    1.2,
  'bg_morning_dew':      1.5,
  'bg_shaded_grove':     1.8,
  'bg_sunlit_garden':    2.2,
  'bg_wildflower_patch': 2.5,
};

function showWinScreen(): void {
  stopTimer();
  removeUrgencyEffects();
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const currentTarget = parseInt(localStorage.getItem('candyWinTarget') || '500');
  const currentCoins = parseInt(localStorage.getItem('candyCoins') || '0');

  const selectedBg = localStorage.getItem('candySelectedBg') || 'bg_lush_meadow';
  const bgMultiplier = BG_COIN_MULTIPLIERS[selectedBg] || 1.0;

  const baseCoinReward = [0, 75, 150, 300][Math.floor(currentLevel / 5)] || 300;
  const coinsEarned = Math.round(getScaledCoins(baseCoinReward, currentLevel) * bgMultiplier);

  const levelWinsKey = `levelWins_${currentLevel}`;
  const currentLevelWins = parseInt(localStorage.getItem(levelWinsKey) || '0');
  const newWins = currentLevelWins + 1;
  const winsNeeded = getWinsNeeded(currentLevel);

  localStorage.setItem(levelWinsKey, String(newWins));

  let leveledUp = false;
  let isMilestone = false;
  let newLevelNum = currentLevel;
  if (newWins >= winsNeeded) {
    newLevelNum = currentLevel + 1;
    localStorage.setItem('candyLevel', String(newLevelNum));
    localStorage.setItem(levelWinsKey, '0');
    leveledUp = true;
    isMilestone = newLevelNum % 5 === 0;
  }

  const bonusCoins = isMilestone ? Math.floor(coinsEarned * 2) : 0;
  const totalCoinsEarned = coinsEarned + bonusCoins;
  localStorage.setItem('candyWinTarget', String(currentTarget + 50));
  localStorage.setItem('candyCoins', String(currentCoins + totalCoinsEarned));

  // Quest progress
  const diff = new URLSearchParams(window.location.search).get('difficulty') || 'medium';
  updateQuestProgress('win1', 1);
  updateQuestProgress('win5', 1);
  updateQuestProgress('win10', 1);
  if (diff === 'medium') updateQuestProgress('medium1', 1);
  if (diff === 'hard') updateQuestProgress('hard5', 1);
  updateQuestProgress('points200', points, 'max');
  updateQuestProgress('points1000', points, 'max');
  updateQuestProgress('points2500', points, 'max');

  if (leveledUp) {
    localStorage.setItem('pendingLevelUp', JSON.stringify({
      oldLevel: currentLevel,
      newLevel: newLevelNum,
      coinsEarned: totalCoinsEarned,
      isMilestone: isMilestone
    }));
  }

  const screen = document.getElementById('win-screen');
  const scoreEl = document.getElementById('win-score');
  const coinsEl = document.getElementById('win-coins');
  if (!screen || !scoreEl) return;
  scoreEl.textContent = String(points);
  if (coinsEl) {
    let coinText = String(totalCoinsEarned);
    if (isMilestone) coinText += ` 🎉 (MILESTONE BONUS!)`;
    else if (leveledUp) coinText += ` ⭐`;
    coinsEl.textContent = coinText;
  }
  celebrateWin(leveledUp);
  screen.classList.remove('hidden');
}

function applyRandomBackground(): string {
  const bgSys = (window as any).BgSystem;
  const selectedId = localStorage.getItem('candySelectedBg');
  const bgMap: Record<string, number> = {
    'bg_lush_meadow': 0,
    'bg_autumn_garden': 1,
    'bg_morning_dew': 2,
    'bg_shaded_grove': 3,
    'bg_sunlit_garden': 4,
    'bg_wildflower_patch': 5
  };
  let bgIdx = 0;

  if (selectedId && bgMap[selectedId] !== undefined) {
    bgIdx = bgMap[selectedId];
  }
  // else bgIdx stays 0 (bg_lush_meadow default)

  savedBgIndex = bgIdx;
  if (bgSys) {
    bgSys.start(bgIdx);
    document.body.style.backgroundImage = '';
  } else {
    const bg = BACKGROUNDS[bgIdx % BACKGROUNDS.length];
    document.body.style.backgroundImage = `url('${bg}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    return bg;
  }
  return BACKGROUNDS[bgIdx % BACKGROUNDS.length];
}

function applyBackground(bg: string): void {
  const bgSys = (window as any).BgSystem;
  if (bgSys) {
    bgSys.start(savedBgIndex);
    document.body.style.backgroundImage = '';
  } else {
    document.body.style.backgroundImage = `url('${bg}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  }
}

function showObjectiveScreen(difficulty: string): void {
  const baseTiers: { [key: string]: { title: string; basePoints: number; coins: number } } = {
    easy: { title: 'BEGINNER', basePoints: 500, coins: 75 },
    medium: { title: 'CHALLENGE', basePoints: 1500, coins: 150 },
    hard: { title: 'MASTERY', basePoints: 2500, coins: 300 },
  };

  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const tier = baseTiers[difficulty] || baseTiers.medium;
  const scaledPoints = tier.basePoints + (currentLevel - 1) * 250;

  const titleEl = document.getElementById('objective-title');
  const descEl = document.getElementById('objective-description');
  const coinsEl = document.getElementById('reward-coins');
  const screen = document.getElementById('objective-screen');

  if (titleEl) titleEl.textContent = `🎯 ${tier.title}`;
  if (descEl) descEl.textContent = `Earn ${scaledPoints} points`;
  if (coinsEl) coinsEl.textContent = `${tier.coins} coins`;

  if (screen) screen.classList.remove('hidden');
}

function startGame(): void {
  const diff = new URLSearchParams(window.location.search).get('difficulty') || 'medium';
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const basePoints: { [key: string]: number } = {
    easy: 500,
    medium: 1500,
    hard: 2500,
  };
  winTarget = (basePoints[diff] || basePoints.medium) + (currentLevel - 1) * 250;

  savedBackground = applyRandomBackground();
  const baseMovesPerDiff: { [key: string]: number } = { easy: 22, medium: 20, hard: 18 };
  const baseMoves = baseMovesPerDiff[diff] || baseMovesPerDiff.medium;
  const levelBonus = Math.max(0, (currentLevel - 1) * 2);
  savedMoveCap = baseMoves + levelBonus + Math.floor(Math.random() * 6) - 3;
  moveCap = savedMoveCap;
  movesUsed = 0;
  savedMaxTime = diff === 'easy' ? 120 : diff === 'hard' ? 60 : 90;
  timeLeft = savedMaxTime;
  isAnimating = false;
  gameIconSet = pickIconSet();
  savedIconSet = gameIconSet;
  gridShape = generateGridShape(currentLevel);
  savedGridShape = gridShape;
  recalcCellSize();
  gameGrid = generateGrid();
  savedGrid = gameGrid.map(row => [...row]);
  goldGrid = generateGoldGrid();
  savedGoldGrid = goldGrid.map(row => [...row]);
  renderGrid();
  setupDragHandlers();
  updateScoreDisplay();
  updateMovesDisplay();
  updateTimerDisplay();
  renderBoosterBar();
}

function getWinsNeeded(level: number): number {
  if (level <= 2) return 3;
  if (level <= 4) return 4;
  return 5;
}

function getScaledCoins(baseCoin: number, level: number): number {
  let multiplier = 1;
  if (level >= 20) multiplier = 3;
  else if (level >= 10) multiplier = 2;
  return Math.floor(baseCoin * multiplier);
}

function showCountdown(): void {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes cntNumIn {
      0%   { transform: scale(0.12) translateY(15px); opacity: 0; filter: blur(12px); }
      65%  { transform: scale(1.08) translateY(-4px); opacity: 1; filter: blur(0); }
      100% { transform: scale(1)    translateY(0);    opacity: 1; filter: blur(0); }
    }
    @keyframes cntNumOut {
      0%   { transform: scale(1);   opacity: 1; filter: blur(0); }
      100% { transform: scale(1.7); opacity: 0; filter: blur(8px); }
    }
    @keyframes cntGoIn {
      0%   { transform: scale(0.06); opacity: 0; filter: blur(24px); }
      52%  { transform: scale(1.22); opacity: 1; filter: blur(0); }
      78%  { transform: scale(0.94); }
      100% { transform: scale(1);    opacity: 1; }
    }
    @keyframes cntRing {
      0%   { transform: translate(-50%,-50%) scale(0.1); opacity: 0.9; }
      100% { transform: translate(-50%,-50%) scale(5.5); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'countdown-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;
    background:rgba(0,0,0,0);backdrop-filter:blur(0px);
    display:flex;align-items:center;justify-content:center;
    z-index:5000;font-family:Fredoka,sans-serif;
    transition:background 0.4s ease,backdrop-filter 0.4s ease,opacity 0.45s ease;
  `;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.background = 'rgba(0,0,0,0.88)';
    overlay.style.backdropFilter = 'blur(3px)';
  }));

  const numEl = document.createElement('div');
  numEl.style.cssText = `
    font-size:clamp(110px,28vmin,220px);font-weight:900;
    color:#7af0b0;position:relative;z-index:2;pointer-events:none;
  `;
  overlay.appendChild(numEl);

  const counts = ['3','2','1'];
  let idx = 0;

  function doCount(val: string, isGo: boolean): void {
    if (isGo) {
      numEl.textContent = 'GO!';
      numEl.style.color = '#ffd700';
      numEl.style.textShadow = '0 0 80px rgba(255,215,0,1),0 0 40px rgba(255,165,0,0.8),-3px -3px 0 #7a5a00,3px 3px 0 #7a5a00';
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'cntGoIn 0.58s cubic-bezier(0.34,1.56,0.64,1) forwards';

      overlay.style.transition = 'background 0.12s ease';
      overlay.style.background = 'rgba(12,28,8,0.88)';
      setTimeout(() => {
        overlay.style.transition = 'background 0.45s ease';
        overlay.style.background = 'rgba(0,0,0,0.88)';
      }, 120);

      (['rgba(255,215,0,0.9)','rgba(255,165,0,0.65)','rgba(122,240,176,0.5)'] as string[]).forEach((color, i) => {
        const ring = document.createElement('div');
        ring.style.cssText = `
          position:absolute;left:50%;top:50%;
          width:200px;height:200px;border-radius:50%;
          border:3px solid ${color};pointer-events:none;
          transform:translate(-50%,-50%) scale(0.1);opacity:0;
          animation:cntRing 0.95s ease-out ${i * 0.1}s both;
        `;
        overlay.appendChild(ring);
      });

      setTimeout(() => {
        overlay.style.transition = 'opacity 0.5s ease';
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.remove(); style.remove(); startTimer(); }, 500);
      }, 720);

    } else {
      numEl.textContent = val;
      numEl.style.color = '#7af0b0';
      numEl.style.textShadow = '-2px -2px 0 #2d6e48,2px 2px 0 #2d6e48,0 0 55px rgba(122,240,176,0.85)';
      numEl.style.animation = 'none';
      void numEl.offsetWidth;
      numEl.style.animation = 'cntNumIn 0.24s cubic-bezier(0.34,1.56,0.64,1) forwards';

      setTimeout(() => {
        overlay.style.transition = 'background 0.22s ease';
        overlay.style.background = 'rgba(4,18,8,0.88)';
        setTimeout(() => {
          overlay.style.transition = 'background 0.38s ease';
          overlay.style.background = 'rgba(0,0,0,0.88)';
        }, 220);
      }, 120);

      setTimeout(() => {
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = 'cntNumOut 0.19s ease-in forwards';
        setTimeout(() => {
          idx++;
          doCount(idx < counts.length ? counts[idx] : 'GO!', idx >= counts.length);
        }, 190);
      }, 560);
    }
  }

  setTimeout(() => doCount(counts[0], false), 360);
}

function resetGame(): void {
  stopTimer();
  removeUrgencyEffects();
  points = 0;
  document.getElementById('loss-screen')!.classList.add('hidden');
  applyBackground(savedBackground);
  moveCap = savedMoveCap;
  movesUsed = 0;
  timeLeft = savedMaxTime;
  isAnimating = false;
  gameIconSet = savedIconSet;
  gridShape = savedGridShape;
  GRID_SIZE = gridShape ? 7 : 8;
  recalcCellSize();
  gameGrid = savedGrid.map(row => [...row]);
  goldGrid = savedGoldGrid.map(row => [...row]);
  renderGrid();
  setupDragHandlers();
  updateScoreDisplay();
  updateMovesDisplay();
  updateTimerDisplay();
  renderBoosterBar();
  showCountdown();
}

function goToMenu(): void {
  stopTimer();
  window.location.href = 'menu screen/index.html';
}

function useExtraLife(): void {
  const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv['extra-life'] || inv['extra-life'] <= 0) return;
  inv['extra-life']--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  document.getElementById('loss-screen')?.classList.add('hidden');
  isAnimating = false;
  if (lossReason === 'time') {
    timeLeft = 20;
    updateTimerDisplay();
  } else {
    moveCap += 10;
    updateMovesDisplay();
  }
  startTimer();
  renderBoosterBar();
}

function showLossScreen(reason = 'moves'): void {
  lossReason = reason;
  stopTimer();
  removeUrgencyEffects();
  isAnimating = true;
  const screen = document.getElementById('loss-screen');
  const scoreEl = document.getElementById('loss-score');
  if (!screen || !scoreEl) return;
  scoreEl.textContent = String(points);
  const eyebrowEl = document.getElementById('loss-eyebrow');
  if (eyebrowEl) eyebrowEl.textContent = reason === 'time' ? "Time's up!" : 'No moves left';
  const extraLifeContainer = document.getElementById('loss-extra-life');
  if (extraLifeContainer) {
    const inv: Record<string, number> = JSON.parse(localStorage.getItem('candyInventory') || '{}');
    const count = inv['extra-life'] || 0;
    if (count > 0) {
      const bonus = reason === 'time' ? '+20 seconds' : '+10 moves';
      extraLifeContainer.innerHTML = `<button class="extra-life-btn">❤️ Continue (${bonus})</button><p class="extra-life-count">×${count} remaining</p>`;
      extraLifeContainer.classList.remove('hidden');
      (extraLifeContainer.querySelector('.extra-life-btn') as HTMLButtonElement).addEventListener('click', useExtraLife);
    } else {
      extraLifeContainer.innerHTML = '';
      extraLifeContainer.classList.add('hidden');
    }
  }
  screen.classList.remove('hidden');
}

function setupDragHandlers(): void {
  const container = document.getElementById('game-grid')!;

  container.addEventListener('mousedown', (e: MouseEvent) => {
    if (bombModeActive) {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cell) { e.preventDefault(); fireBomb(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!)); }
      return;
    }
    if (lightningModeActive) {
      const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
      if (cell) { e.preventDefault(); fireLightning(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!)); }
      return;
    }
    if (isAnimating) return;
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    e.preventDefault();
    dragStartCell = cell;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cell.classList.add('dragging');
  });

  document.addEventListener('mouseup', (e: MouseEvent) => {
    if (bombModeActive || lightningModeActive) return;
    handleDragEnd(e.clientX, e.clientY);
  });

  container.addEventListener('mousemove', (e: MouseEvent) => {
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    if (bombModeActive) highlightBombArea(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
    else if (lightningModeActive) highlightLightningArea(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
  });

  container.addEventListener('mouseleave', () => {
    if (bombModeActive) clearBombHighlight();
    if (lightningModeActive) clearLightningHighlight();
  });

  container.addEventListener('touchstart', (e: TouchEvent) => {
    if (bombModeActive || lightningModeActive) { e.preventDefault(); return; }
    if (isAnimating) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const cell = el?.closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    e.preventDefault();
    dragStartCell = cell;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    cell.classList.add('dragging');
  }, { passive: false });

  container.addEventListener('touchmove', (e: TouchEvent) => {
    if (!bombModeActive && !lightningModeActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const cell = el?.closest('.grid-cell') as HTMLElement | null;
    if (cell) {
      if (bombModeActive) highlightBombArea(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
      else if (lightningModeActive) highlightLightningArea(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
    }
  }, { passive: false });

  document.addEventListener('touchend', (e: TouchEvent) => {
    if (bombModeActive) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const cell = el?.closest('.grid-cell') as HTMLElement | null;
      if (cell) fireBomb(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
      return;
    }
    if (lightningModeActive) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      const cell = el?.closest('.grid-cell') as HTMLElement | null;
      if (cell) fireLightning(parseInt(cell.dataset.row!), parseInt(cell.dataset.col!));
      return;
    }
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  });
}

window.addEventListener('resize', () => {
  if (document.getElementById('game-grid')?.children.length) recalcCellSize();
});

document.addEventListener('DOMContentLoaded', () => {
  // Initialize animated background
  if (window.BgSystem) {
    window.BgSystem.init();
    window.BgSystem.start(0); // lush meadow
  }

  startBgMusic();

  const params = new URLSearchParams(window.location.search);
  const autostart = params.has('autostart');
  const difficulty = params.get('difficulty') || 'medium';

  if (autostart) {
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('objective-screen')?.classList.remove('hidden');
    startGame();
    showObjectiveScreen(difficulty);
    requestAnimationFrame(() => {
      document.getElementById('loading-overlay')?.classList.remove('active');
    });
  } else {
    document.getElementById('loading-overlay')?.classList.remove('active');
  }

  document.getElementById('menu-play')?.addEventListener('click', () => {
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('objective-screen')?.classList.remove('hidden');
    startGame();
    showObjectiveScreen(difficulty);
  });

  document.getElementById('objective-start-btn')?.addEventListener('click', () => {
    document.getElementById('objective-screen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    showCountdown();
  });

  document.getElementById('retry-btn')?.addEventListener('click', resetGame);
  document.getElementById('win-menu-btn')?.addEventListener('click', goToMenu);
  document.getElementById('loss-menu-btn')?.addEventListener('click', goToMenu);
});
