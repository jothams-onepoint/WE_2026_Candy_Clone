const ICONS = ['ant', 'blue_flower', 'grass', 'potted_plant', 'red_flower', 'shovel'];
const ICON_SETS = ['tile_icons_red', 'Tile_icons_blue'];
const GRID_SIZE = 8;

let gameGrid = [];
let goldGrid = [];
let gameIconSet;
let points = 0;
let isAnimating = false;
let moveCap = 0;
let movesUsed = 0;
let timeLeft = 40;
let timerInterval = null;

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
}

function startTimer() {
  if (timerInterval !== null) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
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

  if (playChime) {
    chimeSound.currentTime = 0;
    chimeSound.play().catch(() => {});
  } else {
    crunchSound.currentTime = 0;
    crunchSound.play().catch(() => {});
  }

  matchedSet.forEach(key => {
    const [r, c] = key.split(',').map(Number);
    showBreakAnimation(r, c);
  });

  await sleep(520);

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
  invalidSwapSound.currentTime = 0;
  invalidSwapSound.play().catch(() => {});
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
    updateCellDOM(r1, c1);
    updateCellDOM(r2, c2);
    whooshSound.currentTime = 0;
    whooshSound.play().catch(() => {});
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
  const screen = document.getElementById('win-screen');
  const scoreEl = document.getElementById('win-score');
  if (!screen || !scoreEl) return;
  scoreEl.textContent = String(points);
  screen.classList.remove('hidden');
}

function showLossScreen() {
  stopTimer();
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
    handleDragEnd(e.clientX, e.clientY);
  });

  container.addEventListener('touchstart', (e) => {
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

  document.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const playBtn = document.getElementById('menu-play');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      document.getElementById('main-menu')?.classList.add('hidden');
      document.getElementById('app')?.classList.remove('hidden');
    });
  }

  moveCap = Math.floor(Math.random() * 11) + 15;
  movesUsed = 0;
  timeLeft = 40;
  gameIconSet = pickIconSet();
  gameGrid = generateGrid();
  goldGrid = generateGoldGrid();
  renderGrid();
  setupDragHandlers();
  updateScoreDisplay();
  updateMovesDisplay();
  updateTimerDisplay();
  startTimer();
});
