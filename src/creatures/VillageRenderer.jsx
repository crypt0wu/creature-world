import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getTerrainHeight } from '../components/Terrain'
import SPECIES from './species'

function Marker({ x, z, color, destroyProgress }) {
  const y = useMemo(() => getTerrainHeight(x, z) + 0.05, [x, z])
  const s = 1 - destroyProgress
  const opacity = 0.3 * (1 - destroyProgress)
  return (
    <mesh
      position={[x, y - destroyProgress * 0.5, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[s, s, s]}
    >
      <ringGeometry args={[2.0, 2.5, 32]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Shelter({ x, z, color, ownerName, destroyProgress }) {
  const baseY = useMemo(() => getTerrainHeight(x, z), [x, z])
  const [hovered, setHovered] = useState(false)
  const s = 1 - destroyProgress
  const y = baseY - destroyProgress * 0.5
  const opacity = 0.85 * (1 - destroyProgress)
  const emissiveIntensity = 1.5 * (1 - destroyProgress)
  const lightIntensity = 1.5 * (1 - destroyProgress)

  return (
    <group position={[x, y, z]} scale={[s, s, s]}>
      {/* Box base */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[2, 1.5, 2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          toneMapped={false}
          roughness={0.4}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Pyramid roof */}
      <mesh position={[0, 2.0, 0]} castShadow>
        <coneGeometry args={[1.5, 1.0, 4]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          toneMapped={false}
          roughness={0.4}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Point light */}
      <pointLight color={color} intensity={lightIntensity} distance={10} position={[0, 1.5, 0]} />
      {/* Hover hitbox */}
      {destroyProgress === 0 && (
        <mesh
          position={[0, 1.2, 0]}
          visible={false}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[2.5, 3, 2.5]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {/* Hover tooltip */}
      {hovered && destroyProgress === 0 && (
        <Html position={[0, 3.5, 0]} center sprite zIndexRange={[0, 0]}>
          <div style={{
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px', fontWeight: 'bold',
            color: color,
            textShadow: `0 0 8px ${color}, 0 0 4px rgba(0,0,0,0.9)`,
            background: 'rgba(5, 10, 5, 0.8)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${color}40`,
          }}>
            {ownerName}'s Shelter
          </div>
        </Html>
      )}
    </group>
  )
}

function Campfire({ x, z, color, ownerName, destroyProgress }) {
  const baseY = useMemo(() => getTerrainHeight(x, z), [x, z])
  const [hovered, setHovered] = useState(false)
  const flameRef = useRef()
  const lightRef = useRef()
  const speedRef = useRef(3 + Math.random() * 2) // unique flicker speed per campfire

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const spd = speedRef.current
    const flicker = 0.85 + 0.15 * Math.sin(t * spd) * Math.sin(t * spd * 1.7 + 1.3)
    if (flameRef.current) {
      flameRef.current.scale.set(flicker, 0.8 + 0.2 * flicker, flicker)
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.0 * flicker * (1 - destroyProgress)
    }
  })

  const s = 1 - destroyProgress
  const y = baseY - destroyProgress * 0.5
  const opacity = 0.85 * (1 - destroyProgress)
  const emissiveIntensity = 2.0 * (1 - destroyProgress)

  return (
    <group position={[x, y, z]} scale={[s, s, s]}>
      {/* Stone ring */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.15, 8, 6]} />
        <meshStandardMaterial
          color="#776655"
          roughness={0.9}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Flame */}
      <mesh ref={flameRef} position={[0, 0.5, 0]}>
        <coneGeometry args={[0.3, 0.8, 4]} />
        <meshStandardMaterial
          color="#ff6622"
          emissive="#ff6622"
          emissiveIntensity={emissiveIntensity}
          toneMapped={false}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Point light */}
      <pointLight ref={lightRef} color="#ff6622" intensity={2.0 * (1 - destroyProgress)} distance={8} position={[0, 0.6, 0]} />
      {/* Hover hitbox */}
      {destroyProgress === 0 && (
        <mesh
          position={[0, 0.5, 0]}
          visible={false}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {/* Hover tooltip */}
      {hovered && destroyProgress === 0 && (
        <Html position={[0, 2.0, 0]} center sprite zIndexRange={[0, 0]}>
          <div style={{
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px', fontWeight: 'bold',
            color: '#ff8844',
            textShadow: '0 0 8px #ff6622, 0 0 4px rgba(0,0,0,0.9)',
            background: 'rgba(5, 10, 5, 0.8)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: '1px solid #ff662240',
          }}>
            {ownerName}'s Campfire
          </div>
        </Html>
      )}
    </group>
  )
}

function StorageChest({ x, z, color, ownerName, itemCount, destroyProgress, onClick }) {
  const baseY = useMemo(() => getTerrainHeight(x, z), [x, z])
  const [hovered, setHovered] = useState(false)
  const s = 1 - destroyProgress
  const y = baseY - destroyProgress * 0.5
  const opacity = 0.85 * (1 - destroyProgress)
  const emissiveIntensity = 1.0 * (1 - destroyProgress)
  const lightIntensity = 0.8 * (1 - destroyProgress)

  return (
    <group position={[x, y, z]} scale={[s, s, s]}>
      {/* Chest body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.8, 0.8, 1.2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          toneMapped={false}
          roughness={0.5}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Lid (tilted open) */}
      <mesh position={[0, 0.85, -0.45]} rotation={[-0.35, 0, 0]} castShadow>
        <boxGeometry args={[1.8, 0.1, 1.2]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity * 0.7}
          toneMapped={false}
          roughness={0.5}
          transparent
          opacity={opacity}
        />
      </mesh>
      {/* Point light */}
      <pointLight color={color} intensity={lightIntensity} distance={6} position={[0, 1.0, 0]} />
      {/* Clickable hover hitbox */}
      {destroyProgress === 0 && (
        <mesh
          position={[0, 0.5, 0]}
          visible={false}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => { e.stopPropagation(); if (onClick) onClick() }}
        >
          <boxGeometry args={[2.2, 1.5, 1.6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {/* Hover tooltip */}
      {hovered && destroyProgress === 0 && (
        <Html position={[0, 2.0, 0]} center sprite zIndexRange={[0, 0]}>
          <div style={{
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Courier New', monospace",
            fontSize: '12px', fontWeight: 'bold',
            color: color,
            textShadow: `0 0 8px ${color}, 0 0 4px rgba(0,0,0,0.9)`,
            background: 'rgba(5, 10, 5, 0.8)',
            padding: '3px 8px',
            borderRadius: '4px',
            border: `1px solid ${color}40`,
          }}>
            {ownerName}'s Storage ({itemCount} items) — click to inspect
          </div>
        </Html>
      )}
    </group>
  )
}

export default function VillageRenderer({ creaturesRef, onSelectStorage }) {
  const [revision, setRevision] = useState(0)
  const prevKeyRef = useRef('')

  useFrame(() => {
    if (!creaturesRef?.current) return
    let key = ''
    for (let i = 0; i < creaturesRef.current.length; i++) {
      const c = creaturesRef.current[i]
      if (!c.village) continue
      // Include destroying state + timer in key so we re-render each frame during animation
      if (c.village.destroying) {
        key += c.id + ':d' + Math.round(c.village.destroyTimer * 10) + ','
      } else if (c.alive) {
        key += c.id + ':' + c.village.buildings.length + ','
      }
    }
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key
      setRevision(r => r + 1)
    }
  })

  const creatures = creaturesRef?.current?.filter(c =>
    c.village && (c.alive || c.village.destroying)
  ) || []

  return (
    <group>
      {creatures.map(c => {
        const glowColor = SPECIES[c.species]?.glow || '#ffffff'
        const dp = c.village.destroying
          ? Math.min(1, 1 - Math.max(0, c.village.destroyTimer) / 3.0)
          : 0
        return (
          <group key={c.id + '-village-' + revision}>
            {c.village.buildings.length === 0 && (
              <Marker x={c.village.x} z={c.village.z} color={glowColor} destroyProgress={dp} />
            )}
            {c.village.buildings.map((b, bi) => {
              if (b.type === 'shelter') {
                return (
                  <Shelter
                    key={`${c.id}-shelter-${bi}`}
                    x={b.x}
                    z={b.z}
                    color={glowColor}
                    ownerName={c.name}
                    destroyProgress={dp}
                  />
                )
              }
              if (b.type === 'campfire') {
                return (
                  <Campfire
                    key={`${c.id}-campfire-${bi}`}
                    x={b.x}
                    z={b.z}
                    color={glowColor}
                    ownerName={c.name}
                    destroyProgress={dp}
                  />
                )
              }
              if (b.type === 'storage') {
                return (
                  <StorageChest
                    key={`${c.id}-storage-${bi}`}
                    x={b.x}
                    z={b.z}
                    color={glowColor}
                    ownerName={c.name}
                    itemCount={b.items ? b.items.length : 0}
                    destroyProgress={dp}
                    onClick={() => onSelectStorage && onSelectStorage(c.id)}
                  />
                )
              }
              return null
            })}
          </group>
        )
      })}
    </group>
  )
}
