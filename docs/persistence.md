# Persistence System

All game state persists via browser LocalStorage. Sessions resume automatically.

## Storage Keys

| Key | Data | Default |
|-----|------|---------|
| `creature-world-creatures` | Array of all creature objects | `null` (triggers fresh spawn) |
| `creature-world-clock` | World clock time (number) | `0` |
| `creature-world-resources` | Resource node states (depleted, timers) | `null` |
| `creature-world-species-memory` | Generational learning data per species | `{}` |

## Save Functions

```javascript
saveCreatures(creatures)        // Full creature array
saveWorldClock(time)            // World time counter
saveResourceStates(states)      // Resource depletion/regrow state
saveSpeciesMemory(memory)       // Cross-generation learning
```

All save calls are wrapped in try/catch — silently ignore quota errors.

## Load Functions

```javascript
loadCreatures()      // Returns null if no data → triggers fresh spawn
loadWorldClock()     // Returns 0 if no data
loadResourceStates() // Returns null if no data → fresh resources
loadSpeciesMemory()  // Returns {} if no data
```

## Save Frequency

- Saves triggered periodically (throttled, every few seconds)
- Not every frame — prevents performance impact and quota exhaustion
- Species memory saved on creature death events

## What Gets Saved (Creature Object)

Every field on the creature object is serialized, including:
- Position (x, z), rotation (rotY)
- Stats (hp, maxHp, atk, spd, baseSpd)
- Status (hunger, energy, level, xp, kills)
- Inventory array (all items)
- Equipment slots (weapon, armor)
- Behavior state (sleeping, eating, gathering, etc.)
- Combat state (inCombat, _scaredTimer, _combatCooldown, etc.)
- Strategy memory (last 6 decisions)
- Personality, species, name, age

## What Gets Saved (Resources)

Per resource node:
- `depleted`: boolean
- `regrowTimer`: seconds remaining until respawn
- `gathererId`: which creature is gathering (null if none)

## Reset

`clearAll()` removes all 4 localStorage keys:
```javascript
localStorage.removeItem('creature-world-creatures')
localStorage.removeItem('creature-world-clock')
localStorage.removeItem('creature-world-resources')
localStorage.removeItem('creature-world-species-memory')
```

After clear:
- World objects regenerated (`regenerateWorld()`)
- Creatures respawn fresh (one per species)
- All timers and states reset to defaults
- Species memory wiped (generational learning resets)

## Quota Safety

All localStorage operations wrapped in try/catch:
- If storage quota exceeded, save silently fails
- Game continues running in-memory
- Data may be lost on browser close if quota hit
