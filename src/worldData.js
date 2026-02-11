import { getTerrainHeight, getZoneDensity } from './components/Terrain'

// ─── Pond definitions (matching Terrain.jsx depressions) ───
export const PONDS = [
  { cx: 15, cz: -5, radius: 10 },
  { cx: -30, cz: 25, radius: 6 },
]

// ─── Check if a point is inside or near a pond ───────────
function isNearPond(x, z, buffer) {
  for (let i = 0; i < PONDS.length; i++) {
    const dx = x - PONDS[i].cx, dz = z - PONDS[i].cz
    if (dx * dx + dz * dz < (PONDS[i].radius + buffer) ** 2) return true
  }
  return false
}

// ─── Generate world items (trees, rocks, bushes) ───────────
// Uses Math.random() so each game/reset has a unique layout
function generateWorldItems() {
  const items = []
  const SPREAD = 180

  // Trees — density-driven placement with pond avoidance
  for (let i = 0; i < 250; i++) {
    const x = (Math.random() - 0.5) * SPREAD
    const z = (Math.random() - 0.5) * SPREAD
    if (isNearPond(x, z, 5)) continue
    const density = getZoneDensity(x, z)
    if (Math.random() > density + 0.1) continue
    const y = getTerrainHeight(x, z)
    if (y < -1.0) continue
    const s = 0.7 + Math.random() * 1.5
    const v = Math.random()
    items.push({
      type: 'tree',
      pos: [x, y, z],
      scale: s,
      variant: v,
      collisionRadius: (1.2 + 0.4) * s,
      key: `tree-${i}`,
    })
  }

  // Rocks — scattered everywhere
  for (let i = 0; i < 80; i++) {
    const x = (Math.random() - 0.5) * SPREAD
    const z = (Math.random() - 0.5) * SPREAD
    if (isNearPond(x, z, 4)) continue
    const y = getTerrainHeight(x, z)
    if (y < -0.5) continue
    const s = 0.4 + Math.random() * 2.5
    items.push({
      type: 'rock',
      pos: [x, y + 0.1, z],
      scale: s,
      collisionRadius: 0.5 * s + 0.5,
      key: `rock-${i}`,
    })
  }

  // Bushes — favor edges of forests and clearings
  for (let i = 0; i < 150; i++) {
    const x = (Math.random() - 0.5) * SPREAD
    const z = (Math.random() - 0.5) * SPREAD
    if (isNearPond(x, z, 3)) continue
    const density = getZoneDensity(x, z)
    if (density < 0.05 || density > 0.8) {
      if (Math.random() > 0.3) continue
    }
    const y = getTerrainHeight(x, z)
    if (y < -0.5) continue
    const s = 0.5 + Math.random() * 1.2
    items.push({
      type: 'bush',
      pos: [x, y + 0.15, z],
      scale: s,
      collisionRadius: 0.6 * s + 0.3,
      key: `bush-${i}`,
    })
  }

  return items
}

// ─── Mutable world item arrays (mutated in-place on regenerate) ───
export const WORLD_ITEMS = []
export const OBSTACLES = []

function _populate() {
  WORLD_ITEMS.length = 0
  OBSTACLES.length = 0
  const items = generateWorldItems()
  for (let i = 0; i < items.length; i++) {
    WORLD_ITEMS.push(items[i])
    OBSTACLES.push({
      x: items[i].pos[0],
      z: items[i].pos[2],
      radius: items[i].collisionRadius,
    })
  }
}

// Generate on initial module load
_populate()

// ─── Regenerate all world items (called on reset) ────────
export function regenerateWorld() {
  _populate()
}

// ─── Find a valid position for a resource to respawn ────────
export function findValidResourcePosition(type) {
  const SPREAD = 160
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = (Math.random() - 0.5) * SPREAD
    const z = (Math.random() - 0.5) * SPREAD
    const y = getTerrainHeight(x, z)

    if (type === 'tree' && y < -1.0) continue
    if ((type === 'rock' || type === 'bush') && y < -0.5) continue

    if (isNearPond(x, z, 4)) continue

    let blocked = false
    for (let i = 0; i < OBSTACLES.length; i++) {
      const dx = x - OBSTACLES[i].x, dz = z - OBSTACLES[i].z
      if (Math.sqrt(dx * dx + dz * dz) < OBSTACLES[i].radius + 2) { blocked = true; break }
    }
    if (blocked) continue

    const yOff = type === 'rock' ? 0.1 : type === 'bush' ? 0.15 : 0
    return [x, y + yOff, z]
  }
  // Fallback — near center
  const x = (Math.random() - 0.5) * 40
  const z = (Math.random() - 0.5) * 40
  const y = getTerrainHeight(x, z)
  const yOff = type === 'rock' ? 0.1 : type === 'bush' ? 0.15 : 0
  return [x, y + yOff, z]
}

// ─── Shared mutable animal position registry ───────────────
// Each GLBAnimal pushes an entry on mount and updates it each frame.
// Other animals read this array for inter-animal avoidance.
export const animalPositions = []
