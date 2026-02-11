import { PONDS, OBSTACLES } from '../../worldData'
import { getTerrainHeight } from '../../components/Terrain'
import { tryPickupBerry, eatFromInventory } from '../inventory'

const WORLD_HALF = 95
const FOOD_COUNT = 10
const FOOD_EAT_RANGE = 2.5
const EAT_DURATION = 3.0
const HUNGER_RESTORE = 60

// ── Food source management ──────────────────────────────────

function findValidPosition() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = (Math.random() - 0.5) * WORLD_HALF * 1.6
    const z = (Math.random() - 0.5) * WORLD_HALF * 1.6

    if (Math.abs(x) > WORLD_HALF - 5 || Math.abs(z) > WORLD_HALF - 5) continue

    const y = getTerrainHeight(x, z)
    if (y < -0.3) continue

    let blocked = false
    for (let i = 0; i < PONDS.length; i++) {
      const dx = x - PONDS[i].cx
      const dz = z - PONDS[i].cz
      if (Math.sqrt(dx * dx + dz * dz) < PONDS[i].radius + 3) { blocked = true; break }
    }
    if (blocked) continue

    for (let i = 0; i < OBSTACLES.length; i++) {
      const dx = x - OBSTACLES[i].x
      const dz = z - OBSTACLES[i].z
      if (Math.sqrt(dx * dx + dz * dz) < OBSTACLES[i].radius + 1) { blocked = true; break }
    }
    if (blocked) continue

    return { x, z, y }
  }
  const x = (Math.random() - 0.5) * 20
  const z = (Math.random() - 0.5) * 20
  return { x, z, y: getTerrainHeight(x, z) }
}

export function createFoodSources() {
  const foods = []
  for (let i = 0; i < FOOD_COUNT; i++) {
    const pos = findValidPosition()
    foods.push({ ...pos, active: true, respawnTimer: 0, beingEaten: false, eatProgress: 0, popTimer: 0 })
  }
  return foods
}

export function updateFoodSources(foods, dt) {
  for (let i = 0; i < foods.length; i++) {
    const f = foods[i]
    if (f.popTimer > 0) f.popTimer -= dt
    if (!f.active && !f.beingEaten && f.respawnTimer > 0) {
      f.respawnTimer -= dt
      if (f.respawnTimer <= 0) {
        const pos = findValidPosition()
        f.x = pos.x
        f.z = pos.z
        f.y = pos.y
        f.active = true
        f.eatProgress = 0
      }
    }
  }
}

// ── Creature hunger behavior ────────────────────────────────

export function updateHunger(c, spec, dt, foods, allCreatures) {
  if (!c.alive) return
  if (c.sleeping) return

  // Drain hunger
  c.hunger = Math.max(0, c.hunger - dt * spec.hungerDrain)

  // Currently eating — stay put, shrink food, restore hunger when done
  if (c.eating) {
    c.eatTimer -= dt
    c.currentSpeed = 0
    c.moving = false

    // Update food shrink progress
    if (c.targetFoodIdx >= 0 && c.targetFoodIdx < foods.length) {
      foods[c.targetFoodIdx].eatProgress = Math.min(1, 1 - Math.max(0, c.eatTimer) / EAT_DURATION)
    }

    if (c.eatTimer <= 0) {
      // Calculate actual hunger gain
      const hungerBefore = c.hunger
      c.hunger = Math.min(100, c.hunger + HUNGER_RESTORE)
      c.lastHungerGain = Math.round(c.hunger - hungerBefore)

      // Try to pick up an extra berry into inventory
      c.pickedUpBerry = tryPickupBerry(c)

      // Finish eating — trigger pop effect on food
      if (c.targetFoodIdx >= 0 && c.targetFoodIdx < foods.length) {
        const food = foods[c.targetFoodIdx]
        food.beingEaten = false
        food.popTimer = 0.6
        food.respawnTimer = 30 + Math.random() * 30
      }

      c.eating = false
      c.seekingFood = false
      c.targetFoodIdx = -1
    }
    return
  }

  // Determine hunger threshold based on personality
  let threshold = 40
  if (c.personality === 'lazy') threshold = 20
  else if (c.personality === 'bold' || c.personality === 'fierce') threshold = 45

  // If hunger is above threshold and we were seeking, cancel
  if (c.hunger >= threshold + 10 && c.seekingFood) {
    c.seekingFood = false
    c.targetFoodIdx = -1
  }

  // Eat from inventory before seeking food on the map
  if (c.hunger < 40 && !c.seekingFood && c.inventory.length > 0) {
    if (eatFromInventory(c)) return
  }

  // Start seeking food when hungry
  if (c.hunger < threshold && !c.seekingFood) {
    let bestDist = Infinity
    let bestIdx = -1

    for (let i = 0; i < foods.length; i++) {
      if (!foods[i].active) continue
      const dx = foods[i].x - c.x
      const dz = foods[i].z - c.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }

    if (bestIdx >= 0) {
      if (c.personality === 'timid') {
        const food = foods[bestIdx]
        for (let j = 0; j < allCreatures.length; j++) {
          const other = allCreatures[j]
          if (other.id === c.id || !other.alive) continue
          const dx = other.x - food.x
          const dz = other.z - food.z
          if (Math.sqrt(dx * dx + dz * dz) < 5) {
            if (c.hunger > 15) return
          }
        }
      }

      c.seekingFood = true
      c.targetFoodIdx = bestIdx
    }
  }

  // Navigate toward food
  if (c.seekingFood && c.targetFoodIdx >= 0) {
    const food = foods[c.targetFoodIdx]

    if (!food || !food.active) {
      c.seekingFood = false
      c.targetFoodIdx = -1
      return
    }

    c.targetX = food.x
    c.targetZ = food.z
    c.moving = true
    c.stuckTimer = 0

    const dx = food.x - c.x
    const dz = food.z - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    if (dist < FOOD_EAT_RANGE) {
      c.eating = true
      c.eatTimer = EAT_DURATION
      c.moving = false
      c.currentSpeed = 0
      food.active = false
      food.beingEaten = true
      food.eatProgress = 0
    }
  }

  // Starvation damage
  if (c.hunger <= 0) {
    c.hp = Math.max(0, c.hp - dt * 0.5)
    if (c.hp <= 0) {
      c.alive = false
      c.state = 'dead'
      c.currentSpeed = 0
      c.seekingFood = false
      c.eating = false
    }
  }
}
