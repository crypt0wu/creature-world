# Behavior Orchestration

The simulation loop, update order, state machine, and system blocking rules.

## Update Order (Per Frame, Per Creature)

```
1. Age & Phase timers increment
2. ENERGY SYSTEM
   - Drain energy (moving costs more)
   - Apply fatigue speed reduction
   - Check sleep trigger
3. AUTO-POTION
   - Check HP < 50%, use healing potion if available
   - Blocked during sleep
4. IF NOT in combat/chase/watching:
   a. HUNGER
      - Drain hunger
      - Seek food if hungry (self-gates during scared)
      - Check starvation damage
   b. IF NOT scared:
      - GATHERING (resource seeking, gather progress)
      - CRAFTING (craft timer, auto-equip, start new crafts)
   c. MOVEMENT (wander, obstacle avoidance, flee movement)
5. COMBAT
   - Engagement scan
   - Fight phase (hit exchange)
   - Flee phase
   - Chase delay/decision
   - Chase pursuit
   - Scared timer countdown
6. LEVELING
   - Check XP threshold
   - Apply stat gains
7. STATE DETERMINATION
   - Set display state based on priority
```

## System Blocking Rules

| Active State | Blocks |
|-------------|--------|
| `inCombat` | Hunger, gathering, crafting, movement |
| `_chasing` | Hunger, gathering, crafting, movement |
| `_chaseDelayTimer > 0` | Hunger, gathering, crafting, movement |
| `_scaredTimer > 0` | Gathering, crafting (hunger partially works) |
| `sleeping` | Movement, but NOT energy regen |
| `eating` | Movement |
| `gathering` | Movement, starting new crafts |
| `crafting` | Movement, gathering, eating |
| `drinkingPotion` | Movement |

## State Priority (Display)

States are evaluated in strict priority order. The first matching condition wins:

```
1.  fighting        → inCombat
2.  watching         → _chaseDelayTimer > 0
3.  chasing          → _chasing
4.  fleeing          → _fleeSprint > 0
5.  scared           → _scaredTimer > 0
6.  drinking potion  → drinkingPotion
7.  sleeping         → sleeping
8.  eating           → eating
9.  gathering        → gathering
10. crafting         → crafting
11. seeking food     → seekingFood
12. seeking resource → seekingResource
13. hungry           → hunger < 25
14. tired            → energy < 25
15. wandering        → moving
16. idle             → default
```

## State Machine Flow

```
                    IDLE
                   ↙    ↘
           WANDERING    HUNGRY
              ↓            ↓
        SEEKING RESOURCE  SEEKING FOOD
              ↓            ↓
          GATHERING      EATING
              ↓
          CRAFTING
              ↓
          EQUIPPING

      [ANY STATE] ──→ COMBAT DETECTED
                          ↓
                      FIGHTING
                       ↙    ↘
                   WIN      LOSE
                    ↓         ↓
                WATCHING   FLEEING
                    ↓         ↓
               CHASING    SCARED
                ↙    ↘       ↓
           CAUGHT  GAVE UP  RECOVERY
              ↓       ↓       ↓
          FIGHTING  IDLE    IDLE
```

## Catch-Up Simulation

When frame delta exceeds 100ms (e.g., tab was backgrounded):

- Run multiple simulation ticks at 50ms each
- Set `catching = true` flag during catch-up
- During catch-up: visual event flags are cleared (no popup spam)
- Active gameplay timers (chase delay, pending escape) are NOT cleared
- This prevents 10-second backgrounds from causing visual chaos

## Save Frequency

- Creature states saved to LocalStorage periodically (throttled)
- Resource states saved alongside creatures
- Species memory saved on death events
- World clock saved periodically
- All saves wrapped in try/catch for quota safety
