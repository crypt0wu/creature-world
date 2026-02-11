import { tryAutoCraft, autoEquip, autoUsePotion } from '../crafting'
import { markDecisionUseful } from '../scoring'

const CRAFT_COOLDOWN = 4
const EQUIP_DELAY = 2 // seconds after crafting before auto-equip

export function updateCrafting(c, spec, dt) {
  if (!c.alive || c.sleeping || c.eating || c.gathering || c.seekingFood || c.seekingResource) return

  // Auto-use potions when hurt (runs every tick, no cooldown)
  autoUsePotion(c)

  // Auto-equip equipment from inventory (with delay after crafting so icon is visible)
  if (!c._equipDelay) c._equipDelay = 0
  if (c._equipDelay > 0) {
    c._equipDelay -= dt
  } else {
    autoEquip(c)
  }

  if (!c._craftCooldown) c._craftCooldown = 0
  c._craftCooldown -= dt

  // Decision engine flagged "craft now" — bypass cooldown
  if (c._wantsCraftNow) {
    c._wantsCraftNow = false
    c._craftCooldown = 0
  }

  if (c._craftCooldown > 0) return

  if (c.inventory.length < 2) return

  const result = tryAutoCraft(c)
  if (result.crafted) {
    c._craftCooldown = CRAFT_COOLDOWN
    c._equipDelay = EQUIP_DELAY
    c._gatherGoal = null // re-evaluate next idle tick
    for (const matType of Object.keys(result.recipe.materials)) {
      markDecisionUseful(c, matType)
    }
  }
}
