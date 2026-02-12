# Visual System

Particle effects, floating text, death animations, and creature rendering.

## Creature Rendering

Each creature is rendered as a glowing orb with:
- **Core sphere**: Species color, emissive material
- **Glow sphere**: Larger transparent sphere, species glow color
- **Point light**: Illuminates surrounding area (intensity ~3)
- **Selection ring**: Visible when creature is selected/hovered
- **Health bar**: HTML overlay showing HP

## Particle Systems

### Bite Particles (Combat)
- **Count**: 15 particles per bite
- **Trigger**: On combat hit dealt
- **Visual**: Small spheres scatter from target
- **Lifetime**: ~0.5s with velocity decay

### Damage Particles (Combat)
- **Count**: 10 particles per hit received
- **Trigger**: On taking damage
- **Visual**: Red/orange particles burst from creature
- **Lifetime**: ~0.5s

### Death Particles
- **Count**: 20 particles
- **Trigger**: On creature death
- **Visual**: Species-colored particles explode outward
- **Velocities**: X/Z: random -6 to +6, Y: +2 to +6 (upward burst)
- **Duration**: 2 seconds total
- **Core shrink**: Core orb scales to 0 opacity over 2s
- **Cleanup**: Component fully removed from scene after animation

### Zzz Particles (Sleep)
- **Trigger**: While `sleeping = true`
- **Visual**: "Z" text floats upward
- **Timer-based**: Periodic spawn

### Gather Colors
```javascript
{ wood: '#aa7744', stone: '#99aaaa', herb: '#66cc66', crystal: '#aa66ff' }
```

## Floating Text System

Two separate text display systems:

### 1. Animated Float Text (`floatingText` object)
- Floats upward from creature position
- Fades out over ~1.5 seconds
- Used for: combat events, level-ups, item pickups
- Properties: `floatTimer`, `floatValue`, `floatColor`, `floatLabel`

### 2. Persistent Label (`_floatText`)
- Stays attached to creature
- Used for: panic text during scared state
- Updated by combat.js, displayed via `display.floatText`

## Combat Float Text Events

| Event | Text | Color | System |
|-------|------|-------|--------|
| Fled (runner) | "FLED!" | `#ffaa33` | Direct floatingText |
| Caught (prey) | "CAUGHT!" | `#ff2222` | Direct floatingText |
| Draw | "Draw!" | `#ccaa44` | Direct floatingText |
| Chase started | "Chasing {name}!" | varies | Event flag → Creature.jsx |
| Chase gave up | "Gave up chase" | `#ffaa44` | Event flag → Creature.jsx |
| Chase exhausted | "Exhausted!" | `#ffaa44` | Event flag → Creature.jsx |
| Escaped | "Escaped!" | varies | Event flag → Creature.jsx |
| Panic text | "Run! Get away!" etc. | `#ffaa33` | Direct `_floatText` |

### Event Flag Pattern
Combat.js sets flags (e.g., `combatChaseStarted`, `combatChaseCaught`, `combatChaseGaveUp`, `combatChaseEscaped`) that Creature.jsx consumes on the next frame to trigger visual effects. This ensures one popup per event.

## Damage Text
- Trigger: On hit received
- Display: Damage number (e.g., "-14")
- Color: `#ff4444` (red)
- Duration: ~1s float upward

## Combat Flash
- Trigger: On hit received
- Visual: Brief white flash on creature core
- Duration: ~0.1s

## Level-Up Glow
- Trigger: `justLeveledUp` flag
- Visual: Expanding golden glow ring
- Duration: ~2s fade

## Crystal Flash
- Trigger: Crystal found while gathering
- Visual: Purple flash on creature
- Duration: Brief

## Progress Bar
- Trigger: During gathering
- Visual: Small bar above creature showing gather progress (0-100%)
- Resets on completion

## Detail Levels

Creatures use LOD (Level of Detail) based on camera distance:
- **Close**: Full detail — all particles, labels, health bar
- **Medium**: Reduced particles
- **Far**: Minimal rendering — just core + glow

## Hover Tooltip

Shared mutable state (`hoverStore.js`):
- 3D components call `setHover(label)` on pointer enter
- UI reads `hoverState` via requestAnimationFrame
- Shows creature name, species, level on hover

## Death Sequence

1. `wasAlive` transitions from true to false
2. Set display state to dead, HP to 0
3. Spawn 20 death particles with random velocities
4. Core orb shrinks to 0 over 2 seconds
5. Glow and light fade out
6. After 2s: hide group, set `removed = true`
7. Component returns null (fully removed from React tree)
