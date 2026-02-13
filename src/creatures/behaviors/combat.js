// ── Combat system ──────────────────────────────────────────────
//
// EXACT COMBAT FLOW:
//   1. FIGHT: A & B exchange hits every 2s. Only the creature that
//      just took damage rolls for flee. Attacker NEVER rolls.
//      Max 4 hits each → draw.
//   2. FLEE: Loser sprints at 2x speed in the EXACT OPPOSITE
//      direction from the winner. Winner stands still.
//      Show "FLED!" on the fleeing creature. Panicked thinking text.
//   3. CHASE DECISION: Winner stands still for 3s (head start).
//      After delay, personality + prey HP roll to chase.
//      If yes → sprint 1.5x for up to 8s. If no → back to normal.
//   4. CHASE RESOLUTION: Catch (<3 units) → combat resumes.
//      Timer expires → chaser gives up, prey gets "ESCAPED!".
//   5. SCARED: After fleeing ends, 30s scared state. No gather/craft.
//      Can eat if starving (hunger < 10). Speed 1.3x.
//
// CRITICAL RULES:
//   - Only ONE creature flees. The other is the WINNER. Never both.
//   - The winner either chases or goes back to normal. Never flees.
//   - Fleeing creature runs OPPOSITE direction from the winner.
//   - States are sequential, never overlapping:
//       Loser:  fighting → fleeing → scared → normal
//       Winner: fighting → watching → chasing/idle → idle
//   - The 3s head start is critical for balance.

import { interruptCraft, breakEquipment, EQUIPMENT_DEFS, interruptPotion } from '../crafting'

// ── Type advantage (attacker type → defender type = 1.5x) ──
const TYPE_ADVANTAGE = {
  fire: 'grass', grass: 'water', water: 'fire',
  electric: 'water', dark: 'electric', ice: 'fire',
}

// ── Constants ──
const ENGAGE_RADIUS   = 12
const COMBAT_RADIUS   = 3.5
const HIT_INTERVAL    = 2.0
const MAX_HITS        = 4        // per creature → 8 total = draw
const COMBAT_COOLDOWN = 60
const SCARED_TIME_MIN = 7        // min scared duration
const SCARED_TIME_MAX = 30       // max scared duration
const HARD_TIMEOUT    = 30       // safety net for stuck fights
const CHASE_DELAY     = 3.0      // seconds winner stands still
const CHASE_DURATION  = 8.0      // max chase time after delay
const FLEE_MIN_DIST   = 35       // min distance before fleeing creature can stop
const CATCH_DIST      = 3.0      // distance to catch fleeing prey
const FLEE_SPRINT_MIN = 10       // min flee sprint duration
const FLEE_SPRINT_MAX = 12       // max flee sprint duration

// ── Panicked thinking text ──
const PANIC_TEXTS = [
  'Run! Get away!', 'Too strong!', 'Must escape!',
  'No no no!', 'Have to run!', "Can't fight this!",
]

// ── Species type lookup ──
const SPECIES_TYPES = {
  Embrix: 'fire', Aqualis: 'water', Verdox: 'grass',
  Voltik: 'electric', Shadeyn: 'dark', Glacira: 'ice',
}

function getType(c) { return SPECIES_TYPES[c.species] || 'fire' }

// ══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════

// Flee roll — called ONLY on the creature that just took damage
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

// Damage: ATK × random(0.8–1.2) × type bonus − armor
function calcDamage(attacker, defender) {
  const base = attacker.atk * (0.8 + Math.random() * 0.4)
  const superEff = TYPE_ADVANTAGE[getType(attacker)] === getType(defender)
  let dmg = base * (superEff ? 1.5 : 1.0)
  if (defender.equipment?.armor) {
    dmg = Math.max(1, dmg - defender.equipment.armor.maxHpBonus * 0.3)
  }
  return { damage: Math.round(dmg), superEff }
}

// Equipment durability tick
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

// Interrupt any current activity
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
  c._returningHome = false
  c._returningToBuild = false
  if (c._buildingType) { c._buildingType = null; c._buildingTimer = 0; c._buildingDuration = 0 }
}

// ══════════════════════════════════════════════════════════════
// STATE TRANSITIONS — clean and atomic
// ══════════════════════════════════════════════════════════════

// Clear combat-only fields
function endCombat(c) {
  c.inCombat = false
  c._combatTarget = null
  c._hitTimer = 0
  c._combatTurns = 0
  c._combatDuration = 0
}

// Clear chase fields
function endChase(c) {
  c._chasing = false
  c._chaseTargetId = null
  c._chaseTimer = 0
  c._chaseGoingForKill = false
  c._combatCooldown = COMBAT_COOLDOWN
}

// Clear all flee/scared fields on a creature (full reset to normal)
function clearFleeState(c) {
  c._fleeSprint = 0
  c._fleeZigzag = 0
  c._fleeMinDist = 0
  c._scaredTimer = 0
  c._scaredOfId = null
  c._fleeFromX = 0
  c._fleeFromZ = 0
  c._pendingEscape = false
  c._panicTextTimer = 0
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: FLEE EXECUTION
// Runner sprints away, winner enters chase-delay
// ══════════════════════════════════════════════════════════════

function doFlee(runner, winner) {
  console.log(`[COMBAT] ${runner.name} FLEES from ${winner.name}!`)

  // ── RUNNER: end combat, start fleeing ──
  endCombat(runner)
  runner.xp += 5
  runner.combatFled = { hp: runner.hp, maxHp: runner.maxHp, opponentName: winner.name }

  // Animated float text: "FLED!" (no Creature.jsx flag handler for combatFled)
  runner.floatingText = { text: 'FLED!', color: '#ffaa33', timer: 2.0 }

  // Flee state
  runner._pendingEscape = true
  const scaredDuration = SCARED_TIME_MIN + Math.random() * (SCARED_TIME_MAX - SCARED_TIME_MIN)
  runner._scaredTimer = scaredDuration
  runner._combatCooldown = scaredDuration
  runner._fleeSprint = FLEE_SPRINT_MIN + Math.random() * (FLEE_SPRINT_MAX - FLEE_SPRINT_MIN)
  runner._fleeMinDist = FLEE_MIN_DIST
  runner._scaredOfId = winner.id
  runner._fleeFromX = winner.x
  runner._fleeFromZ = winner.z
  runner._panicTextTimer = 3.0   // wait for FLED! text before cycling panic

  // Sprint in EXACT OPPOSITE direction from winner
  const dx = winner.x - runner.x, dz = winner.z - runner.z
  const dist = Math.sqrt(dx * dx + dz * dz) || 1
  runner.targetX = Math.max(-95, Math.min(95, runner.x - (dx / dist) * 35))
  runner.targetZ = Math.max(-95, Math.min(95, runner.z - (dz / dist) * 35))
  runner.moving = true

  // ── WINNER: end combat, stand still for 3s chase-delay ──
  endCombat(winner)
  winner._combatCooldown = 0        // set after chase decision
  winner._chaseDelayTimer = CHASE_DELAY
  winner._chaseDelayTarget = runner.id
  winner.moving = false
  winner.currentSpeed = 0

  console.log(`[COMBAT] ${winner.name} watches ${runner.name} flee (${CHASE_DELAY}s to decide)`)
}

// ══════════════════════════════════════════════════════════════
// PHASE 3: CHASE DECISION
// Personality + prey HP determine if winner chases
// ══════════════════════════════════════════════════════════════

function evaluateChase(winner, runner) {
  // Never chase if HP < 40%
  if (winner.hp < winner.maxHp * 0.40) {
    console.log(`[CHASE] ${winner.name} too hurt to chase (HP ${Math.round(winner.hp / winner.maxHp * 100)}%)`)
    return false
  }

  // Personality-based base chance
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
  console.log(
    `[CHASE] ${winner.name} (${p}) chase roll: ${Math.round(roll * 100)} vs ${Math.round(chance * 100)}%` +
    `${goingForKill ? ' (BLOOD!)' : ''} → ${roll < chance ? 'CHASE!' : 'let go'}`
  )

  if (roll >= chance) return false

  // ── START CHASE ──
  console.log(`[CHASE] ${winner.name} sprints after ${runner.name}!${goingForKill ? ' GOING FOR THE KILL!' : ''}`)
  winner._chasing = true
  winner._chaseTargetId = runner.id
  winner._chaseTimer = CHASE_DURATION
  winner._chaseGoingForKill = goingForKill
  winner._combatCooldown = 0

  // Event flag for CreatureManager log
  winner.combatChaseStarted = { targetName: runner.name, goingForKill }
  winner.floatingText = { text: goingForKill ? 'Going for the kill!' : 'Chasing!', color: goingForKill ? '#ff2222' : '#ff4444', timer: 1.5 }

  winner.targetX = runner.x
  winner.targetZ = runner.z
  winner.moving = true
  return true
}

// ══════════════════════════════════════════════════════════════
// PHASE 5: TRIGGER ESCAPED
// Called when: winner lets prey go, chaser gives up, chaser exhausted
// ══════════════════════════════════════════════════════════════

function triggerEscaped(prey, fromName) {
  prey._pendingEscape = false
  prey.combatEscaped = true
  // Event flag for CreatureManager log
  if (!prey.combatChaseEscaped) {
    prey.combatChaseEscaped = { chaserName: fromName }
  }
  prey.floatingText = { text: 'Escaped!', color: '#44ff88', timer: 1.5 }

  // Stop sprinting — safe now
  prey._fleeSprint = 0
  prey._fleeZigzag = 0
  prey._fleeMinDist = 0
  prey._panicTextTimer = 0

  // Fresh scared timer from NOW
  const scaredDuration = SCARED_TIME_MIN + Math.random() * (SCARED_TIME_MAX - SCARED_TIME_MIN)
  prey._scaredTimer = scaredDuration
  prey._combatCooldown = scaredDuration

  console.log(`[COMBAT] ${prey.name} escaped from ${fromName}!`)
}

// ══════════════════════════════════════════════════════════════
// MAIN UPDATE — called every frame for every creature
// ══════════════════════════════════════════════════════════════
export function updateCombat(c, allCreatures, spec, dt) {
  if (!c.alive) return

  // ── Tick timers ──
  if (c._scaredTimer > 0) {
    c._scaredTimer -= dt
    if (c._scaredTimer <= 0) {
      // Scared expired → fully normal
      c._scaredTimer = 0
      c._scaredOfId = null
      c._fleeMinDist = 0
      c._pendingEscape = false
      c._panicTextTimer = 0
    }
  }

  if (c._fleeSprint > 0) {
    c._fleeSprint -= dt
    // Flee sprint expired naturally (no chaser caught us, no triggerEscaped called)
    if (c._fleeSprint <= 0 && c._pendingEscape) {
      c._fleeSprint = 0
      c._pendingEscape = false
      c._fleeZigzag = 0
      c._panicTextTimer = 0
      c.combatEscaped = true
      // Look up chaser name from _scaredOfId
      const chaser = c._scaredOfId != null ? allCreatures.find(t => t.id === c._scaredOfId) : null
      c.combatChaseEscaped = { chaserName: chaser?.name || 'unknown' }
      c.floatingText = { text: 'Escaped!', color: '#44ff88', timer: 1.5 }
      // Fresh scared timer from now
      const scaredDuration = SCARED_TIME_MIN + Math.random() * (SCARED_TIME_MAX - SCARED_TIME_MIN)
      c._scaredTimer = scaredDuration
      c._combatCooldown = scaredDuration
      console.log(`[COMBAT] ${c.name} escaped and is recovering`)
    }
  }

  if (c._combatCooldown > 0) c._combatCooldown -= dt

  // ── Panicked thinking text while fleeing ──
  if (c._fleeSprint > 0 && c._scaredTimer > 0) {
    c._panicTextTimer = (c._panicTextTimer || 0) - dt
    if (c._panicTextTimer <= 0) {
      c._panicTextTimer = 1.5 + Math.random() * 1.5  // cycle every 1.5–3s
      const msg = PANIC_TEXTS[Math.floor(Math.random() * PANIC_TEXTS.length)]
      c.floatingText = { text: msg, color: '#ffaa33', timer: 1.5 }
    }
  }

  // ── Re-sprint if threat comes too close (only while still actively fleeing) ──
  if (c._scaredTimer > 0 && c._scaredOfId && c._pendingEscape && !c.inCombat && !c._chasing) {
    const threat = allCreatures.find(t => t.id === c._scaredOfId && t.alive)
    if (threat) {
      const tdx = threat.x - c.x, tdz = threat.z - c.z
      const d2 = tdx * tdx + tdz * tdz
      if (d2 < 20 * 20 && c._fleeSprint <= 0) {
        c._fleeSprint = 2.0
        const d = Math.sqrt(d2) || 1
        c.targetX = Math.max(-95, Math.min(95, c.x - (tdx / d) * 30))
        c.targetZ = Math.max(-95, Math.min(95, c.z - (tdz / d) * 30))
        c.moving = true
        // Update flee-from to threat's current position
        c._fleeFromX = threat.x
        c._fleeFromZ = threat.z
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // CHASE DELAY — winner stands still for 3s deciding
  // ══════════════════════════════════════════════════════════
  if (c._chaseDelayTimer > 0) {
    c._chaseDelayTimer -= dt

    // Stand completely still
    c.moving = false
    c.currentSpeed = 0

    // Face the fleeing creature
    const prey = allCreatures.find(t => t.id === c._chaseDelayTarget && t.alive)
    if (prey) {
      c.rotY = Math.atan2(prey.x - c.x, prey.z - c.z)
    }

    // Delay expired → make the decision
    if (c._chaseDelayTimer <= 0) {
      c._chaseDelayTimer = 0
      const targetId = c._chaseDelayTarget
      c._chaseDelayTarget = null

      const runner = allCreatures.find(t => t.id === targetId && t.alive)
      if (!runner) {
        // Prey died during delay
        c._combatCooldown = COMBAT_COOLDOWN / 2
        return
      }

      const chased = evaluateChase(c, runner)
      if (!chased) {
        // Let them go — winner returns to normal immediately
        console.log(`[COMBAT] ${c.name} let ${runner.name} go`)
        c.combatLetGo = { targetName: runner.name }
        c._combatCooldown = COMBAT_COOLDOWN / 2
        triggerEscaped(runner, c.name)
      }
    }
    return  // skip everything else while in chase delay
  }

  // ══════════════════════════════════════════════════════════
  // CHASE — pursuer sprints after fleeing creature
  // ══════════════════════════════════════════════════════════
  if (c._chasing && c._chaseTargetId) {
    c._chaseTimer -= dt
    const prey = allCreatures.find(t => t.id === c._chaseTargetId && t.alive)

    // Give up: timer expired or prey gone
    if (!prey || c._chaseTimer <= 0) {
      console.log(`[CHASE] ${c.name} gives up the chase`)
      c.combatChaseGaveUp = { targetName: prey?.name || 'unknown' }
      c.floatingText = { text: 'Gave up chase', color: '#ffaa44', timer: 1.5 }
      if (prey) {
        prey.combatChaseEscaped = { chaserName: c.name }
        triggerEscaped(prey, c.name)
      }
      endChase(c)
      return
    }

    const dx = prey.x - c.x, dz = prey.z - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // CAUGHT — resume combat
    if (dist < CATCH_DIST) {
      console.log(`[CHASE] ${c.name} CATCHES ${prey.name}! (dist: ${dist.toFixed(1)})`)

      // Event flag for CreatureManager log
      c.combatChaseCaught = { targetName: prey.name }
      c.floatingText = { text: 'Caught!', color: '#ff2222', timer: 1.8 }
      prey.floatingText = { text: 'CAUGHT!', color: '#ff2222', timer: 2.0 }

      // End chase + clear prey flee state completely
      endChase(c)
      clearFleeState(prey)

      // Re-engage combat
      c.inCombat = true
      c._combatTarget = prey.id
      c._hitTimer = 0
      c._combatTurns = 0
      c._combatDuration = 0
      c._combatCooldown = 0

      prey.inCombat = true
      prey._combatTarget = c.id
      prey._hitTimer = 1.0  // defender hits 1s after
      prey._combatTurns = 0
      prey._combatDuration = 0
      prey._combatCooldown = 0
      return
    }

    // Sprint toward prey at 1.5x speed
    const angle = Math.atan2(dx, dz)
    c.rotY = angle
    const chaseSpd = c.spd * 0.4 * 1.5
    c.x = Math.max(-95, Math.min(95, c.x + Math.sin(angle) * chaseSpd * dt))
    c.z = Math.max(-95, Math.min(95, c.z + Math.cos(angle) * chaseSpd * dt))
    c.moving = true
    c.targetX = prey.x
    c.targetZ = prey.z

    // Energy drain during chase
    c.energy = Math.max(0, c.energy - 0.3 * dt)
    if (c.energy <= 5) {
      console.log(`[CHASE] ${c.name} exhausted, gives up`)
      c.combatChaseGaveUp = { targetName: prey.name, exhausted: true }
      c.floatingText = { text: 'Exhausted!', color: '#ffaa44', timer: 1.5 }
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

    // Target gone, dead, or no longer in combat → end
    if (!target || !target.alive || !target.inCombat) {
      endCombat(c)
      return
    }

    // Safety: target's combat partner isn't us → stale reference, disengage
    if (target._combatTarget !== c.id) {
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

    // Tick hit timer — wait until in range AND timer ready
    c._hitTimer = (c._hitTimer || 0) + dt
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

    // XP for attacker
    c.xp += Math.max(1, Math.floor(damage / 5) * (superEff ? 2 : 1))

    // Equipment durability
    tickDurability(c, 'weapon', 3, 5)
    tickDurability(target, 'armor', 4, 6)

    // Visual event flags (consumed by Creature.jsx)
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
      if (target.village && !target.village.destroying) {
        console.log(`[VILLAGE] ${target.name} died, village destroying`)
        target.village.destroying = true
        target.village.destroyTimer = 3.0
      }
      c.xp += target.level * 25
      c.kills++
      c._combatCooldown = COMBAT_COOLDOWN

      // Loot 1–2 items
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

    // ── Flee check: ONLY the creature that just took damage rolls ──
    // The attacker (c) NEVER rolls on the same turn
    if (rollFlee(target)) {
      doFlee(target, c)
    }
    return
  }

  // ══════════════════════════════════════════════════════════
  // NOT IN COMBAT — scan for new fights
  // ══════════════════════════════════════════════════════════

  // Don't scan if busy or in a post-combat state
  if (c.sleeping || c.eating || c.gathering || c.crafting) return
  if (c._combatCooldown > 0 || c._scaredTimer > 0) return
  if (c._chasing || c._chaseDelayTimer > 0 || c._fleeSprint > 0) return

  for (let i = 0; i < allCreatures.length; i++) {
    const t = allCreatures[i]
    if (t.id === c.id || !t.alive) continue

    // Skip targets that are in any combat-related state
    if (t.inCombat) continue
    if (t._chasing || t._chaseDelayTimer > 0) continue
    if (t._fleeSprint > 0 || t._scaredTimer > 0) continue
    if (t._combatCooldown > 0) continue

    // Range check
    const dx = t.x - c.x, dz = t.z - c.z
    if (dx * dx + dz * dz > ENGAGE_RADIUS * ENGAGE_RADIUS) continue

    // Aggression roll
    const aggro = spec.behaviorWeights?.aggression || 0.3
    if (Math.random() > aggro * dt * 0.3) continue

    // Same species: 90% skip
    if (c.species === t.species && Math.random() > 0.10) continue

    // Don't fight at very low HP
    if (c.hp < c.maxHp * 0.25) continue

    // ── ENGAGE! ──
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

    t.inCombat = true
    t._combatTarget = c.id
    t._hitTimer = 1.0  // defender hits 1s after attacker
    t._combatTurns = 0
    t._combatDuration = 0

    break
  }
}
