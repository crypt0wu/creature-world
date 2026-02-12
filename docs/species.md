# Species & Stats

6 elemental species, each with unique stats, behavior weights, and visual identity.

## Species Table

| Species | Type | Color | HP | ATK | SPD | Hunger Drain | Energy Drain | Range | Pause |
|---------|------|-------|-----|-----|-----|-------------|-------------|-------|-------|
| **Embrix** | fire | `#ff6633` | 90 | 14 | 7 | 0.20 | 0.12 | 20 | 2-6s |
| **Aqualis** | water | `#3399ff` | 110 | 10 | 5 | 0.10 | 0.08 | 25 | 4-10s |
| **Verdox** | nature | `#33cc33` | 100 | 8 | 6 | 0.08 | 0.06 | 30 | 5-12s |
| **Voltik** | electric | `#ffcc00` | 80 | 12 | 9 | 0.22 | 0.15 | 15 | 1-4s |
| **Shadeyn** | shadow | `#9966cc` | 95 | 13 | 8 | 0.13 | 0.10 | 18 | 3-8s |
| **Glacira** | ice | `#66ccff` | 130 | 16 | 3 | 0.07 | 0.05 | 10 | 6-18s |

## Behavior Weights

Each species has three behavior weights (0.0 - 1.0) that influence decision-making:

| Species | Aggression | Exploration | Caution |
|---------|-----------|-------------|---------|
| Embrix | 0.7 | 0.5 | 0.2 |
| Aqualis | 0.3 | 0.6 | 0.5 |
| Verdox | 0.2 | 0.7 | 0.4 |
| Voltik | 0.6 | 0.8 | 0.3 |
| Shadeyn | 0.5 | 0.4 | 0.6 |
| Glacira | 0.4 | 0.2 | 0.5 |

## Descriptions

- **Embrix** (fire): Fast, aggressive, high metabolism. Burns through energy and food quickly.
- **Aqualis** (water): Balanced stats, moderate metabolism. Reliable all-rounder.
- **Verdox** (nature): Explorer with low resource consumption. Roams far, eats little.
- **Voltik** (electric): Lightning-fast but fragile. Highest speed, lowest HP, burns resources fast.
- **Shadeyn** (shadow): Stealthy and cautious. Balanced offense with high awareness.
- **Glacira** (ice): Slow and powerful. Glacial metabolism, devastating attacks. Highest HP and ATK.

## Type Effectiveness

Combat damage is modified by type matchups:

| Attacker | Super Effective vs. | Resisted by |
|----------|-------------------|-------------|
| Fire | Nature, Ice | Water |
| Water | Fire | Nature, Electric |
| Nature | Water | Fire, Ice |
| Electric | Water | Nature |
| Shadow | Electric | Fire |
| Ice | Nature | Fire, Water |

- **Super effective**: 1.5x damage
- **Resisted**: 0.75x damage
- **Neutral**: 1.0x damage

## Glow Colors (Visual)

| Species | Core Color | Glow Color |
|---------|-----------|------------|
| Embrix | `#ff6633` | `#ff9944` |
| Aqualis | `#3399ff` | `#44bbff` |
| Verdox | `#33cc33` | `#66ff66` |
| Voltik | `#ffcc00` | `#ffee44` |
| Shadeyn | `#9966cc` | `#bb88ee` |
| Glacira | `#66ccff` | `#88eeff` |

## Personalities

Each creature is randomly assigned one personality at spawn. Personalities affect many systems:

| Personality | Sleep Threshold | Sleep Duration | Hunger Threshold | Berry Pickup | Combat Style |
|------------|----------------|---------------|-----------------|-------------|-------------|
| fierce | 3 energy | 10-20s | 45 | 0% | Weapon preference, high chase chance |
| bold | 10 energy | 15-30s | 45 | 0% | Weapon preference, high chase chance |
| sneaky | 10 energy | 15-30s | 40 | 55% | Balanced, moderate chase |
| curious | 10 energy | 15-30s | 40 | 45% | Balanced |
| timid | 10 energy | 15-30s | 40 | 35% | Armor preference, low chase |
| gentle | 10 energy | 15-30s | 40 | 35% | Armor preference, low chase |
| loyal | 10 energy | 15-30s | 40 | 30% | Balanced |
| lazy | 20 energy | 20-40s | 20 | 25% | Late hunger response |

## Name Generation

Creature names are procedurally generated from prefix + suffix:

**Prefixes** (20): Pyr, Zal, Nyx, Vor, Ash, Kir, Dex, Lum, Rav, Sol, Hex, Grim, Flux, Vex, Ori, Cryo, Zel, Myr, Thr, Kor

**Suffixes** (20): axis, ion, ara, yx, en, is, ox, us, ith, or, ax, iel, une, ek, an, os, ix, al, um, ir
