# Creature World - Complete Game Documentation

A 3D browser-based creature simulation built with React, Three.js (react-three-fiber), and Vite. Creatures autonomously wander, eat, sleep, gather resources, craft items, and fight each other in a persistent open world.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Species & Stats](./species.md) | All 6 species with full stat tables, personalities, and type matchups |
| [Creature Data](./creature-data.md) | Complete creature object structure — every field explained |
| [Combat System](./combat.md) | 5-phase combat flow: Fight, Flee, Chase Decision, Chase, Scared |
| [Movement & Wander](./movement.md) | Pathfinding, obstacle avoidance, flee mechanics, speed modifiers |
| [Hunger & Food](./hunger.md) | Hunger drain, food seeking, eating, starvation, inventory eating |
| [Energy & Sleep](./energy.md) | Energy drain, fatigue, sleep triggers, sleep duration, regen |
| [Leveling & XP](./leveling.md) | XP sources, level thresholds, stat gains per level |
| [Gathering & Resources](./gathering.md) | Resource types, gather durations, yields, regrow timers |
| [Crafting & Items](./crafting.md) | Recipes, crafting flow, equipment, potions, auto-equip |
| [Inventory & Scoring](./inventory.md) | Item scoring, smart drops, strategy memory, species memory |
| [World & Environment](./world.md) | World gen, terrain, ponds, trees, day/night cycle, lighting |
| [Behavior Orchestration](./behavior-loop.md) | Update order, state machine, system blocking rules |
| [Visual System](./visuals.md) | Particles, float text, death animation, UI components |
| [Persistence](./persistence.md) | LocalStorage save/load, reset mechanism |
| [Controls & Camera](./controls.md) | WASD movement, orbit camera, click-to-navigate |

## Tech Stack

- **React 18** + **react-three-fiber** (Three.js renderer)
- **@react-three/drei** (helpers: OrbitControls, Html, etc.)
- **Vite** (dev server + bundler)
- **LocalStorage** (persistence layer)

## Quick Start

```bash
cd creature-world
npm install
npm run dev
```

Default port: `5173` (or next available)
