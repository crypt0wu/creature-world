import { startCraft, completeCraft, autoEquip } from '../crafting'
import { markDecisionUseful } from '../scoring'
import { needsStorageMaterials } from '../village'

const CRAFT_COOLDOWN = 4
const EQUIP_DELAY = 2 // seconds after crafting before auto-equip

export function updateCrafting(c, spec, dt) {
  if (!c.alive) return
  if (c._scaredTimer > 0) return  // Scared creatures don't craft — run first

  // ── Active crafting in progress — MUST tick regardless of hunger/seeking state ──
  if (c.crafting) {
    c.craftTimer -= dt
    if (c.craftTimer <= 0) {
      // Crafting complete!
      const recipe = c.craftRecipe
      completeCraft(c)
      c._craftCooldown = CRAFT_COOLDOWN
      c._equipDelay = EQUIP_DELAY
      c._gatherGoal = null // re-evaluate next idle tick
      // Clear any food/resource seeking flags that accumulated during crafting
      c.seekingFood = false
      c.targetFoodIdx = -1
      c.seekingResource = false
      c.targetResourceIdx = -1
      if (recipe) {
        for (const matType of Object.keys(recipe.materials)) {
          markDecisionUseful(c, matType)
        }
      }
    }
    return // Don't do anything else while crafting
  }

  // Auto-equip equipment from inventory — runs regardless of activity state
  // (with delay after crafting so icon is visible)
  if (!c._equipDelay) c._equipDelay = 0
  if (c._equipDelay > 0) {
    c._equipDelay -= dt
  } else {
    autoEquip(c)
  }

  // Skip starting new crafts during other activities or when tired
  if (c.sleeping || c.eating || c.gathering || c.seekingFood || c.seekingResource) return
  if (c._returningHome) return    // Walking home to sleep — don't start crafting
  if (c._returningToBuild) return // Walking home to build — don't start crafting
  if (c._buildingType) return     // Currently building — don't start crafting
  if (c.energy < 25) return // Too tired to start crafting — prioritize rest

  // Block crafting while saving materials for shelter or storage
  if (c.village) {
    let hasShelter = false
    for (let i = 0; i < c.village.buildings.length; i++) {
      if (c.village.buildings[i].type === 'shelter') { hasShelter = true; break }
    }
    if (!hasShelter) return // Don't craft anything — save materials for shelter
  }
  if (c.village && needsStorageMaterials(c)) return // Save materials for storage

  if (!c._craftCooldown) c._craftCooldown = 0
  c._craftCooldown -= dt

  // Decision engine flagged "craft now" — bypass cooldown
  if (c._wantsCraftNow) {
    c._wantsCraftNow = false
    c._craftCooldown = 0
  }

  if (c._craftCooldown > 0) return

  if (c.inventory.length < 2) return

  const result = startCraft(c)
  if (result.started) {
    // Crafting has begun — materials consumed, timer set
    // completeCraft will be called when timer expires
  }
}
