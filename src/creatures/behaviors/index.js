import { updateMovement } from './wander'
import { updateHunger, createFoodSources, updateFoodSources } from './hunger'
import { updateEnergy } from './energy'
import { updateCombat } from './combat'
import { checkLevelUp } from './leveling'

export { createFoodSources, updateFoodSources }

export function updateCreature(c, allCreatures, spec, dt, foods) {
  if (!c.alive) return

  c.age += dt
  c.phase += dt

  // Energy runs first — it affects speed + can trigger sleep
  updateEnergy(c, spec, dt)

  // Hunger runs before movement — it decides food-seeking targets
  updateHunger(c, spec, dt, foods, allCreatures)
  updateMovement(c, spec, dt)
  updateCombat(c, allCreatures, spec, dt)
  checkLevelUp(c, spec)

  // State determination (if still alive after updates)
  if (c.alive) {
    if (c.sleeping) c.state = 'sleeping'
    else if (c.eating) c.state = 'eating'
    else if (c.seekingFood) c.state = 'seeking food'
    else if (c.hunger < 25) c.state = 'hungry'
    else if (c.energy < 25) c.state = 'tired'
    else if (c.moving) c.state = 'wandering'
    else c.state = 'idle'
  }
}

export { updateMovement, updateHunger, updateEnergy, updateCombat, checkLevelUp }
