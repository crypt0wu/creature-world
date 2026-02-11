import { useRef, useMemo } from 'react'
import * as THREE from 'three'

// Shared terrain height function — used by Trees.jsx too
export function getTerrainHeight(x, z) {
  let y = 0
  // Large rolling hills
  y += Math.sin(x * 0.05) * Math.cos(z * 0.04) * 4.0
  y += Math.sin(x * 0.03 + 1.0) * Math.cos(z * 0.025 + 0.5) * 3.0
  // Medium undulation
  y += Math.sin(x * 0.1 + z * 0.08) * 1.5
  y += Math.cos(x * 0.02 - z * 0.03) * 2.0
  // Small detail bumps
  y += Math.sin(x * 0.25 + z * 0.3) * 0.5
  y += Math.cos(x * 0.18 - z * 0.22 + 2.0) * 0.4

  // Pond depression (main pond near center-east)
  const pond1Dist = Math.sqrt((x - 15) ** 2 + (z + 5) ** 2)
  if (pond1Dist < 12) {
    y -= (12 - pond1Dist) * 0.35
  }

  // Second smaller pond (northwest)
  const pond2Dist = Math.sqrt((x + 30) ** 2 + (z - 25) ** 2)
  if (pond2Dist < 7) {
    y -= (7 - pond2Dist) * 0.4
  }

  // Clearing — flatten a meadow area (southwest)
  const clearingDist = Math.sqrt((x + 25) ** 2 + (z + 20) ** 2)
  if (clearingDist < 18) {
    const flatten = Math.max(0, 1 - clearingDist / 18)
    y = y * (1 - flatten * 0.6) + flatten * 0.3
  }

  return y
}

// Zone density map — returns 0-1 indicating how "forested" an area is
export function getZoneDensity(x, z) {
  // Dense forest zones
  const forest1 = Math.max(0, 1 - Math.sqrt((x - 40) ** 2 + (z - 10) ** 2) / 25)
  const forest2 = Math.max(0, 1 - Math.sqrt((x + 10) ** 2 + (z + 40) ** 2) / 20)
  const forest3 = Math.max(0, 1 - Math.sqrt((x - 20) ** 2 + (z + 50) ** 2) / 22)
  const forest4 = Math.max(0, 1 - Math.sqrt((x + 50) ** 2 + (z - 5) ** 2) / 18)

  // Clearings — suppress density
  const clearing1 = Math.max(0, 1 - Math.sqrt((x + 25) ** 2 + (z + 20) ** 2) / 18)
  const clearing2 = Math.max(0, 1 - Math.sqrt((x - 5) ** 2 + (z - 35) ** 2) / 15)

  // Ponds — no trees
  const pond1 = Math.max(0, 1 - Math.sqrt((x - 15) ** 2 + (z + 5) ** 2) / 14)
  const pond2 = Math.max(0, 1 - Math.sqrt((x + 30) ** 2 + (z - 25) ** 2) / 9)

  // Base density + forest boost - clearing/pond suppression
  const base = 0.35
  const density = base + (forest1 + forest2 + forest3 + forest4) * 0.6
    - (clearing1 + clearing2) * 0.5
    - (pond1 + pond2) * 1.0

  return Math.max(0, Math.min(1, density))
}

export default function Terrain({ onClick }) {
  const meshRef = useRef()

  const { geometry } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(200, 200, 256, 256)
    geo.rotateX(-Math.PI / 2)

    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = getTerrainHeight(x, z)

      pos.setY(i, y)

      // Color based on height + zone
      const density = getZoneDensity(x, z)
      const baseGreen = 0.12 + Math.random() * 0.04

      if (y < -2.0) {
        // Deep pond bed
        colors[i * 3] = 0.04
        colors[i * 3 + 1] = 0.05
        colors[i * 3 + 2] = 0.04
      } else if (y < -0.5) {
        // Muddy shore
        colors[i * 3] = 0.07
        colors[i * 3 + 1] = 0.07
        colors[i * 3 + 2] = 0.04
      } else if (density < 0.15) {
        // Open plains / clearings — lighter yellow-green
        colors[i * 3] = 0.08 + Math.random() * 0.02
        colors[i * 3 + 1] = baseGreen + 0.06
        colors[i * 3 + 2] = 0.03
      } else if (density > 0.6) {
        // Dense forest floor — very dark green
        colors[i * 3] = 0.03
        colors[i * 3 + 1] = baseGreen * 0.8
        colors[i * 3 + 2] = 0.02
      } else if (y < 1.5) {
        // Mid — lush green
        colors[i * 3] = 0.05 + y * 0.01
        colors[i * 3 + 1] = baseGreen + y * 0.02
        colors[i * 3 + 2] = 0.02
      } else {
        // High ground — lighter with brown hints
        colors[i * 3] = 0.08 + y * 0.01
        colors[i * 3 + 1] = baseGreen + 0.04
        colors[i * 3 + 2] = 0.03
      }
    }

    geo.computeVertexNormals()
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return { geometry: geo }
  }, [])

  return (
    <mesh ref={meshRef} geometry={geometry} receiveShadow onClick={onClick}>
      <meshStandardMaterial
        vertexColors
        roughness={0.95}
        metalness={0.0}
        flatShading
      />
    </mesh>
  )
}
