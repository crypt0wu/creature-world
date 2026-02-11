import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { setHover, clearHover } from '../hoverStore'

const POP_COUNT = 10

const ITEM_COLORS = {
  wood:    '#aa7744',
  stone:   '#99aaaa',
  herb:    '#66cc66',
  crystal: '#aa66ff',
  berry:   '#ff6699',
}

const ITEM_LABELS = {
  wood: 'Wood', stone: 'Stone', herb: 'Herb', crystal: 'Crystal', berry: 'Berry',
}

function DroppedItem({ item, index }) {
  const groupRef = useRef()
  const meshRef = useRef()
  const glowRef = useRef()
  const popRef = useRef()
  const timerRef = useRef()

  const popDirs = useMemo(() =>
    Array.from({ length: POP_COUNT }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 2 + 0.5,
      z: (Math.random() - 0.5) * 2,
    })), [])
  const popPositions = useMemo(() => new Float32Array(POP_COUNT * 3), [])

  const color = ITEM_COLORS[item.type] || '#888888'

  useFrame(() => {
    if (!groupRef.current) return

    // Hide if inactive and no pop animation
    if (!item.active && item.popTimer <= 0) {
      groupRef.current.visible = false
      if (popRef.current) popRef.current.visible = false
      return
    }

    if (item.active) {
      groupRef.current.visible = true
      const t = performance.now() * 0.001 + index * 2.3

      // Floating bob
      const bob = Math.sin(t * 2) * 0.15
      groupRef.current.position.set(item.x, item.y + 0.5 + bob, item.z)
      groupRef.current.rotation.y += 0.02

      // Pulse faster in last 5 seconds
      if (meshRef.current) {
        if (item.timer < 5) {
          const freq = 3 + (5 - item.timer) * 2
          const pulse = 0.4 + Math.abs(Math.sin(t * freq)) * 0.8
          meshRef.current.material.emissiveIntensity = pulse
        } else {
          meshRef.current.material.emissiveIntensity = 0.6
        }
      }

      // Glow breathe + fade
      if (glowRef.current) {
        const breathe = 1 + Math.sin(t * 3) * 0.2
        glowRef.current.scale.setScalar(breathe)
        const fade = Math.min(1, item.timer / 5)
        glowRef.current.material.opacity = 0.15 * fade
      }

      // Countdown display
      if (timerRef.current) {
        const secs = Math.ceil(item.timer)
        timerRef.current.textContent = `${secs}s`
        timerRef.current.style.color = item.timer < 5 ? '#ff6644' : '#88aa88'
        timerRef.current.style.display = 'block'
      }
    } else {
      groupRef.current.visible = false
      if (timerRef.current) timerRef.current.style.display = 'none'
    }

    // Pop particles on despawn
    if (popRef.current) {
      const hasPop = !item.active && item.popTimer > 0
      popRef.current.visible = hasPop
      if (hasPop) {
        popRef.current.position.set(item.x, item.y + 0.5, item.z)
        const progress = 1 - item.popTimer / 0.6
        for (let i = 0; i < POP_COUNT; i++) {
          const d = popDirs[i]
          popPositions[i * 3] = d.x * progress * 2
          popPositions[i * 3 + 1] = d.y * progress * 2 - progress * progress
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
        onPointerOver={(e) => { e.stopPropagation(); setHover(ITEM_LABELS[item.type] || 'Item') }}
        onPointerOut={clearHover}
      >
        <mesh ref={meshRef} castShadow>
          <sphereGeometry args={[0.25, 12, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.4, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
        </mesh>
        <pointLight color={color} intensity={2} distance={6} />

        <Html position={[0, 0.8, 0]} center sprite zIndexRange={[0, 0]}>
          <div ref={timerRef} style={{
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Courier New', monospace",
            fontSize: '11px', fontWeight: 'bold',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            display: 'none',
          }} />
        </Html>
      </group>

      <points ref={popRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={POP_COUNT}
            array={popPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.15} transparent opacity={1} sizeAttenuation />
      </points>
    </>
  )
}

export default function DroppedItems({ droppedItemsRef }) {
  return (
    <>
      {droppedItemsRef.current.map((item, i) => (
        <DroppedItem key={item.id} item={item} index={i} />
      ))}
    </>
  )
}
