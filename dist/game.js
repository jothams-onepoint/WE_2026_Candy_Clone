function isSoundOn() { return localStorage.getItem('soundEnabled') !== 'false'; }
const ICONS = ['ant', 'blue_flower', 'grass', 'potted_plant', 'red_flower', 'shovel'];
const ICON_SETS = ['tile_icons_red', 'Tile_icons_blue'];
const BACKGROUNDS = [
  'assets/backgrounds/bg_autumn_garden.png',
  'assets/backgrounds/bg_lush_meadow.png',
  'assets/backgrounds/bg_morning_dew.png',
  'assets/backgrounds/bg_shaded_grove.png',
  'assets/backgrounds/bg_sunlit_garden.png',
  'assets/backgrounds/bg_wildflower_patch.png',
];
const GRID_SIZE = 8;

let gameGrid = [];
let goldGrid = [];
let gameIconSet;
let points = 0;
let winTarget = 500;
let isAnimating = false;
let moveCap = 0;
let movesUsed = 0;
let timeLeft = 40;
let timerInterval = null;

let savedGrid = [];
let savedGoldGrid = [];
let savedIconSet = 'tile_icons_red';
let savedMoveCap = 0;
let savedBackground = '';
let savedBgIndex = 0;

let bombModeActive = false;
let bombCursorMoveHandler = null;

const BOOSTERS = [
  { id: 'bomb',        emoji: '💣' },
  { id: 'lightning',   emoji: '⚡' },
  { id: 'extra-life',  emoji: '❤️' },
  { id: 'color-blast', emoji: '🌈' },
];

function cancelBombModeKey(e) {
  if (e.key === 'Escape') cancelBombMode();
}

function enterBombMode() {
  bombModeActive = true;
  document.getElementById('game-grid')?.classList.add('bomb-mode');
  const cursor = document.createElement('div');
  cursor.id = 'bomb-cursor';
  cursor.textContent = '💣';
  document.body.appendChild(cursor);
  bombCursorMoveHandler = (e) => {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  };
  document.addEventListener('mousemove', bombCursorMoveHandler);
  document.addEventListener('keydown', cancelBombModeKey);
}

function cancelBombMode() {
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

function clearBombHighlight() {
  document.querySelectorAll('.bomb-highlight').forEach(el => el.classList.remove('bomb-highlight'));
}

function highlightBombArea(centerRow, centerCol) {
  clearBombHighlight();
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        getCellElement(r, c)?.classList.add('bomb-highlight');
      }
    }
  }
}

async function fireBomb(centerRow, centerCol) {
  if (!bombModeActive) return;
  const inv = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv['bomb'] || inv['bomb'] <= 0) { cancelBombMode(); return; }
  inv['bomb']--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  cancelBombMode();
  isAnimating = true;

  const affected = [];
  for (let r = centerRow - 1; r <= centerRow + 1; r++) {
    for (let c = centerCol - 1; c <= centerCol + 1; c++) {
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
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

  const removedSet = new Set(affected.map(({ row, col }) => `${row},${col}`));
  const newCells = new Set();
  for (let col = 0; col < GRID_SIZE; col++) {
    const keepIcons = [];
    const keepGolds = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!removedSet.has(`${row},${col}`)) {
        keepIcons.push(gameGrid[row][col]);
        keepGolds.push(goldGrid[row][col]);
      }
    }
    const newCount = GRID_SIZE - keepIcons.length;
    const newIcons = [];
    const newGolds = [];
    for (let i = 0; i < newCount; i++) {
      newIcons.push(ICONS[Math.floor(Math.random() * ICONS.length)]);
      newGolds.push(Math.random() < 0.01);
      newCells.add(`${i},${col}`);
    }
    const allIcons = [...newIcons, ...keepIcons];
    const allGolds = [...newGolds, ...keepGolds];
    for (let row = 0; row < GRID_SIZE; row++) {
      gameGrid[row][col] = allIcons[row];
      goldGrid[row][col] = allGolds[row];
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

function activateBooster(id) {
  if (isAnimating || bombModeActive) return;
  const inv = JSON.parse(localStorage.getItem('candyInventory') || '{}');
  if (!inv[id] || inv[id] <= 0) return;
  if (id === 'bomb') { enterBombMode(); return; }
  inv[id]--;
  localStorage.setItem('candyInventory', JSON.stringify(inv));
  switch (id) {
    case 'lightning':   moveCap += 10; updateMovesDisplay(); break;
    case 'extra-life':  timeLeft += 30; updateTimerDisplay(); break;
    case 'color-blast': moveCap += 15; updateMovesDisplay(); break;
  }
  renderBoosterBar();
}

function renderBoosterBar() {
  const bar = document.getElementById('booster-bar');
  if (!bar) return;
  const inv = JSON.parse(localStorage.getItem('candyInventory') || '{}');
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

const whooshSound = new Audio('assets/Sounds/whoosh.mp3');
const invalidSwapSound = new Audio('assets/Sounds/invalidswap.mp3');
const crunchSound = new Audio('assets/Sounds/crunch.mp3');
const chimeSound = new Audio('assets/Sounds/chime.mp3');

let dragStartCell = null;
let dragStartX = 0;
let dragStartY = 0;

function pickIconSet() {
  return ICON_SETS[Math.floor(Math.random() * ICON_SETS.length)];
}

function generateGrid() {
  const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const blocked = new Set();
      if (col >= 2 && grid[row][col - 1] !== null && grid[row][col - 1] === grid[row][col - 2]) {
        blocked.add(grid[row][col - 1]);
      }
      if (row >= 2 && grid[row - 1][col] !== null && grid[row - 1][col] === grid[row - 2][col]) {
        blocked.add(grid[row - 1][col]);
      }
      const valid = ICONS.filter(icon => !blocked.has(icon));
      grid[row][col] = valid[Math.floor(Math.random() * valid.length)];
    }
  }
  return grid;
}

function generateGoldGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => Math.random() < 0.01)
  );
}

function renderGrid(newCells) {
  const container = document.getElementById('game-grid');
  if (!container) return;
  container.innerHTML = '';
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const icon = gameGrid[row][col];
      const isGold = goldGrid[row][col];
      const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;

      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.icon = icon;
      if (isGold) cell.dataset.gold = 'true';
      if (newCells && newCells.has(`${row},${col}`)) cell.classList.add('tile-new');

      const img = document.createElement('img');
      img.src = `assets/tile icons/${cellSet}/${icon}.png`;
      img.alt = icon;
      img.draggable = false;

      cell.appendChild(img);
      container.appendChild(cell);
    }
  }
}

function getCellElement(row, col) {
  return document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
}

function updateCellDOM(row, col) {
  const cell = getCellElement(row, col);
  if (!cell) return;
  const icon = gameGrid[row][col];
  const isGold = goldGrid[row][col];
  const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;
  const img = cell.querySelector('img');
  img.src = `assets/tile icons/${cellSet}/${icon}.png`;
  img.alt = icon;
  cell.dataset.icon = icon;
  if (isGold) cell.dataset.gold = 'true'; else delete cell.dataset.gold;
}

function updateScoreDisplay() {
  const el = document.getElementById('score-display');
  if (el) el.textContent = String(points);
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  el.textContent = String(timeLeft);
  el.classList.toggle('low', timeLeft <= 10);
  updateStopwatch();
}

function updateStopwatch() {
  const minuteHand = document.getElementById('minute-hand');
  const secondHand = document.getElementById('second-hand');
  const timeText = document.getElementById('time-text');
  if (!minuteHand || !secondHand || !timeText) return;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  // Calculate rotation angles (SVG starts at 12 o'clock, rotates clockwise)
  const totalSeconds = timeLeft;
  const maxSeconds = timeLeft === 40 ? 40 : (timeLeft > 60 ? 120 : (timeLeft > 45 ? 90 : 60));

  const secondAngle = (secs / 60) * 360;
  const minuteAngle = ((mins % 60) / 60) * 360 + (secs / 60) * (360 / 60);

  minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
  secondHand.style.transform = `rotate(${secondAngle}deg)`;
}

function show10SecondWarning() {
  if (document.getElementById('ten-second-warning')) return;
  const el = document.createElement('div');
  el.id = 'ten-second-warning';
  el.textContent = '⚠️ 10 SECONDS LEFT! ⚠️';
  document.body.appendChild(el);
}

function ensureUrgencyVignette() {
  if (document.getElementById('urgency-vignette')) return;
  const el = document.createElement('div');
  el.id = 'urgency-vignette';
  document.body.appendChild(el);
}

function removeUrgencyEffects() {
  document.getElementById('ten-second-warning')?.remove();
  document.getElementById('urgency-vignette')?.remove();
}

function startTimer() {
  if (timerInterval !== null) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft === 10) {
      show10SecondWarning();
    }
    if (timeLeft <= 10 && timeLeft > 0) {
      ensureUrgencyVignette();
    }
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      showLossScreen();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateMovesDisplay() {
  const el = document.getElementById('moves-display');
  if (!el) return;
  const remaining = moveCap - movesUsed;
  el.textContent = String(remaining);
  el.classList.toggle('low', remaining <= 3);
}

function findAllMatchGroups() {
  const groups = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    let col = 0;
    while (col < GRID_SIZE) {
      const icon = gameGrid[row][col];
      let len = 1;
      while (col + len < GRID_SIZE && gameGrid[row][col + len] === icon) len++;
      if (len >= 3) {
        const cells = [];
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
      if (len >= 3) {
        const cells = [];
        for (let i = 0; i < len; i++) cells.push({ row: row + i, col });
        groups.push({ cells, size: len });
      }
      row += len;
    }
  }

  return groups;
}

function hasMatchAt(row, col) {
  const icon = gameGrid[row][col];

  let hCount = 1;
  for (let c = col - 1; c >= 0 && gameGrid[row][c] === icon; c--) hCount++;
  for (let c = col + 1; c < GRID_SIZE && gameGrid[row][c] === icon; c++) hCount++;
  if (hCount >= 3) return true;

  let vCount = 1;
  for (let r = row - 1; r >= 0 && gameGrid[r][col] === icon; r--) vCount++;
  for (let r = row + 1; r < GRID_SIZE && gameGrid[r][col] === icon; r++) vCount++;
  return vCount >= 3;
}

function getAnimDir() {
  return gameIconSet === 'tile_icons_red' ? 'red' : 'blue';
}

function showBreakAnimation(row, col) {
  const cell = getCellElement(row, col);
  if (!cell) return;
  const icon = gameGrid[row][col];
  const isGold = goldGrid[row][col];
  const animDir = isGold ? 'gold' : getAnimDir();
  const img = cell.querySelector('img');
  if (img) {
    img.src = `assets/animations/tile icons animations/${animDir}/${icon}_break_anim.png`;
  }
  cell.classList.add('breaking');
}

function showScoreFlash(cells, amount) {
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
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 900);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processMatches(depth = 0) {
  if (depth > 20) return;

  const groups = findAllMatchGroups();
  if (groups.length === 0) return;

  const matchedSet = new Set();
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

  // Apply gravity and refill — gameGrid stays fully populated throughout
  const newCells = new Set();
  for (let col = 0; col < GRID_SIZE; col++) {
    const keepIcons = [];
    const keepGolds = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      if (!matchedSet.has(`${row},${col}`)) {
        keepIcons.push(gameGrid[row][col]);
        keepGolds.push(goldGrid[row][col]);
      }
    }
    const newCount = GRID_SIZE - keepIcons.length;
    const newIcons = [];
    const newGolds = [];
    for (let i = 0; i < newCount; i++) {
      newIcons.push(ICONS[Math.floor(Math.random() * ICONS.length)]);
      newGolds.push(Math.random() < 0.01);
      newCells.add(`${i},${col}`);
    }
    const allIcons = [...newIcons, ...keepIcons];
    const allGolds = [...newGolds, ...keepGolds];
    for (let row = 0; row < GRID_SIZE; row++) {
      gameGrid[row][col] = allIcons[row];
      goldGrid[row][col] = allGolds[row];
    }
  }

  renderGrid(newCells);
  await sleep(320);

  await processMatches(depth + 1);
}

function flashInvalid(r1, c1) {
  const cell = getCellElement(r1, c1);
  if (!cell) return;
  cell.classList.add('invalid-swap');
  setTimeout(() => cell.classList.remove('invalid-swap'), 350);
  if (isSoundOn()) { invalidSwapSound.currentTime = 0; invalidSwapSound.play().catch(() => {}); }
}

const SWAP_DURATION = 180;

async function animateSwap(r1, c1, r2, c2) {
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

async function trySwap(r1, c1, r2, c2) {
  if (isAnimating) return;

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
      showLossScreen();
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

function handleDragEnd(endX, endY) {
  if (!dragStartCell) return;

  const dx = endX - dragStartX;
  const dy = endY - dragStartY;
  dragStartCell.classList.remove('dragging');

  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
    dragStartCell = null;
    return;
  }

  const row = parseInt(dragStartCell.dataset.row);
  const col = parseInt(dragStartCell.dataset.col);
  let targetRow;
  let targetCol;

  if (Math.abs(dx) >= Math.abs(dy)) {
    targetRow = row;
    targetCol = col + (dx > 0 ? 1 : -1);
  } else {
    targetRow = row + (dy > 0 ? 1 : -1);
    targetCol = col;
  }

  dragStartCell = null;

  if (targetRow >= 0 && targetRow < GRID_SIZE && targetCol >= 0 && targetCol < GRID_SIZE) {
    trySwap(row, col, targetRow, targetCol);
  }
}

function showWinScreen() {
  stopTimer();
  removeUrgencyEffects();
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const currentTarget = parseInt(localStorage.getItem('candyWinTarget') || '500');
  const currentCoins = parseInt(localStorage.getItem('candyCoins') || '0');

  const coinsEarned = Math.floor(points / 10);
  localStorage.setItem('candyLevel', String(currentLevel + 1));
  localStorage.setItem('candyWinTarget', String(currentTarget + 50));
  localStorage.setItem('candyCoins', String(currentCoins + coinsEarned));

  const levelWinsKey = `levelWins_${currentLevel}`;
  const currentLevelWins = parseInt(localStorage.getItem(levelWinsKey) || '0');
  localStorage.setItem(levelWinsKey, String(currentLevelWins + 1));

  const screen = document.getElementById('win-screen');
  const scoreEl = document.getElementById('win-score');
  const coinsEl = document.getElementById('win-coins');
  if (!screen || !scoreEl) return;
  scoreEl.textContent = String(points);
  if (coinsEl) coinsEl.textContent = String(coinsEarned);
  screen.classList.remove('hidden');
}

function applyRandomBackground() {
  const bgIdx = Math.floor(Math.random() * (window.BgSystem ? window.BgSystem.count() : BACKGROUNDS.length));
  savedBgIndex = bgIdx;
  if (window.BgSystem) {
    window.BgSystem.start(bgIdx);
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

function applyBackground(bg) {
  if (window.BgSystem) {
    window.BgSystem.start(savedBgIndex);
    document.body.style.backgroundImage = '';
  } else {
    document.body.style.backgroundImage = `url('${bg}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
  }
}

function showObjectiveScreen(difficulty) {
  const baseTiers = {
    easy: { title: 'BEGINNER', basePoints: 500, coins: 75 },
    medium: { title: 'CHALLENGE', basePoints: 1500, coins: 150 },
    hard: { title: 'MASTERY', basePoints: 2500, coins: 300 },
  };

  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const tier = baseTiers[difficulty] || baseTiers.medium;
  const scaledPoints = tier.basePoints + (currentLevel - 1) * 500;

  const titleEl = document.getElementById('objective-title');
  const descEl = document.getElementById('objective-description');
  const coinsEl = document.getElementById('reward-coins');
  const screen = document.getElementById('objective-screen');

  if (titleEl) titleEl.textContent = `🎯 ${tier.title}`;
  if (descEl) descEl.textContent = `Earn ${scaledPoints} points`;
  if (coinsEl) coinsEl.textContent = `${tier.coins} coins`;

  if (screen) screen.classList.remove('hidden');
}

function startGame() {
  const diff = new URLSearchParams(window.location.search).get('difficulty') || 'medium';
  const currentLevel = parseInt(localStorage.getItem('candyLevel') || '1');
  const basePoints = {
    easy: 500,
    medium: 1500,
    hard: 2500,
  };
  winTarget = (basePoints[diff] || basePoints.medium) + (currentLevel - 1) * 500;

  savedBackground = applyRandomBackground();
  savedMoveCap = Math.floor(Math.random() * 11) + 15;
  moveCap = savedMoveCap;
  movesUsed = 0;
  timeLeft = diff === 'easy' ? 120 : diff === 'hard' ? 60 : 90;
  isAnimating = false;
  gameIconSet = pickIconSet();
  savedIconSet = gameIconSet;
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
  startTimer();
}

function resetGame() {
  stopTimer();
  removeUrgencyEffects();
  points = 0;
  document.getElementById('loss-screen').classList.add('hidden');
  applyBackground(savedBackground);
  moveCap = savedMoveCap;
  movesUsed = 0;
  timeLeft = 40;
  isAnimating = false;
  gameIconSet = savedIconSet;
  gameGrid = savedGrid.map(row => [...row]);
  goldGrid = savedGoldGrid.map(row => [...row]);
  renderGrid();
  setupDragHandlers();
  updateScoreDisplay();
  updateMovesDisplay();
  updateTimerDisplay();
  renderBoosterBar();
  startTimer();
}

function goToMenu() {
  stopTimer();
  window.location.href = 'menu screen/index.html';
}

function showLossScreen() {
  stopTimer();
  removeUrgencyEffects();
  isAnimating = true;
  const screen = document.getElementById('loss-screen');
  const scoreEl = document.getElementById('loss-score');
  if (!screen || !scoreEl) return;
  scoreEl.textContent = String(points);
  screen.classList.remove('hidden');
}

function setupDragHandlers() {
  const container = document.getElementById('game-grid');

  container.addEventListener('mousedown', (e) => {
    if (bombModeActive) {
      const cell = e.target.closest('.grid-cell');
      if (cell) { e.preventDefault(); fireBomb(parseInt(cell.dataset.row), parseInt(cell.dataset.col)); }
      return;
    }
    if (isAnimating) return;
    const cell = e.target.closest('.grid-cell');
    if (!cell) return;
    e.preventDefault();
    dragStartCell = cell;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cell.classList.add('dragging');
  });

  document.addEventListener('mouseup', (e) => {
    if (bombModeActive) return;
    handleDragEnd(e.clientX, e.clientY);
  });

  container.addEventListener('mousemove', (e) => {
    if (!bombModeActive) return;
    const cell = e.target.closest('.grid-cell');
    if (cell) highlightBombArea(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
  });

  container.addEventListener('mouseleave', () => {
    if (bombModeActive) clearBombHighlight();
  });

  container.addEventListener('touchstart', (e) => {
    if (bombModeActive) { e.preventDefault(); return; }
    if (isAnimating) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el && el.closest('.grid-cell');
    if (!cell) return;
    e.preventDefault();
    dragStartCell = cell;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    cell.classList.add('dragging');
  }, { passive: false });

  container.addEventListener('touchmove', (e) => {
    if (!bombModeActive) return;
    e.preventDefault();
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el && el.closest('.grid-cell');
    if (cell) highlightBombArea(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
  }, { passive: false });

  document.addEventListener('touchend', (e) => {
    if (bombModeActive) {
      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const cell = el && el.closest('.grid-cell');
      if (cell) fireBomb(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
      return;
    }
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Initialize animated background
  if (window.BgSystem) {
    window.BgSystem.init();
    window.BgSystem.start(0); // lush meadow
  }

  const params = new URLSearchParams(window.location.search);
  const autostart = params.has('autostart');
  const difficulty = params.get('difficulty') || 'medium';

  if (autostart) {
    document.getElementById('main-menu')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('objective-screen')?.classList.remove('hidden');
    startGame();
    showObjectiveScreen(difficulty);
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
  });

  document.getElementById('retry-btn')?.addEventListener('click', resetGame);
  document.getElementById('win-menu-btn')?.addEventListener('click', goToMenu);
  document.getElementById('loss-menu-btn')?.addEventListener('click', goToMenu);
});
