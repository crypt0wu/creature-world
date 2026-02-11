import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getTerrainHeight } from '../components/Terrain'
import SPECIES from './species'
import { setHover, clearHover } from '../hoverStore'

const BITE_COUNT = 15

export default function Creature({ creaturesRef, index, isSelected, onSelect }) {
  const groupRef = useRef()
  const coreRef = useRef()
  const glowRef = useRef()
  const lightRef = useRef()
  const ringRef = useRef()
  const ripplesRef = useRef()
  const rippleRefs = useRef([null, null, null])
  const biteRef = useRef()
  const floatTextRef = useRef()
  const labelRef = useRef()

  const c = creaturesRef.current[index]
  const spec = SPECIES[c.species]
  const timer = useRef(0)
  const wasEating = useRef(false)
  const wasSleeping = useRef(false)
  const zzzRef = useRef()
  const zzzTimer = useRef(0)
  const biteVelocities = useRef([])
  const biteLife = useRef(0)
  const floatTimer = useRef(0)
  const floatValue = useRef(0)
  const floatColor = useRef('#44ff88')
  const floatLabel = useRef('')
  const prevInventoryLen = useRef(c.inventory?.length || 0)

  const { camera } = useThree()
  // detailLevel: 0 = name only, 1 = name + HP, 2 = name + status + HP
  const [display, setDisplay] = useState({
    hp: c.hp, maxHp: c.maxHp, state: c.state, alive: c.alive, detailLevel: 2,
  })

  const bitePositions = useMemo(() => new Float32Array(BITE_COUNT * 3), [])

  useFrame((_, delta) => {
    const creature = creaturesRef.current[index]
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)

    if (!creature.alive) {
      groupRef.current.visible = false
      return
    }

    groupRef.current.visible = true
    const y = getTerrainHeight(creature.x, creature.z)

    // ── Position: walking bob or eating chew-bounce ──
    const eatBounce = creature.eating ? Math.abs(Math.sin(creature.phase * 5)) * 0.12 : 0
    const walkBob = creature.moving ? Math.sin(creature.phase * 3) * 0.08 : 0
    groupRef.current.position.set(creature.x, y + 1.2 + walkBob + eatBounce, creature.z)
    groupRef.current.rotation.y = creature.rotY

    // ── Core pulse: sleeping breathing / eating bounce / normal ──
    if (coreRef.current) {
      if (creature.sleeping) {
        const pulse = 1 + Math.sin(creature.phase * 1.5) * 0.06
        coreRef.current.scale.setScalar(pulse)
      } else if (creature.eating) {
        const pulse = 1 + Math.sin(creature.phase * 6) * 0.1
        coreRef.current.scale.setScalar(pulse)
      } else {
        const s = coreRef.current.scale.x
        if (Math.abs(s - 1) > 0.01) coreRef.current.scale.setScalar(s + (1 - s) * 5 * dt)
        else coreRef.current.scale.setScalar(1)
      }
    }

    // ── Emissive / light: dim while sleeping, bright while eating ──
    if (coreRef.current?.material) {
      let target = 0.8
      if (creature.sleeping) target = 0.2 + Math.sin(creature.phase * 1.5) * 0.05
      else if (creature.eating) target = 1.5
      const cur = coreRef.current.material.emissiveIntensity
      coreRef.current.material.emissiveIntensity = cur + (target - cur) * 4 * dt
    }
    if (lightRef.current) {
      const target = creature.sleeping ? 1 : creature.eating ? 6 : 3
      lightRef.current.intensity += (target - lightRef.current.intensity) * 4 * dt
    }

    // ── Glow shell breathing ──
    if (glowRef.current) {
      const t = performance.now() * 0.002 + index * 2
      glowRef.current.scale.setScalar(1 + Math.sin(t) * 0.15)
    }

    // ── Selection ring ──
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5
    }

    // ── Ripple rings while eating ──
    if (ripplesRef.current) {
      ripplesRef.current.visible = creature.eating
    }
    if (creature.eating) {
      const t = creature.phase
      for (let i = 0; i < 3; i++) {
        const ring = rippleRefs.current[i]
        if (!ring) continue
        const cycle = ((t * 1.2 + i * 0.7) % 2.1) / 2.1
        ring.scale.setScalar(1 + cycle * 3)
        ring.material.opacity = 0.25 * (1 - cycle)
      }
    }

    // ── Detect sleeping transitions ──
    const justFellAsleep = creature.sleeping && !wasSleeping.current
    const justWokeUp = !creature.sleeping && wasSleeping.current
    wasSleeping.current = creature.sleeping

    // ── ZZZ text cycling ──
    if (creature.sleeping) {
      zzzTimer.current += dt
    }
    if (zzzRef.current) {
      if (creature.sleeping) {
        const cycle = Math.floor(zzzTimer.current * 0.8) % 3
        const texts = ['z', 'zZ', 'zZz']
        zzzRef.current.textContent = texts[cycle]
        const floatY = Math.sin(zzzTimer.current * 2) * 3
        zzzRef.current.style.transform = `translateY(${-floatY}px)`
        zzzRef.current.style.display = 'block'
      } else {
        zzzRef.current.style.display = 'none'
        zzzTimer.current = 0
      }
    }

    // ── Wake text ──
    if (justWokeUp) {
      floatTimer.current = 1.5
      floatValue.current = 0
      floatColor.current = '#6688cc'
      floatLabel.current = 'Awake!'
    }

    // ── Detect eating transitions ──
    const justStarted = creature.eating && !wasEating.current
    const justFinished = !creature.eating && wasEating.current
    wasEating.current = creature.eating

    // ── Bite particles on eating start ──
    if (justStarted) {
      biteLife.current = 0.8
      biteVelocities.current = []
      for (let i = 0; i < BITE_COUNT; i++) {
        bitePositions[i * 3] = (Math.random() - 0.5) * 0.5
        bitePositions[i * 3 + 1] = -0.5
        bitePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5
        biteVelocities.current.push({
          x: (Math.random() - 0.5) * 3,
          y: Math.random() * 2.5 + 1,
          z: (Math.random() - 0.5) * 3,
        })
      }
      if (biteRef.current) {
        biteRef.current.visible = true
        biteRef.current.geometry.attributes.position.needsUpdate = true
      }
    }

    if (biteLife.current > 0) {
      biteLife.current -= dt
      for (let i = 0; i < BITE_COUNT; i++) {
        const v = biteVelocities.current[i]
        if (!v) continue
        bitePositions[i * 3] += v.x * dt
        bitePositions[i * 3 + 1] += v.y * dt
        bitePositions[i * 3 + 2] += v.z * dt
        v.y -= 4 * dt
      }
      if (biteRef.current) {
        biteRef.current.geometry.attributes.position.needsUpdate = true
        biteRef.current.material.opacity = Math.max(0, biteLife.current / 0.8)
      }
      if (biteLife.current <= 0 && biteRef.current) {
        biteRef.current.visible = false
      }
    }

    // ── Detect inventory pickup ──
    const invLen = creature.inventory?.length || 0
    if (invLen > prevInventoryLen.current && creature.alive) {
      floatTimer.current = 1.5
      floatValue.current = 0
      floatColor.current = '#ff6699'
      floatLabel.current = '+1 Berry'
    }
    prevInventoryLen.current = invLen

    // ── Floating text (hunger gain or wake) ──
    if (justFinished) {
      floatTimer.current = 1.5
      floatValue.current = creature.lastHungerGain || 60
      floatColor.current = '#44ff88'
      floatLabel.current = ''
    }

    if (floatTextRef.current) {
      if (floatTimer.current > 0) {
        floatTimer.current -= dt
        const progress = 1 - floatTimer.current / 1.5
        floatTextRef.current.style.opacity = String(Math.max(0, 1 - progress * 1.3))
        floatTextRef.current.style.transform = `translateY(${-progress * 35}px)`
        const color = floatColor.current
        floatTextRef.current.style.color = color
        floatTextRef.current.style.textShadow = `0 0 10px ${color}, 0 0 4px rgba(0,0,0,0.9)`
        floatTextRef.current.textContent = floatLabel.current || (floatValue.current > 0 ? `+${floatValue.current} hunger` : '')
        floatTextRef.current.style.display = 'block'
      } else {
        floatTextRef.current.style.display = 'none'
      }
    }

    // ── Per-frame label scale (clamped) ──
    if (labelRef.current && groupRef.current) {
      const camDist = camera.position.distanceTo(groupRef.current.position)
      // Map distance to scale: close (20) → 1.3, far (150) → 0.65
      const t = Math.max(0, Math.min(1, (camDist - 20) / 130))
      const scale = 1.3 - t * 0.65  // 1.3 at close, 0.65 at far
      labelRef.current.style.transform = `scale(${scale})`
    }

    // ── Periodic UI sync ──
    timer.current += delta
    if (timer.current > 0.5) {
      timer.current = 0
      const camDist = groupRef.current ? camera.position.distanceTo(groupRef.current.position) : 100
      const detailLevel = camDist < 45 ? 2 : camDist < 85 ? 1 : 0
      setDisplay({
        hp: creature.hp, maxHp: creature.maxHp,
        state: creature.state, alive: creature.alive,
        detailLevel,
      })
    }
  })

  const hpPct = display.maxHp > 0 ? (display.hp / display.maxHp) * 100 : 0
  const hpColor = hpPct > 50 ? '#44ff44' : hpPct > 25 ? '#ffaa00' : '#ff4444'

  return (
    <group
      ref={groupRef}
      onClick={(e) => { e.stopPropagation(); onSelect(c.id) }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; setHover(`${c.name} (${c.species})`) }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; clearHover() }}
    >
      {/* Core sphere */}
      <mesh ref={coreRef} castShadow>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial
          color={spec.color}
          emissive={spec.color}
          emissiveIntensity={0.8}
          roughness={0.3}
        />
      </mesh>
      {/* Glow shell */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[1.0, 16, 16]} />
        <meshBasicMaterial color={spec.glow} transparent opacity={0.12} />
      </mesh>
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[0.5, 12, 12]} />
        <meshBasicMaterial color={spec.glow} transparent opacity={0.3} />
      </mesh>
      {/* Light */}
      <pointLight ref={lightRef} color={spec.glow} intensity={3} distance={12} />

      {/* Selection ring */}
      {isSelected && (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
          <ringGeometry args={[1.5, 1.8, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Ripple rings — visible while eating */}
      <group ref={ripplesRef} visible={false} position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} ref={el => { rippleRefs.current[i] = el }}>
            <ringGeometry args={[0.8, 1.0, 20]} />
            <meshBasicMaterial color={spec.glow} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Bite particles */}
      <points ref={biteRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={BITE_COUNT}
            array={bitePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#44ff88" size={0.15} transparent opacity={0.8} sizeAttenuation />
      </points>

      {/* Name / status label */}
      <Html position={[0, 2.8, 0]} center sprite zIndexRange={[0, 0]}>
        <div ref={labelRef} style={{
          pointerEvents: 'none', textAlign: 'center',
          userSelect: 'none', whiteSpace: 'nowrap',
          fontFamily: "'Courier New', monospace",
        }}>
          {display.detailLevel >= 2 && (
            <div style={{
              fontSize: '11px',
              color: display.state === 'sleeping' ? '#6688cc'
                : display.state === 'eating' ? '#44ff88'
                : display.state === 'seeking food' ? '#ffcc44'
                : display.state === 'hungry' ? '#ffaa44'
                : display.state === 'tired' ? '#44aaff'
                : '#666',
              textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
            }}>
              {display.state}
            </div>
          )}
          <div style={{
            fontSize: '18px', fontWeight: 'bold',
            color: spec.glow, textShadow: `0 0 8px ${spec.glow}, 0 0 3px rgba(0,0,0,0.9)`,
            marginBottom: display.detailLevel >= 1 ? '8px' : '0',
          }}>
            {c.name}
          </div>
          {display.detailLevel >= 1 && (
            <div style={{
              width: '70px', height: '5px',
              background: 'rgba(0,0,0,0.7)', borderRadius: '3px',
              margin: '0 auto', overflow: 'hidden',
            }}>
              <div style={{
                width: `${hpPct}%`, height: '100%',
                background: hpColor, borderRadius: '3px',
              }} />
            </div>
          )}
        </div>
      </Html>

      {/* Floating text (hunger gain / wake) */}
      <Html position={[0, 4.2, 0]} center sprite zIndexRange={[0, 0]}>
        <div ref={floatTextRef} style={{
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          fontFamily: "'Courier New', monospace",
          fontSize: '20px', fontWeight: 'bold',
          color: '#44ff88',
          textShadow: '0 0 10px #44ff88, 0 0 4px rgba(0,0,0,0.9)',
          display: 'none',
        }} />
      </Html>

      {/* ZZZ sleep text */}
      <Html position={[1.0, 4.2, 0]} center sprite zIndexRange={[0, 0]}>
        <div ref={zzzRef} style={{
          pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
          fontFamily: "'Courier New', monospace",
          fontSize: '18px', fontWeight: 'bold',
          color: '#6688cc',
          textShadow: '0 0 8px #6688cc, 0 0 4px rgba(0,0,0,0.9)',
          display: 'none',
        }} />
      </Html>
    </group>
  )
}
