import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { getTerrainHeight } from '../components/Terrain'
import { WORLD_ITEMS, OBSTACLES, findValidResourcePosition } from '../worldData'
import SPECIES from './species'
import { createAllCreatures } from './creatureData'
import { loadCreatures, loadWorldClock, saveCreatures, saveWorldClock, loadResourceStates, saveResourceStates, loadSpeciesMemory, saveSpeciesMemory } from './creatureStore'
import { updateCreature, createFoodSources, updateFoodSources } from './behaviors'
import { scoreItem, recordDeath } from './scoring'
import { MAX_INVENTORY } from './inventory'
import Creature from './Creature'
import FoodSources from '../components/FoodSources'
import DroppedItems from '../components/DroppedItems'

const GATHER_VERBS = { tree: 'chopping a tree', rock: 'mining a rock', bush: 'picking herbs' }
const ITEM_LABELS = { wood: 'Wood', stone: 'Stone', herb: 'Herb', crystal: 'Crystal', berry: 'Berry' }

function createDefaultResourceStates() {
  return WORLD_ITEMS.map(() => ({
    depleted: false, regrowTimer: 0, regrowDuration: 0, scale: 1, gathererId: null,
    beingGathered: false, gatherProgress: 0, needsRelocation: false,
  }))
}

export default function CreatureManager({ controlsRef, selectedId, followingId, onSelect, onSync, resourceStatesRef }) {
  const initialData = useMemo(() => {
    const loaded = loadCreatures()
    if (loaded && loaded.length > 0) {
      return loaded.map(c => ({
        stuckTimer: 0, lastDist: 999, phase: Math.random() * Math.PI * 2,
        currentSpeed: 0, targetSpeed: 0,
        seekingFood: false, targetFoodIdx: -1, eating: false, eatTimer: 0, lastHungerGain: 0,
        sleeping: false, sleepTimer: 0, sleepDuration: 0, vulnerable: false,
        inventory: [], ateFromInventory: false, pickedUpBerry: false,
        gathering: false, gatherTimer: 0, gatherDuration: 0, seekingResource: false,
        targetResourceIdx: -1, targetResourceType: '',
        gatherResult: null, gatherDone: false, foundCrystal: false,
        equipment: { weapon: null, armor: null },
        strategyMemory: [],
        justCrafted: null, justDropped: null, _craftCooldown: 0,
        dropFloatText: null, dropFloatColor: null,
        _gatherGoal: null, _wantsCraftNow: false, _decisionTimer: 0,
        ...c,
      }))
    }
    return createAllCreatures()
  }, [])

  // Initialize resource states (load from storage or create fresh)
  useMemo(() => {
    const loaded = loadResourceStates()
    if (loaded && loaded.length === WORLD_ITEMS.length) {
      resourceStatesRef.current = loaded.map(rs => ({
        beingGathered: false, gatherProgress: 0, needsRelocation: false,
        ...rs, gathererId: null,
      }))
    } else {
      resourceStatesRef.current = createDefaultResourceStates()
    }
  }, [resourceStatesRef])

  const creaturesRef = useRef(initialData.map(c => ({ ...c })))
  const foodsRef = useRef(createFoodSources())
  const worldClockRef = useRef(loadWorldClock())
  const logRef = useRef([])
  const syncTimer = useRef(0)
  const saveTimer = useRef(0)
  const droppedItemsRef = useRef([])
  const speciesMemoryRef = useRef(loadSpeciesMemory())
  const dropIdCounter = useRef(0)
  const lastRealTimeRef = useRef(Date.now())
  const simulatingRef = useRef(false)

  // ── Core simulation step ────────────────────────────────────
  // Processes dt seconds of game time. When catching=true (catch-up mode),
  // visual flags are cleared after logging to prevent duplicate log entries.
  function simulateTick(dt, catching) {
    const creatures = creaturesRef.current
    const foods = foodsRef.current
    const resourceStates = resourceStatesRef.current
    const speciesMemory = speciesMemoryRef.current

    worldClockRef.current += dt

    // Update food respawn timers
    updateFoodSources(foods, dt)

    // Tick resource regrow timers
    for (let i = 0; i < resourceStates.length; i++) {
      const rs = resourceStates[i]
      if (rs.depleted && rs.regrowTimer > 0) {
        if (rs.needsRelocation) {
          rs.needsRelocation = false
          const type = WORLD_ITEMS[i].type
          const newPos = findValidResourcePosition(type)
          WORLD_ITEMS[i].pos = newPos
          OBSTACLES[i].x = newPos[0]
          OBSTACLES[i].z = newPos[2]
        }

        rs.regrowTimer -= dt
        const progress = 1 - Math.max(0, rs.regrowTimer) / Math.max(rs.regrowDuration, 1)
        rs.scale = 0.1 + progress * 0.9
        if (rs.regrowTimer <= 0) {
          rs.depleted = false
          rs.regrowTimer = 0
          rs.scale = 1
        }
      }
    }

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]
      const prevState = c.state
      const wasAlive = c.alive
      const spec = SPECIES[c.species]

      updateCreature(c, creatures, spec, dt, foods, resourceStates, speciesMemory)

      // Inventory event logging
      if (c.alive && c.pickedUpBerry) {
        c.pickedUpBerry = false
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} found an extra berry! (inventory: ${c.inventory.length}/${MAX_INVENTORY})`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }
      if (c.alive && c.ateFromInventory) {
        c.ateFromInventory = false
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} ate a berry from inventory (+${c.lastHungerGain} hunger)`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }

      // Gathering event logging
      if (c.alive && c.gatherFailed) {
        const FAIL_MSGS = {
          tree: `${c.name} chopped a tree but found nothing useful`,
          rock: `${c.name} mined a rock but it crumbled to dust`,
          bush: `${c.name} picked a bush but it was already bare`,
        }
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: FAIL_MSGS[c.gatherFailed] || `${c.name} gathered nothing`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
        c.gatherFailed = null
      }
      if (c.alive && c.gatherDone) {
        const r = c.gatherResult
        if (r && r.qty > 0) {
          logRef.current.unshift({
            time: worldClockRef.current,
            msg: `${c.name} gathered ${r.qty} ${r.type}`,
            species: c.species,
          })
          if (logRef.current.length > 50) logRef.current.pop()
        }
      }
      if (c.alive && c.foundCrystal) {
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} found a rare crystal!`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }

      // Smart drop events — spawn ground items
      if (c.alive && c.justDropped) {
        const drops = c.justDropped
        c.justDropped = null
        for (const drop of drops) {
          const y = getTerrainHeight(drop.x, drop.z)
          droppedItemsRef.current.push({
            id: `drop-${dropIdCounter.current++}`,
            type: drop.type,
            x: drop.x + (Math.random() - 0.5) * 2,
            y: y,
            z: drop.z + (Math.random() - 0.5) * 2,
            timer: 15,
            maxTimer: 15,
            active: true,
            popTimer: 0,
          })
          const newItemLabel = c.gatherResult ? (ITEM_LABELS[c.gatherResult.type] || c.gatherResult.type) : 'item'
          logRef.current.unshift({
            time: worldClockRef.current,
            msg: `${c.name} dropped ${ITEM_LABELS[drop.type] || drop.type} for ${newItemLabel} (${drop.reason})`,
            species: c.species,
          })
          if (logRef.current.length > 50) logRef.current.pop()
        }
      }

      // Crafting event logging
      if (c.alive && c.justCrafted) {
        const recipe = c.justCrafted.recipe
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} crafted ${recipe.label}!`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }

      // Potion usage logging
      if (c.alive && c.justUsedPotion) {
        c.justUsedPotion = false
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} used a Healing Potion (+40 HP)`,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }

      if (c.alive && c.state !== prevState) {
        let msg
        if (c.state === 'sleeping') {
          msg = `${c.name} fell asleep`
        } else if (prevState === 'sleeping') {
          msg = `${c.name} woke up (energy: ${Math.round(c.energy)})`
        } else if (prevState === 'eating' && c.state !== 'eating') {
          msg = `${c.name} finished eating (+${c.lastHungerGain} hunger)`
        } else if (c.state === 'gathering') {
          const verb = GATHER_VERBS[c.targetResourceType] || 'gathering'
          msg = `${c.name} is ${verb}`
        } else if (c.state === 'seeking resource' && c._gatherGoal?.reason) {
          msg = `${c.name}: ${c._gatherGoal.reason}`
        } else {
          msg = `${c.name} is ${c.state}`
        }
        logRef.current.unshift({
          time: worldClockRef.current,
          msg,
          species: c.species,
        })
        if (logRef.current.length > 50) logRef.current.pop()
      }
      if (!c.alive && wasAlive) {
        recordDeath(c, speciesMemory)
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} has died!`,
          species: c.species,
        })
      }

      // During catch-up, clear visual flags to prevent duplicate logs
      if (catching) {
        c.gatherDone = false
        c.gatherResult = null
        c.foundCrystal = false
        c.justCrafted = null
      }
    }

    // Tick dropped items: countdown, pickup, despawn
    const droppedItems = droppedItemsRef.current
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      const di = droppedItems[i]
      if (!di.active) {
        if (di.popTimer > 0) {
          di.popTimer -= dt
        } else {
          droppedItems.splice(i, 1)
        }
        continue
      }

      di.timer -= dt

      // Nearby creature pickup (probabilistic to avoid per-frame O(n*m))
      if (Math.random() < 0.1) {
        for (let j = 0; j < creatures.length; j++) {
          const cr = creatures[j]
          if (!cr.alive || cr.sleeping || cr.eating || cr.gathering) continue
          if (cr.inventory.length >= MAX_INVENTORY) continue

          const dx = cr.x - di.x
          const dz = cr.z - di.z
          if (dx * dx + dz * dz < 9) { // within 3 units
            const score = scoreItem(di.type, cr, speciesMemory)
            if (score > 15) {
              cr.inventory.push({ type: di.type })
              di.active = false
              di.popTimer = 0
              logRef.current.unshift({
                time: worldClockRef.current,
                msg: `${cr.name} picked up dropped ${ITEM_LABELS[di.type] || di.type}`,
                species: cr.species,
              })
              if (logRef.current.length > 50) logRef.current.pop()
              break
            }
          }
        }
      }

      // Despawn
      if (di.timer <= 0 && di.active) {
        di.active = false
        di.popTimer = catching ? 0 : 0.6
      }
    }
  }

  // ── Background simulation timer ─────────────────────────────
  // Runs when the tab is hidden and useFrame/rAF is paused.
  // Browsers throttle setInterval to ~1/s in background tabs.
  // IMPORTANT: only advance lastRealTimeRef by the time actually processed,
  // so useFrame can catch up any remainder when the tab becomes active.
  useEffect(() => {
    const interval = setInterval(() => {
      if (simulatingRef.current) return
      const now = Date.now()
      const elapsed = (now - lastRealTimeRef.current) / 1000
      if (elapsed < 0.5) return // useFrame is still running, let it handle sim

      simulatingRef.current = true

      // Process up to 10s of sim time per background tick (in chunks)
      let toProcess = Math.min(elapsed, 10.0)
      // Only advance the clock by what we actually process — rest is caught up later
      lastRealTimeRef.current += toProcess * 1000

      const stepSize = toProcess > 5 ? 0.5 : 0.2
      while (toProcess > 0.001) {
        const dt = Math.min(toProcess, stepSize)
        simulateTick(dt, true)
        toProcess -= dt
      }

      // Save periodically during background operation
      saveTimer.current += Math.min(elapsed, 10.0)
      if (saveTimer.current > 5.0) {
        saveTimer.current = 0
        saveCreatures(creaturesRef.current)
        saveWorldClock(worldClockRef.current)
        saveResourceStates(resourceStatesRef.current)
        saveSpeciesMemory(speciesMemoryRef.current)
      }

      simulatingRef.current = false
    }, 1000)

    // Save state when tab is hidden so nothing is lost if the tab is killed
    function onVisChange() {
      if (document.hidden) {
        saveCreatures(creaturesRef.current)
        saveWorldClock(worldClockRef.current)
        saveResourceStates(resourceStatesRef.current)
        saveSpeciesMemory(speciesMemoryRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [])

  // ── Main render loop ────────────────────────────────────────
  // Uses real wall-clock time instead of rAF delta, with catch-up
  // for any time missed while the tab was hidden.
  useFrame(() => {
    if (simulatingRef.current) return
    simulatingRef.current = true

    const now = Date.now()
    let totalElapsed = (now - lastRealTimeRef.current) / 1000
    lastRealTimeRef.current = now

    // Cap catch-up at 30 minutes to avoid freezing
    totalElapsed = Math.min(totalElapsed, 1800)

    const isCatchUp = totalElapsed > 0.1

    // Unified simulation loop — processes ALL elapsed time in adaptive steps.
    // Adaptive step sizes: larger for bigger backlogs (faster), smaller for precision.
    // The very last step keeps visual flags (catching=false) for Creature.jsx float text.
    let remaining = totalElapsed
    while (remaining > 0.001) {
      const maxStep = remaining > 300 ? 1.0 : remaining > 10 ? 0.2 : 0.05
      const dt = Math.min(remaining, maxStep)
      remaining -= dt
      const isLastStep = remaining <= 0.001
      simulateTick(dt, !isLastStep)
    }

    // Camera follow
    if (followingId && controlsRef?.current) {
      const creatures = creaturesRef.current
      const c = creatures.find(c => c.id === followingId)
      if (c && c.alive) {
        const y = getTerrainHeight(c.x, c.z)
        const target = controlsRef.current.target
        if (isCatchUp) {
          // Snap camera after catch-up
          target.x = c.x
          target.y = y + 1
          target.z = c.z
        } else {
          const camDt = Math.min(totalElapsed, 0.05)
          target.x += (c.x - target.x) * 3 * camDt
          target.y += (y + 1 - target.y) * 3 * camDt
          target.z += (c.z - target.z) * 3 * camDt
        }
      }
    }

    // Sync to parent for UI (always sync after catch-up)
    syncTimer.current += totalElapsed
    if (syncTimer.current > 0.5 || isCatchUp) {
      syncTimer.current = 0
      const creatures = creaturesRef.current
      onSync(
        creatures.map(c => ({ ...c })),
        worldClockRef.current,
        [...logRef.current],
      )
    }

    // Save to localStorage
    saveTimer.current += totalElapsed
    if (saveTimer.current > 5.0) {
      saveTimer.current = 0
      const creatures = creaturesRef.current
      saveCreatures(creatures)
      saveWorldClock(worldClockRef.current)
      saveResourceStates(resourceStatesRef.current)
      saveSpeciesMemory(speciesMemoryRef.current)
    }

    simulatingRef.current = false
  })

  return (
    <>
      <FoodSources foodsRef={foodsRef} />
      <DroppedItems droppedItemsRef={droppedItemsRef} />
      {creaturesRef.current.map((c, i) => (
        <Creature
          key={c.id}
          creaturesRef={creaturesRef}
          index={i}
          isSelected={selectedId === c.id}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}
