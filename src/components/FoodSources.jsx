import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { setHover, clearHover } from '../hoverStore'

const POP_COUNT = 12

function FoodItem({ food, index }) {
  const groupRef = useRef()
  const popRef = useRef()

  const popDirs = useMemo(() =>
    Array.from({ length: POP_COUNT }, () => ({
      x: (Math.random() - 0.5) * 2.5,
      y: Math.random() * 2 + 0.5,
      z: (Math.random() - 0.5) * 2.5,
    })), [])
  const popPositions = useMemo(() => new Float32Array(POP_COUNT * 3), [])

  useFrame(() => {
    // Food bush — visible when active or being eaten
    if (groupRef.current) {
      const visible = food.active || food.beingEaten
      groupRef.current.visible = visible
      if (visible) {
        const t = performance.now() * 0.001 + index * 1.5
        const shrink = food.beingEaten ? Math.max(0.05, 1 - (food.eatProgress || 0)) : 1
        const shakeX = food.beingEaten ? Math.sin(t * 20) * 0.04 : 0
        const shakeZ = food.beingEaten ? Math.cos(t * 20) * 0.04 : 0
        groupRef.current.position.set(
          food.x + shakeX,
          food.y + 0.3 + Math.sin(t) * 0.05,
          food.z + shakeZ
        )
        groupRef.current.scale.setScalar(shrink)
      }
    }

    // Pop particles — burst when food is fully consumed
    if (popRef.current) {
      const hasPop = food.popTimer > 0
      popRef.current.visible = hasPop
      if (hasPop) {
        popRef.current.position.set(food.x, food.y + 0.5, food.z)
        const progress = 1 - food.popTimer / 0.6
        for (let i = 0; i < POP_COUNT; i++) {
          const d = popDirs[i]
          popPositions[i * 3] = d.x * progress * 2
          popPositions[i * 3 + 1] = d.y * progress * 2 - progress * progress * 1.5
          popPositions[i * 3 + 2] = d.z * progress * 2
        }
        popRef.current.geometry.attributes.position.needsUpdate = true
        popRef.current.material.opacity = Math.max(0, 1 - progress * progress)
      }
    }
  })

  return (
    <>
      <group ref={groupRef}
        onPointerOver={(e) => { e.stopPropagation(); setHover('Berry Bush') }}
        onPointerOut={clearHover}
      >
        {/* Bush base */}
        <mesh position={[0, 0.05, 0]}>
          <sphereGeometry args={[0.45, 8, 6]} />
          <meshStandardMaterial color="#1a4a1a" emissive="#0a2a0a" emissiveIntensity={0.2} roughness={0.9} />
        </mesh>
        {/* Berry cluster */}
        <mesh position={[0, 0.35, 0]}>
          <sphereGeometry args={[0.22, 8, 8]} />
          <meshStandardMaterial color="#ff4488" emissive="#ff2266" emissiveIntensity={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0.18, 0.25, 0.1]}>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color="#ff6699" emissive="#ff3377" emissiveIntensity={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.15, 0.28, -0.12]}>
          <sphereGeometry args={[0.18, 8, 8]} />
          <meshStandardMaterial color="#ff5588" emissive="#ff2266" emissiveIntensity={0.65} roughness={0.4} />
        </mesh>
        <mesh position={[0.08, 0.4, -0.08]}>
          <sphereGeometry args={[0.14, 8, 8]} />
          <meshStandardMaterial color="#ff77aa" emissive="#ff4488" emissiveIntensity={0.5} roughness={0.4} />
        </mesh>
        {/* Glow light */}
        <pointLight color="#ff6699" intensity={2} distance={8} />
      </group>

      {/* Pop particles */}
      <points ref={popRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={POP_COUNT}
            array={popPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#44ff88" size={0.2} transparent opacity={1} sizeAttenuation />
      </points>
    </>
  )
}

export default function FoodSources({ foodsRef }) {
  return (
    <>
      {foodsRef.current.map((food, i) => (
        <FoodItem key={i} food={food} index={i} />
      ))}
    </>
  )
}
