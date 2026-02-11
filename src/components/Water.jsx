import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Pond({ position, radius }) {
  const meshRef = useRef()
  const matRef = useRef()
  const baseY = position[1]

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (meshRef.current) {
      meshRef.current.position.y = baseY + Math.sin(t * 0.5 + position[0]) * 0.05
    }
    if (matRef.current) {
      matRef.current.opacity = 0.55 + Math.sin(t * 0.8 + position[2]) * 0.05
    }
  })

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 32]} />
      <meshStandardMaterial
        ref={matRef}
        color="#0a2a2a"
        transparent
        opacity={0.55}
        roughness={0.1}
        metalness={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export default function Water() {
  return (
    <>
      {/* Main pond (center-east) */}
      <Pond position={[15, -2.2, -5]} radius={10} />
      {/* Smaller pond (northwest) */}
      <Pond position={[-30, -1.5, 25]} radius={6} />
    </>
  )
}
