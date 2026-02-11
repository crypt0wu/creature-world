import { RECIPES, countMaterials } from './crafting'

// ── Base item values ────────────────────────────────────
const BASE_VALUE = {
  wood: 20, stone: 25, herb: 30, berry: 40, crystal: 80,
}

// ── Which materials map to which equipment category ─────
const WEAPON_MATS = ['stone']
const DEFENSE_MATS = ['wood']

// ── Personality scoring modifiers ───────────────────────
const PERSONALITY_MODS = {
  fierce:  { weapon_mat: 1.4, defense_mat: 0.7 },
  bold:    { weapon_mat: 1.3, defense_mat: 0.8 },
  timid:   { weapon_mat: 0.7, defense_mat: 1.4 },
  gentle:  { weapon_mat: 0.8, defense_mat: 1.3 },
  curious: { crystal: 1.3 },
  sneaky:  { herb: 1.2 },
  lazy:    { berry: 1.3 },
  loyal:   {},
}

// ── Score a single item for a creature ──────────────────
export function scoreItem(itemType, c, speciesMemory) {
  let score = BASE_VALUE[itemType] || 10

  // 1. HP context: herbs → can craft healing potion
  if (itemType === 'herb') {
    const hpRatio = c.hp / Math.max(c.maxHp, 1)
    if (hpRatio < 0.5) score += 30 * (1 - hpRatio)
    else if (hpRatio < 0.7) score += 10
  }

  // 2. Hunger context: berries are food
  if (itemType === 'berry') {
    if (c.hunger < 30) score += 35 * (1 - c.hunger / 30)
    else if (c.hunger < 50) score += 10
  }

  // 3. Recipe completion proximity
  const counts = countMaterials(c.inventory)
  for (const recipe of RECIPES) {
    if (!recipe.materials[itemType]) continue
    let totalNeeded = 0
    let totalHave = 0
    for (const [mat, needed] of Object.entries(recipe.materials)) {
      totalNeeded += needed
      if (mat === itemType) {
        totalHave += Math.min((counts[mat] || 0) + 1, needed)
      } else {
        totalHave += Math.min(counts[mat] || 0, needed)
      }
    }
    score += (totalHave / Math.max(totalNeeded, 1)) * 25
  }

  // 4. Equipment check: deprioritize materials for equipment we have
  //    BUT re-prioritize if durability is low (need replacement)
  if (c.equipment?.weapon && WEAPON_MATS.includes(itemType)) {
    const wpn = c.equipment.weapon
    if (wpn.durability !== undefined && wpn.durability / wpn.maxDurability < 0.30) {
      score *= 1.3
    } else {
      score *= 0.5
    }
  }
  if (c.equipment?.armor && DEFENSE_MATS.includes(itemType)) {
    const arm = c.equipment.armor
    if (arm.durability !== undefined && arm.durability / arm.maxDurability < 0.30) {
      score *= 1.3
    } else {
      score *= 0.5
    }
  }

  // 5. Age/kills modifier
  if (c.kills > 0 || c.age > 300) {
    if (WEAPON_MATS.includes(itemType)) score *= 1.15
  }
  if (c.age < 120) {
    if (itemType === 'berry' || itemType === 'herb') score *= 1.1
  }

  // 6. Personality modifier
  const pmod = PERSONALITY_MODS[c.personality] || {}
  if (pmod[itemType]) score *= pmod[itemType]
  if (pmod.weapon_mat && WEAPON_MATS.includes(itemType)) score *= pmod.weapon_mat
  if (pmod.defense_mat && DEFENSE_MATS.includes(itemType)) score *= pmod.defense_mat

  // 7. Species memory: generational learning
  if (speciesMemory) {
    const mem = speciesMemory[c.species]
    if (mem) {
      if (mem.starvation > 0 && (itemType === 'berry' || itemType === 'herb')) {
        score += Math.min(20, mem.starvation * 5)
      }
      if (mem.lowHp > 0 && WEAPON_MATS.includes(itemType)) {
        score += Math.min(15, mem.lowHp * 5)
      }
    }
  }

  // 8. Strategy memory: personal experience
  if (c.strategyMemory && c.strategyMemory.length > 0) {
    let successes = 0
    let total = 0
    for (const m of c.strategyMemory) {
      if (m.keptType === itemType) {
        total++
        if (m.useful) successes++
      }
    }
    if (total > 0) {
      score += (successes / total - 0.5) * 20
    }
  }

  return Math.max(0, Math.round(score))
}

// ── Evaluate whether to drop an item for a new one ──────
export function evaluateDrop(c, newItemType, speciesMemory) {
  const newScore = scoreItem(newItemType, c, speciesMemory)

  let lowestScore = Infinity
  let lowestIdx = -1
  for (let i = 0; i < c.inventory.length; i++) {
    const s = scoreItem(c.inventory[i].type, c, speciesMemory)
    if (s < lowestScore) {
      lowestScore = s
      lowestIdx = i
    }
  }

  if (lowestIdx >= 0 && newScore > lowestScore + 5) {
    const droppedType = c.inventory[lowestIdx].type
    return {
      shouldDrop: true,
      dropIndex: lowestIdx,
      droppedType,
      newScore,
      lowestScore,
      reason: _getDropReason(newItemType, c),
    }
  }

  return { shouldDrop: false }
}

function _getDropReason(newItemType, c) {
  if (newItemType === 'crystal') return 'rare materials'
  if (newItemType === 'berry' && c.hunger < 30) return 'survival (hungry)'
  if (newItemType === 'herb' && c.hp < c.maxHp * 0.6) return 'healing materials'

  const counts = countMaterials(c.inventory)
  if (newItemType === 'stone' && (counts.stone || 0) >= 1 && (counts.wood || 0) >= 1) {
    return 'completing stone blade recipe'
  }
  if (newItemType === 'wood' && (counts.wood || 0) >= 1) {
    return 'completing wooden shield recipe'
  }

  return 'better value'
}

// ── Pre-gather check: would gathering this resource be useful? ──
const RESOURCE_TO_ITEM = { tree: 'wood', rock: 'stone', bush: 'herb' }

export function wouldGatherBeUseful(c, resourceType, speciesMemory) {
  if (c.inventory.length < 8) return true

  const primaryItem = RESOURCE_TO_ITEM[resourceType]
  if (!primaryItem) return false

  const primaryScore = scoreItem(primaryItem, c, speciesMemory)

  let lowestScore = Infinity
  for (let i = 0; i < c.inventory.length; i++) {
    const s = scoreItem(c.inventory[i].type, c, speciesMemory)
    if (s < lowestScore) lowestScore = s
  }

  if (primaryScore > lowestScore + 5) return true

  // Rocks can also yield crystals (12% chance, high value)
  if (resourceType === 'rock') {
    const crystalScore = scoreItem('crystal', c, speciesMemory)
    if (crystalScore > lowestScore + 5) return true
  }

  return false
}

// ── Species memory: generational learning ───────────────
export function recordDeath(c, speciesMemory) {
  if (!speciesMemory) return
  if (!speciesMemory[c.species]) {
    speciesMemory[c.species] = { starvation: 0, lowHp: 0 }
  }
  if (c.hunger <= 0) {
    speciesMemory[c.species].starvation++
  } else {
    speciesMemory[c.species].lowHp++
  }
}

// ── Strategy memory: per-creature decision tracking ─────
export function recordDecision(c, droppedType, keptType) {
  if (!c.strategyMemory) c.strategyMemory = []
  c.strategyMemory.push({ droppedType, keptType, useful: false, time: c.age })
  if (c.strategyMemory.length > 6) c.strategyMemory.shift()
}

export function markDecisionUseful(c, usedType) {
  if (!c.strategyMemory) return
  for (let i = c.strategyMemory.length - 1; i >= 0; i--) {
    if (c.strategyMemory[i].keptType === usedType && !c.strategyMemory[i].useful) {
      c.strategyMemory[i].useful = true
      break
    }
  }
}
