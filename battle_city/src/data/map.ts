export const TILE_SIZE = 32
export const MAP_WIDTH_TILES = 28
export const MAP_HEIGHT_TILES = 20
export const FIELD_WIDTH = MAP_WIDTH_TILES * TILE_SIZE
export const FIELD_HEIGHT = MAP_HEIGHT_TILES * TILE_SIZE

// 0 = empty, 1 = solid wall
export type MapGrid = number[][]

export const AI_SPAWN = { x: TILE_SIZE * 2.5, y: TILE_SIZE * 2.5 }
export const DRONE_SPAWN = {
  x: FIELD_WIDTH - TILE_SIZE * 2.5,
  y: FIELD_HEIGHT - TILE_SIZE * 2.5,
}

const cloneGrid = (grid: MapGrid): MapGrid => grid.map((row) => [...row])

const emptyGrid = (): MapGrid =>
  Array.from({ length: MAP_HEIGHT_TILES }, () => Array.from({ length: MAP_WIDTH_TILES }, () => 0))

const inBounds = (tx: number, ty: number) =>
  tx >= 0 && ty >= 0 && tx < MAP_WIDTH_TILES && ty < MAP_HEIGHT_TILES

const carveSpawnArea = (grid: MapGrid, centerTx: number, centerTy: number) => {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const tx = centerTx + dx
      const ty = centerTy + dy
      if (inBounds(tx, ty)) grid[ty][tx] = 0
    }
  }
}

export const generateRandomSymmetricMap = (): MapGrid => {
  const grid = emptyGrid()

  // Borders
  for (let x = 0; x < MAP_WIDTH_TILES; x += 1) {
    grid[0][x] = 1
    grid[MAP_HEIGHT_TILES - 1][x] = 1
  }
  for (let y = 0; y < MAP_HEIGHT_TILES; y += 1) {
    grid[y][0] = 1
    grid[y][MAP_WIDTH_TILES - 1] = 1
  }

  // Symmetric obstacles
  const density = 0.12
  const half = Math.floor(MAP_WIDTH_TILES / 2)
  for (let y = 2; y < MAP_HEIGHT_TILES - 2; y += 1) {
    for (let x = 2; x < half; x += 1) {
      if (Math.random() < density) {
        grid[y][x] = 1
        grid[y][MAP_WIDTH_TILES - 1 - x] = 1
      }
    }
  }

  // A few symmetric "bars" to create structure/corridors
  const bars = 5
  for (let i = 0; i < bars; i += 1) {
    const y = 2 + Math.floor(Math.random() * (MAP_HEIGHT_TILES - 4))
    const xStart = 3 + Math.floor(Math.random() * (half - 4))
    const len = 2 + Math.floor(Math.random() * 5)
    for (let x = xStart; x < xStart + len && x < half; x += 1) {
      grid[y][x] = 1
      grid[y][MAP_WIDTH_TILES - 1 - x] = 1
    }
  }

  // Ensure spawns are clear
  carveSpawnArea(grid, 2, 2)
  carveSpawnArea(grid, MAP_WIDTH_TILES - 3, MAP_HEIGHT_TILES - 3)

  // Make sure center is not fully blocked
  const centerTx = Math.floor(MAP_WIDTH_TILES / 2)
  const centerTy = Math.floor(MAP_HEIGHT_TILES / 2)
  carveSpawnArea(grid, centerTx, centerTy)

  return cloneGrid(grid)
}
