# Combat System

5-phase sequential combat with chase mechanics, personality-driven decisions, and post-combat scared state.

## Constants

```
ENGAGE_RADIUS   = 12      // Detection range to start combat
COMBAT_RADIUS   = 3.5     // Must be within to exchange hits
HIT_INTERVAL    = 2.0     // Seconds between hit exchanges
MAX_HITS        = 4       // Max rounds before forced flee check
COMBAT_COOLDOWN = 60      // Seconds before creature can fight again
SCARED_TIME_MIN = 7       // Min scared duration (seconds)
SCARED_TIME_MAX = 30      // Max scared duration (seconds)
HARD_TIMEOUT    = 30      // Max total combat duration
CHASE_DELAY     = 3.0     // Head start before chase decision
CHASE_DURATION  = 8.0     // Max chase duration
FLEE_MIN_DIST   = 35      // Minimum distance to maintain from threat
CATCH_DIST      = 3.0     // Distance to catch fleeing prey
FLEE_SPRINT_MIN = 10      // Min flee sprint duration
FLEE_SPRINT_MAX = 12      // Max flee sprint duration
```

## Engagement Rules

A creature initiates combat when:
1. Target is within `ENGAGE_RADIUS` (12 units)
2. `Math.random() < aggression` (species behavior weight)
3. Target is NOT in any combat state (fighting, chasing, fleeing, scared, cooldown)
4. Attacker is NOT in any combat state
5. Neither creature is sleeping, eating, gathering, or crafting

Combat interrupts: sleeping, eating, gathering, crafting, potion drinking.

## Phase 1: FIGHT

Both creatures exchange hits every 2 seconds until one flees or dies.

### Damage Formula

```
baseDamage = attacker.atk * (0.6 + Math.random() * 0.8)  // 60-140% of ATK
typeMultiplier = effectiveness(attacker.type, defender.type)
finalDamage = Math.max(1, Math.floor(baseDamage * typeMultiplier))
```

### Flee Check (Only Damaged Creature)

After taking damage, ONLY the creature that was hit rolls a flee check:

```
fleeChance = baseFleeChance(personality) + hpPenalty
```

**Base flee chances by personality:**
- `timid`: 0.35
- `gentle`: 0.30
- `lazy`: 0.25
- `curious`: 0.20
- `sneaky`: 0.18
- `loyal`: 0.15
- `bold`: 0.10
- `fierce`: 0.05

**HP penalty (added to base):**
- HP < 20%: +0.40
- HP < 40%: +0.25
- HP < 60%: +0.10

### Fight End Conditions

- One creature's HP reaches 0 (death)
- Flee check passes (transition to Phase 2)
- `MAX_HITS` (4) reached with no flee (forced flee check on lower-HP creature)
- `HARD_TIMEOUT` (30s) reached (draw — both disengage, +5 XP each)

## Phase 2: FLEE

Only ONE creature flees. The other stays.

### Fleeing Creature
- Ends combat state immediately
- Sprint duration: 10-12 seconds (randomized)
- Direction: exact opposite from winner
- `_pendingEscape = true` (waiting for escape confirmation)
- Displays "FLED!" floating text (orange)
- Panic text cycling begins

### Winning Creature
- Ends combat state
- Stands completely still for 3 seconds (mandatory head start)
- Faces the fleeing creature
- Enters `_chaseDelayTimer = 3.0`

## Phase 3: CHASE DECISION

During the 3-second delay, the winner evaluates whether to chase.

### Decision Logic

```javascript
// Never chase if hurt
if (winner.hp < winner.maxHp * 0.40) → NO CHASE

// Personality-based base chance
let chance = 0.25  // default
if (personality === 'fierce' || 'bold') chance = 0.70
else if (personality === 'sneaky') chance = 0.50

// Low HP prey bonuses ("blood in the water")
if (preyHpPercent < 0.15) → chance = 0.90, goingForKill = true
if (preyHpPercent < 0.25) → chance += 0.30, goingForKill = true
if (preyHpPercent < 0.35) → chance += 0.15

// Roll
if (Math.random() < chance) → START CHASE
```

### Outcomes
- **Chase**: Sprint at 1.5x base speed toward prey for up to 8 seconds
- **No chase**: Trigger escape on prey, return to normal behavior

## Phase 4: CHASE RESOLUTION

### Catch (distance < 3 units)
- Resume combat immediately
- Clear all flee state on prey
- Both re-enter fight phase with fresh timers

### Timeout (chase timer expires)
- Chaser gives up ("Gave up chase" float text)
- Prey gets "Escaped!" flag
- `triggerEscaped()` fires on prey
- Prey enters scared state (7-30s)

### Exhaustion (chaser energy <= 5)
- Chaser collapses ("Exhausted!" float text)
- Same outcome as timeout

## Phase 5: SCARED STATE

Duration: 7-30 seconds (randomized per instance)

### Restrictions
- Cannot gather or craft
- Cannot seek food on the map
- CAN eat from inventory if `hunger < 10` (survival only)
- Speed multiplier: 1.3x base (nervous)

### Flee Distance
- Must maintain `FLEE_MIN_DIST` (35 units) from threat
- If threat approaches within 20 units AND `_pendingEscape` is true: re-trigger 2-second sprint
- Once escaped, `_pendingEscape = false` (no more re-sprints)

### Movement
- Erratic zigzag while sprinting (perpendicular jinking every 0.3-0.8s, 8-15 units)
- Slide along world boundaries instead of stopping
- Panic wobble: speed varies +/-20% with sine wave + random

### Panic Texts (cycle every 1.5-3s)
```
'Run! Get away!', 'Too strong!', 'Must escape!',
'No no no!', 'Have to run!', "Can't fight this!"
```

## XP Rewards

| Event | XP |
|-------|-----|
| Combat hit | `max(1, floor(damage / 5)) * (superEffective ? 2 : 1)` |
| Flee (survivor) | +5 |
| Draw | +5 each |
| Kill | `victim.level * 25` |

## Kill Rewards

When a creature kills another:
- +XP based on victim's level
- Loot drop: 1-2 random items from victim's inventory
- Items drop on the ground at death location

## Combat Cooldown

After any combat (win, lose, draw), creature enters `_combatCooldown` matching their scared duration. Cannot engage in new combat during cooldown.

## Safety Checks

- Stale reference: If target's `_combatTarget !== c.id`, end combat immediately
- Already fighting: Skip targets in any combat-related state during engagement scan
- Sleeping targets: Combat wakes them up, sets `combatInterrupted = true`
