import { MAX_INVENTORY } from './inventory'

// ── Equipment slots ──────────────────────────────────────
export const SLOT_WEAPON = 'weapon'
export const SLOT_ARMOR = 'armor'

// ── Craft durations [min, max] in seconds ────────────────
export const CRAFT_DURATIONS = {
  stone_blade:    [15, 20],
  wooden_shield:  [20, 25],
  healing_potion: [10, 12],
}

// ── Energy cost to craft ─────────────────────────────────
export const CRAFT_ENERGY = {
  stone_blade:    15,
  wooden_shield:  20,
  healing_potion: 8,
}

// ── Equipment max durability ─────────────────────────────
export const EQUIPMENT_DURABILITY = {
  stone_blade:   50,
  wooden_shield: 40,
}

// ── Recipe definitions ──────────────────────────────────
export const RECIPES = [
  {
    id: 'wooden_shield',
    label: 'Wooden Shield',
    slot: SLOT_ARMOR,
    materials: { wood: 2 },
    stats: { maxHpBonus: 15 },
  },
  {
    id: 'stone_blade',
    label: 'Stone Blade',
    slot: SLOT_WEAPON,
    materials: { wood: 1, stone: 2 },
    stats: { atkBonus: 8 },
  },
  {
    id: 'healing_potion',
    label: 'Healing Potion',
    slot: null, // consumable
    materials: { herb: 2 },
    stats: { healAmount: 40 },
  },
]

// ── Equipment defs for UI lookup ────────────────────────
export const EQUIPMENT_DEFS = {
  wooden_shield: { label: 'Wooden Shield', slot: SLOT_ARMOR, maxHpBonus: 15 },
  stone_blade:   { label: 'Stone Blade',   slot: SLOT_WEAPON, atkBonus: 8 },
}

// ── Craftable item types (for inventory identification) ──
const EQUIPPABLE = { stone_blade: SLOT_WEAPON, wooden_shield: SLOT_ARMOR }
const CONSUMABLE = { healing_potion: true }

// ── Count materials in inventory ────────────────────────
export function countMaterials(inventory) {
  const counts = {}
  for (let i = 0; i < inventory.length; i++) {
    const t = inventory[i].type
    counts[t] = (counts[t] || 0) + 1
  }
  return counts
}

// ── Can this recipe be crafted? ─────────────────────────
export function canCraft(inventory, recipe) {
  const counts = countMaterials(inventory)
  for (const [mat, needed] of Object.entries(recipe.materials)) {
    if ((counts[mat] || 0) < needed) return false
  }
  return true
}

// ── What materials are still missing for a recipe? ───────
export function getMissingMaterials(inventory, recipe) {
  const counts = countMaterials(inventory)
  const missing = {}
  for (const [mat, needed] of Object.entries(recipe.materials)) {
    const have = counts[mat] || 0
    if (have < needed) missing[mat] = needed - have
  }
  return missing
}

// ── Best recipe goal for a creature (craftable or closest) ──
export function getBestGoalRecipe(c) {
  const counts = countMaterials(c.inventory)
  const hasWeapon = !!c.equipment?.weapon
  const hasArmor = !!c.equipment?.armor
  const hpRatio = c.hp / Math.max(c.maxHp, 1)

  const evaluated = []
  for (const recipe of RECIPES) {
    const missing = getMissingMaterials(c.inventory, recipe)
    const craftableNow = Object.keys(missing).length === 0

    // Skip equipment we already have — UNLESS durability is low
    const weaponLowDur = hasWeapon && c.equipment.weapon.durability !== undefined
      && (c.equipment.weapon.durability / c.equipment.weapon.maxDurability) < 0.30
    const armorLowDur = hasArmor && c.equipment.armor.durability !== undefined
      && (c.equipment.armor.durability / c.equipment.armor.maxDurability) < 0.30
    if (recipe.slot === SLOT_WEAPON && hasWeapon && !weaponLowDur) continue
    if (recipe.slot === SLOT_ARMOR && hasArmor && !armorLowDur) continue
    // Potions are ALWAYS worth crafting — they're survival items for later

    // Completion ratio
    let totalNeeded = 0, totalHave = 0
    for (const [mat, needed] of Object.entries(recipe.materials)) {
      totalNeeded += needed
      totalHave += Math.min(counts[mat] || 0, needed)
    }
    const completionRatio = totalHave / Math.max(totalNeeded, 1)

    let priority = completionRatio * 50
    if (craftableNow) priority += 100
    // Potions: always worth crafting, higher priority when hurt
    if (recipe.id === 'healing_potion' && craftableNow) priority += 10 // base craft bonus
    if (recipe.id === 'healing_potion' && hpRatio < 0.7) priority += 40
    if (recipe.id === 'healing_potion' && hpRatio < 0.5) priority += 30
    if (recipe.slot === SLOT_WEAPON && !hasWeapon) priority += 20
    if (recipe.slot === SLOT_ARMOR && !hasArmor) priority += 15
    // Priority boost for replacing degraded equipment
    if (recipe.slot === SLOT_WEAPON && weaponLowDur) priority += 35
    if (recipe.slot === SLOT_ARMOR && armorLowDur) priority += 30

    const p = c.personality
    if ((p === 'fierce' || p === 'bold') && recipe.slot === SLOT_WEAPON) priority += 10
    if ((p === 'timid' || p === 'gentle') && recipe.slot === SLOT_ARMOR) priority += 10
    if ((p === 'timid' || p === 'gentle') && recipe.id === 'healing_potion') priority += 5

    evaluated.push({ recipe, missing, craftableNow, priority, completionRatio })
  }

  if (evaluated.length === 0) return null
  evaluated.sort((a, b) => b.priority - a.priority)
  return evaluated[0]
}

// ── Total materials consumed by a recipe ────────────────
function totalMaterialCount(recipe) {
  let n = 0
  for (const v of Object.values(recipe.materials)) n += v
  return n
}

// ── Remove materials from inventory (mutates) ───────────
export function consumeMaterials(inventory, recipe) {
  for (const [mat, needed] of Object.entries(recipe.materials)) {
    let removed = 0
    for (let i = inventory.length - 1; i >= 0 && removed < needed; i--) {
      if (inventory[i].type === mat) {
        inventory.splice(i, 1)
        removed++
      }
    }
  }
}

// ── Equip a weapon or armor from inventory ──────────────
function equipItem(c, invIdx) {
  const item = c.inventory[invIdx]
  if (!item) return false
  const slot = EQUIPPABLE[item.type]
  if (!slot) return false
  if (!c.equipment) c.equipment = { weapon: null, armor: null }

  const recipe = RECIPES.find(r => r.id === item.type)
  if (!recipe) return false

  // Remove from inventory
  c.inventory.splice(invIdx, 1)

  if (slot === SLOT_WEAPON) {
    if (c.equipment.weapon) {
      c.atk -= c.equipment.weapon.atkBonus || 0
    }
    const maxDur = EQUIPMENT_DURABILITY[recipe.id] || 50
    c.equipment.weapon = { id: recipe.id, atkBonus: recipe.stats.atkBonus, durability: maxDur, maxDurability: maxDur }
    c.atk += recipe.stats.atkBonus
  } else {
    if (c.equipment.armor) {
      c.maxHp -= c.equipment.armor.maxHpBonus || 0
      c.hp = Math.min(c.hp, c.maxHp)
    }
    const maxDur = EQUIPMENT_DURABILITY[recipe.id] || 40
    c.equipment.armor = { id: recipe.id, maxHpBonus: recipe.stats.maxHpBonus, durability: maxDur, maxDurability: maxDur }
    c.maxHp += recipe.stats.maxHpBonus
    c.hp = Math.min(c.maxHp, c.hp + recipe.stats.maxHpBonus)
  }
  return true
}

// ── Break equipment — remove bonuses and clear slot ─────
export function breakEquipment(c, slot) {
  if (!c.equipment) return
  const equip = c.equipment[slot]
  if (!equip) return

  if (slot === 'weapon') {
    c.atk -= equip.atkBonus || 0
  } else if (slot === 'armor') {
    c.maxHp -= equip.maxHpBonus || 0
    c.hp = Math.min(c.hp, c.maxHp)
  }

  c.equipment[slot] = null
}

// ── Use a potion from inventory ─────────────────────────
function usePotion(c, invIdx) {
  const item = c.inventory[invIdx]
  if (!item || !CONSUMABLE[item.type]) return false

  const recipe = RECIPES.find(r => r.id === item.type)
  if (!recipe) return false

  c.inventory.splice(invIdx, 1)
  c.hp = Math.min(c.maxHp, c.hp + recipe.stats.healAmount)
  c.justUsedPotion = { healAmount: recipe.stats.healAmount }
  return true
}

// ── Auto-equip: scan inventory and equip weapons/armor ───
// Only equips if the slot is empty or the new item is strictly better.
// Duplicates and equal/worse items stay in inventory.
export function autoEquip(c) {
  if (!c.equipment) c.equipment = { weapon: null, armor: null }
  for (let i = c.inventory.length - 1; i >= 0; i--) {
    const itemType = c.inventory[i].type
    const slot = EQUIPPABLE[itemType]
    if (!slot) continue

    const recipe = RECIPES.find(r => r.id === itemType)
    if (!recipe) continue

    const current = c.equipment[slot]
    if (!current) {
      // Slot empty — equip
      equipItem(c, i)
    } else if (current.durability !== undefined && current.durability < 5) {
      // Current item nearly broken — replace even with same type
      equipItem(c, i)
    } else if (current.id !== itemType) {
      // Different item — only equip if strictly better
      if (slot === SLOT_WEAPON && recipe.stats.atkBonus > (current.atkBonus || 0)) {
        equipItem(c, i)
      } else if (slot === SLOT_ARMOR && recipe.stats.maxHpBonus > (current.maxHpBonus || 0)) {
        equipItem(c, i)
      }
      // else: worse or equal — leave in inventory
    }
    // same item id (duplicate) — leave in inventory
  }
}

// ── Auto-use potions when hurt (timed — 3-4 second drinking) ──
export function autoUsePotion(c, dt) {
  // Tick active drinking
  if (c.drinkingPotion) {
    c.potionTimer -= dt
    // Gradual healing
    const healThisTick = (c.potionHealTotal / c.potionDuration) * dt
    c.potionHealedSoFar += healThisTick
    c.hp = Math.min(c.maxHp, c.hp + healThisTick)

    if (c.potionTimer <= 0) {
      // Done drinking
      const actualHealed = Math.round(c.potionHealedSoFar)
      c.justUsedPotion = { healAmount: actualHealed }
      c.drinkingPotion = false
      c.potionTimer = 0
      c.potionDuration = 0
      c.moving = false
    }
    return
  }

  // Start drinking if hurt enough
  if (c.hp >= c.maxHp * 0.5) return

  for (let i = c.inventory.length - 1; i >= 0; i--) {
    if (CONSUMABLE[c.inventory[i].type]) {
      _startDrinkingPotion(c, i)
      return
    }
  }
}

function _startDrinkingPotion(c, invIdx) {
  const item = c.inventory[invIdx]
  if (!item || !CONSUMABLE[item.type]) return

  const recipe = RECIPES.find(r => r.id === item.type)
  if (!recipe) return

  c.inventory.splice(invIdx, 1) // Consume potion from inventory
  const duration = 3 + Math.random() // 3-4 seconds
  c.drinkingPotion = true
  c.potionTimer = duration
  c.potionDuration = duration
  c.potionHealTotal = recipe.stats.healAmount
  c.potionHealedSoFar = 0
  c.moving = false
  c.potionStarted = { healAmount: recipe.stats.healAmount }
}

// ── Interrupt potion drinking (combat) — potion is wasted ──
export function interruptPotion(c) {
  if (!c.drinkingPotion) return
  c.drinkingPotion = false
  c.potionTimer = 0
  c.potionDuration = 0
  c.potionHealTotal = 0
  c.potionHealedSoFar = 0
}

// ── Choose best recipe for this creature ────────────────
export function chooseCraftRecipe(c) {
  // Potion if hurt
  if (c.hp < c.maxHp * 0.7) {
    const potion = RECIPES.find(r => r.id === 'healing_potion')
    if (canCraft(c.inventory, potion)) return potion
  }

  // Build craftable list (equipment only)
  const craftable = RECIPES.filter(r => r.slot !== null && canCraft(c.inventory, r))
  if (craftable.length === 0) {
    // No equipment to craft — craft potions as survival stockpile
    const potion = RECIPES.find(r => r.id === 'healing_potion')
    if (canCraft(c.inventory, potion)) return potion
    return null
  }

  const p = c.personality
  const hasWeapon = !!c.equipment?.weapon
  const hasArmor = !!c.equipment?.armor
  const needsWeapon = !hasWeapon || (hasWeapon && c.equipment.weapon.durability !== undefined
    && (c.equipment.weapon.durability / c.equipment.weapon.maxDurability) < 0.30)
  const needsArmor = !hasArmor || (hasArmor && c.equipment.armor.durability !== undefined
    && (c.equipment.armor.durability / c.equipment.armor.maxDurability) < 0.30)

  if ((p === 'fierce' || p === 'bold') && needsWeapon) {
    const weapon = craftable.find(r => r.slot === SLOT_WEAPON)
    if (weapon) return weapon
  }
  if ((p === 'timid' || p === 'gentle') && needsArmor) {
    const armor = craftable.find(r => r.slot === SLOT_ARMOR)
    if (armor) return armor
  }

  if (needsWeapon) {
    const weapon = craftable.find(r => r.slot === SLOT_WEAPON)
    if (weapon) return weapon
  }
  if (needsArmor) {
    const armor = craftable.find(r => r.slot === SLOT_ARMOR)
    if (armor) return armor
  }

  return craftable[0] || null
}

// ── Start timed crafting ─────────────────────────────────
// Consumes materials and energy, sets crafting state. Item is NOT created yet.
export function startCraft(c) {
  const recipe = chooseCraftRecipe(c)
  if (!recipe) return { started: false }

  // Energy check
  const energyCost = CRAFT_ENERGY[recipe.id] || 10
  if (c.energy < energyCost) return { started: false }

  // Slot check: removing N materials, adding 1 item
  const matCount = totalMaterialCount(recipe)
  const netSlots = c.inventory.length - matCount + 1
  if (netSlots > MAX_INVENTORY) return { started: false }

  // Consume materials and energy
  consumeMaterials(c.inventory, recipe)
  c.energy -= energyCost

  // Set crafting state
  const [minDur, maxDur] = CRAFT_DURATIONS[recipe.id] || [10, 15]
  const duration = minDur + Math.random() * (maxDur - minDur)
  c.crafting = true
  c.craftTimer = duration
  c.craftDuration = duration
  c.craftRecipe = recipe

  return { started: true, recipe }
}

// ── Complete crafting — called when timer reaches 0 ──────
export function completeCraft(c) {
  if (!c.craftRecipe) return
  const recipe = c.craftRecipe

  c.inventory.push({ type: recipe.id })
  c.justCrafted = { recipe }

  c.crafting = false
  c.craftTimer = 0
  c.craftDuration = 0
  c.craftRecipe = null
}

// ── Interrupt crafting — returns materials, no item created ──
export function interruptCraft(c) {
  if (!c.crafting || !c.craftRecipe) return
  const recipe = c.craftRecipe

  // Return consumed materials to inventory
  for (const [mat, qty] of Object.entries(recipe.materials)) {
    for (let i = 0; i < qty; i++) {
      c.inventory.push({ type: mat })
    }
  }
  // Return energy (partial — 50% refund)
  const energyCost = CRAFT_ENERGY[recipe.id] || 10
  c.energy = Math.min(100, c.energy + energyCost * 0.5)

  c.crafting = false
  c.craftTimer = 0
  c.craftDuration = 0
  c.craftRecipe = null
}

// ── Legacy wrapper (kept for compatibility) ──────────────
export function tryAutoCraft(c) {
  return startCraft(c)
}
