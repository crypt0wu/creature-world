import { OBSTACLES, PONDS } from '../../worldData'

const WORLD_HALF = 95
const WORLD_EDGE_ZONE = 15

function angleDiff(a, b) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t
}

function pickTarget(c, range) {
  c.targetX = c.x + (Math.random() - 0.5) * range
  c.targetZ = c.z + (Math.random() - 0.5) * range
  c.targetX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetX))
  c.targetZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetZ))
  for (let i = 0; i < PONDS.length; i++) {
    const pond = PONDS[i]
    const dx = c.targetX - pond.cx
    const dz = c.targetZ - pond.cz
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < pond.radius + 3) {
      const push = (pond.radius + 4) / Math.max(dist, 0.1)
      c.targetX = pond.cx + dx * push
      c.targetZ = pond.cz + dz * push
    }
  }
  c.stuckTimer = 0
  c.lastDist = 999
}

export function updateMovement(c, spec, dt) {
  if (!c.alive) return

  // Sleeping — decel and return
  if (c.sleeping) {
    c.currentSpeed = Math.max(0, c.currentSpeed - 3.0 * dt)
    return
  }

  // Eating — stop all movement
  if (c.eating) {
    c.currentSpeed = Math.max(0, c.currentSpeed - 3.0 * dt)
    return
  }

  // Gathering — stop all movement
  if (c.gathering) {
    c.currentSpeed = Math.max(0, c.currentSpeed - 3.0 * dt)
    return
  }

  // Crafting — stop all movement
  if (c.crafting) {
    c.currentSpeed = Math.max(0, c.currentSpeed - 3.0 * dt)
    return
  }

  // Drinking potion — stop all movement
  if (c.drinkingPotion) {
    c.currentSpeed = Math.max(0, c.currentSpeed - 3.0 * dt)
    return
  }

  const fleeBoost = c._fleeSprint > 0 ? 2.0 : 1.0
  const scaredBoost = (c._scaredTimer > 0 && c._fleeSprint <= 0) ? 1.3 : 1.0
  // Speed fluctuation during panic sprint — varies ±20%
  const panicWobble = c._fleeSprint > 0 ? (0.8 + Math.sin(c.phase * 8) * 0.2 + Math.random() * 0.2) : 1.0
  const baseSpeed = c.spd * 0.4 * fleeBoost * scaredBoost * panicWobble

  // Scared state: enforce minimum flee distance + keep running
  if (c._scaredTimer > 0 && !c.inCombat) {
    const fdx = c.x - (c._fleeFromX || 0)
    const fdz = c.z - (c._fleeFromZ || 0)
    const fleeDist = Math.sqrt(fdx * fdx + fdz * fdz)
    const minDist = c._fleeMinDist || 30
    const farEnough = fleeDist >= minDist

    if (c._fleeSprint > 0 || !farEnough) {
      // Not safe yet — keep sprint alive if needed
      if (!farEnough && c._fleeSprint <= 0) c._fleeSprint = 2.0

      // Erratic zigzag while sprinting in panic
      if (c._fleeSprint > 0 && c.moving) {
        c._fleeZigzag -= dt
        if (c._fleeZigzag <= 0) {
          c._fleeZigzag = 0.3 + Math.random() * 0.5
          const fdx2 = c.x - (c._fleeFromX || 0)
          const fdz2 = c.z - (c._fleeFromZ || 0)
          const flen = Math.sqrt(fdx2 * fdx2 + fdz2 * fdz2) || 1
          const perpX = -fdz2 / flen
          const perpZ = fdx2 / flen
          const jink = (Math.random() - 0.5) * 2 * (8 + Math.random() * 7)
          c.targetX += perpX * jink
          c.targetZ += perpZ * jink
          c.targetX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetX))
          c.targetZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetZ))
        }
      }

      if (!c.moving) {
        const awayDist = Math.sqrt(fdx * fdx + fdz * fdz) || 1
        c.targetX = c.x + (fdx / awayDist) * 25
        c.targetZ = c.z + (fdz / awayDist) * 25

        // Boundary redirect: slide along edge instead of stopping
        const margin = 10
        if (c.targetX > WORLD_HALF - margin) {
          c.targetX = WORLD_HALF - margin - Math.random() * 10
          c.targetZ += (Math.random() > 0.5 ? 1 : -1) * 20
        } else if (c.targetX < -WORLD_HALF + margin) {
          c.targetX = -WORLD_HALF + margin + Math.random() * 10
          c.targetZ += (Math.random() > 0.5 ? 1 : -1) * 20
        }
        if (c.targetZ > WORLD_HALF - margin) {
          c.targetZ = WORLD_HALF - margin - Math.random() * 10
          c.targetX += (Math.random() > 0.5 ? 1 : -1) * 20
        } else if (c.targetZ < -WORLD_HALF + margin) {
          c.targetZ = -WORLD_HALF + margin + Math.random() * 10
          c.targetX += (Math.random() > 0.5 ? 1 : -1) * 20
        }
        c.targetX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetX))
        c.targetZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.targetZ))
        c.moving = true
        c.pause = 0
      }
    }
  }

  if (!c.moving) {
    // If seeking food, hunger.js will set moving+target — just decel and wait
    if (c.seekingFood) {
      c.currentSpeed = Math.max(0, c.currentSpeed - 2.0 * dt)
      return
    }

    // If seeking resource, gathering.js drives movement — just decel and wait
    if (c.seekingResource) {
      c.currentSpeed = Math.max(0, c.currentSpeed - 2.0 * dt)
      return
    }

    c.pause -= dt
    c.currentSpeed = Math.max(0, c.currentSpeed - 2.0 * dt)

    if (c.pause <= 0) {
      c.moving = true
      pickTarget(c, spec.range)
    }

    if (c.currentSpeed > 0.01) {
      c.x += Math.sin(c.rotY) * c.currentSpeed * dt
      c.z += Math.cos(c.rotY) * c.currentSpeed * dt
    }
  } else {
    const dx = c.targetX - c.x
    const dz = c.targetZ - c.z
    const dist = Math.sqrt(dx * dx + dz * dz)

    // Stuck detection
    if (dist < c.lastDist - 0.2) {
      c.stuckTimer = 0
    } else {
      c.stuckTimer += dt
    }
    c.lastDist = dist

    if (c.stuckTimer > 2.5 && !c.seekingFood && !c.seekingResource) {
      pickTarget(c, spec.range)
    }

    const targetAngle = Math.atan2(dx, dz)
    let desiredAngle = targetAngle

    // Obstacle avoidance
    let avoidX = 0, avoidZ = 0

    for (let i = 0; i < OBSTACLES.length; i++) {
      // Skip avoidance for the resource we're heading toward
      if (c.seekingResource && i === c.targetResourceIdx) continue
      const obs = OBSTACLES[i]
      const adx = c.x - obs.x
      const adz = c.z - obs.z
      const distSq = adx * adx + adz * adz
      if (distSq > 100) continue
      const minDist = 3.0 + obs.radius
      if (distSq < minDist * minDist && distSq > 0.01) {
        const d = Math.sqrt(distSq)
        const t = (minDist - d) / minDist
        avoidX += (adx / d) * t * 3.0
        avoidZ += (adz / d) * t * 3.0
      }
    }

    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const adx = c.x - pond.cx
      const adz = c.z - pond.cz
      const distSq = adx * adx + adz * adz
      const minDist = pond.radius + 4
      if (distSq < minDist * minDist && distSq > 0.01) {
        const d = Math.sqrt(distSq)
        const t = (minDist - d) / minDist
        avoidX += (adx / d) * t * 5.0
        avoidZ += (adz / d) * t * 5.0
      }
    }

    const edgeStart = WORLD_HALF - WORLD_EDGE_ZONE
    if (Math.abs(c.x) > edgeStart) {
      avoidX += -Math.sign(c.x) * ((Math.abs(c.x) - edgeStart) / WORLD_EDGE_ZONE) * 4.0
    }
    if (Math.abs(c.z) > edgeStart) {
      avoidZ += -Math.sign(c.z) * ((Math.abs(c.z) - edgeStart) / WORLD_EDGE_ZONE) * 4.0
    }

    let dirX = Math.sin(desiredAngle) + avoidX * 0.5
    let dirZ = Math.cos(desiredAngle) + avoidZ * 0.5
    desiredAngle = Math.atan2(dirX, dirZ)

    const turnRate = c._fleeSprint > 0 ? 6.0 : 2.5
    c.rotY = lerpAngle(c.rotY, desiredAngle, turnRate * dt)

    if (dist < 3.0) {
      c.targetSpeed = baseSpeed * (dist / 3.0)
    } else {
      c.targetSpeed = baseSpeed
    }

    if (c.currentSpeed < c.targetSpeed) {
      c.currentSpeed = Math.min(c.targetSpeed, c.currentSpeed + 1.5 * dt)
    } else {
      c.currentSpeed = Math.max(c.targetSpeed, c.currentSpeed - 2.0 * dt)
    }

    c.x += Math.sin(c.rotY) * c.currentSpeed * dt
    c.z += Math.cos(c.rotY) * c.currentSpeed * dt

    // Don't stop if still fleeing and not far enough from danger
    const stillFleeing = c._scaredTimer > 0 && (c._fleeMinDist || 0) > 0
    const fleeDistOk = !stillFleeing || (() => {
      const fx = c.x - (c._fleeFromX || 0), fz = c.z - (c._fleeFromZ || 0)
      return Math.sqrt(fx * fx + fz * fz) >= c._fleeMinDist
    })()
    if (dist < 1.5 && c.currentSpeed < 0.3 && !c.seekingFood && !c.seekingResource && fleeDistOk) {
      c.moving = false
      c.pause = spec.pauseMin + Math.random() * (spec.pauseMax - spec.pauseMin)
    }
  }

  // Hard clamp
  c.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.x))
  c.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, c.z))

  for (let i = 0; i < PONDS.length; i++) {
    const pond = PONDS[i]
    const pdx = c.x - pond.cx
    const pdz = c.z - pond.cz
    const pDist = Math.sqrt(pdx * pdx + pdz * pdz)
    if (pDist < pond.radius + 1.5) {
      const push = (pond.radius + 2.0) / Math.max(pDist, 0.1)
      c.x = pond.cx + pdx * push
      c.z = pond.cz + pdz * push
    }
  }
}
