import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Fireflies({ count = 120 }) {
  const meshRef = useRef()

  const { positions, offsets, speeds, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const off = new Float32Array(count)
    const spd = new Float32Array(count)
    const sz = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160
      pos[i * 3 + 1] = 0.5 + Math.random() * 8
      pos[i * 3 + 2] = (Math.random() - 0.5) * 160
      off[i] = Math.random() * Math.PI * 2
      spd[i] = 0.3 + Math.random() * 0.8
      sz[i] = 0.03 + Math.random() * 0.06
    }
    return { positions: pos, offsets: off, speeds: spd, sizes: sz }
  }, [count])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colorArray = useMemo(() => {
    const c = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Warm yellows and soft greens
      const variant = Math.random()
      if (variant < 0.6) {
        // Warm firefly yellow
        c[i * 3] = 0.9 + Math.random() * 0.1
        c[i * 3 + 1] = 0.7 + Math.random() * 0.2
        c[i * 3 + 2] = 0.1 + Math.random() * 0.15
      } else if (variant < 0.85) {
        // Soft green
        c[i * 3] = 0.3 + Math.random() * 0.2
        c[i * 3 + 1] = 0.8 + Math.random() * 0.2
        c[i * 3 + 2] = 0.2 + Math.random() * 0.1
      } else {
        // Faint blueish (pollen)
        c[i * 3] = 0.5 + Math.random() * 0.2
        c[i * 3 + 1] = 0.6 + Math.random() * 0.2
        c[i * 3 + 2] = 0.8 + Math.random() * 0.2
      }
    }
    return c
  }, [count])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime

    for (let i = 0; i < count; i++) {
      const ox = positions[i * 3]
      const oy = positions[i * 3 + 1]
      const oz = positions[i * 3 + 2]
      const phase = offsets[i]
      const speed = speeds[i]

      dummy.position.set(
        ox + Math.sin(t * speed + phase) * 1.5,
        oy + Math.sin(t * speed * 0.7 + phase * 2) * 0.8,
        oz + Math.cos(t * speed * 0.5 + phase) * 1.5
      )

      // Pulsing scale
      const pulse = 0.5 + Math.sin(t * 2 + phase * 3) * 0.5
      const s = sizes[i] * (0.5 + pulse * 0.5)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color="#ffcc44"
        transparent
        opacity={0.8}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
