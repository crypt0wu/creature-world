import { WORLD_ITEMS } from '../../worldData'
import { MAX_INVENTORY, trySmartPickup } from '../inventory'
import { getBestGoalRecipe } from '../crafting'
import { scoreItem, wouldGatherBeUseful } from '../scoring'

// ── Resource config ─────────────────────────────────────────
const RESOURCE_CONFIG = {
  tree:  { duration: 5, energyCost: 12, minYield: 1, maxYield: 3, item: 'wood',  regrowMin: 300, regrowMax: 480, failChance: 0.20 },
  rock:  { duration: 4, energyCost: 10, minYield: 1, maxYield: 2, item: 'stone', regrowMin: 480, regrowMax: 720, crystalChance: 0.12, failChance: 0.15 },
  bush:  { duration: 3, energyCost: 4,  minYield: 1, maxYield: 2, item: 'herb',  regrowMin: 180, regrowMax: 300, failChance: 0.10 },
}

const GATHER_RANGE = 40
const ARRIVE_DIST = 3.5

// ── Material → resource type mapping ────────────────────────
const MATERIAL_TO_RESOURCE = { wood: 'tree', stone: 'rock', herb: 'bush' }

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
      c._gatherGoal = null
      // Immediately re-evaluate (lazy creatures rest briefly between tasks)
      c._decisionTimer = c.personality === 'lazy' ? 2.0 : 0
    }
    return
  }

  // ── Already heading toward a resource — navigate ──────────
  if (c.seekingResource) {
    _navigateToResource(c, resourceStates, dt)
    return
  }

  // ── Decision: should we start gathering? ──────────────────
  if (c.energy <= 20) return

  // Timer-based decision engine (replaces random throttle)
  // Runs during movement too — can interrupt wandering to start gathering
  if (!c._decisionTimer) c._decisionTimer = 0
  c._decisionTimer -= dt
  if (c._decisionTimer > 0) return

  // Fast re-eval when idle (0.5s), slower when executing a plan (3s)
  const hasActiveGoal = c._gatherGoal && c._gatherGoal.action !== 'idle'
  c._decisionTimer = hasActiveGoal ? 3.0 : 0.5

  // ── Run the decision engine ──
  const goal = _planNextAction(c, resourceStates, allCreatures, speciesMemory)
  c._gatherGoal = goal

  if (goal.action === 'craft') {
    // Signal crafting system to bypass cooldown
    c._wantsCraftNow = true
    return
  }

  if (goal.action === 'gather') {
    const targetIdx = _findBestResource(c, goal.resourceType, resourceStates, allCreatures)
    if (targetIdx >= 0) {
      c.seekingResource = true
      c.targetResourceIdx = targetIdx
      c.targetResourceType = WORLD_ITEMS[targetIdx].type
      resourceStates[targetIdx].gathererId = c.id
      c.pause = 0 // don't pause — start heading to resource
    } else {
      c._gatherGoal = { action: 'idle', reason: `No ${goal.resourceType} nearby` }
    }
    return
  }

  // action === 'idle': do nothing, wander system handles it
}

// ── The Decision Engine ─────────────────────────────────────
function _planNextAction(c, resourceStates, allCreatures, speciesMemory) {
  const invFull = c.inventory.length >= MAX_INVENTORY

  // Step 1: Can I craft something useful RIGHT NOW?
  const goalRecipe = getBestGoalRecipe(c)
  if (goalRecipe && goalRecipe.craftableNow) {
    return {
      action: 'craft',
      reason: `Can craft ${goalRecipe.recipe.label} now`,
      recipeId: goalRecipe.recipe.id,
      priority: 1.0,
    }
  }

  // Step 2: Close to a recipe? Seek the missing material.
  if (goalRecipe && !goalRecipe.craftableNow) {
    const entries = Object.entries(goalRecipe.missing).sort((a, b) => a[1] - b[1])
    const [neededMat, neededQty] = entries[0]
    const resourceType = MATERIAL_TO_RESOURCE[neededMat]

    if (resourceType) {
      if (!invFull || wouldGatherBeUseful(c, resourceType, speciesMemory)) {
        if (_hasAvailableResource(resourceType, c, resourceStates)) {
          return {
            action: 'gather',
            resourceType,
            materialNeeded: neededMat,
            reason: `Need ${neededQty} ${neededMat} for ${goalRecipe.recipe.label}`,
            recipeId: goalRecipe.recipe.id,
            priority: 0.8 + goalRecipe.completionRatio * 0.15,
          }
        }
      }
    }
  }

  // Step 3: No recipe goal, inventory not full — gather highest value material
  if (!invFull) {
    const typeScores = [
      { type: 'tree', item: 'wood', score: scoreItem('wood', c, speciesMemory) },
      { type: 'rock', item: 'stone', score: scoreItem('stone', c, speciesMemory) },
      { type: 'bush', item: 'herb', score: scoreItem('herb', c, speciesMemory) },
    ]
    typeScores.sort((a, b) => b.score - a.score)

    for (const ts of typeScores) {
      if (_hasAvailableResource(ts.type, c, resourceStates)) {
        return {
          action: 'gather',
          resourceType: ts.type,
          materialNeeded: ts.item,
          reason: `Gathering ${ts.item} (highest value)`,
          recipeId: null,
          priority: 0.4,
        }
      }
    }
  }

  // Step 4: Inventory full — can we improve via smart drop?
  if (invFull) {
    const types = ['tree', 'rock', 'bush']
    for (const rType of types) {
      if (wouldGatherBeUseful(c, rType, speciesMemory) &&
          _hasAvailableResource(rType, c, resourceStates)) {
        const itemName = RESOURCE_CONFIG[rType].item
        return {
          action: 'gather',
          resourceType: rType,
          materialNeeded: itemName,
          reason: `Inventory full, but ${itemName} would improve it`,
          recipeId: null,
          priority: 0.3,
        }
      }
    }
  }

  // Step 5: Nothing available right now — but still have a goal
  const hasWeapon = !!c.equipment?.weapon
  const hasArmor = !!c.equipment?.armor
  let idleReason
  if (!hasWeapon) idleReason = 'Goal: Craft Stone Blade. Looking for stone and wood nearby.'
  else if (!hasArmor) idleReason = 'Goal: Craft Wooden Shield. Looking for wood nearby.'
  else if (!invFull) idleReason = 'Equipped. Gathering materials for potions.'
  else idleReason = 'Fully stocked. Exploring the area.'
  return { action: 'idle', reason: idleReason, priority: 0.0 }
}

// ── Quick check: any available resource of this type nearby? ──
function _hasAvailableResource(type, c, resourceStates) {
  for (let i = 0; i < WORLD_ITEMS.length; i++) {
    const rs = resourceStates[i]
    if (!rs || rs.depleted || rs.beingGathered) continue
    if (WORLD_ITEMS[i].type !== type) continue
    const dx = WORLD_ITEMS[i].pos[0] - c.x
    const dz = WORLD_ITEMS[i].pos[2] - c.z
    if (dx * dx + dz * dz < GATHER_RANGE * GATHER_RANGE) return true
  }
  return false
}

// ── Find best resource with competition avoidance ───────────
function _findBestResource(c, resourceType, resourceStates, allCreatures) {
  // Build set of resources other creatures are heading toward
  const contested = new Set()
  for (let j = 0; j < allCreatures.length; j++) {
    const other = allCreatures[j]
    if (other.id === c.id || !other.alive) continue
    if (other.seekingResource && other.targetResourceIdx >= 0) {
      contested.add(other.targetResourceIdx)
    }
  }

  let bestDist = GATHER_RANGE
  let bestIdx = -1
  let fallbackDist = GATHER_RANGE
  let fallbackIdx = -1

  for (let i = 0; i < WORLD_ITEMS.length; i++) {
    const rs = resourceStates[i]
    if (!rs || rs.depleted || rs.beingGathered) continue
    if (WORLD_ITEMS[i].type !== resourceType) continue

    const dx = WORLD_ITEMS[i].pos[0] - c.x
    const dz = WORLD_ITEMS[i].pos[2] - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist >= GATHER_RANGE) continue

    if (!contested.has(i)) {
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    } else {
      if (dist < fallbackDist) { fallbackDist = dist; fallbackIdx = i }
    }
  }

  // Use contested resource if no uncontested found
  if (bestIdx < 0 && fallbackIdx >= 0) return fallbackIdx

  // Nothing of this type — try any type as last resort
  if (bestIdx < 0) {
    for (let i = 0; i < WORLD_ITEMS.length; i++) {
      const rs = resourceStates[i]
      if (!rs || rs.depleted || rs.beingGathered) continue
      const dx = WORLD_ITEMS[i].pos[0] - c.x
      const dz = WORLD_ITEMS[i].pos[2] - c.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
  }

  return bestIdx
}

// ── Navigate toward target resource ─────────────────────────
function _navigateToResource(c, resourceStates, dt) {
  const idx = c.targetResourceIdx
  if (idx < 0 || idx >= WORLD_ITEMS.length) { _clearGather(c, resourceStates); return }

  const rs = resourceStates[idx]
  if (!rs || rs.depleted) {
    // Resource was taken by someone else
    if (rs) rs.gathererId = null
    _clearGather(c, resourceStates)
    return
  }

  // Another creature is already harvesting this resource — give up and re-plan
  if (rs.beingGathered && rs.gathererId !== c.id) {
    _clearGather(c, resourceStates)
    return
  }

  const item = WORLD_ITEMS[idx]
  c.targetX = item.pos[0]
  c.targetZ = item.pos[2]
  c.moving = true

  const dx = item.pos[0] - c.x
  const dz = item.pos[2] - c.z
  const dist = Math.sqrt(dx * dx + dz * dz)

  // Stuck detection — if no progress for 4 seconds, give up
  if (dist < (c._lastResourceDist || 999) - 0.2) {
    c._resourceStuckTimer = 0
  } else {
    c._resourceStuckTimer = (c._resourceStuckTimer || 0) + dt
  }
  c._lastResourceDist = dist

  if (c._resourceStuckTimer > 4) {
    _clearGather(c, resourceStates)
    return
  }

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
    c._resourceStuckTimer = 0
    c._lastResourceDist = 999
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
  c._gatherGoal = null
  c._wantsCraftNow = false
  c._resourceStuckTimer = 0
  c._lastResourceDist = 999
  c._decisionTimer = 0
}
