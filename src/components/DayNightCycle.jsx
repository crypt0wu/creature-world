import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function DayNightCycle({ speed = 0.015 }) {
  const dirLightRef = useRef()
  const ambientRef = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime * speed
    const cycle = Math.sin(t)

    // Sun position orbits
    if (dirLightRef.current) {
      dirLightRef.current.position.set(
        Math.cos(t) * 60,
        Math.max(5, cycle * 40 + 25),
        Math.sin(t) * 60
      )

      // Intensity — moonlit floor at night, bright during day
      const dayAmount = Math.max(0, cycle)
      dirLightRef.current.intensity = 1.2 + dayAmount * 1.0

      // Color: cool blue-white moonlight at night, warm white during day
      const nightAmount = 1 - dayAmount
      dirLightRef.current.color.setRGB(
        0.7 + dayAmount * 0.3 - nightAmount * 0.1,
        0.7 + dayAmount * 0.2,
        0.75 + dayAmount * 0.15 + nightAmount * 0.1
      )
    }

    if (ambientRef.current) {
      const dayAmount = Math.max(0, cycle)
      const nightAmount = 1 - dayAmount
      // Bright moonlit meadow floor
      ambientRef.current.intensity = 1.2 + dayAmount * 0.5
      // Cool blueish tint at night for moonlit feel
      ambientRef.current.color.setRGB(
        0.45 + dayAmount * 0.15 - nightAmount * 0.05,
        0.45 + dayAmount * 0.15,
        0.5 + dayAmount * 0.05 + nightAmount * 0.1
      )
    }
  })

  return (
    <>
      <directionalLight
        ref={dirLightRef}
        position={[10, 12, 8]}
        intensity={0.4}
        color="#e8c090"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <ambientLight ref={ambientRef} intensity={0.12} color="#1a1825" />
      {/* Subtle fill from below — ground bounce */}
      <hemisphereLight
        args={['#5a6a5a', '#2a2a20', 0.8]}
      />
    </>
  )
}
