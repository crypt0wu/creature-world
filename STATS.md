# CREATURE WORLD — COMPLETE STAT SHEET

---

## 1. SPECIES BASE STATS

| Species | Type | HP | ATK | SPD | Hunger Drain/s | Energy Drain/s | Pause (s) | Wander Range | Aggression |
|---------|------|---:|----:|----:|---------------:|--------------:|----------:|-------------:|-----------:|
| **Embrix** | Fire | 80 | 15 | 8 | 0.20 | 0.12 | 1–4 | 25 | 0.8 |
| **Aqualis** | Water | 120 | 8 | 4 | 0.10 | 0.08 | 5–15 | 15 | 0.2 |
| **Verdox** | Grass | 100 | 6 | 4 | 0.08 | 0.06 | 8–20 | 12 | 0.1 |
| **Voltik** | Electric | 70 | 12 | 10 | 0.22 | 0.15 | 0.5–2 | 30 | 0.5 |
| **Shadeyn** | Dark | 85 | 14 | 7 | 0.13 | 0.10 | 3–8 | 20 | 0.7 |
| **Glacira** | Ice | 130 | 16 | 3 | 0.07 | 0.05 | 6–18 | 10 | 0.4 |

Other species behavior weights (exploration / caution):
- Embrix: 0.7 / 0.2
- Aqualis: 0.4 / 0.8
- Verdox: 0.2 / 0.6
- Voltik: 0.9 / 0.3
- Shadeyn: 0.5 / 0.7
- Glacira: 0.2 / 0.5

---

## 2. CRAFTING RECIPES

| Recipe | Materials | Craft Time (s) | Energy Cost | Effect | Max Durability |
|--------|-----------|:-----------:|:-----------:|--------|:--------------:|
| **Stone Blade** | 1 wood + 2 stone | 15–20 | 15 | +8 ATK | 50 |
| **Wooden Shield** | 2 wood | 20–25 | 20 | +15 max HP | 40 |
| **Healing Potion** | 2 herb | 10–12 | 8 | Heals 40 HP | consumable |

- Craft cooldown between crafts: **4s**
- Auto-equip delay after crafting: **2s**
- Minimum energy to start crafting: **25**
- Minimum inventory items to attempt craft: **2**
- Interrupted craft refund: **materials returned, 50% energy refunded**
- Equipment replacement: replaces slot if current durability < 5

---

## 3. RESOURCE GATHERING

| Resource | Item | Duration (s) | Energy Cost | Yield | Fail Chance | Crystal Chance | Regrow Time (s) |
|----------|------|:------------:|:-----------:|:-----:|:-----------:|:--------------:|:---------------:|
| **Tree** | Wood | 5 | 12 | 1–3 | 20% | — | 300–480 |
| **Rock** | Stone | 4 | 10 | 1–2 | 15% | 12% | 480–720 |
| **Bush** | Herb | 3 | 4 | 1–2 | 10% | — | 180–300 |

- Gather search range: **40 units**
- Arrive distance (start gathering): **3.5 units**
- Minimum energy to start gathering: **20**
- Stuck timeout on navigation: **4s**
- Decision re-eval timer: **0.5s** idle, **3.0s** when executing a plan
- Lazy creatures pause **2s** between gather tasks (others: 0s)

---

## 4. COMBAT VALUES

### Engagement
- Engage scan radius: **12 units**
- Combat melee radius: **3.5 units**
- Aggression roll per frame: `aggro * dt * 0.3` (species aggression weight, e.g. Embrix 0.8)
- Same-species fight: **90% skip** (10% chance to fight own kind)
- Won't start fight if HP < **25%** of max
- Combat cooldown after fight: **60s**
- Give-up distance: **36 units** (3x engage radius)

### Hitting
- Hit interval: **2.0s**
- Defender first-hit delay: **1.0s** after attacker
- Max hits per creature: **4** (8 total between both), then mutual disengage
- Hard timeout safety: **30s** force-end

### Damage Formula
```
base = ATK × random(0.8 – 1.2)
type_bonus = 1.5x if super effective, 1.0x otherwise
armor_reduction = defender.armor.maxHpBonus × 0.3
final = max(1, round(base × type_bonus - armor_reduction))
```

### Type Advantage (attacker → defender = 1.5x)
| Attacker | Super Effective vs |
|----------|-------------------|
| Fire | Grass |
| Grass | Water |
| Water | Fire |
| Electric | Water |
| Dark | Electric |
| Ice | Fire |

### Equipment Durability Loss Per Hit
- Weapon (attacker): **3–5** per hit dealt
- Armor (defender): **4–6** per hit taken
- Low durability warning: at **25%** remaining

### Flee Thresholds (checked ONLY on the creature that just took damage)
| Defender HP % | Flee Chance |
|:-------------:|:-----------:|
| > 60% | 0% |
| 40–60% | 20% |
| 20–40% | 50% |
| < 20% | 75% |

Only the defender rolls for flee. The attacker never rolls on the same turn.

### Flee Execution
- Only ONE creature flees (the loser). The winner stays put.
- Flee direction: **exact opposite** from winner's position
- Flee sprint duration: **10–12s** at **2x speed**
- Erratic zigzag: direction jink every **0.3–0.8s**, ±8–15 unit lateral offset
- Speed fluctuation: **±20%** wobble during sprint
- Scared timer: **7–30s** after fleeing (randomized, blocks gathering/crafting)
- Min flee distance before stopping: **35 units**
- Runner combat cooldown: **7–30s** (= scared time)
- Flee XP: **+5 XP** for runner

### Chase System
- **3 second delay**: winner stands still for 3s before deciding (head start for prey)
- During delay: prey sprints away building ~6 speed-units of distance
- If chase NO: winner returns to normal immediately, cooldown **30s**

| Condition | Chase Chance |
|-----------|:-----------:|
| Winner HP < 40% | **0% (never)** |
| Fierce / Bold | **70%** |
| Sneaky | **50%** |
| All others | **25%** |
| Prey HP < 15% | **90% override** (going for kill) |
| Prey HP < 25% | **+30% bonus** (going for kill) |
| Prey HP < 35% | **+15% bonus** |

- Chase duration: **8s** max (after the 3s delay)
- Chase speed: **1.5x** normal movement speed (`spd * 0.4 * 1.5`)
- Catch distance: **< 3 units**
- On catch: combat resumes, prey flee state cleared
- Energy drain during chase: **0.3/s**, gives up at energy ≤ 5

### Mutual Disengage (hit limit = draw)
- No fleeing — both walk **15 units** apart
- Both get combat cooldown: **60s**
- Both get **+5 XP**

### Kill Rewards
- Kill XP: `victim.level × 25`
- Loot: **1–2 random items** from victim inventory (50% chance of 2nd)
- Loot cap: stops if killer inventory = 8

### XP From Damage
- Per hit: `max(1, floor(damage / 5))` — doubled if super effective

---

## 5. LEVELING

| Level | XP to Next Level | Cumulative XP |
|:-----:|:----------------:|:-------------:|
| 1→2 | 30 | 30 |
| 2→3 | 60 | 90 |
| 3→4 | 90 | 180 |
| 4→5 | 120 | 300 |
| 5→6 | 150 | 450 |
| 6→7 | 180 | 630 |
| 7→8 | 210 | 840 |
| 8→9 | 240 | 1080 |
| 9→10 | 270 | 1350 |

Formula: `XP needed = level × 30`

### Stat Gains Per Level
- **+10 max HP** (also heals 10 HP)
- **+2 ATK**
- **+1 SPD** (both spd and baseSpd)

### Max Level: **10**

### Level 10 Stats (base + 9 level-ups, no equipment)
| Species | HP | ATK | SPD |
|---------|---:|----:|----:|
| Embrix | 170 | 33 | 17 |
| Aqualis | 210 | 26 | 13 |
| Verdox | 190 | 24 | 13 |
| Voltik | 160 | 30 | 19 |
| Shadeyn | 175 | 32 | 16 |
| Glacira | 220 | 34 | 12 |

---

## 6. HUNGER & ENERGY THRESHOLDS

### Hunger
- Max hunger: **100**
- Food seek threshold (personality-based):
  - Bold / Fierce: **< 45**
  - Default: **< 40**
  - Lazy: **< 20**
- Cancel food seeking: hunger >= **threshold + 10**
- Eat from inventory threshold: hunger **< 40**
- Scared + starving eat threshold: hunger **< 10** (inventory only)
- Timid near-food avoidance: won't approach if other creature within **5 units** of food (unless hunger < 15)

### Food Sources
- Count: **10** on map
- Eat range: **2.5 units**
- Eat duration: **3.0s**
- Hunger restore per food: **+60**
- Food respawn: **120–180s**
- Berry pickup after eating: personality-based chance (see inventory)
- Berry hunger restore (from inventory): **+60**

### Starvation
- Damage rate at 0 hunger: **0.5 HP/s**
- Death at 0 HP from starvation

### Energy
- Max energy: **100**
- Base drain: species `energyDrain` value per second
- Moving drain: **1.5x** base + speed-proportional bonus (`currentSpeed/baseSpd × energyDrain × 0.5`)

### Tired State (energy < 25)
- Speed reduction: linear from **100% at 25 energy → 50% at 0 energy**
- Formula: `baseSpd × (0.5 + (energy/25) × 0.5)`

### Sleep
- Sleep trigger threshold:
  - Default: energy **< 10**
  - Lazy: energy **< 20**
  - Fierce: energy **< 3**
- Sleep duration:
  - Default: **15–30s**
  - Lazy: **20–40s**
  - Fierce: **10–20s**
- Sleep energy regen: **4.0/s**
- Sleep HP regen: **0.5/s**
- Vulnerable during sleep: **yes** (flag set)

---

## 7. PERSONALITY TYPES & BEHAVIOR MODIFIERS

8 personalities: `bold, timid, curious, lazy, fierce, gentle, sneaky, loyal`

| Personality | Combat | Hunger | Energy/Sleep | Crafting Bias | Gathering | Item Scoring |
|-------------|--------|--------|--------------|---------------|-----------|-------------|
| **Bold** | Chase 70% | Seek food < 45 | Default sleep < 10 | Prefers weapons | — | Weapon mat ×1.3, Defense mat ×0.8 |
| **Fierce** | Chase 70% | Seek food < 45 | Sleep < 3, dur 10–20s | Prefers weapons | — | Weapon mat ×1.4, Defense mat ×0.7 |
| **Sneaky** | Chase 50% | Default | Default | — | — | Herb ×1.2 |
| **Timid** | Chase 25% | Default | Default | Prefers armor + potions | — | Weapon mat ×0.7, Defense mat ×1.4 |
| **Gentle** | Chase 25% | Default | Default | Prefers armor + potions | — | Weapon mat ×0.8, Defense mat ×1.3 |
| **Curious** | Chase 25% | Default | Default | — | — | Crystal ×1.3 |
| **Lazy** | Chase 25% | Seek food < 20 | Sleep < 20, dur 20–40s | — | 2s delay between tasks | Berry ×1.3 |
| **Loyal** | Chase 25% | Default | Default | — | — | No modifiers |

### Berry Pickup Chances (after eating food on map)
| Personality | Chance |
|-------------|:------:|
| Sneaky | 55% |
| Curious | 45% |
| Timid | 35% |
| Gentle | 35% |
| Loyal | 30% |
| Lazy | 25% |
| Bold | 0% |
| Fierce | 0% |

---

## 8. EQUIPMENT DURABILITY

| Equipment | Max Durability | Loss Per Hit | Breaks At |
|-----------|:--------------:|:------------:|:---------:|
| Stone Blade | 50 | 3–5 (attacker, per hit dealt) | 0 |
| Wooden Shield | 40 | 4–6 (defender, per hit taken) | 0 |

- Low durability warning: **25%** remaining
- On break: stat bonus removed (ATK or max HP)
- Craft replacement trigger: durability **< 30%**
- Auto-equip replaces if current durability **< 5**

Stone Blade lasts: ~10–16 hits dealt
Wooden Shield lasts: ~7–10 hits taken

---

## 9. INVENTORY & POTIONS

- **Max inventory: 8 slots**
- Items: wood, stone, herb, crystal, berry, stone_blade, wooden_shield, healing_potion
- Smart pickup: when full, scores new item vs worst item in inventory, swaps if new score > worst + 5
- Drop threshold margin: **+5 score** required

### Base Item Values (for scoring)
| Item | Base Score |
|------|:---------:|
| Wood | 20 |
| Stone | 25 |
| Herb | 30 |
| Berry | 40 |
| Crystal | 80 |

### Healing Potion
- Heal amount: **40 HP**
- Auto-use trigger: HP **< 50%** of max
- Drinking duration: **3–4s** (gradual heal over duration)
- Interrupted by combat: **potion wasted**, partial healing kept
- Crafted items stay in inventory until auto-equip (2s delay)

---

## 10. FLEE, CHASE & SCARED TIMERS

| Value | Amount |
|-------|:------:|
| Flee sprint duration | **10–12s** (randomized) |
| Flee sprint speed | **2x normal** (`spd × 0.4 × 2.0`) |
| Flee direction | **exact opposite** from winner |
| Flee zigzag interval | **0.3–0.8s** per jink |
| Flee speed wobble | **±20%** fluctuation |
| Scared timer | **7–30s** (randomized) |
| Scared speed boost (after sprint) | **1.3x normal** |
| Min flee distance before stopping | **35 units** |
| Flee target distance | **35 units** from opponent |
| Boundary redirect margin | **10 units** from edge |
| Scared proximity re-flee | within **20 units** of threat → sprint **2s** more |
| Runner combat cooldown | **7–30s** (= scared time) |
| Winner combat cooldown | **30s** (if no chase), **60s** (after chase) |
| Chase delay (head start) | **3s** (winner stands still) |
| Chase duration | **8s** max (after delay) |
| Chase speed | **1.5x normal** (`spd × 0.4 × 1.5`) |
| Chase catch distance | **< 3 units** |
| Chase energy drain | **0.3/s**, gives up at ≤ 5 |
| Post-chase combat cooldown | **60s** |
| World bounds | **±95 units** (190×190 map) |
| World edge avoidance zone | **15 units** from edge |

### Scared State Blocks
- Gathering: **blocked**
- Crafting: **blocked**
- Food seeking: **blocked** (except inventory eating at hunger < 10)
- Combat engagement scan: **blocked**
