# Movement & Wander System

All creature navigation, obstacle avoidance, and flee movement mechanics.

## Constants

```
WORLD_HALF      = 95      // World extends -95 to +95 on X and Z
WORLD_EDGE_ZONE = 15      // Edge avoidance zone (last 15 units)
```

## Base Speed

```
effectiveSpeed = creature.spd * 0.4
```

Speed stat is multiplied by 0.4 to get actual movement speed.

## Speed Modifiers

| Condition | Multiplier | Stacks |
|-----------|-----------|--------|
| Flee sprint (`_fleeSprint > 0`) | 2.0x | No |
| Scared (no sprint) | 1.3x | No |
| Panic wobble (during sprint) | 0.8 - 1.2x (sine + random) | With flee |
| Fatigue (`energy < 25`) | 0.5x - 1.0x (linear) | With all |

### Panic Wobble Formula
```javascript
panicWobble = 0.8 + Math.sin(phase * 8) * 0.2 + Math.random() * 0.2
```

### Fatigue Formula
```javascript
// energy 0 → 50% speed, energy 25 → 100% speed
spd = baseSpd * (0.5 + (energy / 25) * 0.5)
```

## Movement States

### Activity Stop (decel rate: -3.0/s)
These states immediately halt movement:
- `sleeping`
- `eating`
- `gathering`
- `crafting`
- `drinkingPotion`

### Seeking Decel (decel rate: -2.0/s)
These states let other systems drive navigation:
- `seekingFood` (hunger.js sets target)
- `seekingResource` (gathering.js sets target)

## Wander Behavior

When idle and pause timer expires:
1. Pick random target within species range
2. Clamp target to world bounds
3. Repel target from ponds (push outward if within `pond.radius + 3`)
4. Move toward target

### Pause Duration
Species-dependent: `pauseMin + random * (pauseMax - pauseMin)`

| Species | Pause Range |
|---------|------------|
| Embrix | 2-6s |
| Aqualis | 4-10s |
| Verdox | 5-12s |
| Voltik | 1-4s |
| Shadeyn | 3-8s |
| Glacira | 6-18s |

### Arrival Detection
When `distance < 1.5` and `currentSpeed < 0.3`:
- Stop moving
- Start pause timer

## Obstacle Avoidance

### Trees/Rocks/Bushes
- Avoidance radius: `3.0 + obstacle.radius`
- Only active within 10 units (distance squared < 100)
- Force strength: `(minDist - dist) / minDist * 3.0`
- Direction: Push away from obstacle center

### Ponds
- Avoidance radius: `pond.radius + 4`
- Force strength: `(minDist - dist) / minDist * 5.0` (stronger than obstacles)
- Direction: Push away from pond center

### World Boundaries
- Edge zone starts at `WORLD_HALF - WORLD_EDGE_ZONE` (80 units)
- Force: linear increase toward center, strength `4.0`
- Applied on both X and Z independently

### Avoidance Integration
```javascript
dirX = sin(desiredAngle) + avoidX * 0.5
dirZ = cos(desiredAngle) + avoidZ * 0.5
finalAngle = atan2(dirX, dirZ)
```

## Turn Rate
- Normal movement: 2.5 rad/s
- Fleeing: 6.0 rad/s (faster jinking ability)

## Acceleration / Deceleration
- Accelerate: +1.5 speed per second
- Decelerate: -2.0 speed per second

### Approach Slowdown
When within 3 units of target:
```javascript
targetSpeed = baseSpeed * (distance / 3.0)
```

## Stuck Detection

- Timer increments when distance to target hasn't decreased by 0.2 units
- After 2.5 seconds stuck: pick new random target
- Only triggers when not seeking food/resources

## Flee Movement

### Initial Flee
Direction: exact opposite from threat
```javascript
targetX = x + (awayDirX / awayDist) * 25
targetZ = z + (awayDirZ / awayDist) * 25
```

### Boundary Redirect
When flee target would hit world edge (within 10-unit margin):
- Slide along edge
- Add perpendicular component (+/-20 units)
- Re-clamp to world bounds

### Zigzag (During Sprint)
Every 0.3-0.8 seconds:
```javascript
perpX = -awayDirZ / distance  // perpendicular to flee direction
perpZ = awayDirX / distance
jink = random(-1, 1) * (8 + random * 7)  // 8-15 unit offset
targetX += perpX * jink
targetZ += perpZ * jink
```

### Flee Distance Enforcement
While scared:
- Check distance from `_fleeFromX/Z`
- If distance < `_fleeMinDist`: re-trigger 2-second sprint
- This runs in wander.js, gated by `_fleeMinDist` value (0 = no enforcement)

## Hard Clamp
After all movement:
```javascript
x = clamp(x, -WORLD_HALF, WORLD_HALF)
z = clamp(z, -WORLD_HALF, WORLD_HALF)
```

Pond push: If creature ends up inside pond radius + 1.5, push outward to `radius + 2.0`.
