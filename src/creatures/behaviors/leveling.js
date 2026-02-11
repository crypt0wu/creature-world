// Leveling system — XP thresholds and stat gains

export function checkLevelUp(c, spec) {
  const xpNeeded = c.level * 100

  if (c.xp >= xpNeeded) {
    c.level++
    c.xp -= xpNeeded
    c.maxHp += Math.floor(spec.baseHp * 0.1)
    c.hp = Math.min(c.hp + 10, c.maxHp)
    c.atk += Math.floor(spec.baseAtk * 0.05) + 1
    return true
  }
  return false
}
