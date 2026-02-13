import { updateMovement } from './wander'
import { updateHunger, createFoodSources, updateFoodSources } from './hunger'
import { updateEnergy } from './energy'
import { updateCombat } from './combat'
import { checkLevelUp } from './leveling'
import { updateGathering } from './gathering'
import { updateCrafting } from './crafting'
import { autoUsePotion } from '../crafting'

export { createFoodSources, updateFoodSources }

export function updateCreature(c, allCreatures, spec, dt, foods, resourceStates, speciesMemory) {
  if (!c.alive) return

  c.age += dt
  c.phase += dt

  // Energy runs first — it affects speed + can trigger sleep
  updateEnergy(c, spec, dt, allCreatures)

  // Auto-use potions when hurt — runs regardless of activity (except sleeping)
  // Timed: 3-4 seconds to drink, can be interrupted by combat
  if (!c.sleeping) {
    autoUsePotion(c, dt)
  }

  // Skip hunger/gathering/crafting/wander during active combat, chase, or chase delay
  if (!c.inCombat && !c._chasing && !(c._chaseDelayTimer > 0)) {
    const isScared = c._scaredTimer > 0

    // Hunger runs always, but hunger.js self-gates during scared state
    updateHunger(c, spec, dt, foods, allCreatures)

    // Gathering + Crafting: BLOCKED during scared state — run first!
    if (!isScared) {
      updateGathering(c, spec, dt, resourceStates, allCreatures, speciesMemory)
      updateCrafting(c, spec, dt)
    }

    updateMovement(c, spec, dt)
  }

  updateCombat(c, allCreatures, spec, dt)
  checkLevelUp(c, spec)

  // State determination (if still alive after updates)
  if (c.alive) {
    if (c.inCombat) c.state = 'fighting'
    else if (c._chaseDelayTimer > 0) c.state = 'watching'
    else if (c._chasing) c.state = 'chasing'
    else if (c._fleeSprint > 0) c.state = 'fleeing'
    else if (c._scaredTimer > 0) c.state = 'scared'
    else if (c.drinkingPotion) c.state = 'drinking potion'
    else if (c.sleeping) c.state = 'sleeping'
    else if (c.eating) c.state = 'eating'
    else if (c.gathering) c.state = 'gathering'
    else if (c.crafting) c.state = 'crafting'
    else if (c._buildingType) c.state = 'building'
    else if (c._returningToBuild) c.state = 'returning to build'
    else if (c._returningHome) c.state = 'returning home'
    else if (c.seekingFood) c.state = 'seeking food'
    else if (c.seekingResource) c.state = 'seeking resource'
    else if (c.hunger < 25) c.state = 'hungry'
    else if (c.energy < 25) c.state = 'tired'
    else if (c.moving) c.state = 'wandering'
    else c.state = 'idle'
  }
}

export { updateMovement, updateHunger, updateEnergy, updateCombat, checkLevelUp, updateGathering, updateCrafting }
