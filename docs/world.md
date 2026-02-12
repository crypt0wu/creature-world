# World & Environment

Procedurally generated terrain with obstacles, ponds, and a day/night lighting cycle.

## World Size

```
World bounds: -95 to +95 on X and Z axes (190 x 190 units)
Spawn area:   -70 to +70 on X and Z axes (creatures spawn within)
```

## World Objects

### Trees
- **Count**: 250
- **Collision radius**: `(1.2 + 0.4) * scale`
- Density-driven placement (clustered in forest areas)
- Visual: 3D tree models with leaves

### Rocks
- **Count**: 80
- **Collision radius**: `0.5 * scale + 0.5`
- Scattered placement
- Visual: 3D rock meshes

### Bushes
- **Count**: 150
- **Collision radius**: `0.6 * scale + 0.3`
- Gather-able for herbs
- Visual: Small green clusters

### Ponds
- **Count**: 2 (fixed positions)
- **Collision**: `radius + buffer` (creatures pushed away)
- Visual: Animated water surface
- Creatures cannot enter ponds (hard push outward)

## Terrain

- Procedural heightmap with gentle hills
- `getTerrainHeight(x, z)` exported function for Y-position lookup
- Creatures follow terrain height as they move
- Camera follows terrain contour

## Day/Night Cycle

### Speed
```javascript
speed = 0.015  // 1 real second = 0.015 cycle units
// Full day/night cycle ≈ 7 minutes real time
```

### Sun Position (orbits the world)
```javascript
t = elapsedTime * speed
x = cos(t) * 60
y = max(5, sin(t) * 40 + 25)  // Range: 5-65 units high
z = sin(t) * 60
```

### Lighting

**Directional Light (Sun)**
- Day: intensity 1.2 - 2.2 (bright white-warm)
- Night: intensity 1.2 (cool blue-white moonlight)
- Color transition: warm white → cool blue

**Ambient Light**
- Day: intensity 1.2 - 1.7
- Night: intensity 1.2 with blue tint
- Simulates scattered sky light

**Hemisphere Light (Ground Bounce)**
```javascript
args: ['#5a6a5a', '#2a2a20', 0.8]
// sky color, ground color, intensity
```

### Shadow System
- Shadow map: 2048 x 2048
- Shadow camera: 80-unit frustum in all directions
- Cast by directional light only

## Ambient Elements

### Fireflies
- Particle system for ambient atmosphere
- More visible at night
- Float and glow randomly

### Starfield
- Night sky dome with procedural stars
- Visible during night cycle
- Fade in/out with day/night transition

### Wildlife
- Ambient environmental creatures (non-interactive)
- Visual variety in the world

## World Regeneration

`regenerateWorld()` function:
- Re-rolls all tree, rock, bush positions
- Keeps pond positions fixed
- Called on world reset
- New seed for procedural generation
