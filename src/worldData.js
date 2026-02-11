import { getTerrainHeight, getZoneDensity } from './components/Terrain'

function seededRandom(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ─── Pond definitions (matching Terrain.jsx depressions) ───
export const PONDS = [
  { cx: 15, cz: -5, radius: 10 },
  { cx: -30, cz: 25, radius: 6 },
]

// ─── Generate world items (trees, rocks, bushes) ───────────
// Single source of truth — used by Trees.jsx for rendering
// and Wildlife.jsx for collision avoidance
function generateWorldItems() {
  const items = []
  const SPREAD = 180

  // Trees — density-driven placement
  for (let i = 0; i < 250; i++) {
    const x = (seededRandom(i * 3) - 0.5) * SPREAD
    const z = (seededRandom(i * 3 + 1) - 0.5) * SPREAD
    const density = getZoneDensity(x, z)
    if (seededRandom(i * 3 + 99) > density + 0.1) continue
    const y = getTerrainHeight(x, z)
    if (y < -1.0) continue
    const s = 0.7 + seededRandom(i * 3 + 2) * 1.5
    const v = seededRandom(i * 7)
    items.push({
      type: 'tree',
      pos: [x, y, z],
      scale: s,
      variant: v,
      collisionRadius: (1.2 + 0.4) * s,  // match visual crown radius
      key: `tree-${i}`,
    })
  }

  // Rocks — scattered everywhere, denser on hills
  for (let i = 0; i < 80; i++) {
    const x = (seededRandom(i * 5 + 1000) - 0.5) * SPREAD
    const z = (seededRandom(i * 5 + 1001) - 0.5) * SPREAD
    const y = getTerrainHeight(x, z)
    if (y < -0.5) continue
    const s = 0.4 + seededRandom(i * 5 + 1002) * 2.5
    items.push({
      type: 'rock',
      pos: [x, y + 0.1, z],
      scale: s,
      collisionRadius: 0.5 * s + 0.5,  // match visual rock size
      key: `rock-${i}`,
    })
  }

  // Bushes — favor edges of forests and clearings
  for (let i = 0; i < 150; i++) {
    const x = (seededRandom(i * 4 + 2000) - 0.5) * SPREAD
    const z = (seededRandom(i * 4 + 2001) - 0.5) * SPREAD
    const density = getZoneDensity(x, z)
    if (density < 0.05 || density > 0.8) {
      if (seededRandom(i * 4 + 2099) > 0.3) continue
    }
    const y = getTerrainHeight(x, z)
    if (y < -0.5) continue
    const s = 0.5 + seededRandom(i * 4 + 2002) * 1.2
    items.push({
      type: 'bush',
      pos: [x, y + 0.15, z],
      scale: s,
      collisionRadius: 0.6 * s + 0.3,  // match visual bush size
      key: `bush-${i}`,
    })
  }

  return items
}

export const WORLD_ITEMS = generateWorldItems()

// ─── Flat obstacle list for fast collision checks ──────────
export const OBSTACLES = WORLD_ITEMS.map(item => ({
  x: item.pos[0],
  z: item.pos[2],
  radius: item.collisionRadius,
}))

// ─── Shared mutable animal position registry ───────────────
// Each GLBAnimal pushes an entry on mount and updates it each frame.
// Other animals read this array for inter-animal avoidance.
export const animalPositions = []
