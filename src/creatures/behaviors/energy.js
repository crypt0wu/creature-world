import { interruptCraft } from '../crafting'
import { canBuildShelter, startBuildingShelter, completeShelter, isNearShelter,
         canBuildCampfire, startBuildingCampfire, completeCampfire,
         canBuildStorage, startBuildingStorage, completeStorage, depositToStorage } from '../village'

export function updateEnergy(c, spec, dt, allCreatures) {
  if (!c.alive) return

  // ── Active building — tick timer, complete when done, then sleep ──
  if (c._buildingType) {
    c._buildingTimer -= dt
    c.currentSpeed = 0
    c.moving = false
    if (c._buildingTimer <= 0) {
      if (c._buildingType === 'storage') completeStorage(c)
      else if (c._buildingType === 'campfire') completeCampfire(c)
      else completeShelter(c)
      // Now fall through to sleep trigger below (energy is still low)
    } else {
      return
    }
  }

  // ── While sleeping: regen energy + HP, count down timer, wake when done ──
  if (c.sleeping) {
    const sheltered = isNearShelter(c)
    const energyRate = sheltered ? 8.0 : 4.0
    c.energy = Math.min(100, c.energy + energyRate * dt)
    c.hp = Math.min(c.maxHp, c.hp + 0.5 * dt)
    c.vulnerable = true
    c.sleepTimer -= dt

    if (c.sleepTimer <= 0) {
      c.sleeping = false
      c.vulnerable = false
      c.sleepTimer = 0
    }
    return
  }

  // ── Drain: base + 50% bonus when moving + speed-proportional bonus ──
  let drain = spec.energyDrain
  if (c.moving) {
    drain *= 1.5
    drain += (c.currentSpeed / Math.max(c.baseSpd, 0.1)) * spec.energyDrain * 0.5
  }
  c.energy = Math.max(0, c.energy - dt * drain)

  // ── Tired (energy < 25): reduce spd proportionally (50%–100% of baseSpd) ──
  if (c.energy < 25) {
    const t = c.energy / 25 // 0 at 0 energy, 1 at 25 energy
    c.spd = c.baseSpd * (0.5 + t * 0.5) // 50% at 0, 100% at 25
  } else {
    c.spd = c.baseSpd
  }

  // ── Return-to-build: arrival check ──
  if (c._returningToBuild && c.village) {
    const dx = c.village.x - c.x
    const dz = c.village.z - c.z
    if (dx * dx + dz * dz < 9) {
      c._returningToBuild = false
      console.log(`[VILLAGE] ${c.name} arrived home to build`)
      if (canBuildShelter(c)) {
        startBuildingShelter(c, allCreatures)
        return
      }
      if (canBuildCampfire(c)) {
        startBuildingCampfire(c, allCreatures)
        return
      }
      if (canBuildStorage(c)) {
        startBuildingStorage(c, allCreatures)
        return
      }
      // Materials gone (used/dropped)? Resume normal behavior
      // Deposit items into storage if we have one
      depositToStorage(c)
    } else {
      c.targetX = c.village.x
      c.targetZ = c.village.z
      if (!c.moving) { c.moving = true; c.stuckTimer = 0; c.lastDist = 999 }
      return
    }
  }

  // ── Trigger: has building materials → head home to build ──
  if (!c._returningToBuild && !c._returningHome && !c.sleeping && !c._buildingType
      && !c.gathering && !c.crafting && !c.eating && !c.seekingFood
      && !c.inCombat && !c._chasing && !(c._chaseDelayTimer > 0) && !c._fleeSprint && !(c._scaredTimer > 0)
      && c.village && (canBuildShelter(c) || canBuildCampfire(c) || canBuildStorage(c))) {
    const buildLabel = canBuildShelter(c) ? 'shelter' : canBuildCampfire(c) ? 'campfire' : 'storage'
    const dx = c.village.x - c.x
    const dz = c.village.z - c.z
    if (dx * dx + dz * dz < 9) {
      // Already at home — build now
      if (canBuildShelter(c)) startBuildingShelter(c, allCreatures)
      else if (canBuildCampfire(c)) startBuildingCampfire(c, allCreatures)
      else startBuildingStorage(c, allCreatures)
      return
    }
    c._returningToBuild = true
    c.targetX = c.village.x
    c.targetZ = c.village.z
    c.moving = true
    c.stuckTimer = 0
    c.lastDist = 999
    c.seekingResource = false
    console.log(`[VILLAGE] ${c.name} has enough to build ${buildLabel}, heading home`)
    return
  }

  // ── Sleep trigger: personality-based threshold ──
  let sleepThreshold = 10
  if (c.personality === 'lazy') sleepThreshold = 20
  else if (c.personality === 'fierce') sleepThreshold = 3

  if (c.energy < sleepThreshold) {
    // Already walking home to sleep — check arrival
    if (c._returningHome && c.village) {
      const dx = c.village.x - c.x
      const dz = c.village.z - c.z
      if (dx * dx + dz * dz < 9) {
        // Arrived home
        c._returningHome = false
        let _wood = 0, _stone = 0
        for (let i = 0; i < c.inventory.length; i++) {
          if (c.inventory[i].type === 'wood') _wood++
          if (c.inventory[i].type === 'stone') _stone++
        }
        const _hasBuilt = c.village.buildings.some(b => b.type === 'shelter')
        console.log(`[SHELTER] ${c.name} arrived home, wood=${_wood} stone=${_stone}, canBuild=${canBuildShelter(c) ? 'yes' : 'no'}, hasBuilt=${_hasBuilt ? 'yes' : 'no'}`)
        // Try to build before sleeping
        if (canBuildShelter(c)) {
          if (c.crafting) interruptCraft(c)
          startBuildingShelter(c, allCreatures)
          return
        }
        if (canBuildCampfire(c)) {
          if (c.crafting) interruptCraft(c)
          startBuildingCampfire(c, allCreatures)
          return
        }
        if (canBuildStorage(c)) {
          if (c.crafting) interruptCraft(c)
          startBuildingStorage(c, allCreatures)
          return
        }
        // Deposit to storage on arrival home
        depositToStorage(c)
        // Fall through to sleep below
      } else {
        // Keep driving toward home
        c.targetX = c.village.x
        c.targetZ = c.village.z
        if (!c.moving) { c.moving = true; c.stuckTimer = 0; c.lastDist = 999 }
        return
      }
    }

    // Has village but far from home? Walk home first
    if (!c._returningHome && c.village) {
      const dx = c.village.x - c.x
      const dz = c.village.z - c.z
      if (dx * dx + dz * dz >= 9) {
        if (c.crafting) interruptCraft(c)
        c._returningHome = true
        c.targetX = c.village.x
        c.targetZ = c.village.z
        c.moving = true
        c.stuckTimer = 0
        c.lastDist = 999
        c.seekingFood = false
        c.seekingResource = false
        console.log(`[VILLAGE] ${c.name} heading home to sleep`)
        return
      }
    }

    // At home (or no village) — try to build before sleeping
    if (c.village && canBuildShelter(c)) {
      if (c.crafting) interruptCraft(c)
      startBuildingShelter(c, allCreatures)
      return
    }
    if (c.village && canBuildCampfire(c)) {
      if (c.crafting) interruptCraft(c)
      startBuildingCampfire(c, allCreatures)
      return
    }
    if (c.village && canBuildStorage(c)) {
      if (c.crafting) interruptCraft(c)
      startBuildingStorage(c, allCreatures)
      return
    }
    // Deposit to storage if at home
    if (c.village) depositToStorage(c)

    // Sleep here (no village, or already at home, or can't build)
    if (c.crafting) interruptCraft(c)

    c.sleeping = true
    c._returningHome = false
    c.moving = false
    c.seekingFood = false
    c.vulnerable = true

    // Duration: 15–30s (lazy: 20–40s, fierce: 10–20s)
    let minDur = 15, maxDur = 30
    if (c.personality === 'lazy') { minDur = 20; maxDur = 40 }
    else if (c.personality === 'fierce') { minDur = 10; maxDur = 20 }

    c.sleepDuration = minDur + Math.random() * (maxDur - minDur)
    c.sleepTimer = c.sleepDuration
  }
}
