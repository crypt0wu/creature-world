import { tryAutoCraft, autoEquip, autoUsePotion } from '../crafting'
import { markDecisionUseful } from '../scoring'

const CRAFT_COOLDOWN = 10
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
  if (c._craftCooldown > 0) return

  if (c.inventory.length < 2) return

  const result = tryAutoCraft(c)
  if (result.crafted) {
    c._craftCooldown = CRAFT_COOLDOWN
    c._equipDelay = EQUIP_DELAY // delay equip so item shows in inventory
    for (const matType of Object.keys(result.recipe.materials)) {
      markDecisionUseful(c, matType)
    }
  }
}
