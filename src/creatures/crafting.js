import { MAX_INVENTORY } from './inventory'

// ── Equipment slots ──────────────────────────────────────
export const SLOT_WEAPON = 'weapon'
export const SLOT_ARMOR = 'armor'

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
    c.equipment.weapon = { id: recipe.id, atkBonus: recipe.stats.atkBonus }
    c.atk += recipe.stats.atkBonus
  } else {
    if (c.equipment.armor) {
      c.maxHp -= c.equipment.armor.maxHpBonus || 0
      c.hp = Math.min(c.hp, c.maxHp)
    }
    c.equipment.armor = { id: recipe.id, maxHpBonus: recipe.stats.maxHpBonus }
    c.maxHp += recipe.stats.maxHpBonus
    c.hp = Math.min(c.maxHp, c.hp + recipe.stats.maxHpBonus)
  }
  return true
}

// ── Use a potion from inventory ─────────────────────────
function usePotion(c, invIdx) {
  const item = c.inventory[invIdx]
  if (!item || !CONSUMABLE[item.type]) return false

  const recipe = RECIPES.find(r => r.id === item.type)
  if (!recipe) return false

  c.inventory.splice(invIdx, 1)
  c.hp = Math.min(c.maxHp, c.hp + recipe.stats.healAmount)
  c.justUsedPotion = true
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

// ── Auto-use potions when hurt ──────────────────────────
export function autoUsePotion(c) {
  if (c.hp >= c.maxHp * 0.5) return
  for (let i = c.inventory.length - 1; i >= 0; i--) {
    if (CONSUMABLE[c.inventory[i].type]) {
      usePotion(c, i)
      return
    }
  }
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
    // Try potion even if not hurt
    const potion = RECIPES.find(r => r.id === 'healing_potion')
    if (canCraft(c.inventory, potion) && c.hp < c.maxHp) return potion
    return null
  }

  const p = c.personality
  const hasWeapon = !!c.equipment?.weapon
  const hasArmor = !!c.equipment?.armor

  if ((p === 'fierce' || p === 'bold') && !hasWeapon) {
    const weapon = craftable.find(r => r.slot === SLOT_WEAPON)
    if (weapon) return weapon
  }
  if ((p === 'timid' || p === 'gentle') && !hasArmor) {
    const armor = craftable.find(r => r.slot === SLOT_ARMOR)
    if (armor) return armor
  }

  if (!hasWeapon) {
    const weapon = craftable.find(r => r.slot === SLOT_WEAPON)
    if (weapon) return weapon
  }
  if (!hasArmor) {
    const armor = craftable.find(r => r.slot === SLOT_ARMOR)
    if (armor) return armor
  }

  return craftable[0] || null
}

// ── Attempt auto-craft ──────────────────────────────────
// Consumes materials, adds crafted item to inventory.
// Only crafts if net slot count stays within MAX_INVENTORY.
export function tryAutoCraft(c) {
  const recipe = chooseCraftRecipe(c)
  if (!recipe) return { crafted: false }

  // Slot check: removing N materials, adding 1 item
  const matCount = totalMaterialCount(recipe)
  const netSlots = c.inventory.length - matCount + 1
  if (netSlots > MAX_INVENTORY) return { crafted: false }

  consumeMaterials(c.inventory, recipe)
  c.inventory.push({ type: recipe.id })
  c.justCrafted = { recipe }

  return { crafted: true, recipe }
}
