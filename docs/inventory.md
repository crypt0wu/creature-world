# Inventory & Scoring System

Item management, smart pickup/drop decisions, strategy memory, and species memory.

## Inventory

- **Max slots**: 8 items
- **Items persist** across save/load via LocalStorage

## Item Types

| Item | Category | Base Value | Use |
|------|----------|-----------|-----|
| Wood | raw | 20 | Craft weapon/armor |
| Stone | raw | 25 | Craft weapon |
| Herb | raw | 30 | Craft potion |
| Crystal | rare | 80 | High-value trade material |
| Berry | food | 40 | Eat for hunger restoration |
| Stone Blade | weapon | - | +8 ATK, 50 durability |
| Wooden Shield | armor | - | +15 Max HP, 40 durability |
| Healing Potion | consumable | - | +40 HP, 3-4s to drink |

## Scoring System

Items are scored dynamically based on creature context. Higher scores = more valuable to keep.

### Base Values
```javascript
{ wood: 20, stone: 25, herb: 30, berry: 40, crystal: 80 }
```

### Scoring Factors

All factors contribute to the final score:

**1. HP Context (herbs for potions)**
- HP < 50%: `+30 * (1 - hpRatio)`
- HP < 70%: `+10`

**2. Hunger Context (berries as food)**
- Hunger < 30: `+35 * (1 - hungerRatio)`
- Hunger < 50: `+10`

**3. Recipe Completion**
For each recipe this item is used in:
```javascript
score += (totalMaterialsOwned / totalMaterialsNeeded) * 25
```

**4. Equipment Status**
- Has weapon AND durability > 30%: stone value * 0.5
- Has armor AND durability > 30%: wood value * 0.5
- Durability < 30%: material value * 1.3 (need replacement)

**5. Age/Kills Modifier**
- Kills > 0 OR age > 300s: stone * 1.15 (battle-hardened)
- Age < 120s: berry/herb * 1.1 (early survival)

**6. Personality Modifier**
| Personality | Boosted Items | Reduced Items |
|------------|--------------|---------------|
| fierce | Weapon mats * 1.4 | Defense mats * 0.7 |
| bold | Weapon mats * 1.3 | Defense mats * 0.8 |
| timid | Defense mats * 1.4 | Weapon mats * 0.7 |
| gentle | Defense mats * 1.3 | Weapon mats * 0.8 |
| curious | Crystal * 1.3 | - |
| sneaky | Herb * 1.2 | - |
| lazy | Berry * 1.3 | - |
| loyal | No modifier | No modifier |

**7. Species Memory (generational learning)**
- Species with starvation deaths: berry/herb +5 each
- Species with combat deaths: stone +5

**8. Strategy Memory (personal experience)**
- Items kept and used: positive boost
- Items kept but unused: negative penalty

## Smart Pickup Logic

### Inventory Not Full
Add item directly.

### Inventory Full
1. Score the new item
2. Find lowest-scoring item in inventory
3. If `newScore > lowestScore + 5`:
   - Drop lowest-value item at creature's position
   - Add new item to inventory
   - Record decision in strategy memory
4. Otherwise: reject pickup

## Drop Reasons (logged)

```
"rare materials"                    // crystal
"survival (hungry)"                 // berry when hungry
"healing materials"                 // herb when hurt
"completing stone blade recipe"     // stone for recipe
"completing wooden shield recipe"   // wood for recipe
"better value"                      // default
```

## Strategy Memory

Per-creature, tracks last 6 item decisions:

```javascript
{
  droppedType: 'wood',     // what was dropped
  keptType: 'crystal',     // what was kept instead
  useful: false,           // was the kept item ever used?
  time: 145.3              // creature age when decided
}
```

**Update**: When an item is used in crafting, mark its `keptType` entry as `useful = true`
**Decay**: Only keep the 6 most recent decisions

## Species Memory

Shared across all creatures of the same species, persists across sessions:

```javascript
speciesMemory = {
  Embrix:  { starvation: 0, lowHp: 0 },
  Aqualis: { starvation: 0, lowHp: 0 },
  Verdox:  { starvation: 0, lowHp: 0 },
  Voltik:  { starvation: 0, lowHp: 0 },
  Shadeyn: { starvation: 0, lowHp: 0 },
  Glacira: { starvation: 0, lowHp: 0 },
}
```

**Update on death**:
- If `hunger <= 0`: increment `starvation`
- Otherwise: increment `lowHp`

**Effect**: Scoring system boosts food/berry values for species with starvation history, and stone/weapon material values for species with combat death history.
