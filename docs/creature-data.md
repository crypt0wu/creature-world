# Creature Data Structure

Complete list of every field on a creature object.

## Identity

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique identifier |
| `name` | string | Generated name (prefix + suffix) |
| `species` | string | Species key (e.g., 'embrix') |
| `personality` | string | One of 8 personalities |
| `alive` | boolean | Whether creature is alive |
| `age` | number | Total seconds alive |
| `phase` | number | Animation phase timer |

## Position & Movement

| Field | Type | Description |
|-------|------|-------------|
| `x` | number | World X position |
| `z` | number | World Z position |
| `rotY` | number | Facing direction (radians) |
| `moving` | boolean | Whether actively moving |
| `currentSpeed` | number | Current movement speed |
| `targetSpeed` | number | Desired movement speed |
| `targetX` | number | Navigation target X |
| `targetZ` | number | Navigation target Z |
| `stuckTimer` | number | Time spent not making progress |
| `lastDist` | number | Last distance to target (stuck detection) |
| `pause` | number | Idle pause timer (seconds remaining) |

## Stats

| Field | Type | Description |
|-------|------|-------------|
| `hp` | number | Current hit points |
| `maxHp` | number | Maximum hit points |
| `atk` | number | Attack power (includes equipment) |
| `spd` | number | Current speed stat (affected by fatigue) |
| `baseSpd` | number | Base speed stat (unmodified) |
| `level` | number | Current level (1-10) |
| `xp` | number | Current XP toward next level |
| `kills` | number | Total kills |

## Needs

| Field | Type | Description |
|-------|------|-------------|
| `hunger` | number | Current hunger (0-100, drains over time) |
| `energy` | number | Current energy (0-100, drains while active) |

## State Flags

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | Display state (e.g., 'wandering', 'fighting') |
| `sleeping` | boolean | Currently sleeping |
| `sleepTimer` | number | Seconds of sleep remaining |
| `sleepDuration` | number | Total sleep duration |
| `vulnerable` | boolean | Can be attacked (true during sleep) |
| `eating` | boolean | Currently eating |
| `eatTimer` | number | Seconds of eating remaining |
| `gathering` | boolean | Currently gathering a resource |
| `gatherTimer` | number | Seconds of gathering remaining |
| `crafting` | boolean | Currently crafting |
| `craftTimer` | number | Seconds of crafting remaining |
| `craftRecipe` | object | Recipe being crafted |
| `drinkingPotion` | boolean | Currently drinking a potion |
| `seekingFood` | boolean | Navigating to food source |
| `seekingResource` | boolean | Navigating to resource node |
| `targetFoodIdx` | number | Index of target food source (-1 if none) |
| `targetResourceIdx` | number | Index of target resource node (-1 if none) |

## Combat State

| Field | Type | Description |
|-------|------|-------------|
| `inCombat` | boolean | Currently in active combat |
| `_combatTarget` | number | ID of combat opponent |
| `_combatTimer` | number | Total time in current combat |
| `_combatHits` | number | Hit exchanges in current fight |
| `_hitTimer` | number | Countdown to next hit |
| `_combatCooldown` | number | Seconds before can fight again |

## Flee/Chase State

| Field | Type | Description |
|-------|------|-------------|
| `_fleeSprint` | number | Seconds of flee sprint remaining |
| `_fleeFromX` | number | X position of threat |
| `_fleeFromZ` | number | Z position of threat |
| `_fleeMinDist` | number | Minimum distance to maintain from threat |
| `_fleeZigzag` | number | Timer for next zigzag direction change |
| `_pendingEscape` | boolean | Waiting for escape confirmation |
| `_scaredTimer` | number | Seconds of scared state remaining |
| `_scaredOfId` | number | ID of creature scared of |
| `_chasing` | boolean | Currently chasing fleeing prey |
| `_chaseTarget` | number | ID of chase target |
| `_chaseTimer` | number | Seconds remaining in chase |
| `_chaseDelayTimer` | number | Seconds remaining in chase delay |
| `_chaseDelayTarget` | number | ID of creature being considered for chase |

## Inventory & Equipment

| Field | Type | Description |
|-------|------|-------------|
| `inventory` | array | Items held (max 8) |
| `weapon` | object/null | Equipped weapon (Stone Blade) |
| `armor` | object/null | Equipped armor (Wooden Shield) |

### Item Object
```javascript
{
  type: 'wood',           // item type
  id: 'stone_blade_1',   // unique identifier (equipment)
  slot: 'weapon',         // equipment slot (weapon/armor/consumable)
  atkBonus: 8,           // weapon stat bonus
  maxHpBonus: 15,        // armor stat bonus
  healAmount: 40,        // potion heal amount
  durability: 50,        // current durability
  maxDurability: 50,     // max durability
}
```

## Visual Event Flags

These flags are set by behavior systems and consumed by Creature.jsx for visual effects:

| Field | Type | Description |
|-------|------|-------------|
| `justLeveledUp` | object/null | Level-up data (newLevel, gains) |
| `justCrafted` | object/null | Crafting result data |
| `justUsedPotion` | object/null | Potion use data |
| `justDropped` | array/null | Items dropped this frame |
| `gatherResult` | object/null | Gathering result data |
| `gatherDone` | boolean | Gathering just completed |
| `foundCrystal` | boolean | Crystal discovered |
| `combatInterrupted` | boolean | Activity interrupted by combat |
| `combatChaseStarted` | object/null | Chase initiated data |
| `combatChaseCaught` | object/null | Prey caught data |
| `combatChaseGaveUp` | object/null | Chase abandoned data |
| `combatChaseEscaped` | object/null | Prey escaped data |
| `floatingText` | object/null | Direct float text to display |
| `_floatText` | string | Persistent label text (panic texts) |
| `deathCause` | string | Cause of death ('starvation', 'combat') |
| `lastHungerGain` | number | Last hunger restoration amount |

## Behavior Memory

| Field | Type | Description |
|-------|------|-------------|
| `_gatherGoal` | object/null | Current gathering decision |
| `_craftCooldown` | number | Seconds until can craft again |
| `_equipDelay` | number | Seconds until auto-equip runs |
| `_wantsCraftNow` | boolean | Decision engine flagged immediate craft |
| `strategyMemory` | array | Last 6 item decisions |

## Thinking Text

| Field | Type | Description |
|-------|------|-------------|
| `thinkingText` | string | Current AI reasoning display text |
| `_panicTextTimer` | number | Timer for cycling panic texts |
