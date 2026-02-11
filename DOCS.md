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
│   └── CreatureUI.jsx       # Roster, stats panel, activity log, world clock
│
├── creatures/
│   ├── Creature.jsx         # Individual creature 3D rendering + eating/sleeping effects
│   ├── CreatureManager.jsx  # Per-frame simulation loop, food lifecycle, save/sync
│   ├── creatureData.js      # Creature spawning, name generation, initial stats
│   ├── creatureStore.js     # localStorage save/load/clear
│   ├── inventory.js         # Inventory system — pickup chances, eat from inventory
│   ├── behaviors/
│   │   ├── index.js         # Behavior pipeline orchestrator
│   │   ├── wander.js        # Pathfinding, obstacle avoidance, edge repulsion
│   │   ├── hunger.js        # Food system, eating, starvation
│   │   ├── energy.js        # Energy drain, tiredness, sleep/wake cycle
│   │   ├── combat.js        # Stub — proximity, aggression, damage, XP
│   │   └── leveling.js      # XP thresholds, stat gains on level-up
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
- **Inventory** — array of items (max 5 slots), persisted to localStorage
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
updateEnergy → updateHunger → updateMovement → updateCombat → checkLevelUp → state determination
```

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

### Inventory (implemented)
- **Capacity:** 5 slots per creature
- **Item type:** Berries (restore 60 hunger each)
- **Pickup:** After eating at a bush, chance to pick up an extra berry into inventory
- **Personality pickup chances:** sneaky 55%, curious 45%, timid/gentle 35%, default 30%, lazy 25%, bold/fierce 0% (never hoard)
- **Eating from inventory:** When hunger < 40 and creature has berries, eats from inventory before seeking food on the map
- **Logging:** "picked up a berry (N/5)" and "ate a berry from inventory (+X hunger)"
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

### Combat (stub)
- File exists with proximity detection, aggression checks, cooldown, damage, XP rewards
- Currently a no-op (TODO)

### Leveling (implemented)
- XP threshold: `level * 100`
- On level-up: `maxHp += floor(baseHp * 0.1)`, `hp += 10`, `atk += floor(baseAtk * 0.05) + 1`

### State Determination
Priority order: sleeping > eating > seeking food > hungry (hunger < 25) > tired (energy < 25) > wandering > idle

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
- HP / Hunger / Energy progress bars with color coding
- ATK, SPD, Level, XP, Kills values
- Personality, Age (HH:MM:SS), Status, Species
- Inventory display: 5 slots with berry icons, N/5 counter
- Follow / Unfollow button
- Close button

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
