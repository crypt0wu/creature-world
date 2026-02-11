// Leveling system — XP thresholds, stat gains, max level 10

const MAX_LEVEL = 10

export function checkLevelUp(c, spec) {
  if (!c.alive) return false
  if (c.level >= MAX_LEVEL) return false

  const xpNeeded = c.level * 30

  if (c.xp >= xpNeeded) {
    c.level++
    c.xp -= xpNeeded

    // Stat gains: +10 max HP, +2 ATK, +1 SPD
    c.maxHp += 10
    c.hp = Math.min(c.maxHp, c.hp + 10) // heal 10 on level up
    c.atk += 2
    c.spd += 1
    c.baseSpd += 1

    // Set visual flag for level-up effect
    c.justLeveledUp = {
      newLevel: c.level,
      hpGain: 10,
      atkGain: 2,
      spdGain: 1,
    }

    return true
  }
  return false
}
