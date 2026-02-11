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

  const baseSpeed = c.spd * 0.4

  if (!c.moving) {
    // If seeking food, hunger.js will set moving+target — just decel and wait
    if (c.seekingFood) {
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

    if (c.stuckTimer > 2.5 && !c.seekingFood) {
      pickTarget(c, spec.range)
    }

    const targetAngle = Math.atan2(dx, dz)
    let desiredAngle = targetAngle

    // Obstacle avoidance
    let avoidX = 0, avoidZ = 0

    for (let i = 0; i < OBSTACLES.length; i++) {
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

    c.rotY = lerpAngle(c.rotY, desiredAngle, 2.5 * dt)

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

    if (dist < 1.5 && c.currentSpeed < 0.3 && !c.seekingFood) {
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
