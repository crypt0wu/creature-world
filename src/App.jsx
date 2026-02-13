import { Canvas } from '@react-three/fiber'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useCallback, useState, useEffect } from 'react'
import * as THREE from 'three'
import Terrain from './components/Terrain'
import Water from './components/Water'
import Trees from './components/Trees'
import Fireflies from './components/Fireflies'
import DayNightCycle from './components/DayNightCycle'
import Starfield from './components/Starfield'
import Wildlife from './components/Wildlife'
import CreatureManager from './creatures/CreatureManager'
import CreatureUI from './components/CreatureUI'
import DebugPanel from './components/DebugPanel'
import { clearAll } from './creatures/creatureStore'
import { regenerateWorld } from './worldData'
import { hoverState, clearHover } from './hoverStore'
import './index.css'

const CAM_BOUNDS = 95

function clampTarget(target) {
  target.x = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, target.x))
  target.z = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, target.z))
}

function Scene({ selectedId, followingId, onSelect, onSelectStorage, onSync, resetKey, resourceStatesRef, speedRef, debugRef, debugOpen, showAllThinking }) {
  const controlsRef = useRef()
  const idleTimer = useRef(null)
  const { camera } = useThree()

  // ── WASD keyboard movement ──
  const keys = useRef({ w: false, a: false, s: false, d: false, shift: false })
  const velocity = useRef(new THREE.Vector3())
  const _forward = useRef(new THREE.Vector3())
  const _right = useRef(new THREE.Vector3())

  useEffect(() => {
    const onDown = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'w') keys.current.w = true
      else if (k === 'a') keys.current.a = true
      else if (k === 's') keys.current.s = true
      else if (k === 'd') keys.current.d = true
      if (e.shiftKey) keys.current.shift = true
    }
    const onUp = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'w') keys.current.w = false
      else if (k === 'a') keys.current.a = false
      else if (k === 's') keys.current.s = false
      else if (k === 'd') keys.current.d = false
      if (k === 'shift' || !e.shiftKey) keys.current.shift = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [])

  // Animation state for click-to-navigate
  const animating = useRef(false)
  const startTarget = useRef(new THREE.Vector3())
  const endTarget = useRef(new THREE.Vector3())
  const startCamPos = useRef(new THREE.Vector3())
  const endCamPos = useRef(new THREE.Vector3())
  const progress = useRef(0)

  const resumeAutoRotateLater = useCallback(() => {
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (controlsRef.current && !followingId) controlsRef.current.autoRotate = true
    }, 5000)
  }, [followingId])

  const pauseAutoRotate = useCallback(() => {
    if (!controlsRef.current) return
    controlsRef.current.autoRotate = false
    resumeAutoRotateLater()
  }, [resumeAutoRotateLater])

  // Animate camera glide + WASD movement each frame
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)

    // Disable auto-rotate when following a creature
    if (followingId && controlsRef.current) {
      controlsRef.current.autoRotate = false
    }

    // ── WASD movement ──
    const k = keys.current
    const hasInput = k.w || k.a || k.s || k.d
    const maxSpeed = k.shift ? 500 : 150
    const accel = k.shift ? 700 : 200
    const friction = 6.0

    if (hasInput && controlsRef.current) {
      // Cancel click-to-navigate animation
      animating.current = false
      controlsRef.current.autoRotate = false

      // Forward = camera-to-target direction, flattened to XZ
      _forward.current.subVectors(controlsRef.current.target, camera.position)
      _forward.current.y = 0
      _forward.current.normalize()

      // Right = perpendicular
      _right.current.crossVectors(_forward.current, camera.up).normalize()

      // Build desired direction
      const dir = new THREE.Vector3()
      if (k.w) dir.add(_forward.current)
      if (k.s) dir.sub(_forward.current)
      if (k.d) dir.add(_right.current)
      if (k.a) dir.sub(_right.current)
      dir.normalize()

      // Accelerate
      velocity.current.x += dir.x * accel * dt
      velocity.current.z += dir.z * accel * dt

      // Clamp to max speed
      const speed = velocity.current.length()
      if (speed > maxSpeed) {
        velocity.current.multiplyScalar(maxSpeed / speed)
      }
    }

    // Apply friction (always — gives smooth deceleration)
    const speed = velocity.current.length()
    if (speed > 0.01) {
      const decay = Math.exp(-friction * dt)
      velocity.current.multiplyScalar(decay)

      // Move camera + target together
      const move = velocity.current.clone().multiplyScalar(dt)
      camera.position.add(move)
      if (controlsRef.current) {
        controlsRef.current.target.add(move)

        // Clamp target to map bounds, push camera back by the same amount
        const t = controlsRef.current.target
        const dx = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, t.x)) - t.x
        const dz = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, t.z)) - t.z
        if (dx !== 0 || dz !== 0) {
          t.x += dx; t.z += dz
          camera.position.x += dx; camera.position.z += dz
          velocity.current.set(0, 0, 0)
        }
      }
    } else {
      velocity.current.set(0, 0, 0)
    }

    // ── Clamp OrbitControls target (handles panning + orbit drift) ──
    if (controlsRef.current) {
      const t = controlsRef.current.target
      const dx = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, t.x)) - t.x
      const dz = Math.max(-CAM_BOUNDS, Math.min(CAM_BOUNDS, t.z)) - t.z
      if (dx !== 0 || dz !== 0) {
        t.x += dx; t.z += dz
        camera.position.x += dx; camera.position.z += dz
      }
    }

    // ── Click-to-navigate animation ──
    if (!animating.current || !controlsRef.current) return

    progress.current += delta / 1.5
    const t = Math.min(progress.current, 1)
    const ease = t * t * (3 - 2 * t)

    controlsRef.current.target.lerpVectors(startTarget.current, endTarget.current, ease)
    camera.position.lerpVectors(startCamPos.current, endCamPos.current, ease)

    if (t >= 1) {
      animating.current = false
    }
  })

  const handleTerrainClick = useCallback((e) => {
    // Ignore drags — only respond to clean clicks
    if (e.delta > 4) return
    if (!controlsRef.current) return

    const point = e.point
    const controls = controlsRef.current

    // Preserve current camera offset from target
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target)

    startTarget.current.copy(controls.target)
    endTarget.current.copy(point)
    clampTarget(endTarget.current)
    startCamPos.current.copy(camera.position)
    endCamPos.current.copy(endTarget.current).add(offset)
    progress.current = 0
    animating.current = true

    controls.autoRotate = false
    resumeAutoRotateLater()
  }, [camera, resumeAutoRotateLater])

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        minDistance={10}
        maxDistance={250}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.45}
        autoRotate
        autoRotateSpeed={0.3}
        enableDamping
        dampingFactor={0.08}
        enablePan
        panSpeed={0.8}
        onStart={pauseAutoRotate}
      />
      <Starfield />
      <Fog />
      <DayNightCycle speed={0.015} />
      <Terrain onClick={handleTerrainClick} />
      <Water />
      <Trees key={`trees-${resetKey}`} resourceStatesRef={resourceStatesRef} />
      <Fireflies count={300} />
      <Wildlife key={`wildlife-${resetKey}`} />
      <CreatureManager
        key={resetKey}
        controlsRef={controlsRef}
        selectedId={selectedId}
        followingId={followingId}
        onSelect={onSelect}
        onSelectStorage={onSelectStorage}
        onSync={onSync}
        resourceStatesRef={resourceStatesRef}
        speedRef={speedRef}
        debugRef={debugRef}
        debugOpen={debugOpen}
        showAllThinking={showAllThinking}
      />
    </>
  )
}

function Fog() {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.015
    const cycle = Math.sin(t)
    const dayAmount = Math.max(0, cycle)
    state.scene.fog.density = 0.002 + (1 - dayAmount) * 0.001
    state.scene.fog.color.setRGB(
      0.04 + dayAmount * 0.06,
      0.05 + dayAmount * 0.08,
      0.04 + dayAmount * 0.05
    )
  })
  return null
}

function HoverTooltip() {
  const ref = useRef(null)
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let id
    const tick = () => {
      if (hoverState.active) {
        el.style.display = 'block'
        el.style.left = `${mouse.current.x + 14}px`
        el.style.top = `${mouse.current.y - 10}px`
        el.textContent = hoverState.label
      } else {
        el.style.display = 'none'
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div ref={ref} style={{
      position: 'fixed', display: 'none', pointerEvents: 'none', zIndex: 100,
      background: 'rgba(5, 10, 5, 0.9)',
      border: '1px solid rgba(80, 200, 120, 0.3)',
      borderRadius: '3px',
      padding: '6px 12px',
      fontFamily: "'Courier New', monospace",
      fontSize: '14px',
      color: '#88cc88',
      whiteSpace: 'nowrap',
      backdropFilter: 'blur(4px)',
    }} />
  )
}

export default function App() {
  const [displayData, setDisplayData] = useState({ creatures: [], worldClock: 0, log: [] })
  const [selectedId, setSelectedId] = useState(null)
  const [followingId, setFollowingId] = useState(null)
  const [selectedStorageId, setSelectedStorageId] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [debugOpen, setDebugOpen] = useState(false)
  const [showAllThinking, setShowAllThinking] = useState(false)
  const resourceStatesRef = useRef([])
  const speedRef = useRef(1)
  const debugRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === '`') setDebugOpen(d => !d) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSync = useCallback((creatures, worldClock, log) => {
    setDisplayData({ creatures, worldClock, log })
  }, [])

  const handleReset = useCallback(() => {
    clearAll()
    regenerateWorld()
    setSelectedId(null)
    setFollowingId(null)
    setSelectedStorageId(null)
    setDisplayData({ creatures: [], worldClock: 0, log: [] })
    setResetKey(k => k + 1)
  }, [])

  const handleSelect = useCallback((id) => {
    setSelectedId(prev => prev === id ? null : id)
    setSelectedStorageId(null) // close storage when selecting creature
  }, [])

  const handleSelectStorage = useCallback((creatureId) => {
    setSelectedStorageId(prev => prev === creatureId ? null : creatureId)
    setSelectedId(null) // close creature panel when selecting storage
    setFollowingId(null)
  }, [])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#050508' }}
      onMouseLeave={clearHover}
    >
      <Canvas
        shadows
        camera={{ position: [60, 35, 60], fov: 45, near: 0.1, far: 800 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.6 }}
        onCreated={({ scene }) => {
          scene.fog = new THREE.FogExp2('#0b140b', 0.002)
          scene.background = new THREE.Color('#050508')
        }}
        onPointerMissed={() => { setSelectedId(null); setFollowingId(null); setSelectedStorageId(null); clearHover() }}
      >
        <Scene
          selectedId={selectedId}
          followingId={followingId}
          onSelect={handleSelect}
          onSelectStorage={handleSelectStorage}
          onSync={handleSync}
          resetKey={resetKey}
          resourceStatesRef={resourceStatesRef}
          speedRef={speedRef}
          debugRef={debugRef}
          debugOpen={debugOpen}
          showAllThinking={showAllThinking}
        />
      </Canvas>

      <HoverTooltip />

      <CreatureUI
        creatures={displayData.creatures}
        selectedId={selectedId}
        followingId={followingId}
        selectedStorageId={selectedStorageId}
        onSelect={handleSelect}
        onSelectStorage={handleSelectStorage}
        onFollow={setFollowingId}
        activityLog={displayData.log}
        worldClock={displayData.worldClock}
        onReset={handleReset}
      />

      {debugOpen && (
        <DebugPanel
          debugRef={debugRef}
          speedRef={speedRef}
          creatures={displayData.creatures}
          selectedId={selectedId}
          onSelect={handleSelect}
          showAllThinking={showAllThinking}
          onToggleThinking={setShowAllThinking}
        />
      )}

      <div style={{
        position: 'fixed',
        bottom: 24,
        left: 0,
        right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        <div style={{
          fontFamily: "'Courier New', monospace",
          fontSize: 14,
          letterSpacing: 6,
          color: 'rgba(120, 160, 100, 0.4)',
          textTransform: 'uppercase',
        }}>
          Creature World
        </div>
      </div>
    </div>
  )
}
