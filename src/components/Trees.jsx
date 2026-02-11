import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { WORLD_ITEMS } from '../worldData'
import { setHover, clearHover } from '../hoverStore'

const CHIP_COUNT = 12

function useChipParticles() {
  const ref = useRef()
  const positions = useMemo(() => new Float32Array(CHIP_COUNT * 3), [])
  const velocities = useRef([])
  const life = useRef(0)
  return { ref, positions, velocities, life }
}

function TreeItem({ item, resourceStatesRef, index }) {
  const groupRef = useRef()
  const currentScale = useRef(1)
  const shakeAngle = useRef(0)
  const tilt = useRef(0)
  const chips = useChipParticles()

  const scale = item.scale
  const variant = item.variant

  useFrame((_, delta) => {
    if (!groupRef.current || !resourceStatesRef?.current) return
    const dt = Math.min(delta, 0.05)
    const rs = resourceStatesRef.current[index]
    if (!rs) return

    // Dynamic position from WORLD_ITEMS (updates on respawn)
    const pos = WORLD_ITEMS[index].pos
    groupRef.current.position.set(pos[0], pos[1], pos[2])

    // Scale: during gathering shrink progressively, otherwise use rs.scale
    let targetS
    if (rs.beingGathered) {
      targetS = 1 - rs.gatherProgress * 0.7
    } else {
      targetS = rs.scale
    }
    currentScale.current += (targetS - currentScale.current) * 0.1

    if (currentScale.current < 0.05) {
      groupRef.current.visible = false
    } else {
      groupRef.current.visible = true
      groupRef.current.scale.set(currentScale.current, currentScale.current, currentScale.current)
    }

    // Shake animation during gathering
    if (rs.beingGathered) {
      shakeAngle.current += dt * 14
      const intensity = 0.08 + rs.gatherProgress * 0.15
      groupRef.current.rotation.z = Math.sin(shakeAngle.current) * intensity
      // Forward tilt increases with progress
      tilt.current += (rs.gatherProgress * 0.3 - tilt.current) * 3 * dt
      groupRef.current.rotation.x = tilt.current

      // Spawn chip particles periodically
      if (Math.random() < 0.15) {
        _spawnChips(chips, scale)
      }
    } else {
      // Reset rotation smoothly
      groupRef.current.rotation.z *= 0.9
      groupRef.current.rotation.x *= 0.9
      shakeAngle.current = 0
      tilt.current *= 0.9
    }

    // Update chip particles
    _updateChips(chips, dt)
  })

  const trunkHeight = (1.8 + variant * 0.6) * scale
  const crownRadius = (1.2 + variant * 0.4) * scale
  const trunkColor = variant > 0.5 ? '#2a1a0a' : '#1f150a'
  const crownColor = variant > 0.5 ? '#0a2a0a' : '#0d1f0a'

  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setHover('Tree') }}
      onPointerOut={clearHover}
    >
      <mesh position={[0, trunkHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.08 * scale, 0.15 * scale, trunkHeight, 6]} />
        <meshStandardMaterial color={trunkColor} roughness={0.9} />
      </mesh>
      <mesh position={[0, trunkHeight * 0.7, 0]} castShadow>
        <coneGeometry args={[crownRadius, crownRadius * 2, 7]} />
        <meshStandardMaterial color={crownColor} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, trunkHeight * 1.0, 0]} castShadow>
        <coneGeometry args={[crownRadius * 0.7, crownRadius * 1.5, 7]} />
        <meshStandardMaterial color="#0d250d" roughness={0.85} flatShading />
      </mesh>
      {/* Wood chip particles */}
      <points ref={chips.ref} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={CHIP_COUNT} array={chips.positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#aa7744" size={0.12} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  )
}

function RockItem({ item, resourceStatesRef, index }) {
  const groupRef = useRef()
  const currentScale = useRef(1)
  const jitter = useRef({ x: 0, z: 0 })
  const chips = useChipParticles()

  const scale = item.scale

  useFrame((_, delta) => {
    if (!groupRef.current || !resourceStatesRef?.current) return
    const dt = Math.min(delta, 0.05)
    const rs = resourceStatesRef.current[index]
    if (!rs) return

    const pos = WORLD_ITEMS[index].pos
    let px = pos[0], pz = pos[2]

    // Vibrate/jitter during gathering
    if (rs.beingGathered) {
      const intensity = 0.04 + rs.gatherProgress * 0.08
      jitter.current.x = (Math.random() - 0.5) * intensity
      jitter.current.z = (Math.random() - 0.5) * intensity
      px += jitter.current.x
      pz += jitter.current.z

      if (Math.random() < 0.12) {
        _spawnChips(chips, scale)
      }
    }

    groupRef.current.position.set(px, pos[1], pz)

    let targetS
    if (rs.beingGathered) {
      targetS = 1 - rs.gatherProgress * 0.6
    } else {
      targetS = rs.scale
    }
    currentScale.current += (targetS - currentScale.current) * 0.1

    if (currentScale.current < 0.05) {
      groupRef.current.visible = false
    } else {
      groupRef.current.visible = true
      groupRef.current.scale.set(currentScale.current, currentScale.current, currentScale.current)
    }

    _updateChips(chips, dt)
  })

  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setHover('Rock') }}
      onPointerOut={clearHover}
    >
      <mesh castShadow rotation={[0, scale * 5, 0]}>
        <dodecahedronGeometry args={[0.3 * scale, 0]} />
        <meshStandardMaterial color="#1a1a18" roughness={0.95} flatShading />
      </mesh>
      <points ref={chips.ref} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={CHIP_COUNT} array={chips.positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#99aaaa" size={0.1} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  )
}

function BushItem({ item, resourceStatesRef, index }) {
  const groupRef = useRef()
  const currentScale = useRef(1)
  const rustlePhase = useRef(0)
  const chips = useChipParticles()

  const scale = item.scale

  useFrame((_, delta) => {
    if (!groupRef.current || !resourceStatesRef?.current) return
    const dt = Math.min(delta, 0.05)
    const rs = resourceStatesRef.current[index]
    if (!rs) return

    const pos = WORLD_ITEMS[index].pos
    groupRef.current.position.set(pos[0], pos[1], pos[2])

    let targetS
    if (rs.beingGathered) {
      // Smooth wilt
      targetS = 1 - rs.gatherProgress * 0.8
      // Rustle — oscillating scale on X/Z
      rustlePhase.current += dt * 10
      const rustle = Math.sin(rustlePhase.current) * 0.08 * (1 - rs.gatherProgress)
      groupRef.current.scale.set(
        targetS + rustle,
        targetS * (1 - rs.gatherProgress * 0.3),
        targetS - rustle
      )

      // Leaf particles floating up
      if (Math.random() < 0.18) {
        _spawnLeafParticles(chips, scale)
      }

      currentScale.current = targetS
      _updateChips(chips, dt, true) // upward drift
      // Skip normal scale logic
      if (targetS < 0.05) {
        groupRef.current.visible = false
      } else {
        groupRef.current.visible = true
      }
      return
    }

    targetS = rs.scale
    currentScale.current += (targetS - currentScale.current) * 0.1
    rustlePhase.current = 0

    if (currentScale.current < 0.05) {
      groupRef.current.visible = false
    } else {
      groupRef.current.visible = true
      groupRef.current.scale.set(currentScale.current, currentScale.current, currentScale.current)
    }

    _updateChips(chips, dt, true)
  })

  return (
    <group ref={groupRef}
      onPointerOver={(e) => { e.stopPropagation(); setHover('Bush') }}
      onPointerOut={clearHover}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.4 * scale, 6, 5]} />
        <meshStandardMaterial color="#0f1f08" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.2 * scale, 0.1, 0.15 * scale]} castShadow>
        <sphereGeometry args={[0.3 * scale, 6, 5]} />
        <meshStandardMaterial color="#0d2208" roughness={0.9} flatShading />
      </mesh>
      <points ref={chips.ref} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={CHIP_COUNT} array={chips.positions} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color="#66cc66" size={0.1} transparent opacity={0.8} sizeAttenuation />
      </points>
    </group>
  )
}

// ── Particle helpers ──────────────────────────────────────

function _spawnChips(chips, scale) {
  chips.life.current = 0.6
  chips.velocities.current = []
  for (let i = 0; i < CHIP_COUNT; i++) {
    chips.positions[i * 3] = (Math.random() - 0.5) * 0.5 * scale
    chips.positions[i * 3 + 1] = Math.random() * 1.5 * scale
    chips.positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5 * scale
    chips.velocities.current.push({
      x: (Math.random() - 0.5) * 3,
      y: Math.random() * 2 + 0.5,
      z: (Math.random() - 0.5) * 3,
    })
  }
  if (chips.ref.current) {
    chips.ref.current.visible = true
    chips.ref.current.geometry.attributes.position.needsUpdate = true
  }
}

function _spawnLeafParticles(chips, scale) {
  chips.life.current = 0.8
  chips.velocities.current = []
  for (let i = 0; i < CHIP_COUNT; i++) {
    chips.positions[i * 3] = (Math.random() - 0.5) * 0.6 * scale
    chips.positions[i * 3 + 1] = Math.random() * 0.5 * scale
    chips.positions[i * 3 + 2] = (Math.random() - 0.5) * 0.6 * scale
    chips.velocities.current.push({
      x: (Math.random() - 0.5) * 1.5,
      y: Math.random() * 2 + 1.5,
      z: (Math.random() - 0.5) * 1.5,
    })
  }
  if (chips.ref.current) {
    chips.ref.current.visible = true
    chips.ref.current.geometry.attributes.position.needsUpdate = true
  }
}

function _updateChips(chips, dt, upwardDrift) {
  if (chips.life.current <= 0) return
  chips.life.current -= dt
  for (let i = 0; i < CHIP_COUNT; i++) {
    const v = chips.velocities.current[i]
    if (!v) continue
    chips.positions[i * 3] += v.x * dt
    chips.positions[i * 3 + 1] += v.y * dt
    chips.positions[i * 3 + 2] += v.z * dt
    if (upwardDrift) {
      v.y -= 1.0 * dt // gentle slow down
    } else {
      v.y -= 5 * dt // gravity
    }
  }
  if (chips.ref.current) {
    chips.ref.current.geometry.attributes.position.needsUpdate = true
    chips.ref.current.material.opacity = Math.max(0, chips.life.current / 0.6)
  }
  if (chips.life.current <= 0 && chips.ref.current) {
    chips.ref.current.visible = false
  }
}

export default function Trees({ resourceStatesRef }) {
  return (
    <group>
      {WORLD_ITEMS.map((item, i) => {
        if (item.type === 'tree') return <TreeItem key={item.key} item={item} resourceStatesRef={resourceStatesRef} index={i} />
        if (item.type === 'rock') return <RockItem key={item.key} item={item} resourceStatesRef={resourceStatesRef} index={i} />
        return <BushItem key={item.key} item={item} resourceStatesRef={resourceStatesRef} index={i} />
      })}
    </group>
  )
}
