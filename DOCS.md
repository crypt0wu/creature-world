# Creature World

Autonomous 3D creature simulation built with Vite + React + React Three Fiber. Six glowing orb species roam a procedural wilderness, eating, wandering, and surviving alongside NPC wildlife. Everything persists via localStorage.

**Stack:** Vite 7, React 19, Three.js r175, @react-three/fiber, @react-three/drei

---

## Folder Structure

```
src/
├── App.jsx                  # Canvas, scene, WASD controls, camera, HoverTooltip, UI wiring
├── main.jsx                 # React root mount
├── index.css                # Global styles
├── hoverStore.js            # Shared mutable hover state (no re-renders)
├── worldData.js             # Trees/rocks/bushes generation, ponds, obstacles, animal registry
│
├── components/
│   ├── Terrain.jsx          # 200x200 terrain mesh, getTerrainHeight(), getZoneDensity()
│   ├── Water.jsx            # Two animated pond surfaces
│   ├── Trees.jsx            # Tree, Rock, Bush meshes from WORLD_ITEMS
│   ├── DayNightCycle.jsx    # Orbiting sun, ambient/hemisphere lights, shadow config
│   ├── Fireflies.jsx        # 300+ instanced firefly particles
│   ├── Wildlife.jsx         # 12 NPC animal species, fish, butterflies
│   ├── FoodSources.jsx      # Berry bush visuals, shrink/shake/pop effects
│   ├── DroppedItems.jsx     # Ground items from smart drops, countdown, pickup
│   └── CreatureUI.jsx       # Roster, 6-section stats panel, activity log, thinking AI
│
├── creatures/
│   ├── Creature.jsx         # Individual creature 3D rendering + eating/sleeping effects
│   ├── CreatureManager.jsx  # Per-frame simulation loop, food lifecycle, save/sync
│   ├── creatureData.js      # Creature spawning, name generation, initial stats
│   ├── creatureStore.js     # localStorage save/load/clear
│   ├── inventory.js         # Inventory system — pickup chances, eat from inventory, smart drops
│   ├── crafting.js          # Recipes, auto-craft, equipment, potions
│   ├── scoring.js           # Item valuation, species memory, strategy memory
│   ├── behaviors/
│   │   ├── index.js         # Behavior pipeline orchestrator
│   │   ├── wander.js        # Pathfinding, obstacle avoidance, edge repulsion
│   │   ├── hunger.js        # Food system, eating, starvation
│   │   ├── gathering.js     # Resource gathering — wood, stone, herbs, crystals
│   │   ├── crafting.js      # Auto-craft behavior, auto-equip, auto-use potions
│   │   ├── energy.js        # Energy drain, tiredness, sleep/wake cycle
│   │   ├── combat.js        # Full combat — engagement, damage, type matchups, death, rewards
│   │   └── leveling.js      # XP thresholds, stat gains, max level 10, level-up effects
│   └── species/
│       ├── index.js         # Species registry
│       ├── embrix.js        # Fire — fast, aggressive
│       ├── aqualis.js       # Water — tanky, efficient
│       ├── verdox.js        # Grass — passive, outlasts everything
│       ├── voltik.js        # Electric — erratic, burns resources
│       ├── shadeyn.js       # Dark — stealthy, calculated
│       └── glacira.js       # Ice — slow, devastating
```

---

## Species

Six species, one creature each at world start. All render as glowing orbs with species-colored light.

| Species | Type | HP | ATK | SPD | Hunger Drain | Energy Drain | Range | Pause (s) |
|---------|------|----|-----|-----|-------------|-------------|-------|-----------|
| **Embrix** | Fire | 80 | 15 | 8 | 0.20 | 0.12 | 25 | 1–4 |
| **Aqualis** | Water | 120 | 8 | 4 | 0.10 | 0.08 | 15 | 5–15 |
| **Verdox** | Grass | 100 | 6 | 4 | 0.08 | 0.06 | 12 | 8–20 |
| **Voltik** | Electric | 70 | 12 | 10 | 0.22 | 0.15 | 30 | 0.5–2 |
| **Shadeyn** | Dark | 85 | 14 | 7 | 0.13 | 0.10 | 20 | 3–8 |
| **Glacira** | Ice | 130 | 16 | 3 | 0.07 | 0.05 | 10 | 6–18 |

**Behavior weights** (aggression / exploration / caution):
- Embrix: 0.8 / 0.7 / 0.2
- Aqualis: 0.2 / 0.4 / 0.8
- Verdox: 0.1 / 0.2 / 0.6
- Voltik: 0.5 / 0.9 / 0.3
- Shadeyn: 0.7 / 0.5 / 0.7
- Glacira: 0.4 / 0.2 / 0.5

**Colors:**
- Embrix: `#ff4422` / glow `#ff6600`
- Aqualis: `#2288ff` / glow `#44aaff`
- Verdox: `#22cc44` / glow `#44ff66`
- Voltik: `#ffcc00` / glow `#ffee44`
- Shadeyn: `#9944cc` / glow `#bb66ff`
- Glacira: `#66ccff` / glow `#88eeff`

---

## Creatures

### Spawning
- 6 creatures total (one per species) created via `createAllCreatures()`
- Positioned in a ring: radius 15–40 from origin, evenly spaced by angle
- Random procedural names from prefix+suffix combos (e.g. "Pyraxis", "Nyx-ion")
- Random personality from: bold, timid, curious, lazy, fierce, gentle, sneaky, loyal

### Stats
- **HP / maxHp** — hit points, starts at species baseHp
- **ATK** — attack power
- **SPD / baseSpd** — movement speed
- **Hunger** — 0–100, drains at species rate per second. Starvation at 0 deals 0.5 HP/s
- **Energy** — 0–100, drains at species rate per second. Below 25 = tired (slower). At threshold = sleep
- **Sleeping / sleepTimer / sleepDuration / vulnerable** — sleep state tracking
- **Inventory** — array of items (max 8 slots, types: berry/wood/stone/herb/crystal), persisted to localStorage
- **Level / XP / Kills** — progression tracking
- **Age** — seconds alive (incremented per frame)

### Persistence
- Saved to `localStorage` every 5 seconds (key: `creature-world-creatures`)
- World clock saved separately (key: `creature-world-clock`)
- On load, existing save is restored with missing fields backfilled
- `clearAll()` wipes both keys (Reset World button)

---

## Behaviors

Update pipeline runs every frame in `CreatureManager.useFrame()`:
```
updateEnergy → [if not in combat: updateHunger → updateGathering → updateCrafting → updateMovement] → updateCombat → checkLevelUp → state determination
```
When a creature is in active combat, hunger/gathering/crafting/movement behaviors are skipped — combat handles its own movement (chase/face target).

### Wander (implemented)
- **Idle:** Waits `pauseMin`–`pauseMax` seconds, then picks random target within `range`
- **Moving:** Accelerates to `spec.baseSpd`, lerps rotation toward target at 2.5/s
- **Obstacle avoidance:** Steers around trees, rocks, bushes (3.0 unit buffer) and ponds (radius + 4 buffer)
- **Stuck detection:** If distance doesn't decrease for 2.5s, picks new target
- **Edge repulsion:** Gradient push-back starting 15 units from world edge (world half = 95)
- **Hard boundary:** Clamped to ±92 units

### Hunger (implemented)
- Hunger drains continuously at `spec.hungerDrain`/s
- **Personality thresholds:** bold/fierce seek food at hunger < 45, normal at < 40, lazy at < 20
- **Timid creatures:** Won't approach food if another creature is within 5 units (unless hunger < 15)
- **Seeking:** Targets nearest active food source, walks toward it
- **Eating:** 3-second eat duration, creature stops moving, food shrinks visually
- **Completion:** Restores 60 hunger (capped at 100), food despawns with pop effect
- **Starvation:** At hunger 0, takes 0.5 HP/s damage. Dies when HP hits 0.

### Gathering (implemented)
- **Resources:** Trees (wood), rocks (stone), bushes (herbs). Rocks have a 12% crystal drop chance.
- **Decision:** Idle creatures with energy > 20 and inventory space seek nearby resources (range 40)
- **Preferences:** Fire/bold/fierce → trees, water/ice/gentle → rocks, grass/curious → bushes, else nearest
- **Duration:** Trees 5s, rocks 4s, bushes 3s
- **Yield:** Trees 1–3 wood, rocks 1–2 stone (+12% crystal), bushes 1–2 herbs
- **Energy cost:** Trees 12, rocks 10, bushes 4
- **Regrow:** Trees 120–180s, rocks 180–300s, bushes 60–120s
- **Visual depletion:** Resources shrink to 0 on harvest, then slowly regrow back to full size
- **Claiming:** Only one creature can gather a resource at a time
- **States:** `seeking resource` (walking to target), `gathering` (harvesting in place)
- **New creature fields:** `gathering`, `gatherTimer`, `seekingResource`, `targetResourceIdx`, `targetResourceType`, `gatherResult`, `gatherDone`, `foundCrystal`
- **Logging:** "is chopping/mining/picking", "gathered N type", "found a rare crystal!"
- **Visuals:** Faster orb pulse during gathering, resource-colored particles, float text on completion, crystal flash effect
- **Persistence:** Resource depletion states saved/loaded via localStorage

### Inventory (implemented)
- **Capacity:** 8 slots per creature
- **Item types:** Berries (restore 60 hunger), wood, stone, herbs, crystals
- **Berry pickup:** After eating at a bush, chance to pick up an extra berry into inventory
- **Personality pickup chances:** sneaky 55%, curious 45%, timid/gentle 35%, default 30%, lazy 25%, bold/fierce 0% (never hoard)
- **Eating from inventory:** When hunger < 40 and creature has berries, eats from inventory before seeking food on the map
- **Logging:** "picked up a berry (N/8)" and "ate a berry from inventory (+X hunger)"
- **Persistence:** Inventory array saved/loaded via localStorage

### Energy & Sleep (implemented)
- **Drain:** Base `spec.energyDrain`/s + 50% bonus when moving + speed-proportional bonus
- **Tired (energy < 25):** Speed reduced proportionally — 100% at energy 25, down to 50% at energy 0
- **Sleep trigger:** Personality-based threshold:
  - Default: energy < 10
  - Lazy: energy < 20
  - Fierce: energy < 3
- **Falling asleep:** Sets `sleeping=true`, `moving=false`, `seekingFood=false`, `vulnerable=true`
- **Sleep duration:** 15–30s (lazy: 20–40s, fierce: 10–20s)
- **While sleeping:** Energy regens at 4.0/s (flat), HP regens at 0.5/s, hunger does not drain
- **Wake:** Clears sleeping/vulnerable flags, resumes normal behavior
- **Visuals:** Orb dims (emissive 0.2 + slow pulse), slow breathing scale, floating "zZz" text, "Awake!" on wake
- **Sleeping creatures are vulnerable** — cannot move, eat, or seek food

### Combat (implemented)
Full creature-vs-creature combat system with AI-driven engagement, turn-based damage exchange, and permanent death.

**Engagement:**
- Detection radius: 12 units
- Personality determines aggression: fierce/bold attack on sight, timid/gentle try to flee, sneaky only attacks weaker targets, curious evaluates first
- Creatures evaluate before fighting: HP, weapon, target strength, level comparison
- Creatures do NOT fight while sleeping, eating, or crafting
- Sleeping/crafting/gathering creatures can be interrupted and forced into combat

**Damage Mechanics:**
- Damage = ATK × random(0.7–1.3). Equipment bonuses included in ATK stat
- Type matchups (1.5× damage bonus): fire > grass > water > fire, electric > water, dark > electric, ice > fire
- Armor reduces incoming damage (30% of armor maxHpBonus as flat reduction)
- Hit interval: 1–2 seconds per strike
- Combat radius: 3.5 units (creatures chase if further, disengage if > 18 units)

**Fleeing:**
- Creatures can attempt to flee mid-combat every 3 seconds
- Speed determines escape: faster = 60% chance, slower/equal = 20% chance
- Timid flees at HP < 70%, gentle < 60%, sneaky < 40%, curious < 50%, anyone < 30%

**Death:**
- HP 0 = permanent death. Creature removed from world and roster
- Death animation: orb shrinks while particles shatter outward, fades over 2 seconds
- Death cause recorded in species memory for generational learning
- Log: "X defeated Y! (+25 XP)" and "Y has been slain by X!"

**Rewards:**
- Winner gets XP = opponent level × 25
- Kill count increases
- Winner loots 1–2 random items from dead creature's inventory
- 60-second cooldown before fighting again

**Visual Effects:**
- Both orbs pulse rapidly during combat (15 Hz)
- Combat shake: rapid jitter on X/Z axes
- Red damage particles fly from attacker toward target on each hit
- Yellow particles + "SUPER EFFECTIVE!" text on type advantage hits
- Floating damage numbers ("-12", "-8") pop up on hit
- HP bars drain visibly
- Bright flash on each hit dealt/taken
- Death: orb shatters into species-colored particles, shrinks and fades

**New creature fields:** `inCombat`, `_combatTarget`, `_combatCooldown`, `_hitTimer`, `_fleeTimer`, `combatHitDealt`, `combatHitTaken`, `combatKill`, `combatDeath`, `combatEngaged`, `combatFled`, `combatInterrupted`, `deathCause`, `killedBy`

### Leveling (implemented)
- XP threshold: `level * 30` to level up (Lv.1 needs 30 XP, Lv.5 needs 150 XP)
- XP sources: defeating creatures (opponent level × 25 XP)
- On level-up: +10 max HP, +2 ATK, +1 SPD (also increases baseSpd)
- Max level: 10
- Level-up animation: bright glow burst (2s), floating "LEVEL UP! Lv.N" text, yellow particle burst
- Log: "X reached Level N! (+10 HP, +2 ATK, +1 SPD)"
- **New creature field:** `justLeveledUp`

### State Determination
Priority order: fighting > sleeping > eating > gathering > seeking food > seeking resource > hungry (hunger < 25) > tired (energy < 25) > wandering > idle

---

## NPC Animals

12 animal species loaded as GLB models from `assets/animals/`. Spawned in herds around random centers.

| Animal | Speed | Range | Behavior | Notes |
|--------|-------|-------|----------|-------|
| Deer | 1.6 | 18 | grazer | Slow, long pauses |
| Stag | 1.4 | 20 | grazer | |
| Cow | 1.2 | 14 | grazer | |
| Bull | 1.5 | 16 | grazer | |
| Alpaca | 1.3 | 12 | grazer | |
| Donkey | 1.5 | 14 | grazer | |
| Fox | 3.5 | 25 | quickRoamer | Fast, short pauses |
| Husky | 3.8 | 28 | quickRoamer | |
| Shiba Inu | 3.4 | 22 | quickRoamer | |
| Horse | 3.0 | 45 | trotter | Large range |
| White Horse | 2.8 | 40 | trotter | |
| Wolf | 2.2 | 30 | patrol | Medium speed, herding |

**Behavior profiles:**

| Profile | Pause (s) | Accel | Decel | Turn Speed | Wobble |
|---------|-----------|-------|-------|------------|--------|
| grazer | 8–22 | 0.6 | 1.0 | 1.2 | yes |
| quickRoamer | 0.5–3 | 2.5 | 2.0 | 3.0 | yes |
| trotter | 3–8 | 1.0 | 1.2 | 0.8 | yes |
| patrol | 1.5–5 | 1.5 | 1.5 | 2.0 | yes |

**Other wildlife:**
- **Fish:** 4 in main pond, 2 in secondary. Figure-8 swimming with bob animation.
- **Butterflies/Dragonflies:** 10 total, scattered across terrain. Sine-wave flight paths.

**Features:** Sprint mechanic (up to 7x speed), animation blending (Walk/Idle/Eat/Run), stuck detection with multi-directional pathfinding, smooth avoidance steering, herding bias toward group centers.

---

## Resources

### Food Sources (Berry Bushes)
- **Count:** 10 active at any time
- **Spawning:** Random positions on valid terrain (avoids ponds, obstacles, water, world edges)
- **Visuals:** Dark green bush base + 4 pink/red berry spheres + glow light
- **Nutrition:** +60 hunger per consumption (capped at 100)
- **Eat duration:** 3 seconds
- **Respawn:** 30–60 seconds after consumed, at a new random position

**Eating effects:**
- Food shakes while being eaten (`sin/cos` at 20 Hz)
- Gradually shrinks based on eat progress (down to 5% scale)
- Pop particle burst (12 green particles with gravity) on full consumption

---

## World

### Terrain
- **Size:** 200x200 plane, 256x256 vertex resolution
- **Height:** Multi-octave noise — large hills (4.0 amp) + medium (1.5–2.0) + small bumps (0.4–0.5)
- **Ponds:** Two depressions carved into terrain
  - Main pond: center (15, -5), radius 12
  - Secondary: center (-30, 25), radius 7
- **Clearing:** Center (-25, -20), radius 18, flattens 60% of terrain height
- **Vertex coloring:** Dark theme — deep ponds near-black, shores muddy, plains dark green, forests very dark

### Vegetation (from worldData.js)
- **Trees:** ~250 attempts, density-driven placement via `getZoneDensity()`. Cylinder trunk + cone crown.
- **Rocks:** ~80, scattered everywhere. Dodecahedron geometry, flat shading.
- **Bushes:** ~150, favor forest edges. Sphere-based with overlap.
- All have collision radii used by creature/animal pathfinding.

### Forest Zones
`getZoneDensity()` returns 0–1 controlling tree/bush placement:
- 4 forest zones boost density (+0.6 each)
- 2 clearing zones suppress (-0.5)
- 2 pond zones suppress (-1.0)
- Base density: 0.35

### Water
- Two pond surfaces (CircleGeometry) with animated opacity and Y oscillation
- Dark teal color, metallic properties

### Day/Night Cycle
- Directional light orbits at radius 60, cycle speed 0.015
- Sun height varies 5–65 units
- Light intensity: 1.2–2.2, color shifts from cool blue (night) to warm white (day)
- Ambient light: 1.2–1.7 intensity
- Hemisphere light: green-tinted ground bounce
- Shadows: 2048x2048 shadow map, ±80 unit coverage

### Fireflies
- 300+ instanced particles via InstancedMesh
- Three color variants: warm yellow (60%), soft green (25%), blue (15%)
- Sinusoidal animation on all axes + pulsing scale

---

## UI

### HoverTooltip
- Shared mutable store (`hoverStore.js`) — no React re-renders
- RAF loop reads state and positions a fixed `<div>` near cursor
- Shows on hover: creature name+species, animal type, "Berry Bush", "Tree", "Rock", "Bush"

### Creature Roster (left panel)
- Lists all 6 creatures with name, level, HP bar, current state
- Click to select — highlights entry, shows stats panel
- Dead creatures shown at 40% opacity

### Stats Panel (bottom, when selected)
Six-section layout (480px wide, Chakra Petch headers, Space Mono data):
1. **Header** — Creature name (species-colored), species label, Lv. badge, Follow/Close buttons
2. **Stat Bars** — HP (green), Hunger (orange), Energy (blue) full-width progress bars
3. **Stats Grid** — 2 columns: ATK (with red equipment bonus like "14 (+5)"), SPD, XP, Kills, Personality, Age, Status, Species
4. **Equipment** — Always-visible weapon/armor slots side by side. Filled = emoji + name + stat bonus with colored left border. Empty = dashed outline with dim label
5. **Inventory** — 8 stacked slots (same items grouped with ×N count badge). Hover for tooltip. Empty slots dashed/dimmed
6. **Thinking** — Purple-themed AI reasoning box showing creature's current strategy in quotes. Updates every 0.5s

### Activity Log (right panel)
- Last 50 events (displays 30), timestamped
- Color-coded by species
- Events: state changes, eating completion (+hunger), deaths

### World Clock (top bar)
- Displays elapsed time in HH:MM:SS
- Reset World button clears localStorage and reloads

---

## Controls

### Camera
- **Mouse orbit:** Left-drag to rotate, scroll to zoom (via OrbitControls)
- **Click terrain:** Camera glides smoothly to clicked point (eased animation)
- **Auto-rotate:** Slow rotation when idle, pauses on any input
- **Follow mode:** Camera tracks selected creature (lerps toward creature position)

### Movement (WASD)
- **W/S:** Forward/backward relative to camera facing
- **A/D:** Strafe left/right relative to camera facing
- Velocity-based with acceleration, friction-based deceleration
- Speed: 30 units/s max
- Pauses auto-rotate while active

### Selection
- **Click creature:** Opens stats panel, highlights in roster
- **Click roster entry:** Same as clicking creature in world
- **Follow button:** Camera tracks creature continuously
- **Click terrain while following:** Stops following

---

## Architecture Notes

### Performance
- Creature simulation uses mutable `useRef` arrays — no React re-renders per frame
- UI syncs via `useState` every 0.5 seconds
- Hover tooltip uses RAF + direct DOM manipulation — zero re-renders
- Fireflies use InstancedMesh (single draw call for 300+ particles)
- Particle systems use raw `BufferGeometry` + `Float32Array`

### Data Flow
```
CreatureManager (useFrame)
  ├── updates creature array (mutable ref)
  ├── updates food array (mutable ref)
  ├── syncs to App state every 0.5s → CreatureUI re-renders
  └── saves to localStorage every 5s

Creature (useFrame)
  ├── reads creature data from shared ref
  ├── updates 3D position/rotation/effects
  └── syncs display state every 0.5s (local useState)
```

### Collision System
- `OBSTACLES` array in worldData.js: flat list of {x, z, radius} for all trees/rocks/bushes
- `PONDS` array: {cx, cz, radius} for both ponds
- Creatures check obstacles + ponds each frame for steering
- NPC animals use `animalPositions` shared array for inter-animal avoidance
