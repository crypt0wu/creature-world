import { WORLD_ITEMS } from '../../worldData'
import { MAX_INVENTORY, trySmartPickup } from '../inventory'

// ── Resource config ─────────────────────────────────────────
const RESOURCE_CONFIG = {
  tree:  { duration: 5, energyCost: 12, minYield: 1, maxYield: 3, item: 'wood',  regrowMin: 300, regrowMax: 480, failChance: 0.20 },
  rock:  { duration: 4, energyCost: 10, minYield: 1, maxYield: 2, item: 'stone', regrowMin: 480, regrowMax: 720, crystalChance: 0.12, failChance: 0.15 },
  bush:  { duration: 3, energyCost: 4,  minYield: 1, maxYield: 2, item: 'herb',  regrowMin: 180, regrowMax: 300, failChance: 0.10 },
}

const GATHER_RANGE = 40
const ARRIVE_DIST = 2.5

// ── Preference: species/personality → preferred resource type ──
function preferredType(c) {
  const s = c.species
  const p = c.personality
  if (s === 'embrix' || p === 'bold' || p === 'fierce') return 'tree'
  if (s === 'aqualis' || s === 'glacira' || p === 'gentle') return 'rock'
  if (s === 'verdox' || p === 'curious') return 'bush'
  return null // nearest
}

export function updateGathering(c, spec, dt, resourceStates, allCreatures, speciesMemory) {
  if (!c.alive || c.sleeping || c.eating || c.seekingFood) return

  // ── Active gathering ──────────────────────────────────────
  if (c.gathering) {
    c.gatherTimer -= dt
    c.currentSpeed = 0
    c.moving = false

    // Update gather progress on the resource state for visual feedback
    const activeIdx = c.targetResourceIdx
    const activeRs = resourceStates[activeIdx]
    if (activeRs && c.gatherDuration > 0) {
      activeRs.gatherProgress = Math.min(1, 1 - Math.max(0, c.gatherTimer) / c.gatherDuration)
    }

    if (c.gatherTimer <= 0) {
      const idx = c.targetResourceIdx
      const item = WORLD_ITEMS[idx]
      if (!item) { _clearGather(c, resourceStates); return }
      const cfg = RESOURCE_CONFIG[item.type]
      if (!cfg) { _clearGather(c, resourceStates); return }

      // Failure chance — still costs energy, but yields nothing
      const failed = cfg.failChance && Math.random() < cfg.failChance
      const drops = []
      let pushed = 0
      let crystal = false

      if (failed) {
        c.gatherFailed = item.type // flag for logging
      } else {
        // Roll yield — use smart pickup for full-inventory evaluation
        const qty = cfg.minYield + Math.floor(Math.random() * (cfg.maxYield - cfg.minYield + 1))

        for (let i = 0; i < qty; i++) {
          const result = trySmartPickup(c, cfg.item, speciesMemory)
          if (result.picked) {
            pushed++
            if (result.dropped) drops.push(result.dropped)
          }
        }

        // Crystal chance on stone
        if (item.type === 'rock' && cfg.crystalChance && Math.random() < cfg.crystalChance) {
          const crystalResult = trySmartPickup(c, 'crystal', speciesMemory)
          if (crystalResult.picked) {
            crystal = true
            if (crystalResult.dropped) drops.push(crystalResult.dropped)
          }
        }
      }

      if (drops.length > 0) {
        c.justDropped = drops
      }

      // Energy cost
      c.energy = Math.max(0, c.energy - cfg.energyCost)

      // Mark resource depleted
      const rs = resourceStates[idx]
      if (rs) {
        rs.depleted = true
        rs.beingGathered = false
        rs.gatherProgress = 0
        rs.regrowDuration = cfg.regrowMin + Math.random() * (cfg.regrowMax - cfg.regrowMin)
        rs.regrowTimer = rs.regrowDuration
        rs.scale = 0
        rs.gathererId = null
        rs.needsRelocation = true
      }

      // Set flags for visual/logging
      c.gatherResult = { type: cfg.item, qty: pushed }
      c.gatherDone = true
      c.foundCrystal = crystal

      c.gathering = false
      c.gatherTimer = 0
      c.gatherDuration = 0
      c.seekingResource = false
      c.targetResourceIdx = -1
      c.targetResourceType = ''
    }
    return
  }

  // ── Decision: should we start gathering? ──────────────────
  if (c.seekingResource) {
    // Already heading toward a resource — navigate
    _navigateToResource(c, resourceStates)
    return
  }

  // Guards: need energy, not busy (full inventory is OK — smart drop handles it)
  if (c.energy <= 20) return
  if (c.moving) return

  // Random chance to skip this frame (don't all decide instantly)
  if (Math.random() > 0.02) return

  // Find a resource to gather
  const pref = preferredType(c)
  let bestDist = GATHER_RANGE
  let bestIdx = -1

  for (let i = 0; i < WORLD_ITEMS.length; i++) {
    const rs = resourceStates[i]
    if (!rs || rs.depleted || rs.gathererId) continue

    const item = WORLD_ITEMS[i]
    // If we have a preference, only consider that type
    if (pref && item.type !== pref) continue

    const dx = item.pos[0] - c.x
    const dz = item.pos[2] - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }

  // If preference found nothing, try nearest of any type
  if (bestIdx < 0 && pref) {
    for (let i = 0; i < WORLD_ITEMS.length; i++) {
      const rs = resourceStates[i]
      if (!rs || rs.depleted || rs.gathererId) continue
      const item = WORLD_ITEMS[i]
      const dx = item.pos[0] - c.x
      const dz = item.pos[2] - c.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
  }

  if (bestIdx >= 0) {
    c.seekingResource = true
    c.targetResourceIdx = bestIdx
    c.targetResourceType = WORLD_ITEMS[bestIdx].type
    resourceStates[bestIdx].gathererId = c.id
  }
}

// ── Navigate toward target resource ─────────────────────────
function _navigateToResource(c, resourceStates) {
  const idx = c.targetResourceIdx
  if (idx < 0 || idx >= WORLD_ITEMS.length) { _clearGather(c, resourceStates); return }

  const rs = resourceStates[idx]
  if (!rs || rs.depleted) {
    // Resource was taken by someone else
    if (rs) rs.gathererId = null
    _clearGather(c, resourceStates)
    return
  }

  const item = WORLD_ITEMS[idx]
  c.targetX = item.pos[0]
  c.targetZ = item.pos[2]
  c.moving = true
  c.stuckTimer = 0

  const dx = item.pos[0] - c.x
  const dz = item.pos[2] - c.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  if (dist < ARRIVE_DIST) {
    const cfg = RESOURCE_CONFIG[item.type]
    if (!cfg) { _clearGather(c, resourceStates); return }

    c.gathering = true
    c.gatherTimer = cfg.duration
    c.gatherDuration = cfg.duration
    c.moving = false
    c.currentSpeed = 0

    // Mark resource as actively being gathered
    rs.beingGathered = true
    rs.gatherProgress = 0
  }
}

// ── Clear all gathering state ───────────────────────────────
function _clearGather(c, resourceStates) {
  // Clean up resource state if we were claiming one
  if (c.targetResourceIdx >= 0 && c.targetResourceIdx < resourceStates.length) {
    const rs = resourceStates[c.targetResourceIdx]
    if (rs && rs.gathererId === c.id) {
      rs.gathererId = null
      rs.beingGathered = false
      rs.gatherProgress = 0
    }
  }
  c.gathering = false
  c.gatherTimer = 0
  c.gatherDuration = 0
  c.seekingResource = false
  c.targetResourceIdx = -1
  c.targetResourceType = ''
}
