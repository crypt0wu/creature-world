import { useRef, useState, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getTerrainHeight } from '../components/Terrain'
import SPECIES from './species'
import { setHover, clearHover } from '../hoverStore'

const BITE_COUNT = 15
const DAMAGE_PARTICLE_COUNT = 10
const DEATH_PARTICLE_COUNT = 20
const GATHER_COLORS = { wood: '#aa7744', stone: '#99aaaa', herb: '#66cc66', crystal: '#aa66ff' }

export default function Creature({ creaturesRef, index, isSelected, onSelect, showAllThinking }) {
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
  const progressRef = useRef()
  const progressBarRef = useRef()
  const dmgParticleRef = useRef()
  const deathGroupRef = useRef()
  const deathParticleRef = useRef()
  const dmgTextRef = useRef()

  const c = creaturesRef.current[index]
  const spec = SPECIES[c.species]
  const timer = useRef(0)
  const wasEating = useRef(false)
  const wasSleeping = useRef(false)
  const wasGathering = useRef(false)
  const wasDrinkingPotion = useRef(false)
  const wasAlive = useRef(c.alive)
  const zzzRef = useRef()
  const zzzTimer = useRef(0)
  const biteVelocities = useRef([])
  const biteLife = useRef(0)
  const floatTimer = useRef(0)
  const floatValue = useRef(0)
  const floatColor = useRef('#44ff88')
  const floatLabel = useRef('')
  const prevInventoryLen = useRef(c.inventory?.length || 0)
  const crystalFlash = useRef(0)

  // Combat visuals
  const combatFlash = useRef(0)
  const dmgParticleVels = useRef([])
  const dmgParticleLife = useRef(0)
  const dmgTextTimer = useRef(0)
  const dmgTextValue = useRef('')
  const dmgTextColor = useRef('#ff4444')

  // Death animation
  const deathTimer = useRef(0)
  const deathVelocities = useRef([])
  const deathActive = useRef(false)

  // Level-up glow
  const levelUpGlow = useRef(0)

  // When true, component returns null — fully removed from scene
  const [removed, setRemoved] = useState(!c.alive)

  const { camera } = useThree()
  const [display, setDisplay] = useState({
    hp: c.hp, maxHp: c.maxHp, state: c.state, alive: c.alive, detailLevel: 2,
  })

  // Disable raycasting on dead creatures to prevent ghost tooltips
  const noRaycast = useMemo(() => () => {}, [])

  const bitePositions = useMemo(() => new Float32Array(BITE_COUNT * 3), [])
  const dmgPositions = useMemo(() => new Float32Array(DAMAGE_PARTICLE_COUNT * 3), [])
  const deathPositions = useMemo(() => new Float32Array(DEATH_PARTICLE_COUNT * 3), [])

  useFrame((_, delta) => {
    const creature = creaturesRef.current[index]
    if (!groupRef.current) return
    const dt = Math.min(delta, 0.05)

    // ── Death animation ──
    if (!creature.alive && wasAlive.current) {
      wasAlive.current = false
      deathActive.current = true
      deathTimer.current = 2.0
      // Immediately sync display so Html labels are removed from DOM
      setDisplay(d => ({ ...d, alive: false, state: 'dead', hp: 0 }))
      deathVelocities.current = []
      for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
        deathPositions[i * 3] = (Math.random() - 0.5) * 0.5
        deathPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.5
        deathPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5
        deathVelocities.current.push({
          x: (Math.random() - 0.5) * 6,
          y: Math.random() * 4 + 2,
          z: (Math.random() - 0.5) * 6,
        })
      }
      if (deathParticleRef.current) {
        deathParticleRef.current.visible = true
        deathParticleRef.current.geometry.attributes.position.needsUpdate = true
      }
    }

    if (deathActive.current) {
      deathTimer.current -= dt
      // Animate death particles
      for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
        const v = deathVelocities.current[i]
        if (!v) continue
        deathPositions[i * 3] += v.x * dt
        deathPositions[i * 3 + 1] += v.y * dt
        deathPositions[i * 3 + 2] += v.z * dt
        v.y -= 3 * dt
      }
      if (deathParticleRef.current) {
        deathParticleRef.current.geometry.attributes.position.needsUpdate = true
        deathParticleRef.current.material.opacity = Math.max(0, deathTimer.current / 2.0)
      }
      // Shrink core orb
      if (coreRef.current) {
        const s = Math.max(0, deathTimer.current / 2.0)
        coreRef.current.scale.setScalar(s)
        if (coreRef.current.material) {
          coreRef.current.material.opacity = s
        }
      }
      if (glowRef.current) {
        glowRef.current.scale.setScalar(Math.max(0, deathTimer.current / 2.0))
      }
      if (lightRef.current) {
        lightRef.current.intensity = Math.max(0, (deathTimer.current / 2.0) * 3)
      }

      if (deathTimer.current <= 0) {
        deathActive.current = false
        groupRef.current.visible = false
        if (deathParticleRef.current) deathParticleRef.current.visible = false
        // Fully remove component from scene after animation
        setRemoved(true)
      }
      // Keep deathGroupRef positioned during animation
      if (deathGroupRef.current && groupRef.current) {
        deathGroupRef.current.position.copy(groupRef.current.position)
      }
      return
    }

    if (!creature.alive) {
      groupRef.current.visible = false
      if (!removed) setRemoved(true)
      return
    }

    groupRef.current.visible = true
    const y = getTerrainHeight(creature.x, creature.z)

    // ── Position: walking bob or eating chew-bounce or gathering work-bounce or combat shake ──
    const eatBounce = creature.eating ? Math.abs(Math.sin(creature.phase * 5)) * 0.12 : 0
    const walkBob = creature.moving ? Math.sin(creature.phase * 3) * 0.08 : 0
    const gatherBounce = creature.gathering
      ? Math.abs(Math.sin(creature.phase * 4)) ** 3 * 0.18
      : 0
    // Combat shake — rapid jitter
    const combatShakeX = creature.inCombat ? Math.sin(creature.phase * 25) * 0.08 : 0
    const combatShakeZ = creature.inCombat ? Math.cos(creature.phase * 30) * 0.08 : 0
    groupRef.current.position.set(
      creature.x + combatShakeX,
      y + 1.2 + walkBob + eatBounce - gatherBounce,
      creature.z + combatShakeZ
    )
    groupRef.current.rotation.y = creature.rotY

    // ── Core pulse ──
    if (coreRef.current) {
      if (creature.inCombat) {
        // Rapid combat pulse
        const pulse = 1 + Math.sin(creature.phase * 15) * 0.15
        coreRef.current.scale.setScalar(pulse)
      } else if (creature._chasing) {
        const pulse = 1 + Math.sin(creature.phase * 12) * 0.12
        coreRef.current.scale.setScalar(pulse)
      } else if (levelUpGlow.current > 0) {
        const pulse = 1 + Math.sin(creature.phase * 10) * 0.2
        coreRef.current.scale.setScalar(pulse)
      } else if (creature.sleeping) {
        const pulse = 1 + Math.sin(creature.phase * 1.5) * 0.06
        coreRef.current.scale.setScalar(pulse)
      } else if (creature.drinkingPotion) {
        // Gentle green pulse while drinking
        const pulse = 1 + Math.sin(creature.phase * 4) * 0.12
        coreRef.current.scale.setScalar(pulse)
      } else if (creature.eating) {
        const pulse = 1 + Math.sin(creature.phase * 6) * 0.1
        coreRef.current.scale.setScalar(pulse)
      } else if (creature.gathering) {
        const t = creature.phase * 4
        const impact = Math.abs(Math.sin(t)) ** 3
        const sx = 1 + impact * 0.15
        const sy = 1 - impact * 0.12
        coreRef.current.scale.set(sx, sy, sx)
      } else if (creature.crafting) {
        // Gentle rhythmic pulse while crafting
        const pulse = 1 + Math.sin(creature.phase * 3) * 0.08
        coreRef.current.scale.setScalar(pulse)
      } else {
        const s = coreRef.current.scale.x
        if (Math.abs(s - 1) > 0.01) coreRef.current.scale.setScalar(s + (1 - s) * 5 * dt)
        else coreRef.current.scale.setScalar(1)
      }
    }

    // ── Emissive / light ──
    if (coreRef.current?.material) {
      let target = 0.8
      if (creature.inCombat) target = 1.8 + Math.sin(creature.phase * 12) * 0.5
      else if (creature._chasing) target = 1.6 + Math.sin(creature.phase * 10) * 0.3
      else if (creature._fleeSprint > 0) target = 2.0 + Math.sin(creature.phase * 8) * 0.4
      else if (creature.drinkingPotion) target = 1.6 + Math.sin(creature.phase * 4) * 0.3
      else if (creature.sleeping) target = 0.2 + Math.sin(creature.phase * 1.5) * 0.05
      else if (creature.eating) target = 1.5
      else if (creature.gathering) target = 1.2
      else if (creature.crafting) target = 1.4 + Math.sin(creature.phase * 3) * 0.3

      // Crystal flash override
      if (crystalFlash.current > 0) {
        target = 3.0
        crystalFlash.current -= dt
      }
      // Combat hit flash
      if (combatFlash.current > 0) {
        target = 4.0
        combatFlash.current -= dt
      }
      // Level-up glow
      if (levelUpGlow.current > 0) {
        target = 5.0
        levelUpGlow.current -= dt
      }

      const cur = coreRef.current.material.emissiveIntensity
      coreRef.current.material.emissiveIntensity = cur + (target - cur) * 4 * dt
    }
    if (lightRef.current) {
      let target = creature.sleeping ? 1 : creature.eating ? 6 : creature.gathering ? 5 : creature.crafting ? 5 : 3
      if (creature.inCombat) target = 8
      if (combatFlash.current > 0) target = 12
      if (levelUpGlow.current > 0) target = 15
      lightRef.current.intensity += (target - lightRef.current.intensity) * 4 * dt
    }

    // ── Glow shell breathing ──
    if (glowRef.current) {
      const t = performance.now() * 0.002 + index * 2
      let glowScale = 1 + Math.sin(t) * 0.15
      if (creature.inCombat) glowScale = 1 + Math.sin(t * 5) * 0.25
      else if (creature._fleeSprint > 0) glowScale = 1.3 + Math.sin(t * 6) * 0.2
      if (levelUpGlow.current > 0) glowScale = 1.5 + Math.sin(t * 3) * 0.3
      glowRef.current.scale.setScalar(glowScale)
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
    const justStartedEating = creature.eating && !wasEating.current
    const justFinishedEating = !creature.eating && wasEating.current
    wasEating.current = creature.eating

    // ── Detect gathering transitions ──
    const justStartedGathering = creature.gathering && !wasGathering.current
    const justFinishedGathering = !creature.gathering && wasGathering.current
    wasGathering.current = creature.gathering

    // ── Bite particles on eating start ──
    if (justStartedEating) {
      _spawnBiteParticles('#44ff88')
    }

    // ── Gather particles: burst on start + periodic during gathering ──
    if (justStartedGathering || (creature.gathering && biteLife.current <= 0 && Math.random() < 0.08)) {
      const color = creature.targetResourceType === 'tree' ? '#aa7744'
        : creature.targetResourceType === 'rock' ? '#99aaaa'
        : '#66cc66'
      _spawnBiteParticles(color)
    }

    function _spawnBiteParticles(color) {
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
        biteRef.current.material.color.set(color)
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

    // ── Combat: damage dealt — spawn red particles toward target ──
    if (creature.combatHitDealt) {
      const hit = creature.combatHitDealt
      creature.combatHitDealt = null
      combatFlash.current = 0.15

      // Spawn damage particles flying toward target
      const tdx = hit.targetX - creature.x
      const tdz = hit.targetZ - creature.z
      const tDist = Math.sqrt(tdx * tdx + tdz * tdz) || 1
      const dirX = tdx / tDist
      const dirZ = tdz / tDist

      dmgParticleLife.current = 0.6
      dmgParticleVels.current = []
      for (let i = 0; i < DAMAGE_PARTICLE_COUNT; i++) {
        dmgPositions[i * 3] = (Math.random() - 0.5) * 0.3
        dmgPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.3
        dmgPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.3
        dmgParticleVels.current.push({
          x: dirX * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2,
          y: Math.random() * 2 + 1,
          z: dirZ * (3 + Math.random() * 3) + (Math.random() - 0.5) * 2,
        })
      }
      if (dmgParticleRef.current) {
        dmgParticleRef.current.visible = true
        dmgParticleRef.current.material.color.set(hit.isSuperEffective ? '#ffff44' : '#ff4444')
        dmgParticleRef.current.geometry.attributes.position.needsUpdate = true
      }
    }

    // ── Combat: damage taken — show floating damage number ──
    if (creature.combatHitTaken) {
      const hit = creature.combatHitTaken
      creature.combatHitTaken = null
      combatFlash.current = 0.1

      dmgTextTimer.current = 1.2
      if (hit.isSuperEffective) {
        dmgTextValue.current = `-${hit.damage} SUPER EFFECTIVE!`
        dmgTextColor.current = '#ffff44'
      } else {
        dmgTextValue.current = `-${hit.damage}`
        dmgTextColor.current = '#ff4444'
      }
    }

    // ── Level-up effect ──
    if (creature.justLeveledUp) {
      const lv = creature.justLeveledUp
      creature.justLeveledUp = null
      levelUpGlow.current = 2.0
      floatTimer.current = 2.5
      floatValue.current = 0
      floatColor.current = '#ffff44'
      floatLabel.current = `LEVEL UP! Lv.${lv.newLevel}`
      _spawnBiteParticles('#ffff44')
    }

    // ── Animate damage particles ──
    if (dmgParticleLife.current > 0) {
      dmgParticleLife.current -= dt
      for (let i = 0; i < DAMAGE_PARTICLE_COUNT; i++) {
        const v = dmgParticleVels.current[i]
        if (!v) continue
        dmgPositions[i * 3] += v.x * dt
        dmgPositions[i * 3 + 1] += v.y * dt
        dmgPositions[i * 3 + 2] += v.z * dt
        v.y -= 5 * dt
      }
      if (dmgParticleRef.current) {
        dmgParticleRef.current.geometry.attributes.position.needsUpdate = true
        dmgParticleRef.current.material.opacity = Math.max(0, dmgParticleLife.current / 0.6)
      }
      if (dmgParticleLife.current <= 0 && dmgParticleRef.current) {
        dmgParticleRef.current.visible = false
      }
    }

    // ── Floating damage number ──
    if (dmgTextRef.current) {
      if (dmgTextTimer.current > 0) {
        dmgTextTimer.current -= dt
        const progress = 1 - dmgTextTimer.current / 1.2
        dmgTextRef.current.style.opacity = String(Math.max(0, 1 - progress * 1.5))
        dmgTextRef.current.style.transform = `translateY(${-progress * 40}px) scale(${1 + progress * 0.3})`
        dmgTextRef.current.style.color = dmgTextColor.current
        dmgTextRef.current.style.textShadow = `0 0 12px ${dmgTextColor.current}, 0 0 6px rgba(0,0,0,0.9)`
        dmgTextRef.current.textContent = dmgTextValue.current
        dmgTextRef.current.style.display = 'block'
      } else {
        dmgTextRef.current.style.display = 'none'
      }
    }

    // ── Detect gather completion: show float text ──
    if (creature.gatherDone) {
      creature.gatherDone = false
      const r = creature.gatherResult
      if (r) {
        const typeLabel = r.type.charAt(0).toUpperCase() + r.type.slice(1)
        floatTimer.current = 1.5
        floatValue.current = 0
        floatColor.current = GATHER_COLORS[r.type] || '#88aa88'
        floatLabel.current = `+${r.qty} ${typeLabel}`
        creature.gatherResult = null
      }
    }

    // ── Crystal drop flash ──
    if (creature.foundCrystal) {
      creature.foundCrystal = false
      crystalFlash.current = 0.3
      setTimeout(() => {
        floatTimer.current = 2.0
        floatValue.current = 0
        floatColor.current = '#aa66ff'
        floatLabel.current = '+1 Crystal!'
      }, 200)
    }

    // ── Potion drinking state tracking ──
    const justStartedDrinking = creature.drinkingPotion && !wasDrinkingPotion.current
    const justFinishedDrinking = !creature.drinkingPotion && wasDrinkingPotion.current
    wasDrinkingPotion.current = creature.drinkingPotion

    if (justStartedDrinking) {
      _spawnBiteParticles('#44ff88')
    }

    // ── Potion completion visuals (burst + float text) ──
    if (creature.justUsedPotion) {
      const potion = creature.justUsedPotion
      creature.justUsedPotion = null
      _spawnBiteParticles('#44ff88')
      floatTimer.current = 1.8
      floatValue.current = 0
      floatColor.current = '#44ff88'
      floatLabel.current = `+${potion.healAmount} HP`
      crystalFlash.current = 0.4
    }

    // ── Detect crafting completion: show float text ──
    if (creature.justCrafted) {
      const recipe = creature.justCrafted.recipe
      creature.justCrafted = null
      floatTimer.current = 2.0
      floatValue.current = 0
      floatColor.current = recipe.slot ? '#ffcc44' : '#44ff88'
      floatLabel.current = `Crafted ${recipe.label}!`
      crystalFlash.current = 0.2
    }

    // ── Equipment broke: floating text + shattering particle burst ──
    if (creature.equipmentBroke) {
      const broke = creature.equipmentBroke
      creature.equipmentBroke = null
      floatTimer.current = 2.5
      floatValue.current = 0
      floatColor.current = '#ff4444'
      floatLabel.current = `${broke.itemLabel} broke!`
      _spawnBiteParticles('#ff6622')
      combatFlash.current = 0.3
    }

    // ── Intimidation: creature backed away ──
    if (creature.combatIntimidated) {
      creature.combatIntimidated = null
      floatTimer.current = 1.8
      floatValue.current = 0
      floatColor.current = '#ffaa44'
      floatLabel.current = 'Backed away!'
    }

    // ── Chase events ──
    if (creature.combatChaseStarted) {
      const gfk = creature.combatChaseStarted.goingForKill
      creature.combatChaseStarted = null
      floatTimer.current = 1.5
      floatValue.current = 0
      floatColor.current = gfk ? '#ff2222' : '#ff4444'
      floatLabel.current = gfk ? 'Going for the kill!' : 'Chasing!'
    }
    if (creature.combatChaseCaught) {
      creature.combatChaseCaught = null
      floatTimer.current = 1.8
      floatValue.current = 0
      floatColor.current = '#ff2222'
      floatLabel.current = 'Caught!'
      combatFlash.current = 0.3
    }
    if (creature.combatChaseEscaped) {
      creature.combatChaseEscaped = null
      floatTimer.current = 1.5
      floatValue.current = 0
      floatColor.current = '#44ff88'
      floatLabel.current = 'Escaped!'
    }
    if (creature.combatChaseGaveUp) {
      creature.combatChaseGaveUp = null
      floatTimer.current = 1.5
      floatValue.current = 0
      floatColor.current = '#ffaa44'
      floatLabel.current = 'Gave up chase'
    }

    // ── Detect inventory pickup (berry only — gathering has its own text) ──
    const invLen = creature.inventory?.length || 0
    if (invLen > prevInventoryLen.current && creature.alive && !creature.gatherDone) {
      if (!creature.gathering && floatTimer.current <= 0 && !justFinishedGathering) {
        floatTimer.current = 1.5
        floatValue.current = 0
        floatColor.current = '#ff6699'
        floatLabel.current = '+1 Berry'
      }
    }
    prevInventoryLen.current = invLen

    // ── Floating text (hunger gain or wake or gather) ──
    if (justFinishedEating) {
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

    // ── Gathering / Crafting progress bar ──
    if (progressRef.current) {
      if (creature.gathering && creature.gatherDuration > 0) {
        const pct = Math.min(1, 1 - Math.max(0, creature.gatherTimer) / creature.gatherDuration)
        progressRef.current.style.display = 'block'
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct * 100}%`
          const color = creature.targetResourceType === 'tree' ? '#aa7744'
            : creature.targetResourceType === 'rock' ? '#99aaaa'
            : '#66cc66'
          progressBarRef.current.style.background = color
        }
      } else if (creature.drinkingPotion && creature.potionDuration > 0) {
        const pct = Math.min(1, 1 - Math.max(0, creature.potionTimer) / creature.potionDuration)
        progressRef.current.style.display = 'block'
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct * 100}%`
          progressBarRef.current.style.background = '#44ff88'
        }
      } else if (creature.crafting && creature.craftDuration > 0) {
        const pct = Math.min(1, 1 - Math.max(0, creature.craftTimer) / creature.craftDuration)
        progressRef.current.style.display = 'block'
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct * 100}%`
          progressBarRef.current.style.background = '#ffcc44'
        }
      } else {
        progressRef.current.style.display = 'none'
      }
    }

    // ── Per-frame label scale (clamped) ──
    if (labelRef.current && groupRef.current) {
      const camDist = camera.position.distanceTo(groupRef.current.position)
      const t = Math.max(0, Math.min(1, (camDist - 20) / 130))
      const scale = 1.3 - t * 0.65
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

  // Fully removed from scene after death animation
  if (removed) return null

  const hpPct = display.maxHp > 0 ? (display.hp / display.maxHp) * 100 : 0
  const hpColor = hpPct > 50 ? '#44ff44' : hpPct > 25 ? '#ffaa00' : '#ff4444'

  return (
    <group
      ref={groupRef}
      raycast={display.alive ? undefined : noRaycast}
      onClick={display.alive ? (e) => { e.stopPropagation(); onSelect(c.id) } : undefined}
      onPointerOver={display.alive ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; setHover(`${c.name} (${c.species})`) } : undefined}
      onPointerOut={display.alive ? () => { document.body.style.cursor = 'auto'; clearHover() } : undefined}
    >
      {/* Core sphere */}
      <mesh ref={coreRef} castShadow>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial
          color={spec.color}
          emissive={spec.color}
          emissiveIntensity={0.8}
          roughness={0.3}
          transparent
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

      {/* Bite/gather particles */}
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

      {/* Damage particles (red/yellow) — fly toward target on hit */}
      <points ref={dmgParticleRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={DAMAGE_PARTICLE_COUNT}
            array={dmgPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#ff4444" size={0.2} transparent opacity={0.9} sizeAttenuation />
      </points>

      {/* Death shatter particles */}
      <points ref={deathParticleRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={DEATH_PARTICLE_COUNT}
            array={deathPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color={spec.color} size={0.25} transparent opacity={1.0} sizeAttenuation />
      </points>

      {/* Name / status label — removed from DOM on death */}
      {display.alive && (
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
                  : display.state === 'gathering' ? '#aa7744'
                  : display.state === 'crafting' ? '#ffcc44'
                  : display.state === 'seeking resource' ? '#888866'
                  : display.state === 'fighting' ? '#ff4444'
                  : display.state === 'chasing' ? '#ff6644'
                  : display.state === 'fleeing' ? '#ff8844'
                  : display.state === 'scared' ? '#ff8844'
                  : display.state === 'drinking potion' ? '#44ff88'
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
      )}

      {/* Gathering progress bar */}
      {display.alive && (
        <Html position={[0, 3.6, 0]} center sprite zIndexRange={[0, 0]}>
          <div ref={progressRef} style={{
            pointerEvents: 'none', userSelect: 'none',
            width: '50px', height: '5px',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '3px', overflow: 'hidden',
            display: 'none',
            boxShadow: '0 0 4px rgba(0,0,0,0.5)',
          }}>
            <div ref={progressBarRef} style={{
              width: '0%', height: '100%',
              borderRadius: '3px',
              transition: 'width 0.1s linear',
            }} />
          </div>
        </Html>
      )}

      {/* Floating text (hunger gain / wake / gather / level up) */}
      {display.alive && (
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
      )}

      {/* Floating damage number */}
      {display.alive && (
        <Html position={[0, 3.2, 0]} center sprite zIndexRange={[0, 0]}>
          <div ref={dmgTextRef} style={{
            pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap',
            fontFamily: "'Courier New', monospace",
            fontSize: '22px', fontWeight: 'bold',
            color: '#ff4444',
            textShadow: '0 0 12px #ff4444, 0 0 6px rgba(0,0,0,0.9)',
            display: 'none',
          }} />
        </Html>
      )}

      {/* ZZZ sleep text */}
      {display.alive && (
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
      )}

      {/* Debug: show thinking text above all creatures */}
      {display.alive && showAllThinking && (
        <Html position={[0, 5.2, 0]} center sprite zIndexRange={[0, 0]}>
          <div style={{
            pointerEvents: 'none', userSelect: 'none',
            fontFamily: "'Courier New', monospace",
            fontSize: '9px',
            color: '#ff8844',
            textShadow: '0 0 4px rgba(0,0,0,0.9)',
            background: 'rgba(5, 10, 5, 0.7)',
            padding: '2px 6px',
            borderRadius: '3px',
            border: '1px solid rgba(255, 100, 50, 0.2)',
            maxWidth: '180px',
            textAlign: 'center',
            lineHeight: '1.3',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}>
            {(() => {
              const creature = creaturesRef.current[index]
              if (!creature) return ''
              const state = creature.state || 'idle'
              const goal = creature._gatherGoal?.reason
              if (goal) return `[${state}] ${goal.slice(0, 50)}`
              return `[${state}]`
            })()}
          </div>
        </Html>
      )}
    </group>
  )
}
