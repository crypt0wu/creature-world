// ── Simple combat system ──────────────────────────────────────
// Two creatures close → fight → hit every 2s → flee check → done
// Max 4 hits per creature (8 total), then both walk away

import { interruptCraft, breakEquipment, EQUIPMENT_DEFS, interruptPotion } from '../crafting'

// Type advantage (attacker type → defender type = 1.5x)
const TYPE_ADVANTAGE = {
  fire: 'grass', grass: 'water', water: 'fire',
  electric: 'water', dark: 'electric', ice: 'fire',
}

// Constants
const ENGAGE_RADIUS = 12
const COMBAT_RADIUS = 3.5
const HIT_INTERVAL = 2.0
const MAX_HITS = 4             // per creature → 8 total
const COMBAT_COOLDOWN = 60
const FLEE_SPRINT = 12.0
const SCARED_TIME = 30
const HARD_TIMEOUT = 30        // safety net
const CHASE_DURATION = 8.0     // max chase time
const FLEE_MIN_DIST = 35       // must be this far before stopping

// Species type lookup
const SPECIES_TYPES = {
  Embrix: 'fire', Aqualis: 'water', Verdox: 'grass',
  Voltik: 'electric', Shadeyn: 'dark', Glacira: 'ice',
}

function getType(c) { return SPECIES_TYPES[c.species] || 'fire' }

// ── Flee roll: simple HP thresholds, no modifiers ──
function rollFlee(c) {
  const pct = c.hp / c.maxHp
  let chance
  if (pct > 0.60) chance = 0        // healthy = fight
  else if (pct > 0.40) chance = 0.20
  else if (pct > 0.20) chance = 0.50
  else chance = 0.75

  const roll = Math.random()
  const fled = roll < chance
  console.log(
    `[FLEE] ${c.name} HP:${c.hp}/${c.maxHp} (${Math.round(pct * 100)}%) ` +
    `chance:${Math.round(chance * 100)}% roll:${Math.round(roll * 100)} → ${fled ? 'FLED!' : 'stays'}`
  )
  return fled
}

// ── Damage: ATK × random(0.8–1.2) × type bonus, minus armor ──
function calcDamage(attacker, defender) {
  const base = attacker.atk * (0.8 + Math.random() * 0.4)
  const superEff = TYPE_ADVANTAGE[getType(attacker)] === getType(defender)
  let dmg = base * (superEff ? 1.5 : 1.0)
  if (defender.equipment?.armor) {
    dmg = Math.max(1, dmg - defender.equipment.armor.maxHpBonus * 0.3)
  }
  return { damage: Math.round(dmg), superEff }
}

// ── Equipment durability tick ──
function tickDurability(c, slot, minLoss, maxLoss) {
  const eq = c.equipment?.[slot]
  if (!eq || eq.durability === undefined) return
  eq.durability = Math.max(0, eq.durability - (minLoss + Math.floor(Math.random() * (maxLoss - minLoss + 1))))
  if (eq.durability <= 0) {
    const def = EQUIPMENT_DEFS[eq.id]
    c.equipmentBroke = { itemLabel: def?.label || eq.id, slot }
    breakEquipment(c, slot)
  } else if (eq.durability / eq.maxDurability <= 0.25 && !c.equipmentLow) {
    const def = EQUIPMENT_DEFS[eq.id]
    c.equipmentLow = { itemLabel: def?.label || eq.id, slot }
  }
}

// ── Interrupt any activity ──
function interruptActivity(c) {
  if (c.sleeping) { c.sleeping = false; c.sleepTimer = 0; c.vulnerable = false }
  if (c.eating) { c.eating = false; c.eatTimer = 0; c.seekingFood = false; c.targetFoodIdx = -1 }
  if (c.drinkingPotion) interruptPotion(c)
  if (c.crafting) interruptCraft(c)
  if (c.gathering) {
    c.gathering = false; c.gatherTimer = 0; c.gatherDuration = 0
    c.seekingResource = false; c.targetResourceIdx = -1; c.targetResourceType = ''; c._gatherGoal = null
  }
  if (c.seekingResource) { c.seekingResource = false; c.targetResourceIdx = -1; c.targetResourceType = ''; c._gatherGoal = null }
  if (c.seekingFood) { c.seekingFood = false; c.targetFoodIdx = -1 }
}

// ── End combat for one creature ──
function endCombat(c) {
  c.inCombat = false
  c._combatTarget = null
  c._hitTimer = 0
  c._combatTurns = 0
  c._combatDuration = 0
  if (!c._combatCooldown || c._combatCooldown <= 0) c._combatCooldown = COMBAT_COOLDOWN
}

// ── Execute flee: sprint away, end combat for both, evaluate chase ──
function doFlee(runner, opponent, allCreatures) {
  console.log(`[COMBAT] ${runner.name} FLEES from ${opponent.name}!`)
  runner.xp += 5
  runner.combatFled = { hp: runner.hp, maxHp: runner.maxHp, opponentName: opponent.name }
  runner._scaredTimer = SCARED_TIME
  runner._fleeSprint = FLEE_SPRINT
  runner._fleeMinDist = FLEE_MIN_DIST
  runner._scaredOfId = opponent.id
  runner._fleeFromX = runner.x
  runner._fleeFromZ = runner.z

  endCombat(runner)
  endCombat(opponent)
  runner._combatCooldown = SCARED_TIME
  opponent._combatCooldown = SCARED_TIME / 2

  // Sprint 35 units away from opponent
  const dx = opponent.x - runner.x, dz = opponent.z - runner.z
  const dist = Math.sqrt(dx * dx + dz * dz) || 1
  runner.targetX = runner.x - (dx / dist) * 35
  runner.targetZ = runner.z - (dz / dist) * 35
  runner.moving = true

  // Winner evaluates whether to chase
  evaluateChase(opponent, runner, allCreatures)
}

// ── Chase decision: simple personality roll ──
function evaluateChase(winner, runner, allCreatures) {
  // Only chase if HP > 40%
  if (winner.hp < winner.maxHp * 0.40) {
    console.log(`[CHASE] ${winner.name} too hurt to chase (HP ${Math.round(winner.hp / winner.maxHp * 100)}%)`)
    return
  }

  // Personality-based chance: fierce/bold 70%, sneaky 50%, everyone else 25%
  const p = winner.personality
  let chance = 0.25
  if (p === 'fierce' || p === 'bold') chance = 0.70
  else if (p === 'sneaky') chance = 0.50

  // Low HP prey — smell blood
  const preyPct = runner.hp / runner.maxHp
  let goingForKill = false
  if (preyPct < 0.15) {
    chance = 0.90  // override — almost dead, everyone chases
    goingForKill = true
  } else if (preyPct < 0.25) {
    chance = Math.min(chance + 0.30, 0.95)
    goingForKill = true
  } else if (preyPct < 0.35) {
    chance += 0.15
  }

  const roll = Math.random()
  console.log(`[CHASE] ${winner.name} (${p}) chase roll: ${Math.round(roll * 100)} vs ${Math.round(chance * 100)}%${goingForKill ? ' (BLOOD!)' : ''} → ${roll < chance ? 'CHASE!' : 'no chase'}`)

  if (roll >= chance) return

  // START CHASE
  if (goingForKill) {
    console.log(`${winner.name} is going for the kill on ${runner.name}!`)
  } else {
    console.log(`CHASE TRIGGERED: ${winner.name} chasing ${runner.name}!`)
  }
  winner._chasing = true
  winner._chaseTargetId = runner.id
  winner._chaseTimer = CHASE_DURATION
  winner._chaseGoingForKill = goingForKill
  winner._combatCooldown = 0
  winner.combatChaseStarted = { targetName: runner.name, goingForKill }
  winner.targetX = runner.x
  winner.targetZ = runner.z
  winner.moving = true
}

// ── End chase state ──
function _endChase(c) {
  c._chasing = false
  c._chaseTargetId = null
  c._chaseTimer = 0
  c._chaseGoingForKill = false
  c._combatCooldown = COMBAT_COOLDOWN
}

// ══════════════════════════════════════════════════════════════
// MAIN UPDATE — called every frame for every creature
// ══════════════════════════════════════════════════════════════
export function updateCombat(c, allCreatures, spec, dt) {
  if (!c.alive) return

  // Tick timers
  if (c._scaredTimer > 0) { c._scaredTimer -= dt; if (c._scaredTimer <= 0) c._scaredOfId = null }
  if (c._fleeSprint > 0) c._fleeSprint -= dt
  if (c._combatCooldown > 0) c._combatCooldown -= dt

  // Scared: keep running if threat nearby
  if (c._scaredTimer > 0 && c._scaredOfId && !c.inCombat) {
    const threat = allCreatures.find(t => t.id === c._scaredOfId && t.alive)
    if (threat) {
      const tdx = threat.x - c.x, tdz = threat.z - c.z
      const d2 = tdx * tdx + tdz * tdz
      if (d2 < 20 * 20 && c._fleeSprint <= 0) {
        c._fleeSprint = 2.0
        const d = Math.sqrt(d2) || 1
        c.targetX = c.x - (tdx / d) * 30
        c.targetZ = c.z - (tdz / d) * 30
        c.moving = true
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // CHASE UPDATE — pursuer sprints after fleeing creature
  // ══════════════════════════════════════════════════════════
  if (c._chasing && c._chaseTargetId) {
    c._chaseTimer -= dt
    const prey = allCreatures.find(t => t.id === c._chaseTargetId && t.alive)

    // Give up: timer expired or prey gone
    if (!prey || c._chaseTimer <= 0) {
      console.log(`[CHASE] ${c.name} gives up the chase`)
      c.combatChaseGaveUp = { targetName: prey?.name || 'unknown' }
      _endChase(c)
      return
    }

    const dx = prey.x - c.x, dz = prey.z - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // 1-second head start: don't check catch until prey has had time to run
    const elapsed = CHASE_DURATION - c._chaseTimer
    if (elapsed > 1.0 && dist < 3) {
      // Caught! Resume combat
      console.log(`[CHASE] ${c.name} CATCHES ${prey.name}! (dist: ${dist.toFixed(1)}, ${elapsed.toFixed(1)}s in)`)
      c.combatChaseCaught = { targetName: prey.name }
      _endChase(c)
      // Clear prey flee state
      prey._fleeSprint = 0; prey._scaredTimer = 0; prey._fleeMinDist = 0
      // Re-engage combat
      c.inCombat = true; c._combatTarget = prey.id
      c._hitTimer = 0; c._combatTurns = 0; c._combatDuration = 0
      prey.inCombat = true; prey._combatTarget = c.id
      prey._hitTimer = 1.0; prey._combatTurns = 0; prey._combatDuration = 0
      return
    }

    // Sprint toward prey at 1.5x normal speed
    const angle = Math.atan2(dx, dz)
    c.rotY = angle
    const chaseSpd = c.spd * 0.4 * 1.5
    c.x += Math.sin(angle) * chaseSpd * dt
    c.z += Math.cos(angle) * chaseSpd * dt
    c.x = Math.max(-95, Math.min(95, c.x))
    c.z = Math.max(-95, Math.min(95, c.z))
    c.moving = true
    c.targetX = prey.x; c.targetZ = prey.z
    return
  }

  // ══════════════════════════════════════════════════════════
  // IN COMBAT
  // ══════════════════════════════════════════════════════════
  if (c.inCombat && c._combatTarget) {
    const target = allCreatures.find(t => t.id === c._combatTarget)

    // Target gone/dead/fled → end
    if (!target || !target.alive || !target.inCombat) {
      console.log(`[COMBAT] ${c.name}: opponent gone → ending combat`)
      endCombat(c)
      return
    }

    // Hard timeout safety net
    c._combatDuration = (c._combatDuration || 0) + dt
    if (c._combatDuration > HARD_TIMEOUT) {
      console.log(`[COMBAT-TIMEOUT] ${c.name} force-ending after ${HARD_TIMEOUT}s`)
      endCombat(c)
      endCombat(target)
      return
    }

    // Distance to target
    const dx = target.x - c.x, dz = target.z - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Approach if too far
    if (dist > COMBAT_RADIUS) {
      const angle = Math.atan2(dx, dz)
      c.rotY = angle
      c.x += Math.sin(angle) * c.spd * 0.5 * dt
      c.z += Math.cos(angle) * c.spd * 0.5 * dt
      c.moving = true
      // Way too far → give up
      if (dist > ENGAGE_RADIUS * 3) { endCombat(c); return }
    } else {
      c.moving = false
      c.currentSpeed = 0
      c.rotY = Math.atan2(dx, dz)
    }

    // Tick hit timer ALWAYS (even while approaching)
    c._hitTimer = (c._hitTimer || 0) + dt

    // Not in range or timer not ready → wait
    if (dist > COMBAT_RADIUS || c._hitTimer < HIT_INTERVAL) return

    // ── HIT ──────────────────────────────────────────────────
    c._hitTimer = 0
    c._combatTurns = (c._combatTurns || 0) + 1

    // Hit limit → both walk away
    if (c._combatTurns > MAX_HITS) {
      console.log(`[COMBAT] Hit limit! ${c.name} & ${target.name} disengage after ${MAX_HITS} hits each`)
      c.combatFled = { hp: c.hp, maxHp: c.maxHp, opponentName: target.name }
      target.combatFled = { hp: target.hp, maxHp: target.maxHp, opponentName: c.name }
      c.xp += 5; target.xp += 5
      c._scaredTimer = 15; target._scaredTimer = 15
      c._scaredOfId = target.id; target._scaredOfId = c.id
      c._fleeFromX = c.x; c._fleeFromZ = c.z
      target._fleeFromX = target.x; target._fleeFromZ = target.z
      endCombat(c); endCombat(target)
      const d = dist || 1
      c.targetX = c.x - (dx / d) * 15; c.targetZ = c.z - (dz / d) * 15; c.moving = true
      target.targetX = target.x + (dx / d) * 15; target.targetZ = target.z + (dz / d) * 15; target.moving = true
      return
    }

    // Calculate + apply damage
    const { damage, superEff } = calcDamage(c, target)
    target.hp = Math.max(0, target.hp - damage)
    console.log(
      `[COMBAT] ${c.name} hit #${c._combatTurns}/${MAX_HITS} → ${target.name}: ` +
      `${damage} dmg${superEff ? ' (SUPER EFFECTIVE!)' : ''} | HP: ${target.hp}/${target.maxHp}`
    )

    // XP
    c.xp += Math.max(1, Math.floor(damage / 5) * (superEff ? 2 : 1))

    // Equipment durability
    tickDurability(c, 'weapon', 3, 5)
    tickDurability(target, 'armor', 4, 6)

    // Visual flags
    c.combatHitDealt = { damage, isSuperEffective: superEff, targetX: target.x, targetZ: target.z }
    target.combatHitTaken = { damage, isSuperEffective: superEff, fromX: c.x, fromZ: c.z }

    // ── Death check ──
    if (target.hp <= 0) {
      console.log(`[COMBAT] ${target.name} KILLED by ${c.name}!`)
      target.alive = false
      target.state = 'dead'
      target.currentSpeed = 0
      target.inCombat = false
      target._combatTarget = null
      target.deathCause = 'combat'
      target.killedBy = c.name
      c.xp += target.level * 25
      c.kills++
      c._combatCooldown = COMBAT_COOLDOWN

      // Loot
      const looted = []
      const lootN = 1 + (Math.random() < 0.5 ? 1 : 0)
      for (let i = 0; i < lootN && target.inventory.length > 0; i++) {
        if (c.inventory.length >= 8) break
        const li = Math.floor(Math.random() * target.inventory.length)
        const item = target.inventory.splice(li, 1)[0]
        c.inventory.push(item)
        looted.push(item.type)
      }

      c.combatKill = { victimName: target.name, victimSpecies: target.species, xpGain: target.level * 25, looted }
      target.combatDeath = { killerName: c.name, killerSpecies: c.species }
      endCombat(c)
      return
    }

    // ── Flee check: defender just got hit ──
    if (rollFlee(target)) {
      doFlee(target, c, allCreatures)
      return
    }

    return
  }

  // ══════════════════════════════════════════════════════════
  // NOT IN COMBAT — scan for fights
  // ══════════════════════════════════════════════════════════
  if (c.sleeping || c.eating || c.gathering || c.crafting) return
  if (c._combatCooldown > 0 || c._scaredTimer > 0 || c._chasing) return

  for (let i = 0; i < allCreatures.length; i++) {
    const t = allCreatures[i]
    if (t.id === c.id || !t.alive) continue
    if (t._combatCooldown > 0 && !t.inCombat) continue
    if (t._scaredTimer > 0) continue

    const dx = t.x - c.x, dz = t.z - c.z
    if (dx * dx + dz * dz > ENGAGE_RADIUS * ENGAGE_RADIUS) continue

    // Aggression roll (scaled by dt)
    const aggro = spec.behaviorWeights?.aggression || 0.3
    if (Math.random() > aggro * dt * 0.3) continue

    // Same species: 90% skip
    if (c.species === t.species && Math.random() > 0.10) continue

    // Don't fight at very low HP
    if (c.hp < c.maxHp * 0.25) continue

    // ── FIGHT! ──
    console.log(`[COMBAT] ${c.name} engages ${t.name}!`)
    interruptActivity(c)
    if (t.sleeping || t.eating || t.gathering || t.crafting) {
      interruptActivity(t)
      t.combatInterrupted = true
    }

    c.inCombat = true
    c._combatTarget = t.id
    c._hitTimer = 0
    c._combatTurns = 0
    c._combatDuration = 0
    c.combatEngaged = { targetName: t.name, targetSpecies: t.species }

    if (!t.inCombat) {
      t.inCombat = true
      t._combatTarget = c.id
      t._hitTimer = 1.0  // defender hits 1s after attacker
      t._combatTurns = 0
      t._combatDuration = 0
    }

    break
  }
}
