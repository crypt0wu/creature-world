import { interruptCraft } from '../crafting'

export function updateEnergy(c, spec, dt) {
  if (!c.alive) return

  // ── While sleeping: regen energy + HP, count down timer, wake when done ──
  if (c.sleeping) {
    c.energy = Math.min(100, c.energy + 4.0 * dt)
    c.hp = Math.min(c.maxHp, c.hp + 0.5 * dt)
    c.sleepTimer -= dt

    if (c.sleepTimer <= 0) {
      c.sleeping = false
      c.vulnerable = false
      c.sleepTimer = 0
    }
    return
  }

  // ── Drain: base + 50% bonus when moving + speed-proportional bonus ──
  let drain = spec.energyDrain
  if (c.moving) {
    drain *= 1.5
    drain += (c.currentSpeed / Math.max(c.baseSpd, 0.1)) * spec.energyDrain * 0.5
  }
  c.energy = Math.max(0, c.energy - dt * drain)

  // ── Tired (energy < 25): reduce spd proportionally (50%–100% of baseSpd) ──
  if (c.energy < 25) {
    const t = c.energy / 25 // 0 at 0 energy, 1 at 25 energy
    c.spd = c.baseSpd * (0.5 + t * 0.5) // 50% at 0, 100% at 25
  } else {
    c.spd = c.baseSpd
  }

  // ── Sleep trigger: personality-based threshold ──
  let sleepThreshold = 10
  if (c.personality === 'lazy') sleepThreshold = 20
  else if (c.personality === 'fierce') sleepThreshold = 3

  if (c.energy < sleepThreshold) {
    // Cancel crafting before sleeping — return materials
    if (c.crafting) interruptCraft(c)

    c.sleeping = true
    c.moving = false
    c.seekingFood = false
    c.vulnerable = true

    // Duration: 15–30s (lazy: 20–40s, fierce: 10–20s)
    let minDur = 15, maxDur = 30
    if (c.personality === 'lazy') { minDur = 20; maxDur = 40 }
    else if (c.personality === 'fierce') { minDur = 10; maxDur = 20 }

    c.sleepDuration = minDur + Math.random() * (maxDur - minDur)
    c.sleepTimer = c.sleepDuration
  }
}
