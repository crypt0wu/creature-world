# Creature World — Project Brief

## Concept
An autonomous creature simulation game where AI-driven creatures live in a persistent world 24/7. Users watch, adopt, bet on, and trade creatures. Think Tamagotchi x idle game x crypto x Twitch Plays Pokemon — but the creatures are fully autonomous agents.

## Core Gameplay
- Original creatures (NOT Pokemon — we own the IP)
- Creatures are autonomous — they eat, sleep, fight, explore, evolve, form packs, have rivalries, and can die
- The world runs 24/7 whether anyone is watching or not
- Each creature has a unique name, personality, stats, and lived history
- Users spectate the world in real-time via a web dashboard

## Creature System
- 6 species (expandable):
  - Embrix (fire) — aggressive, fast
  - Aqualis (water) — calm, defensive
  - Verdox (grass) — passive, healer
  - Voltik (electric) — erratic, fast
  - Shadeyn (dark) — stealthy, cunning
  - Glacira (ice) — slow, powerful
- Each creature has: HP, ATK, SPD, hunger, energy, personality, level, XP, kill count, age
- Personalities: bold, timid, curious, lazy, fierce, gentle, sneaky, loyal
- Creatures make autonomous decisions based on their personality + needs:
  - Wander the world
  - Hunt for food when hungry
  - Sleep when low energy (recovers HP)
  - Fight other creatures (fierce/bold personalities initiate)
  - Level up from kills (gain HP, ATK, grow in size)
  - Die from combat or starvation

## Monetization (4 revenue streams)
1. **Adopt a creature** — one-time fee ($5-20). Each creature is unique. Minted as NFT.
2. **Betting** — bet on battles, tournaments, survival milestones (who survives longest, who evolves first)
3. **NFTs** — each creature is an NFT with real lived history on-chain. A creature that survived 6 months of battles is worth more than a newborn. Built on Solana.
4. **Cosmetics & season passes** — habitat skins, creature accessories, seasonal events with limited creature drops

## Tech Stack
- **Frontend:** React + Vite + Three.js (React Three Fiber) for 3D world visualization
- **Backend:** Node.js running the simulation loop
- **Blockchain:** Solana for NFT minting + betting mechanics
- **Real-time:** WebSockets for live spectating
- **Database:** PostgreSQL or SQLite for creature state, history, logs

## Visual Style
- Dark cyberpunk aesthetic (like the attached prototype)
- Glowing creatures with colored auras based on type
- Grid-based or open world with food spots, terrain zones
- Activity feed showing real-time events (fights, deaths, level ups)
- Creature inspector panel (click to view stats)
- Status bar showing all creatures

## MVP Scope (Build This First)
1. ✅ 2D canvas world with 12 creatures roaming autonomously (prototype done — see creature_world.jsx)
2. Upgrade to 3D with React Three Fiber
3. Add terrain/biomes (fire zone, water zone, etc. — creatures get buffs in their home biome)
4. Persistent state — creatures survive between page refreshes
5. Spectator mode — multiple users can watch the same world
6. Basic adopt flow — connect wallet, mint creature NFT

## Post-MVP
- Breeding system
- Pack/alliance formation
- Seasonal events & tournaments
- Betting system
- Leaderboard
- Mobile app

## Existing Prototype
A working React prototype exists (creature_world.jsx) with the core simulation loop, canvas rendering, creature AI state machine, activity feed, and creature inspector. Use this as a starting point and build on top of it.

## Brand
- Name: TBD (not named yet)
- Aesthetic: dark, cyberpunk, crypto-native
- Target audience: crypto degens, gamers, idle game fans, Pokemon nostalgists

## Reference
- ClawCity (GitHub: ClawCity/ClawCity-) — similar concept with React Three Fiber + CRT aesthetic
- The Agentic Labs cyberpunk dashboard we built (cyberpunk_agents.jsx) for visual style reference
