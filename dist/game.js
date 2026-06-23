const ICONS = ['ant', 'blue_flower', 'grass', 'potted_plant', 'red_flower', 'shovel'];
const ICON_SETS = ['tile_icons_red', 'Tile_icons_blue'];
const GRID_SIZE = 8;

function pickIconSet() {
  return ICON_SETS[Math.floor(Math.random() * ICON_SETS.length)];
}

function generateGrid() {
  const grid = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(null)
  );

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const blocked = new Set();

      // Block icons that would create 3-in-a-row horizontally
      if (col >= 2 && grid[row][col - 1] !== null && grid[row][col - 1] === grid[row][col - 2]) {
        blocked.add(grid[row][col - 1]);
      }

      // Block icons that would create 3-in-a-column vertically
      if (row >= 2 && grid[row - 1][col] !== null && grid[row - 1][col] === grid[row - 2][col]) {
        blocked.add(grid[row - 1][col]);
      }

      const valid = ICONS.filter(icon => !blocked.has(icon));
      grid[row][col] = valid[Math.floor(Math.random() * valid.length)];
    }
  }

  return grid;
}

function renderGrid(grid, iconSet) {
  const container = document.getElementById('game-grid');
  if (!container) return;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const isGold = Math.random() < 0.01;
      const cellSet = isGold ? 'Tile_icons_gold' : iconSet;

      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.dataset.icon = grid[row][col];
      if (isGold) cell.dataset.gold = 'true';

      const img = document.createElement('img');
      img.src = `assets/tile icons/${cellSet}/${grid[row][col]}.png`;
      img.alt = grid[row][col];
      img.draggable = false;

      cell.appendChild(img);
      container.appendChild(cell);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const iconSet = pickIconSet();
  const grid = generateGrid();
  renderGrid(grid, iconSet);
});
