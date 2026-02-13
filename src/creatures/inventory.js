import { evaluateDrop, recordDecision } from './scoring'
import { trackGather, getMaxInventory } from './village'

export const MAX_INVENTORY = 12

export const ITEM_DEFS = {
  wood:            { label: 'Wood' },
  stone:           { label: 'Stone' },
  herb:            { label: 'Herb' },
  crystal:         { label: 'Crystal' },
  berry:           { label: 'Wild Berry' },
  stone_blade:     { label: 'Stone Blade' },
  wooden_shield:   { label: 'Wooden Shield' },
  healing_potion:  { label: 'Healing Potion' },
}

const PICKUP_CHANCES = {
  sneaky: 0.55,
  curious: 0.45,
  timid: 0.35,
  gentle: 0.35,
  loyal: 0.30,
  lazy: 0.25,
  bold: 0,
  fierce: 0,
}

export function getPickupChance(personality) {
  return PICKUP_CHANCES[personality] ?? 0.30
}

export function countItemsByType(c, type) {
  let n = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === type) n++
  }
  return n
}

export function tryPickupBerry(c) {
  if (c.inventory.length >= getMaxInventory(c)) return false
  if (Math.random() >= getPickupChance(c.personality)) return false
  c.inventory.push({ type: 'berry', hungerRestore: 60 })
  trackGather(c, 1)
  return true
}

export function trySmartPickup(c, itemType, speciesMemory) {
  if (c.inventory.length < getMaxInventory(c)) {
    c.inventory.push({ type: itemType })
    return { picked: true, dropped: null }
  }

  const result = evaluateDrop(c, itemType, speciesMemory)
  if (result.shouldDrop) {
    const droppedItem = c.inventory.splice(result.dropIndex, 1)[0]
    c.inventory.push({ type: itemType })
    recordDecision(c, droppedItem.type, itemType)
    return {
      picked: true,
      dropped: {
        type: droppedItem.type,
        x: c.x,
        z: c.z,
        reason: result.reason,
      },
    }
  }

  return { picked: false, dropped: null }
}

export function eatFromInventory(c) {
  const idx = c.inventory.findIndex(item => item.type === 'berry')
  if (idx === -1) return false
  const item = c.inventory.splice(idx, 1)[0]
  const hungerBefore = c.hunger
  c.hunger = Math.min(100, c.hunger + item.hungerRestore)
  c.lastHungerGain = Math.round(c.hunger - hungerBefore)
  c.ateFromInventory = true
  return true
}
