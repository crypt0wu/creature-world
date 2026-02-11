export const MAX_INVENTORY = 5

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

export function tryPickupBerry(c) {
  if (c.inventory.length >= MAX_INVENTORY) return false
  if (Math.random() >= getPickupChance(c.personality)) return false
  c.inventory.push({ type: 'berry', hungerRestore: 60 })
  return true
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
