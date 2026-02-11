import { useRef, useMemo, useEffect, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { getTerrainHeight } from './Terrain'
import { OBSTACLES, PONDS, animalPositions } from '../worldData'
import { setHover, clearHover } from '../hoverStore'

// ─── Behavior profiles ─────────────────────────────────
const BEHAVIORS = {
  grazer: {
    pauseMin: 8, pauseMax: 22,
    accel: 0.6, decel: 1.0,
    turnSpeed: 1.2,
    wobbleAmt: 0.25, wobbleFreq: 0.4,
    decelZone: 3.0,
  },
  quickRoamer: {
    pauseMin: 0.5, pauseMax: 3,
    accel: 2.5, decel: 2.0,
    turnSpeed: 3.0,
    wobbleAmt: 0.5, wobbleFreq: 1.0,
    decelZone: 2.0,
  },
  trotter: {
    pauseMin: 3, pauseMax: 8,
    accel: 1.0, decel: 1.2,
    turnSpeed: 0.8,
    wobbleAmt: 0.12, wobbleFreq: 0.25,
    decelZone: 4.0,
  },
  patrol: {
    pauseMin: 1.5, pauseMax: 5,
    accel: 1.5, decel: 1.5,
    turnSpeed: 2.0,
    wobbleAmt: 0.15, wobbleFreq: 0.6,
    decelZone: 2.5,
  },
}

const MODEL_BASE = '/models/Animated Animal Pack-glb'

const ANIMAL_TYPES = [
  { name: 'Deer', path: `${MODEL_BASE}/Deer.glb`, scale: 1.0, speed: 1.6, range: 18, count: 3, behavior: 'grazer', herd: 'deer' },
  { name: 'Stag', path: `${MODEL_BASE}/Stag.glb`, scale: 1.0, speed: 1.4, range: 20, count: 2, behavior: 'grazer', herd: 'deer' },
  { name: 'Fox', path: `${MODEL_BASE}/Fox.glb`, scale: 0.8, speed: 3.5, range: 25, count: 3, behavior: 'quickRoamer', herd: null },
  { name: 'Wolf', path: `${MODEL_BASE}/Wolf.glb`, scale: 0.9, speed: 2.2, range: 30, count: 2, behavior: 'patrol', herd: 'wolf' },
  { name: 'Horse', path: `${MODEL_BASE}/Horse.glb`, scale: 1.1, speed: 3.0, range: 45, count: 2, behavior: 'trotter', herd: 'horse' },
  { name: 'WhiteHorse', path: `${MODEL_BASE}/White Horse.glb`, scale: 1.1, speed: 2.8, range: 40, count: 1, behavior: 'trotter', herd: 'horse' },
  { name: 'Cow', path: `${MODEL_BASE}/Cow.glb`, scale: 1.0, speed: 1.2, range: 14, count: 2, behavior: 'grazer', herd: 'cow' },
  { name: 'Bull', path: `${MODEL_BASE}/Bull.glb`, scale: 1.1, speed: 1.5, range: 16, count: 1, behavior: 'grazer', herd: 'cow' },
  { name: 'Alpaca', path: `${MODEL_BASE}/Alpaca.glb`, scale: 0.9, speed: 1.3, range: 12, count: 2, behavior: 'grazer', herd: 'alpaca' },
  { name: 'Donkey', path: `${MODEL_BASE}/Donkey.glb`, scale: 0.9, speed: 1.5, range: 14, count: 2, behavior: 'grazer', herd: null },
  { name: 'Husky', path: `${MODEL_BASE}/Husky.glb`, scale: 0.7, speed: 3.8, range: 28, count: 2, behavior: 'quickRoamer', herd: null },
  { name: 'ShibaInu', path: `${MODEL_BASE}/Shiba Inu.glb`, scale: 0.6, speed: 3.4, range: 22, count: 2, behavior: 'quickRoamer', herd: null },
]

// ─── World boundary (terrain is 200×200 centered at origin) ──
const WORLD_HALF = 95 // slightly inside the 100-unit edge
const WORLD_EDGE_ZONE = 15 // start steering back at 80 units from center

// ─── Angle helpers ─────────────────────────────────────
function angleDiff(a, b) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

function lerpAngle(a, b, t) {
  return a + angleDiff(a, b) * t
}

// ─── GLB Animal with behavior-driven AI ────────────────
function GLBAnimal({ modelPath, startPos, animalScale = 1, speed = 2, range = 20, behavior = 'grazer', groupCenter, animalName = '?' }) {
  const groupRef = useRef()
  const { scene, animations } = useGLTF(modelPath)
  const clonedScene = useMemo(() => skeletonClone(scene), [scene])
  const { actions, names } = useAnimations(animations, groupRef)
  const activeAction = useRef(null)
  const beh = BEHAVIORS[behavior]
  const myEntry = useRef(null)

  // Register in shared animal position registry
  useEffect(() => {
    const entry = { x: startPos[0], z: startPos[2], radius: animalScale * 2.5 }
    myEntry.current = entry
    animalPositions.push(entry)
    return () => {
      const idx = animalPositions.indexOf(entry)
      if (idx !== -1) animalPositions.splice(idx, 1)
      myEntry.current = null
    }
  }, [])

  // Find animation names — use exact matches to avoid Death/Attack/HitReact
  const animNames = useMemo(() => {
    const safe = names.filter(n => !/death|attack|hitreact|jump/i.test(n))

    const findAnim = (exact, pattern) => {
      let found = safe.find(n => n === exact)
      if (found) return found
      found = safe.find(n => n === `AnimalArmature|${exact}`)
      if (found) return found
      if (pattern) found = safe.find(n => pattern.test(n))
      return found || null
    }

    const walk = findAnim('Walk', /walk/i)
    const idle = findAnim('Idle', null) || findAnim('Idle_2', /^idle/i)
    const eat = findAnim('Eating', /eat/i)
    const run = findAnim('Gallop', /gallop$|run$|trot$/i)

    return { walk, idle, eat, run, fallback: walk || idle || null }
  }, [names])

  const switchAnim = (name, timeScale = 1) => {
    if (!name || !actions[name]) return false
    const next = actions[name]
    if (activeAction.current === next) {
      // Already playing — just update timeScale if needed
      if (Math.abs(activeAction.current.timeScale - timeScale) > 0.05) {
        activeAction.current.timeScale = timeScale
      }
      return true
    }
    if (activeAction.current) activeAction.current.fadeOut(0.4)
    next.reset().fadeIn(0.4).play()
    next.timeScale = timeScale
    next.setLoop(THREE.LoopRepeat)
    next.clampWhenFinished = false
    activeAction.current = next
    return true
  }

  // Start with idle once actions are ready
  useEffect(() => {
    const startAnim = animNames.idle || animNames.walk || animNames.fallback
    if (startAnim) switchAnim(startAnim, 0.7 + Math.random() * 0.3)
  }, [animNames])

  const state = useRef({
    x: startPos[0],
    z: startPos[2],
    targetX: startPos[0] + (Math.random() - 0.5) * range * 0.5,
    targetZ: startPos[2] + (Math.random() - 0.5) * range * 0.5,
    rotY: Math.random() * Math.PI * 2,
    currentSpeed: 0,
    targetSpeed: speed,
    moving: true,
    pause: 0,
    phase: Math.random() * Math.PI * 2,
    wobbleOffset: Math.random() * Math.PI * 2,
    playingWalk: false,
    // Sprint — simple multiplier
    speedMult: 1.0,
    sprintTimer: 0,
    sprintCooldown: 8 + Math.random() * 10,
    currentAnim: 'idle',
    // Patrol
    patrolOriginX: startPos[0],
    patrolOriginZ: startPos[2],
    patrolLeg: 0,
    patrolOffset: Math.random() * Math.PI * 0.5,
    // Avoidance smoothing + stuck detection
    smoothAvoidX: 0,
    smoothAvoidZ: 0,
    stuckTimer: 0,
    lastDist: 999,
  })

  // When stuck, scan 8 directions and pick the clearest path
  const pickClearTarget = (s) => {
    let bestAngle = s.rotY
    let bestScore = -Infinity
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2
      let score = 0
      for (let step = 1; step <= 2; step++) {
        const testX = s.x + Math.sin(angle) * range * 0.3 * step
        const testZ = s.z + Math.cos(angle) * range * 0.3 * step
        for (let i = 0; i < OBSTACLES.length; i++) {
          const obs = OBSTACLES[i]
          const odx = testX - obs.x
          const odz = testZ - obs.z
          const d = odx * odx + odz * odz
          if (d < (obs.radius + 4) * (obs.radius + 4)) score -= 2
        }
        for (let i = 0; i < PONDS.length; i++) {
          const pond = PONDS[i]
          const pdx = testX - pond.cx
          const pdz = testZ - pond.cz
          if (pdx * pdx + pdz * pdz < (pond.radius + 5) * (pond.radius + 5)) score -= 10
        }
        if (Math.abs(testX) > WORLD_HALF || Math.abs(testZ) > WORLD_HALF) score -= 15
      }
      const headingDiff = Math.abs(angleDiff(s.rotY, angle))
      score += (Math.PI - headingDiff) * 0.5
      if (score > bestScore) {
        bestScore = score
        bestAngle = angle
      }
    }
    const dist = range * 0.4 + Math.random() * range * 0.3
    s.targetX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.x + Math.sin(bestAngle) * dist))
    s.targetZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.z + Math.cos(bestAngle) * dist))
    s.stuckTimer = 0
    s.lastDist = 999
  }

  const pushTargetFromPonds = (s) => {
    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const dx = s.targetX - pond.cx
      const dz = s.targetZ - pond.cz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < pond.radius + 3) {
        const push = (pond.radius + 4) / Math.max(dist, 0.1)
        s.targetX = pond.cx + dx * push
        s.targetZ = pond.cz + dz * push
      }
    }
  }

  const pickNewTarget = (s) => {
    if (behavior === 'patrol') {
      s.patrolLeg = (s.patrolLeg + 1) % 4
      const angle = (s.patrolLeg / 4) * Math.PI * 2 + s.patrolOffset
      const dist = range * 0.4 + Math.random() * range * 0.3
      s.targetX = s.patrolOriginX + Math.cos(angle) * dist
      s.targetZ = s.patrolOriginZ + Math.sin(angle) * dist
    } else if (groupCenter) {
      const biasFactor = 0.3 + Math.random() * 0.3
      const randX = (Math.random() - 0.5) * range
      const randZ = (Math.random() - 0.5) * range
      s.targetX = s.x + randX + (groupCenter[0] - s.x) * biasFactor
      s.targetZ = s.z + randZ + (groupCenter[2] - s.z) * biasFactor
    } else {
      s.targetX = s.x + (Math.random() - 0.5) * range
      s.targetZ = s.z + (Math.random() - 0.5) * range
    }
    s.targetX = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.targetX))
    s.targetZ = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.targetZ))
    pushTargetFromPonds(s)
  }

  useFrame((_, delta) => {
    const s = state.current
    const g = groupRef.current
    if (!g) return
    const dt = Math.min(delta, 0.05)

    s.phase += dt

    // ── Sprint — simple speed multiplier ──
    if (s.sprintTimer > 0) {
      s.sprintTimer -= dt
      if (s.sprintTimer <= 0) {
        s.speedMult = 1.0
        s.sprintCooldown = 15 + Math.random() * 15
      }
    } else if (s.sprintCooldown > 0) {
      s.sprintCooldown -= dt
    } else if (Math.random() < 0.002) {
      s.speedMult = Math.max(3.0, 7.0 / speed)
      s.sprintTimer = 3 + Math.random() * 5
    }

    if (!s.moving) {
      // ── Paused ──
      s.pause -= dt

      // Decelerate to stop
      s.currentSpeed = Math.max(0, s.currentSpeed - beh.decel * speed * dt)

      // Switch to idle/eat anim when nearly stopped
      if (s.currentSpeed < 0.1 && s.currentAnim !== 'idle') {
        const idleAnim = (behavior === 'grazer' && animNames.eat) ? animNames.eat : animNames.idle
        if (switchAnim(idleAnim || animNames.fallback, 0.6 + Math.random() * 0.4)) {
          s.currentAnim = 'idle'
          s.playingWalk = false
        }
      }

      if (s.pause <= 0 && !s.moving) {
        s.moving = true
        pickNewTarget(s)
      }

      // Residual movement while decelerating
      if (s.currentSpeed > 0.01) {
        s.x += Math.sin(s.rotY) * s.currentSpeed * dt
        s.z += Math.cos(s.rotY) * s.currentSpeed * dt
      }
    } else {
      // ── Moving ──
      const dx = s.targetX - s.x
      const dz = s.targetZ - s.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      // ── Stuck detection ──
      if (dist < s.lastDist - 0.3) {
        s.stuckTimer = 0
      } else {
        s.stuckTimer += dt
      }
      s.lastDist = dist

      if (s.stuckTimer > 2.0) {
        pickClearTarget(s)
      }

      // Target direction + wobble
      const targetAngle = Math.atan2(dx, dz)
      const wobble = Math.sin(s.phase * beh.wobbleFreq + s.wobbleOffset) * beh.wobbleAmt
      let desiredAngle = targetAngle + wobble

      // ── Avoidance steering ──
      let avoidX = 0, avoidZ = 0

      const me = myEntry.current
      for (let i = 0; i < animalPositions.length; i++) {
        const other = animalPositions[i]
        if (other === me) continue
        const adx = s.x - other.x
        const adz = s.z - other.z
        const distSq = adx * adx + adz * adz
        const minDist = 6.0 + other.radius
        if (distSq < minDist * minDist && distSq > 0.01) {
          const d = Math.sqrt(distSq)
          const t = (minDist - d) / minDist
          avoidX += (adx / d) * t * 3.0
          avoidZ += (adz / d) * t * 3.0
        }
      }

      let clusterWX = 0, clusterWZ = 0, clusterW = 0
      for (let i = 0; i < OBSTACLES.length; i++) {
        const obs = OBSTACLES[i]
        const adx = s.x - obs.x
        const adz = s.z - obs.z
        const distSq = adx * adx + adz * adz
        if (distSq > 100) continue
        const minDist = 2.5 + obs.radius
        if (distSq < minDist * minDist && distSq > 0.01) {
          const d = Math.sqrt(distSq)
          const t = (minDist - d) / minDist
          const w = t * t
          clusterWX += obs.x * w
          clusterWZ += obs.z * w
          clusterW += w
        }
      }
      if (clusterW > 0.01) {
        const cx = clusterWX / clusterW
        const cz = clusterWZ / clusterW
        const cdx = s.x - cx
        const cdz = s.z - cz
        const cd = Math.max(Math.sqrt(cdx * cdx + cdz * cdz), 0.1)
        const force = Math.min(clusterW * 3.0, 4.0)
        avoidX += (cdx / cd) * force
        avoidZ += (cdz / cd) * force
      }

      for (let i = 0; i < PONDS.length; i++) {
        const pond = PONDS[i]
        const adx = s.x - pond.cx
        const adz = s.z - pond.cz
        const distSq = adx * adx + adz * adz
        const minDist = pond.radius + 5
        if (distSq < minDist * minDist && distSq > 0.01) {
          const d = Math.sqrt(distSq)
          const t = (minDist - d) / minDist
          avoidX += (adx / d) * t * t * 6
          avoidZ += (adz / d) * t * t * 6
        }
      }

      const edgeStart = WORLD_HALF - WORLD_EDGE_ZONE
      if (Math.abs(s.x) > edgeStart || Math.abs(s.z) > edgeStart) {
        if (Math.abs(s.x) > edgeStart) {
          const overshoot = (Math.abs(s.x) - edgeStart) / WORLD_EDGE_ZONE
          avoidX += -Math.sign(s.x) * overshoot * 4.0
        }
        if (Math.abs(s.z) > edgeStart) {
          const overshoot = (Math.abs(s.z) - edgeStart) / WORLD_EDGE_ZONE
          avoidZ += -Math.sign(s.z) * overshoot * 4.0
        }
      }

      const smoothRate = 4.0 * dt
      s.smoothAvoidX += (avoidX - s.smoothAvoidX) * smoothRate
      s.smoothAvoidZ += (avoidZ - s.smoothAvoidZ) * smoothRate

      let dirX = Math.sin(desiredAngle)
      let dirZ = Math.cos(desiredAngle)
      dirX += Math.sin(s.rotY) * 1.5
      dirZ += Math.cos(s.rotY) * 1.5
      dirX += s.smoothAvoidX
      dirZ += s.smoothAvoidZ
      desiredAngle = Math.atan2(dirX, dirZ)

      const avoidMag = Math.sqrt(s.smoothAvoidX * s.smoothAvoidX + s.smoothAvoidZ * s.smoothAvoidZ)

      const turnBoost = avoidMag > 0.3 ? Math.min(1 + avoidMag * 0.6, 2.5) : 1.0
      s.rotY = lerpAngle(s.rotY, desiredAngle, beh.turnSpeed * turnBoost * dt)

      // ── Speed ─────────────────────────────────────────
      if (dist < beh.decelZone) {
        s.targetSpeed = speed * (dist / beh.decelZone)
      } else {
        s.targetSpeed = speed
      }

      if (avoidMag > 1.5) {
        s.targetSpeed = Math.min(s.targetSpeed, speed * 0.5)
      }

      if (s.currentSpeed < s.targetSpeed) {
        s.currentSpeed = Math.min(s.targetSpeed, s.currentSpeed + beh.accel * speed * dt)
      } else {
        s.currentSpeed = Math.max(s.targetSpeed, s.currentSpeed - beh.decel * speed * dt)
      }

      // ── Position update ───────────────────────────────
      const moveSpeed = s.currentSpeed * s.speedMult
      s.x += Math.sin(s.rotY) * moveSpeed * dt
      s.z += Math.cos(s.rotY) * moveSpeed * dt

      // ── Animation ─────────────────────────────────────
      let desiredAnim = 'idle'
      let desiredAnimName = animNames.idle || animNames.fallback
      let desiredTimeScale = 0.7

      if (s.speedMult > 1 && animNames.run) {
        desiredAnim = 'run'
        desiredAnimName = animNames.run
        desiredTimeScale = 1.0
      } else if (s.speedMult > 1) {
        desiredAnim = 'walk-fast'
        desiredAnimName = animNames.walk || animNames.fallback
        desiredTimeScale = 2.0
      } else if (s.currentSpeed > 0.2) {
        desiredAnim = 'walk'
        desiredAnimName = animNames.walk || animNames.fallback
        desiredTimeScale = 0.7 + Math.random() * 0.1
      }

      if (desiredAnim !== 'idle' && desiredAnimName) {
        if (s.currentAnim !== desiredAnim) {
          if (switchAnim(desiredAnimName, desiredTimeScale)) {
            s.currentAnim = desiredAnim
            s.playingWalk = true
          }
        } else if (activeAction.current) {
          activeAction.current.timeScale += (desiredTimeScale - activeAction.current.timeScale) * 3.0 * dt
        }
      }

      // Safety: if flagged as walking but no action is running, reset
      if (s.playingWalk && activeAction.current && !activeAction.current.isRunning()) {
        s.playingWalk = false
        s.currentAnim = 'idle'
      }

      // Reached target (sprinting animals don't stop)
      if (dist < 1.0 && s.currentSpeed < 0.3) {
        s.moving = false
        s.pause = beh.pauseMin + Math.random() * (beh.pauseMax - beh.pauseMin)
        s.stuckTimer = 0
        s.currentAnim = '' // force re-eval on next move
      }
    }

    // ── Hard pond boundary ──
    for (let i = 0; i < PONDS.length; i++) {
      const pond = PONDS[i]
      const pdx = s.x - pond.cx
      const pdz = s.z - pond.cz
      const pDist = Math.sqrt(pdx * pdx + pdz * pdz)
      if (pDist < pond.radius + 1.5) {
        const push = (pond.radius + 2.0) / Math.max(pDist, 0.1)
        s.x = pond.cx + pdx * push
        s.z = pond.cz + pdz * push
      }
    }

    // ── Hard world boundary ──
    if (Math.abs(s.x) > WORLD_HALF || Math.abs(s.z) > WORLD_HALF) {
      s.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.x))
      s.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, s.z))
      const towardCenterAngle = Math.atan2(-s.x, -s.z)
      const spread = (Math.random() - 0.5) * Math.PI * 0.5
      const d = range * 0.3 + Math.random() * range * 0.4
      s.targetX = s.x + Math.sin(towardCenterAngle + spread) * d
      s.targetZ = s.z + Math.cos(towardCenterAngle + spread) * d
      s.moving = true
      s.stuckTimer = 0
    }

    // ── Gentle paused separation ──
    if (!s.moving) {
      const me2 = myEntry.current
      for (let i = 0; i < animalPositions.length; i++) {
        const other = animalPositions[i]
        if (other === me2) continue
        const adx = s.x - other.x
        const adz = s.z - other.z
        const distSq = adx * adx + adz * adz
        if (distSq < 6.0 && distSq > 0.01) {
          const d = Math.sqrt(distSq)
          const push = (2.5 - Math.min(d, 2.5)) * 0.5 * dt
          s.x += (adx / d) * push
          s.z += (adz / d) * push
        }
      }
    }

    // Apply position
    g.position.x = s.x
    g.position.z = s.z
    g.position.y = getTerrainHeight(s.x, s.z)
    g.rotation.y = s.rotY

    // Update shared registry
    if (myEntry.current) {
      myEntry.current.x = s.x
      myEntry.current.z = s.z
    }
  })

  return (
    <group ref={groupRef} position={startPos} scale={animalScale}
      onPointerOver={(e) => { e.stopPropagation(); setHover(animalName) }}
      onPointerOut={clearHover}
    >
      <primitive object={clonedScene} />
    </group>
  )
}

// ─── Fish (procedural) — clamped to pond ──────────────
function Fish({ pondCenter, pondRadius }) {
  const groupRef = useRef()
  const tailRef = useRef()
  const state = useRef({
    angle: Math.random() * Math.PI * 2,
    radius: Math.random() * (pondRadius - 2) + 1,
    depth: -0.4 - Math.random() * 0.6,
    speed: 0.2 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
  })

  useFrame((_, delta) => {
    const s = state.current
    const g = groupRef.current
    if (!g) return
    s.angle += s.speed * delta
    s.phase += delta * 6
    const r = Math.min(pondRadius - 1, s.radius + Math.sin(s.phase * 0.3) * 0.5)
    const x = pondCenter[0] + Math.cos(s.angle) * r
    const z = pondCenter[1] + Math.sin(s.angle) * r
    const y = pondCenter[2] + s.depth + Math.sin(s.phase * 0.5) * 0.1
    g.position.set(x, y, z)
    g.rotation.y = -s.angle + Math.PI / 2
    if (tailRef.current) tailRef.current.rotation.y = Math.sin(s.phase) * 0.4
  })

  const color = useMemo(() => Math.random() > 0.5 ? '#cc6622' : '#888888', [])
  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setHover('Fish') }}
      onPointerOut={clearHover}
    >
      <mesh>
        <sphereGeometry args={[0.1, 5, 4]} />
        <meshStandardMaterial color={color} roughness={0.5} flatShading />
      </mesh>
      <mesh ref={tailRef} position={[0, 0, -0.12]}>
        <coneGeometry args={[0.06, 0.1, 4]} />
        <meshStandardMaterial color={color} roughness={0.5} flatShading />
      </mesh>
    </group>
  )
}

// ─── Butterfly (procedural) ────────────────────────────
function Butterfly({ startPos }) {
  const groupRef = useRef()
  const wingLRef = useRef()
  const wingRRef = useRef()
  const state = useRef({
    x: startPos[0], y: startPos[1], z: startPos[2],
    centerX: startPos[0], centerZ: startPos[2],
    phase: Math.random() * Math.PI * 2,
    driftAngle: Math.random() * Math.PI * 2,
    driftSpeed: 0.3 + Math.random() * 0.5,
  })

  useFrame((_, delta) => {
    const s = state.current
    const g = groupRef.current
    if (!g) return
    s.phase += delta * 10
    s.driftAngle += delta * s.driftSpeed
    s.x = s.centerX + Math.sin(s.driftAngle) * 3 + Math.sin(s.driftAngle * 2.3) * 1.5
    s.z = s.centerZ + Math.cos(s.driftAngle * 0.7) * 3 + Math.cos(s.driftAngle * 1.8) * 1.5
    const groundY = getTerrainHeight(s.x, s.z)
    s.y = groundY + 1.0 + Math.sin(s.phase * 0.3) * 0.5
    g.position.set(s.x, s.y, s.z)
    g.rotation.y = s.driftAngle + Math.PI
    const flutter = Math.sin(s.phase) * 0.7
    if (wingLRef.current) wingLRef.current.rotation.z = 0.1 + flutter
    if (wingRRef.current) wingRRef.current.rotation.z = -0.1 - flutter
  })

  const { isDragonfly, wingColor } = useMemo(() => {
    const df = Math.random() > 0.5
    const wc = df
      ? '#44aacc'
      : ['#cc44aa', '#ddaa33', '#aabb44', '#dd6644'][Math.floor(Math.random() * 4)]
    return { isDragonfly: df, wingColor: wc }
  }, [])

  return (
    <group ref={groupRef} position={startPos}
      onPointerOver={(e) => { e.stopPropagation(); setHover(isDragonfly ? 'Dragonfly' : 'Butterfly') }}
      onPointerOut={clearHover}
    >
      <mesh>
        <capsuleGeometry args={[0.015, isDragonfly ? 0.12 : 0.04, 3, 4]} />
        <meshStandardMaterial color={isDragonfly ? '#225566' : '#2a1a10'} roughness={0.8} flatShading />
      </mesh>
      <mesh ref={wingLRef} position={[-0.04, 0.01, 0]}>
        <planeGeometry args={[isDragonfly ? 0.15 : 0.1, isDragonfly ? 0.03 : 0.06]} />
        <meshStandardMaterial color={wingColor} transparent opacity={0.7} roughness={0.3} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh ref={wingRRef} position={[0.04, 0.01, 0]}>
        <planeGeometry args={[isDragonfly ? 0.15 : 0.1, isDragonfly ? 0.03 : 0.06]} />
        <meshStandardMaterial color={wingColor} transparent opacity={0.7} roughness={0.3} side={THREE.DoubleSide} flatShading />
      </mesh>
    </group>
  )
}

// ─── Main Wildlife Component ───────────────────────────
export default function Wildlife() {
  const critters = useMemo(() => {
    const list = []
    const SPREAD = 160

    const herdCenters = {}
    const herds = [...new Set(ANIMAL_TYPES.map(t => t.herd).filter(Boolean))]
    herds.forEach((herd) => {
      const cx = (Math.random() - 0.5) * SPREAD * 0.5
      const cz = (Math.random() - 0.5) * SPREAD * 0.5
      const y = getTerrainHeight(cx, cz)
      if (y < -0.5) {
        herdCenters[herd] = [cx + 20, 0, cz + 20]
      } else {
        herdCenters[herd] = [cx, y, cz]
      }
    })

    ANIMAL_TYPES.forEach((type) => {
      const center = type.herd ? herdCenters[type.herd] : null

      for (let i = 0; i < type.count; i++) {
        let x, z
        let attempts = 0

        do {
          if (center) {
            const angle = Math.random() * Math.PI * 2
            const dist = 3 + Math.random() * 12
            x = center[0] + Math.cos(angle) * dist
            z = center[2] + Math.sin(angle) * dist
          } else {
            x = (Math.random() - 0.5) * SPREAD * 0.7
            z = (Math.random() - 0.5) * SPREAD * 0.7
          }
          attempts++
        } while (attempts < 10 && (
          getTerrainHeight(x, z) < -0.5 ||
          PONDS.some(p => (x - p.cx) ** 2 + (z - p.cz) ** 2 < (p.radius + 2) ** 2)
        ))

        const y = getTerrainHeight(x, z)
        if (y < -0.5) continue

        list.push({
          type: 'glb',
          modelPath: type.path,
          pos: [x, y, z],
          scale: type.scale,
          speed: type.speed,
          range: type.range,
          behavior: type.behavior,
          groupCenter: center,
          key: `${type.name}-${i}`,
          animalName: type.name.replace(/([a-z])([A-Z])/g, '$1 $2'),
        })
      }
    })

    for (let i = 0; i < 4; i++) {
      list.push({ type: 'fish', pondCenter: [15, -5, -2.2], pondRadius: 9, key: `fish-main-${i}` })
    }
    for (let i = 0; i < 2; i++) {
      list.push({ type: 'fish', pondCenter: [-30, 25, -1.5], pondRadius: 5, key: `fish-small-${i}` })
    }

    for (let i = 0; i < 10; i++) {
      const x = (Math.random() - 0.5) * SPREAD * 0.7
      const z = (Math.random() - 0.5) * SPREAD * 0.7
      const y = getTerrainHeight(x, z) + 1
      if (y < 0) continue
      list.push({ type: 'butterfly', pos: [x, y, z], key: `butterfly-${i}` })
    }

    return list
  }, [])

  return (
    <group>
      {critters.map((c) => {
        switch (c.type) {
          case 'glb':
            return (
              <Suspense key={c.key} fallback={null}>
                <GLBAnimal
                  modelPath={c.modelPath}
                  startPos={c.pos}
                  animalScale={c.scale}
                  speed={c.speed}
                  range={c.range}
                  behavior={c.behavior}
                  groupCenter={c.groupCenter}
                  animalName={c.animalName}
                />
              </Suspense>
            )
          case 'fish':
            return <Fish key={c.key} pondCenter={c.pondCenter} pondRadius={c.pondRadius} />
          case 'butterfly':
            return <Butterfly key={c.key} startPos={c.pos} />
          default:
            return null
        }
      })}
    </group>
  )
}

// Preload all models
ANIMAL_TYPES.forEach((type) => useGLTF.preload(type.path))
