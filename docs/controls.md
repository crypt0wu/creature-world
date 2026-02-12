# Controls & Camera

Camera movement, creature selection, and navigation.

## WASD Movement

| Key | Action |
|-----|--------|
| W | Move camera forward |
| A | Move camera left |
| S | Move camera backward |
| D | Move camera right |
| Shift | Sprint (3.3x speed) |

### Movement Physics

```
Normal speed:  150 units/s max
Sprint speed:  500 units/s max
Acceleration:  200 (normal), 700 (sprint)
Friction:      6.0 (exponential decay)
```

Movement is relative to camera facing direction (forward = camera-to-target vector, flattened to XZ plane).

Camera and orbit target move together — the view angle stays consistent while moving.

### Boundary Clamping

Camera target clamped to world bounds (-95 to +95). When hitting a boundary:
- Target snaps to edge
- Camera position adjusted by same delta
- Velocity zeroed

## Orbit Camera

- **Auto-rotate**: Enabled when idle for 5 seconds
- **Disabled**: When following a creature or during WASD movement
- Standard OrbitControls: drag to rotate, scroll to zoom

## Click-to-Navigate

Clicking on terrain initiates a smooth camera glide:
- Animated interpolation from current position to click target
- Camera height adjusts to maintain viewing angle
- Cancelled by WASD input

## Creature Selection

- **Click creature**: Select/deselect
- **Selected creature**: Shows info panel with full stats
- **Follow mode**: Camera tracks selected creature's movement
- **Selection ring**: Visual highlight on selected creature

## Hover Tooltip

- Pointer over creature: Shows name, species, level
- Uses shared `hoverStore.js` (mutable state, read via RAF)
- Dead creatures: raycasting disabled (no ghost tooltips)

## Camera Bounds

```javascript
CAM_BOUNDS = 95  // Same as world bounds
```

Camera target cannot leave the world area.
