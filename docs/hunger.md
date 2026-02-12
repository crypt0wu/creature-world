# Hunger & Food System

Creatures drain hunger over time and must eat to survive. Food sources spawn on the map and respawn after being consumed.

## Constants

```
FOOD_COUNT      = 10      // Food sources in the world
FOOD_RESPAWN    = 120-180 // Seconds to respawn after eaten
EAT_RANGE       = 2.5    // Distance to start eating
EAT_DURATION    = 3.0    // Seconds to finish eating
HUNGER_RESTORE  = 60     // Hunger restored per food
MAX_HUNGER      = 100    // Hunger cap
```

## Hunger Drain Rates

Per second, continuous drain:

| Species | Drain/s | Time to Empty |
|---------|---------|---------------|
| Embrix | 0.20 | ~8.3 min |
| Aqualis | 0.10 | ~16.7 min |
| Verdox | 0.08 | ~20.8 min |
| Voltik | 0.22 | ~7.6 min |
| Shadeyn | 0.13 | ~12.8 min |
| Glacira | 0.07 | ~23.8 min |

## Hunger Thresholds

When hunger drops below threshold, creature begins seeking food:

| Personality | Threshold |
|------------|-----------|
| bold, fierce | 45 |
| sneaky, curious, timid, gentle, loyal | 40 |
| lazy | 20 |

## Food Seeking Priority

1. **Inventory first**: If creature has berries in inventory and `hunger < 40`:
   - Eat berry instantly (no travel needed)
   - Restore: `hungerRestore` (60) + 40 bonus = up to 100
   - Personality gate: `lazy` = 25% chance to check, `bold/fierce` = never use inventory berries

2. **Timid avoidance**: Timid creatures avoid food with other creatures within 5 units, unless `hunger < 15` (emergency)

3. **Map food**: Find closest active (not depleted) food source and navigate to it

## Eating Sequence

1. Navigate to food source
2. Arrive within `EAT_RANGE` (2.5 units)
3. Stop moving, set `eating = true`
4. Eat timer counts down from 3.0s
5. Food shrinks visually (visual progress 0 to 1)
6. On completion:
   - `hunger = min(100, hunger + 60)`
   - Record `lastHungerGain`
   - Attempt berry pickup (personality-dependent, max 8 inventory)
   - Mark food as inactive
   - Food respawn timer: 120-180 seconds (random)

## Berry Pickup Chances

When eating at a map food source, creature may pick up a berry:

| Personality | Chance |
|------------|--------|
| sneaky | 55% |
| curious | 45% |
| timid | 35% |
| gentle | 35% |
| loyal | 30% |
| lazy | 25% |
| bold | 0% |
| fierce | 0% |

Requires: inventory not full (< 8 items)

## Starvation

When hunger reaches 0:
- Take 0.5 HP damage per second
- If HP reaches 0: death with `deathCause = 'starvation'`

## Scared State Interaction

During scared state (`_scaredTimer > 0`):
- **Cannot** seek food on the map
- **CAN** eat from inventory if `hunger < 10` (survival threshold)
- All normal hunger-seeking behavior suppressed

## Food Source Spawning

- 10 food sources placed randomly in world at start
- Positions: random within world bounds, avoiding ponds
- Visual: Small colored sphere with particle effects
- Depleted food is invisible until respawn timer completes
