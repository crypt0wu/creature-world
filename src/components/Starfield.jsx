import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 3000
const NEBULA_COUNT = 200
const SKY_RADIUS = 300

// ── Gas giant banding shader ──
const gasGiantMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      // Multiple horizontal bands at different frequencies
      float band1 = sin(vUv.y * 28.0 + uTime * 0.08) * 0.5 + 0.5;
      float band2 = sin(vUv.y * 14.0 - uTime * 0.05 + 1.5) * 0.5 + 0.5;
      float band3 = sin(vUv.y * 42.0 + uTime * 0.03 + 3.0) * 0.3;
      float band4 = sin(vUv.y * 7.0 + uTime * 0.02) * 0.15;

      // Base colors — warm reds and oranges
      vec3 col1 = vec3(0.8, 0.27, 0.13);
      vec3 col2 = vec3(1.0, 0.53, 0.27);
      vec3 col3 = vec3(0.67, 0.2, 0.1);
      vec3 col4 = vec3(0.9, 0.4, 0.15);

      vec3 col = mix(col1, col2, band1 * 0.7 + band3);
      col = mix(col, col3, band2 * 0.3);
      col = mix(col, col4, band4 + 0.5);

      // Limb darkening
      float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
      rim = max(0.0, rim);
      col *= 0.4 + 0.6 * rim;

      gl_FragColor = vec4(col * 1.2, 1.0);
    }
  `,
  toneMapped: false,
  fog: false,
})

// ── Teal planet surface shader ──
const tealPlanetMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;

    // Simple hash noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // Surface variation via noise
      float n = noise(vUv * 12.0 + uTime * 0.01);
      float n2 = noise(vUv * 24.0 - uTime * 0.015);

      // Base teal with variation
      vec3 col1 = vec3(0.13, 0.53, 0.53);
      vec3 col2 = vec3(0.1, 0.4, 0.45);
      vec3 col3 = vec3(0.2, 0.6, 0.55);

      vec3 col = mix(col1, col2, n * 0.6);
      col = mix(col, col3, n2 * 0.3);

      // Subtle horizontal bands
      float band = sin(vUv.y * 18.0 + uTime * 0.04) * 0.08;
      col += band;

      // Limb darkening
      float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
      rim = max(0.0, rim);
      col *= 0.4 + 0.6 * rim;

      gl_FragColor = vec4(col * 1.1, 1.0);
    }
  `,
  toneMapped: false,
  fog: false,
})

// ── Moon surface shader with craters ──
const moonMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vPosition;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // Multi-scale noise for surface roughness
      float n1 = noise(vUv * 8.0);
      float n2 = noise(vUv * 20.0);
      float n3 = noise(vUv * 40.0);

      // Crater-like features — dark circular depressions
      float craters = 0.0;
      for (int i = 0; i < 6; i++) {
        vec2 center = vec2(
          hash(vec2(float(i) * 1.7, 0.3)),
          hash(vec2(0.5, float(i) * 2.1))
        );
        float r = 0.04 + hash(vec2(float(i), float(i))) * 0.06;
        float d = length(vUv - center);
        // Dark inside, slightly bright rim
        craters += smoothstep(r, r * 0.6, d) * 0.2;
        craters -= smoothstep(r * 1.3, r, d) * 0.08;
      }

      // Base gray with variation
      vec3 col = vec3(0.55, 0.56, 0.58);
      col += (n1 - 0.5) * 0.12;
      col += (n2 - 0.5) * 0.06;
      col += (n3 - 0.5) * 0.03;
      col -= craters;

      // Slight color tint variation
      col.r += n1 * 0.03;
      col.b += n2 * 0.02;

      // Limb darkening
      float rim = dot(vNormal, vec3(0.0, 0.0, 1.0));
      rim = max(0.0, rim);
      col *= 0.35 + 0.65 * rim;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  toneMapped: false,
  fog: false,
})

export default function Starfield() {
  const starsRef = useRef()
  const groupRef = useRef()
  const gasGiantRef = useRef()
  const tealPlanetRef = useRef()
  const moonRef = useRef()

  // ── Star data ──
  const starData = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3)
    const colors = new Float32Array(STAR_COUNT * 3)
    const sizes = new Float32Array(STAR_COUNT)
    const phases = new Float32Array(STAR_COUNT)
    const speeds = new Float32Array(STAR_COUNT)

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      positions[i * 3] = SKY_RADIUS * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = SKY_RADIUS * Math.cos(phi)
      positions[i * 3 + 2] = SKY_RADIUS * Math.sin(phi) * Math.sin(theta)

      const roll = Math.random()
      if (roll < 0.7) sizes[i] = 1.0 + Math.random() * 1.5
      else if (roll < 0.95) sizes[i] = 2.5 + Math.random() * 1.5
      else sizes[i] = 4.0 + Math.random() * 2.5

      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.5 + Math.random() * 2.5

      const c = Math.random()
      if (c < 0.55) {
        colors[i * 3] = 0.9 + Math.random() * 0.1
        colors[i * 3 + 1] = 0.92 + Math.random() * 0.08
        colors[i * 3 + 2] = 1.0
      } else if (c < 0.75) {
        colors[i * 3] = 0.7 + Math.random() * 0.1
        colors[i * 3 + 1] = 0.8 + Math.random() * 0.1
        colors[i * 3 + 2] = 1.0
      } else if (c < 0.9) {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.9 + Math.random() * 0.1
        colors[i * 3 + 2] = 0.7 + Math.random() * 0.15
      } else {
        colors[i * 3] = 1.0
        colors[i * 3 + 1] = 0.7 + Math.random() * 0.15
        colors[i * 3 + 2] = 0.5 + Math.random() * 0.2
      }
    }

    return { positions, colors, sizes, phases, speeds }
  }, [])

  // ── Star shader with per-vertex twinkle ──
  const starMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aSpeed;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vBrightness;
      uniform float uTime;

      void main() {
        vColor = aColor;
        float twinkle = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
        vBrightness = 0.3 + 0.7 * twinkle;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (0.5 + 0.5 * twinkle);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vBrightness;

      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        gl_FragColor = vec4(vColor * vBrightness, glow * vBrightness);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  }), [])

  // ── Nebula cluster data ──
  const nebulaData = useMemo(() => {
    const positions = new Float32Array(NEBULA_COUNT * 3)
    const colors = new Float32Array(NEBULA_COUNT * 3)

    const clusters = [
      { theta: 0.8, phi: 1.0, r: 0.4, g: 0.15, b: 0.6 },
      { theta: 2.5, phi: 0.7, r: 0.15, g: 0.3, b: 0.7 },
      { theta: 4.0, phi: 1.3, r: 0.2, g: 0.5, b: 0.55 },
      { theta: 5.5, phi: 0.5, r: 0.5, g: 0.15, b: 0.4 },
    ]

    for (let i = 0; i < NEBULA_COUNT; i++) {
      const cl = clusters[i % clusters.length]
      const t = cl.theta + (Math.random() - 0.5) * 0.8
      const p = cl.phi + (Math.random() - 0.5) * 0.6

      positions[i * 3] = SKY_RADIUS * Math.sin(p) * Math.cos(t)
      positions[i * 3 + 1] = SKY_RADIUS * Math.cos(p)
      positions[i * 3 + 2] = SKY_RADIUS * Math.sin(p) * Math.sin(t)

      colors[i * 3] = cl.r + (Math.random() - 0.5) * 0.1
      colors[i * 3 + 1] = cl.g + (Math.random() - 0.5) * 0.1
      colors[i * 3 + 2] = cl.b + (Math.random() - 0.5) * 0.1
    }

    return { positions, colors }
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // Update twinkle time
    starMaterial.uniforms.uTime.value = t

    // Update planet shader times
    gasGiantMaterial.uniforms.uTime.value = t
    tealPlanetMaterial.uniforms.uTime.value = t
    moonMaterial.uniforms.uTime.value = t

    // Slow planet rotations
    if (gasGiantRef.current) gasGiantRef.current.rotation.y = t * 0.012
    if (tealPlanetRef.current) tealPlanetRef.current.rotation.y = t * 0.018
    if (moonRef.current) moonRef.current.rotation.y = t * 0.008

    // Track camera so sky is always at fixed distance (skybox behavior)
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position)
      groupRef.current.rotation.y = t * 0.002
    }
  })

  return (
    <>
    <group ref={groupRef}>
      {/* Stars */}
      <points ref={starsRef} material={starMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={STAR_COUNT} array={starData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-aColor" count={STAR_COUNT} array={starData.colors} itemSize={3} />
          <bufferAttribute attach="attributes-aSize" count={STAR_COUNT} array={starData.sizes} itemSize={1} />
          <bufferAttribute attach="attributes-aPhase" count={STAR_COUNT} array={starData.phases} itemSize={1} />
          <bufferAttribute attach="attributes-aSpeed" count={STAR_COUNT} array={starData.speeds} itemSize={1} />
        </bufferGeometry>
      </points>

      {/* Nebula clouds */}
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={NEBULA_COUNT} array={nebulaData.positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={NEBULA_COUNT} array={nebulaData.colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={50}
          sizeAttenuation
          transparent
          opacity={0.045}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          fog={false}
          toneMapped={false}
        />
      </points>
    </group>

    {/* ═══════════════ Gas Giant ═══════════════ */}
    <group position={[200, 150, -300]}>
      {/* Atmosphere glow */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[19, 32, 32]} />
        <meshBasicMaterial
          color="#ff6633"
          transparent
          opacity={0.07}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Planet body with banding shader */}
      <mesh ref={gasGiantRef} material={gasGiantMaterial} frustumCulled={false}>
        <sphereGeometry args={[15, 48, 48]} />
      </mesh>
    </group>

    {/* ═══════════════ Ringed Planet ═══════════════ */}
    <group position={[-250, 100, -200]}>
      {/* Atmosphere glow */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[11, 32, 32]} />
        <meshBasicMaterial
          color="#44ddcc"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Planet body with surface variation */}
      <mesh ref={tealPlanetRef} material={tealPlanetMaterial} frustumCulled={false}>
        <sphereGeometry args={[8, 48, 48]} />
      </mesh>
      {/* Outer ring */}
      <mesh rotation={[Math.PI * 0.4, 0.2, 0.15]} frustumCulled={false}>
        <ringGeometry args={[11, 17, 64]} />
        <meshBasicMaterial
          color="#5599aa"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Inner bright ring band */}
      <mesh rotation={[Math.PI * 0.4, 0.2, 0.15]} frustumCulled={false}>
        <ringGeometry args={[10, 12, 64]} />
        <meshBasicMaterial
          color="#88dddd"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Faint outer dust ring */}
      <mesh rotation={[Math.PI * 0.4, 0.2, 0.15]} frustumCulled={false}>
        <ringGeometry args={[17, 20, 64]} />
        <meshBasicMaterial
          color="#446666"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </mesh>
    </group>

    {/* ═══════════════ Moon ═══════════════ */}
    <group position={[100, 80, -400]}>
      {/* Atmosphere glow */}
      <mesh frustumCulled={false}>
        <sphereGeometry args={[5.5, 24, 24]} />
        <meshBasicMaterial
          color="#aabbcc"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </mesh>
      {/* Moon body with crater shader */}
      <mesh ref={moonRef} material={moonMaterial} frustumCulled={false}>
        <sphereGeometry args={[4, 32, 32]} />
      </mesh>
    </group>
    </>
  )
}
