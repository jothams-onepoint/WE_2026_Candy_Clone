type IconName = 'ant' | 'blue_flower' | 'grass' | 'potted_plant' | 'red_flower' | 'shovel';

const ICONS: IconName[] = ['ant', 'blue_flower', 'grass', 'potted_plant', 'red_flower', 'shovel'];
const ICON_SETS = ['tile_icons_red', 'Tile_icons_blue'] as const;
type IconSet = typeof ICON_SETS[number];
const GRID_SIZE = 8;

let gameGrid: IconName[][] = [];
let goldGrid: boolean[][] = [];
let gameIconSet: IconSet;

const whooshSound = new Audio('Sounds/whoosh.mp3');
const invalidSwapSound = new Audio('Sounds/invalidswap.mp3');

let dragStartCell: HTMLElement | null = null;
let dragStartX = 0;
let dragStartY = 0;

function pickIconSet(): IconSet {
  return ICON_SETS[Math.floor(Math.random() * ICON_SETS.length)];
}

function generateGrid(): IconName[][] {
  const grid: (IconName | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<IconName | null>(GRID_SIZE).fill(null)
  );

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const blocked = new Set<IconName>();

      if (col >= 2 && grid[row][col - 1] !== null && grid[row][col - 1] === grid[row][col - 2]) {
        blocked.add(grid[row][col - 1] as IconName);
      }
      if (row >= 2 && grid[row - 1][col] !== null && grid[row - 1][col] === grid[row - 2][col]) {
        blocked.add(grid[row - 1][col] as IconName);
      }

      const valid = ICONS.filter(icon => !blocked.has(icon));
      grid[row][col] = valid[Math.floor(Math.random() * valid.length)];
    }
  }

  return grid as IconName[][];
}

function generateGoldGrid(): boolean[][] {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => Math.random() < 0.01)
  );
}

function renderGrid(): void {
  const container = document.getElementById('game-grid');
  if (!container) return;
  container.innerHTML = '';

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const isGold = goldGrid[row][col];
      const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;

      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.icon = gameGrid[row][col];
      if (isGold) cell.dataset.gold = 'true';

      const img = document.createElement('img');
      img.src = `assets/tile icons/${cellSet}/${gameGrid[row][col]}.png`;
      img.alt = gameGrid[row][col];
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
  const isGold = goldGrid[row][col];
  const cellSet = isGold ? 'Tile_icons_gold' : gameIconSet;
  const img = cell.querySelector('img') as HTMLImageElement;
  img.src = `assets/tile icons/${cellSet}/${gameGrid[row][col]}.png`;
  img.alt = gameGrid[row][col];
  cell.dataset.icon = gameGrid[row][col];
  if (isGold) {
    cell.dataset.gold = 'true';
  } else {
    delete cell.dataset.gold;
  }
}

function hasMatchAt(row: number, col: number): boolean {
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

function flashInvalid(r1: number, c1: number): void {
  const cell = getCellElement(r1, c1);
  if (!cell) return;
  cell.classList.add('invalid-swap');
  setTimeout(() => cell.classList.remove('invalid-swap'), 350);
  invalidSwapSound.currentTime = 0;
  invalidSwapSound.play();
}

function trySwap(r1: number, c1: number, r2: number, c2: number): void {
  const tmpIcon = gameGrid[r1][c1];
  const tmpGold = goldGrid[r1][c1];

  gameGrid[r1][c1] = gameGrid[r2][c2];
  gameGrid[r2][c2] = tmpIcon;
  goldGrid[r1][c1] = goldGrid[r2][c2];
  goldGrid[r2][c2] = tmpGold;

  if (hasMatchAt(r1, c1) || hasMatchAt(r2, c2)) {
    updateCellDOM(r1, c1);
    updateCellDOM(r2, c2);
    whooshSound.currentTime = 0;
    whooshSound.play();
  } else {
    // Revert: r1c1 currently holds icon2, r2c2 currently holds icon1
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

  if (targetRow >= 0 && targetRow < GRID_SIZE && targetCol >= 0 && targetCol < GRID_SIZE) {
    trySwap(row, col, targetRow, targetCol);
  }

  dragStartCell = null;
}

function setupDragHandlers(): void {
  const container = document.getElementById('game-grid')!;

  container.addEventListener('mousedown', (e: MouseEvent) => {
    const cell = (e.target as HTMLElement).closest('.grid-cell') as HTMLElement | null;
    if (!cell) return;
    e.preventDefault();
    dragStartCell = cell;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cell.classList.add('dragging');
  });

  document.addEventListener('mouseup', (e: MouseEvent) => {
    handleDragEnd(e.clientX, e.clientY);
  });

  container.addEventListener('touchstart', (e: TouchEvent) => {
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

  document.addEventListener('touchend', (e: TouchEvent) => {
    const touch = e.changedTouches[0];
    handleDragEnd(touch.clientX, touch.clientY);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  gameIconSet = pickIconSet();
  gameGrid = generateGrid();
  goldGrid = generateGoldGrid();
  renderGrid();
  setupDragHandlers();
});
