import { WORLD_ITEMS } from '../worldData'
import { setHover, clearHover } from '../hoverStore'

function Tree({ position, scale = 1, variant = 0 }) {
  const trunkHeight = (1.8 + variant * 0.6) * scale
  const crownRadius = (1.2 + variant * 0.4) * scale
  const trunkColor = variant > 0.5 ? '#2a1a0a' : '#1f150a'
  const crownColor = variant > 0.5 ? '#0a2a0a' : '#0d1f0a'

  return (
    <group position={position}
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
    </group>
  )
}

function Rock({ position, scale = 1 }) {
  return (
    <group position={position}
      onPointerOver={(e) => { e.stopPropagation(); setHover('Rock') }}
      onPointerOut={clearHover}
    >
      <mesh castShadow rotation={[0, scale * 5, 0]}>
        <dodecahedronGeometry args={[0.3 * scale, 0]} />
        <meshStandardMaterial color="#1a1a18" roughness={0.95} flatShading />
      </mesh>
    </group>
  )
}

function Bush({ position, scale = 1 }) {
  return (
    <group position={position}
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
    </group>
  )
}

export default function Trees() {
  return (
    <group>
      {WORLD_ITEMS.map((item) => {
        if (item.type === 'tree') return <Tree key={item.key} position={item.pos} scale={item.scale} variant={item.variant} />
        if (item.type === 'rock') return <Rock key={item.key} position={item.pos} scale={item.scale} />
        return <Bush key={item.key} position={item.pos} scale={item.scale} />
      })}
    </group>
  )
}
