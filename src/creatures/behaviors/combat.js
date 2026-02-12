// ── Combat system ──────────────────────────────────────────────
//
// FLOW:
//   1. FIGHT: A & B exchange hits every 2s. Only the creature that
//      just took damage rolls for flee. Max 4 hits each → draw.
//   2. FLEE: Loser sprints at 2x speed OPPOSITE from winner.
//      Winner stands still for 3s (head-start window).
//   3. CHASE DECISION: After 3s delay, winner rolls to chase.
//      If yes → sprint 1.5x for up to 8s. If no → back to normal.
//   4. CHASE RESOLUTION: Catch (<3 units) → combat resumes.
//      Timer expires → chaser gives up, prey gets "ESCAPED!".
//   5. SCARED: After fleeing ends, 30s scared state. No gather/craft.
//
// RULES:
//   - Only ONE creature flees. The other is the WINNER.
//   - States are sequential, never overlapping.
//   - The 3s head start is critical for balance.

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
const FLEE_SPRINT = 12.0       // seconds of 2x speed sprint
const SCARED_TIME = 30         // seconds of scared state after fleeing
const HARD_TIMEOUT = 30        // safety net for stuck fights
const CHASE_DELAY = 3.0        // seconds winner stands still before deciding
const CHASE_DURATION = 8.0     // max chase time after delay
const FLEE_MIN_DIST = 35       // must be this far before allowed to stop
const CATCH_DIST = 3.0         // distance to catch fleeing prey

// Species type lookup
const SPECIES_TYPES = {
  Embrix: 'fire', Aqualis: 'water', Verdox: 'grass',
  Voltik: 'electric', Shadeyn: 'dark', Glacira: 'ice',
}

function getType(c) { return SPECIES_TYPES[c.species] || 'fire' }

// ── Flee roll: simple HP thresholds ──
function rollFlee(c) {
  const pct = c.hp / c.maxHp
  let chance
  if (pct > 0.60) chance = 0
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

// ── End combat for one creature (clear combat-specific fields only) ──
function endCombat(c) {
  c.inCombat = false
  c._combatTarget = null
  c._hitTimer = 0
  c._combatTurns = 0
  c._combatDuration = 0
}

// ── Execute flee: loser sprints away, winner enters chase-delay ──
function doFlee(runner, winner, allCreatures) {
  console.log(`[COMBAT] ${runner.name} FLEES from ${winner.name}!`)

  // Runner: end combat, start fleeing
  runner.xp += 5
  runner.combatFled = { hp: runner.hp, maxHp: runner.maxHp, opponentName: winner.name }
  runner.floatingText = { text: 'FLED!', color: '#ffaa33', timer: 2.0 }
  runner._floatText = 'FLED!'
  runner._floatTextColor = '#ffaa33'
  runner._floatTextTimer = 2.5
  runner._pendingEscape = true

  // Set flee state
  runner._scaredTimer = SCARED_TIME
  runner._fleeSprint = FLEE_SPRINT
  runner._fleeMinDist = FLEE_MIN_DIST
  runner._scaredOfId = winner.id
  runner._fleeFromX = winner.x  // flee FROM the winner's position
  runner._fleeFromZ = winner.z

  endCombat(runner)
  runner._combatCooldown = SCARED_TIME

  // Sprint in EXACT OPPOSITE direction from winner
  const dx = winner.x - runner.x, dz = winner.z - runner.z
  const dist = Math.sqrt(dx * dx + dz * dz) || 1
  runner.targetX = runner.x - (dx / dist) * 35
  runner.targetZ = runner.z - (dz / dist) * 35
  runner.targetX = Math.max(-95, Math.min(95, runner.targetX))
  runner.targetZ = Math.max(-95, Math.min(95, runner.targetZ))
  runner.moving = true

  // Winner: end combat, enter chase-delay (stand still for 3s)
  endCombat(winner)
  winner._combatCooldown = 0  // will be set after chase decision
  winner._chaseDelayTimer = CHASE_DELAY
  winner._chaseDelayTarget = runner.id
  winner.moving = false
  winner.currentSpeed = 0
  console.log(`[COMBAT] ${winner.name} watches ${runner.name} flee (${CHASE_DELAY}s to decide)`)
}

// ── Chase decision: personality + prey HP ──
function evaluateChase(winner, runner, allCreatures) {
  // Never chase if HP < 40%
  if (winner.hp < winner.maxHp * 0.40) {
    console.log(`[CHASE] ${winner.name} too hurt to chase (HP ${Math.round(winner.hp / winner.maxHp * 100)}%)`)
    return false
  }

  // Personality-based chance
  const p = winner.personality
  let chance = 0.25
  if (p === 'fierce' || p === 'bold') chance = 0.70
  else if (p === 'sneaky') chance = 0.50

  // Low HP prey bonuses
  const preyPct = runner.hp / runner.maxHp
  let goingForKill = false
  if (preyPct < 0.15) {
    chance = 0.90
    goingForKill = true
  } else if (preyPct < 0.25) {
    chance = Math.min(chance + 0.30, 0.95)
    goingForKill = true
  } else if (preyPct < 0.35) {
    chance += 0.15
  }

  const roll = Math.random()
  console.log(`[CHASE] ${winner.name} (${p}) chase roll: ${Math.round(roll * 100)} vs ${Math.round(chance * 100)}%${goingForKill ? ' (BLOOD!)' : ''} → ${roll < chance ? 'CHASE!' : 'let go'}`)

  if (roll >= chance) return false

  // START CHASE
  console.log(`[CHASE] ${winner.name} sprints after ${runner.name}!${goingForKill ? ' GOING FOR THE KILL!' : ''}`)
  winner._chasing = true
  winner._chaseTargetId = runner.id
  winner._chaseTimer = CHASE_DURATION
  winner._chaseGoingForKill = goingForKill
  winner._combatCooldown = 0
  winner.combatChaseStarted = { targetName: runner.name, goingForKill }
  winner.floatingText = { text: goingForKill ? 'Going for the kill!' : 'Chasing!', color: goingForKill ? '#ff2222' : '#ff4444', timer: 2.0 }
  winner._floatText = goingForKill ? 'Going for the kill!' : 'Chasing!'
  winner._floatTextColor = goingForKill ? '#ff2222' : '#ff4444'
  winner._floatTextTimer = 2.5
  winner.targetX = runner.x
  winner.targetZ = runner.z
  winner.moving = true
  return true
}

// ── End chase state ──
function endChase(c) {
  c._chasing = false
  c._chaseTargetId = null
  c._chaseTimer = 0
  c._chaseGoingForKill = false
  c._combatCooldown = COMBAT_COOLDOWN
}

// ── Trigger ESCAPED on prey: stop sprinting, enter scared state ──
// Called when: (a) winner decides not to chase, (b) chaser gives up, (c) chaser exhausted
function triggerEscaped(prey, fromName) {
  prey.floatingText = { text: 'ESCAPED!', color: '#44dd44', timer: 2.0 }
  prey._floatText = 'ESCAPED!'
  prey._floatTextColor = '#44dd44'
  prey._floatTextTimer = 2.5
  prey._pendingEscape = false
  prey.combatEscaped = true

  // Stop sprinting immediately — you're safe now
  prey._fleeSprint = 0
  prey._fleeZigzag = 0
  prey._fleeMinDist = 0

  // Reset scared timer to a fresh 30s from NOW
  prey._scaredTimer = SCARED_TIME
  prey._combatCooldown = SCARED_TIME

  console.log(`[COMBAT] ${prey.name} escaped from ${fromName}!`)
}

// ══════════════════════════════════════════════════════════════
// MAIN UPDATE — called every frame for every creature
// ══════════════════════════════════════════════════════════════
export function updateCombat(c, allCreatures, spec, dt) {
  if (!c.alive) return

  // ── Tick scared timer ──
  if (c._scaredTimer > 0) {
    c._scaredTimer -= dt
    if (c._scaredTimer <= 0) {
      c._scaredOfId = null
      c._fleeMinDist = 0
      c._pendingEscape = false
      // Scared timer expired → fully back to normal
    }
  }

  // ── Tick flee sprint ──
  if (c._fleeSprint > 0) c._fleeSprint -= dt

  // ── Tick combat cooldown ──
  if (c._combatCooldown > 0) c._combatCooldown -= dt

  // ── Scared: re-sprint if threat comes close ──
  if (c._scaredTimer > 0 && c._scaredOfId && !c.inCombat && !c._chasing) {
    const threat = allCreatures.find(t => t.id === c._scaredOfId && t.alive)
    if (threat) {
      const tdx = threat.x - c.x, tdz = threat.z - c.z
      const d2 = tdx * tdx + tdz * tdz
      if (d2 < 20 * 20 && c._fleeSprint <= 0) {
        c._fleeSprint = 2.0
        const d = Math.sqrt(d2) || 1
        c.targetX = c.x - (tdx / d) * 30
        c.targetZ = c.z - (tdz / d) * 30
        c.targetX = Math.max(-95, Math.min(95, c.targetX))
        c.targetZ = Math.max(-95, Math.min(95, c.targetZ))
        c.moving = true
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // CHASE DELAY — winner stands still for 3s deciding
  // ══════════════════════════════════════════════════════════
  if (c._chaseDelayTimer > 0) {
    c._chaseDelayTimer -= dt
    // Stand still while deciding
    c.moving = false
    c.currentSpeed = 0

    // Face the fleeing creature
    const prey = allCreatures.find(t => t.id === c._chaseDelayTarget && t.alive)
    if (prey) {
      const dx = prey.x - c.x, dz = prey.z - c.z
      c.rotY = Math.atan2(dx, dz)
    }

    // Delay expired — make the decision
    if (c._chaseDelayTimer <= 0) {
      c._chaseDelayTimer = 0
      const targetId = c._chaseDelayTarget
      c._chaseDelayTarget = null

      const prey2 = allCreatures.find(t => t.id === targetId && t.alive)
      if (!prey2) {
        // Prey died or gone during delay
        c._combatCooldown = COMBAT_COOLDOWN / 2
        return
      }

      const chased = evaluateChase(c, prey2, allCreatures)
      if (!chased) {
        // Let them go — back to normal immediately
        console.log(`[COMBAT] ${c.name} let ${prey2.name} go`)
        c.combatLetGo = { targetName: prey2.name }
        c._combatCooldown = COMBAT_COOLDOWN / 2
        // Notify prey they escaped — stop sprinting, enter scared
        triggerEscaped(prey2, c.name)
      }
    }
    return  // skip everything else while in chase delay
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
      c.floatingText = { text: 'Gave up', color: '#ffaa44', timer: 2.0 }
      c._floatText = 'Gave up'
      c._floatTextColor = '#ffaa44'
      c._floatTextTimer = 2.5
      if (prey) {
        prey.combatChaseEscaped = { chaserName: c.name }
        triggerEscaped(prey, c.name)
      }
      endChase(c)
      return
    }

    const dx = prey.x - c.x, dz = prey.z - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Caught! Resume combat
    if (dist < CATCH_DIST) {
      console.log(`[CHASE] ${c.name} CATCHES ${prey.name}! (dist: ${dist.toFixed(1)})`)
      c.combatChaseCaught = { targetName: prey.name }
      c.floatingText = { text: 'Caught!', color: '#ff2222', timer: 2.0 }
      prey.floatingText = { text: 'CAUGHT!', color: '#ff2222', timer: 2.0 }
      prey._floatText = 'CAUGHT!'
      prey._floatTextColor = '#ff2222'
      prey._floatTextTimer = 2.5
      prey._pendingEscape = false
      endChase(c)

      // Clear prey flee state
      prey._fleeSprint = 0
      prey._scaredTimer = 0
      prey._fleeMinDist = 0
      prey._scaredOfId = null

      // Re-engage combat
      c.inCombat = true
      c._combatTarget = prey.id
      c._hitTimer = 0
      c._combatTurns = 0
      c._combatDuration = 0

      prey.inCombat = true
      prey._combatTarget = c.id
      prey._hitTimer = 1.0  // defender hits 1s after
      prey._combatTurns = 0
      prey._combatDuration = 0
      return
    }

    // Sprint toward prey at 1.5x speed
    const angle = Math.atan2(dx, dz)
    c.rotY = angle
    const chaseSpd = c.spd * 0.4 * 1.5
    c.x += Math.sin(angle) * chaseSpd * dt
    c.z += Math.cos(angle) * chaseSpd * dt
    c.x = Math.max(-95, Math.min(95, c.x))
    c.z = Math.max(-95, Math.min(95, c.z))
    c.moving = true
    c.targetX = prey.x
    c.targetZ = prey.z

    // Energy drain during chase
    c.energy = Math.max(0, c.energy - 0.3 * dt)
    if (c.energy <= 5) {
      console.log(`[CHASE] ${c.name} exhausted, gives up`)
      c.combatChaseGaveUp = { targetName: prey.name }
      c.floatingText = { text: 'Exhausted!', color: '#ffaa44', timer: 2.0 }
      prey.combatChaseEscaped = { chaserName: c.name }
      triggerEscaped(prey, c.name)
      endChase(c)
    }
    return  // skip everything else while chasing
  }

  // ══════════════════════════════════════════════════════════
  // IN COMBAT — exchange hits
  // ══════════════════════════════════════════════════════════
  if (c.inCombat && c._combatTarget) {
    const target = allCreatures.find(t => t.id === c._combatTarget)

    // Target gone/dead/fled → end
    if (!target || !target.alive || !target.inCombat) {
      endCombat(c)
      return
    }

    // Hard timeout safety
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

    // Tick hit timer
    c._hitTimer = (c._hitTimer || 0) + dt

    // Not in range or timer not ready → wait
    if (dist > COMBAT_RADIUS || c._hitTimer < HIT_INTERVAL) return

    // ── HIT ──
    c._hitTimer = 0
    c._combatTurns = (c._combatTurns || 0) + 1

    // Hit limit → draw (mutual disengage, nobody flees)
    if (c._combatTurns > MAX_HITS) {
      console.log(`[COMBAT] Draw! ${c.name} & ${target.name} disengage after ${MAX_HITS} hits each`)
      c.xp += 5; target.xp += 5
      c.floatingText = { text: 'Draw!', color: '#ccaa44', timer: 2.0 }
      target.floatingText = { text: 'Draw!', color: '#ccaa44', timer: 2.0 }
      endCombat(c); endCombat(target)
      c._combatCooldown = COMBAT_COOLDOWN
      target._combatCooldown = COMBAT_COOLDOWN
      // Walk apart
      const d = dist || 1
      c.targetX = c.x - (dx / d) * 15
      c.targetZ = c.z - (dz / d) * 15
      c.moving = true
      target.targetX = target.x + (dx / d) * 15
      target.targetZ = target.z + (dz / d) * 15
      target.moving = true
      return
    }

    // Calculate + apply damage
    const { damage, superEff } = calcDamage(c, target)
    target.hp = Math.max(0, target.hp - damage)
    console.log(
      `[COMBAT] ${c.name} hit #${c._combatTurns}/${MAX_HITS} → ${target.name}: ` +
      `${damage} dmg${superEff ? ' (SUPER EFFECTIVE!)' : ''} | HP: ${target.hp}/${target.maxHp}`
    )

    // XP for attacker
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

    // ── Flee check: ONLY the creature that just took damage (target) rolls ──
    // The attacker (c) NEVER rolls on this turn
    if (rollFlee(target)) {
      doFlee(target, c, allCreatures)
    }

    return
  }

  // ══════════════════════════════════════════════════════════
  // NOT IN COMBAT — scan for fights
  // ══════════════════════════════════════════════════════════
  if (c.sleeping || c.eating || c.gathering || c.crafting) return
  if (c._combatCooldown > 0 || c._scaredTimer > 0 || c._chasing) return
  if (c._chaseDelayTimer > 0) return  // still deciding about chase

  for (let i = 0; i < allCreatures.length; i++) {
    const t = allCreatures[i]
    if (t.id === c.id || !t.alive) continue
    if (t._combatCooldown > 0 && !t.inCombat) continue
    if (t._scaredTimer > 0) continue
    if (t._chaseDelayTimer > 0) continue  // still in post-fight decision

    const dx = t.x - c.x, dz = t.z - c.z
    if (dx * dx + dz * dz > ENGAGE_RADIUS * ENGAGE_RADIUS) continue

    // Aggression roll
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
