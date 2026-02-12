# Energy & Sleep System

Energy drains while active and triggers sleep when depleted. Sleep regenerates both energy and HP.

## Energy Drain Rates

Base drain per second (continuous):

| Species | Base Drain/s |
|---------|-------------|
| Embrix | 0.12 |
| Aqualis | 0.08 |
| Verdox | 0.06 |
| Voltik | 0.15 |
| Shadeyn | 0.10 |
| Glacira | 0.05 |

## Drain Formula

```javascript
let drain = spec.energyDrain  // base rate

if (creature.moving) {
  drain *= 1.5  // +50% when moving
  drain += (currentSpeed / max(baseSpd, 0.1)) * spec.energyDrain * 0.5
  // Additional speed-proportional drain
}

energy -= drain * dt
```

Moving creatures drain 50% more energy, plus an additional bonus proportional to their speed relative to base speed.

## Fatigue (Energy < 25)

Speed is reduced linearly:

```javascript
// At 0 energy: 50% speed
// At 25 energy: 100% speed
spd = baseSpd * (0.5 + (energy / 25) * 0.5)
```

## Sleep Trigger

Personality-based threshold:

| Personality | Sleep At |
|------------|---------|
| lazy | < 20 energy |
| fierce | < 3 energy |
| all others | < 10 energy |

## Sleep Initiation

When energy drops below threshold:
1. Cancel active crafting (refund 50% energy cost, return materials)
2. Set `sleeping = true`
3. Stop all movement
4. Stop food seeking
5. Set `vulnerable = true` (can be attacked while sleeping)
6. Roll sleep duration

## Sleep Duration

Personality-dependent randomized duration:

| Personality | Min | Max |
|------------|-----|-----|
| lazy | 20s | 40s |
| fierce | 10s | 20s |
| all others | 15s | 30s |

```javascript
sleepDuration = minDur + Math.random() * (maxDur - minDur)
```

## While Sleeping

- **Energy regen**: +4.0 energy/second
- **HP regen**: +0.5 HP/second
- **Vulnerable**: true (combat can interrupt sleep)
- **No movement**: speed decelerates to 0
- **Visual**: Zzz particles float upward

## Wake Up

When `sleepTimer` reaches 0:
- `sleeping = false`
- `vulnerable = false`
- Resume normal behavior

## Sleep Interruption

Combat interrupts sleep:
- `sleeping = false`
- `vulnerable = false`
- `combatInterrupted = true` flag set
- Creature enters combat immediately (may be at disadvantage with low energy)
