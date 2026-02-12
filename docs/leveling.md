# Leveling & XP System

Creatures gain XP through combat and level up to become stronger.

## Constants

```
MAX_LEVEL = 10
```

## XP Thresholds

XP needed per level: `currentLevel * 30`

| Level | XP to Next | Cumulative XP |
|-------|-----------|--------------|
| 1 | 30 | 30 |
| 2 | 60 | 90 |
| 3 | 90 | 180 |
| 4 | 120 | 300 |
| 5 | 150 | 450 |
| 6 | 180 | 630 |
| 7 | 210 | 840 |
| 8 | 240 | 1080 |
| 9 | 270 | 1350 |
| 10 | MAX | - |

## Level-Up Rewards

Per level gained:

| Stat | Gain |
|------|------|
| Max HP | +10 |
| Current HP | +10 (immediate heal) |
| Attack | +2 |
| Speed | +1 |
| Base Speed | +1 |

Excess XP carries over to the next level.

## XP Sources

### Combat Hit
```javascript
xp = max(1, floor(damage / 5))
if (superEffective) xp *= 2
```

Both the attacker and the defender earn XP from hits dealt.

### Flee Reward
- +5 XP for successfully escaping combat (survivor bonus)

### Draw
- +5 XP each when combat times out (HARD_TIMEOUT = 30s)

### Kill
- `victim.level * 25` XP to the killer
- Also grants 1-2 random items from victim's inventory as loot

## Visual Feedback

On level up:
- Glow effect on creature
- Float text: creature name + "leveled up to {level}!"
- Stat gain display: "HP +10, ATK +2, SPD +1"
- `justLeveledUp` flag consumed by Creature.jsx for animation
