// AnimatedSpeciesModel — GLB model with per-state animation crossfading
// Currently unused. To re-enable, import and render conditionally in Creature.jsx.
//
// Usage in Creature.jsx:
//   import { AnimatedSpeciesModel, SPECIES_ANIM_CONFIG } from './AnimatedSpeciesModel'
//
//   // In component body:
//   const hasAnimModel = !!SPECIES_ANIM_CONFIG[c.species]
//   const modelMeshesRef = useRef([])
//
//   // In JSX (instead of the orb mesh):
//   {hasAnimModel ? (
//     <group ref={coreRef}>
//       <AnimatedSpeciesModel
//         species={c.species}
//         creaturesRef={creaturesRef}
//         index={index}
//         meshesRef={modelMeshesRef}
//       />
//     </group>
//   ) : ( /* orb mesh */ )}
//
//   // Death animation needs modelMeshesRef fallback for opacity:
//   if (coreRef.current.material) {
//     coreRef.current.material.opacity = s
//   } else if (modelMeshesRef.current?.length) {
//     for (const m of modelMeshesRef.current) {
//       if (m.material) { m.material.transparent = true; m.material.opacity = s }
//     }
//   }
//
//   // Emissive section needs modelMeshesRef fallback too (same pattern).

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Animation config per species — add new species here
export const SPECIES_ANIM_CONFIG = {
  Embrix: {
    basePath: '/models/species/embrix/',
    animations: ['arise', 'catching_breath', 'dead', 'punch', 'running', 'sleep', 'walking'],
    baseMesh: 'walking',
    scale: 1.5,
  },
}

export function AnimatedSpeciesModel({ species, creaturesRef, index, meshesRef }) {
  const config = SPECIES_ANIM_CONFIG[species]
  const groupRef = useRef()
  const prevAnimRef = useRef(null)
  const wakingUpRef = useRef(false)
  const wasSleepingLocal = useRef(creaturesRef.current[index]?.sleeping || false)

  // Load all animation GLBs for this species
  const paths = useMemo(
    () => config.animations.map(name => `${config.basePath}${name}.glb`),
    [config]
  )
  const gltfs = useLoader(GLTFLoader, paths)

  // Clone base mesh and extract animation clips from all GLBs
  const { clone, clips } = useMemo(() => {
    const baseIdx = config.animations.indexOf(config.baseMesh)
    const cloned = cloneSkeleton(gltfs[baseIdx].scene)
    const meshes = []
    cloned.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.material = child.material.clone()
        meshes.push(child)
      }
    })
    if (meshesRef) meshesRef.current = meshes

    const allClips = []
    config.animations.forEach((name, i) => {
      gltfs[i].animations.forEach(clip => {
        const c = clip.clone()
        c.name = name
        allClips.push(c)
      })
    })
    return { clone: cloned, clips: allClips }
  }, [gltfs, config])

  const { actions, mixer } = useAnimations(clips, groupRef)

  // Handle arise animation completion
  useEffect(() => {
    const onFinished = (e) => {
      if (e.action === actions?.arise) {
        wakingUpRef.current = false
      }
    }
    if (mixer) mixer.addEventListener('finished', onFinished)
    return () => { if (mixer) mixer.removeEventListener('finished', onFinished) }
  }, [mixer, actions])

  // Animation state machine — map creature state to animation clip
  useFrame(() => {
    const creature = creaturesRef.current[index]
    if (!creature || !actions) return

    // Detect wake-up transition
    if (wasSleepingLocal.current && !creature.sleeping && creature.alive) {
      wakingUpRef.current = true
    }
    wasSleepingLocal.current = creature.sleeping

    // Determine desired animation from creature state
    let desired = null
    if (!creature.alive) {
      desired = 'dead'
    } else if (wakingUpRef.current) {
      desired = 'arise'
    } else if (creature.sleeping) {
      desired = 'sleep'
    } else if (creature.inCombat) {
      desired = 'punch'
    } else if (creature._fleeSprint > 0 || creature._chasing) {
      desired = 'running'
    } else if (creature._scaredTimer > 0) {
      desired = creature.moving ? 'walking' : 'catching_breath'
    } else if (creature.moving) {
      desired = 'walking'
    }

    // Crossfade to new animation
    if (desired !== prevAnimRef.current) {
      // Fade out previous
      if (prevAnimRef.current && actions[prevAnimRef.current]) {
        actions[prevAnimRef.current].fadeOut(0.3)
      }
      // Fade in new
      if (desired && actions[desired]) {
        const action = actions[desired]
        action.reset()
        if (desired === 'dead' || desired === 'arise') {
          action.setLoop(THREE.LoopOnce)
          action.clampWhenFinished = true
        } else {
          action.setLoop(THREE.LoopRepeat)
        }
        action.fadeIn(0.3).play()
      }
      prevAnimRef.current = desired
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={clone} scale={config.scale} />
    </group>
  )
}

// Preload all species animation models
export function preloadSpeciesModels() {
  Object.values(SPECIES_ANIM_CONFIG).forEach(config => {
    config.animations.forEach(name => {
      useLoader.preload(GLTFLoader, `${config.basePath}${name}.glb`)
    })
  })
}
