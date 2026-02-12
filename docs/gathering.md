# Gathering & Resources

Creatures autonomously gather raw materials from world resources to craft equipment and potions.

## Resource Types

| Resource | Node | Duration | Energy Cost | Min Yield | Max Yield | Regrow Time | Special |
|----------|------|----------|-------------|-----------|-----------|-------------|---------|
| Wood | Tree | 5s | 12 | 1 | 3 | 300-480s | - |
| Stone | Rock | 4s | 10 | 1 | 2 | 480-720s | 12% crystal |
| Herb | Bush | 3s | 4 | 1 | 2 | 180-300s | - |

## Gather Range

- **Detection**: 40 units (how far creature looks for resources)
- **Arrival**: 3.5 units (distance to start gathering)

## Decision Engine

The gathering system uses a decision engine that evaluates what to gather based on context. Decisions are throttled:
- **3 seconds** when idle (no active goal)
- **0.5 seconds** when executing (re-evaluating during action)

### Priority Order

1. **Craftable Now**: Has all materials for best recipe → trigger craft immediately
2. **Recipe Completion**: Missing 1 material for best recipe → gather that specific material
3. **Inventory Not Full**: Gather highest-value material (uses scoring system)
4. **Smart Drop**: Inventory full, but gathering would be an upgrade → gather and drop lowest-value item
5. **Idle Goal**: If nothing productive, display what creature is aiming for

## Gathering Sequence

1. **Navigate**: Target resource set, wander system handles pathfinding + obstacle avoidance
2. **Arrival** (< 3.5 units): Stop moving, start gather animation
3. **Gather Phase** (duration from config):
   - Creature stationary
   - Progress bar visible on resource
   - Energy cost paid on completion (not start)
4. **Completion**:
   - Roll yield: random between min and max
   - For rocks: 12% crystal chance (bonus roll, separate from stone yield)
   - If inventory full: smart pickup evaluates drop
   - Resource marked depleted, starts regrow timer
5. **Failure**: 10-20% chance of no yield (resource still depletes)

## Result Flags

Set on creature after gathering completes:
```javascript
gatherResult = { type: 'wood', qty: 2 }  // what was gathered
gatherDone = true                          // triggers visual feedback
foundCrystal = true/false                  // crystal discovery
justDropped = [{ type, x, z, reason }]     // if items were dropped
```

## Resource Competition

- Each resource has a `gathererId` field
- If another creature is already gathering a resource, it's skipped
- Creatures fall back to their second-best choice
- Stuck detection: If no progress for 4 seconds, give up on that resource

## Goal Display Strings

The decision engine produces readable goal strings shown in the UI:

```
"Can craft Stone Blade now"
"Need 2 stone for Stone Blade"
"Gathering wood (highest value)"
"Inventory full, but crystal would improve it"
"Goal: Craft Stone Blade. Looking for stone and wood nearby."
"Equipped. Gathering materials for potions."
```

## Scared State Interaction

- Gathering is **completely blocked** during scared state
- If a creature is mid-gather when scared, the gather is interrupted
- Resource regrow timer is paused for interrupted gathers

## Energy Requirement

Creatures must have `energy >= 25` to start gathering (same as crafting).
