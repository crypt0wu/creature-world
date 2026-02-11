import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { getTerrainHeight } from '../components/Terrain'
import SPECIES from './species'
import { createAllCreatures } from './creatureData'
import { loadCreatures, loadWorldClock, saveCreatures, saveWorldClock } from './creatureStore'
import { updateCreature, createFoodSources, updateFoodSources } from './behaviors'
import Creature from './Creature'
import FoodSources from '../components/FoodSources'

export default function CreatureManager({ controlsRef, selectedId, followingId, onSelect, onSync }) {
  const initialData = useMemo(() => {
    const loaded = loadCreatures()
    if (loaded && loaded.length > 0) {
      return loaded.map(c => ({
        stuckTimer: 0, lastDist: 999, phase: Math.random() * Math.PI * 2,
        currentSpeed: 0, targetSpeed: 0,
        seekingFood: false, targetFoodIdx: -1, eating: false, eatTimer: 0, lastHungerGain: 0,
        sleeping: false, sleepTimer: 0, sleepDuration: 0, vulnerable: false,
        inventory: [], ateFromInventory: false, pickedUpBerry: false,
        ...c,
      }))
    }
    return createAllCreatures()
  }, [])

  const creaturesRef = useRef(initialData.map(c => ({ ...c })))
  const foodsRef = useRef(createFoodSources())
  const worldClockRef = useRef(loadWorldClock())
  const logRef = useRef([])
  const syncTimer = useRef(0)
  const saveTimer = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const creatures = creaturesRef.current
    const foods = foodsRef.current

    worldClockRef.current += dt

    // Update food respawn timers
    updateFoodSources(foods, dt)

    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i]
      const prevState = c.state
      const wasAlive = c.alive
      const spec = SPECIES[c.species]

      updateCreature(c, creatures, spec, dt, foods)

      // Inventory event logging
      if (c.alive && c.pickedUpBerry) {
        c.pickedUpBerry = false
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} found an extra berry! (inventory: ${c.inventory.length}/5)`,
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

      if (c.alive && c.state !== prevState) {
        let msg
        if (c.state === 'sleeping') {
          msg = `${c.name} fell asleep`
        } else if (prevState === 'sleeping') {
          msg = `${c.name} woke up (energy: ${Math.round(c.energy)})`
        } else if (prevState === 'eating' && c.state !== 'eating') {
          msg = `${c.name} finished eating (+${c.lastHungerGain} hunger)`
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
        logRef.current.unshift({
          time: worldClockRef.current,
          msg: `${c.name} has died!`,
          species: c.species,
        })
      }
    }

    // Camera follow
    if (followingId && controlsRef?.current) {
      const c = creatures.find(c => c.id === followingId)
      if (c && c.alive) {
        const y = getTerrainHeight(c.x, c.z)
        const target = controlsRef.current.target
        target.x += (c.x - target.x) * 3 * dt
        target.y += (y + 1 - target.y) * 3 * dt
        target.z += (c.z - target.z) * 3 * dt
      }
    }

    // Sync to parent for UI
    syncTimer.current += dt
    if (syncTimer.current > 0.5) {
      syncTimer.current = 0
      onSync(
        creatures.map(c => ({ ...c })),
        worldClockRef.current,
        [...logRef.current],
      )
    }

    // Save to localStorage
    saveTimer.current += dt
    if (saveTimer.current > 5.0) {
      saveTimer.current = 0
      saveCreatures(creatures)
      saveWorldClock(worldClockRef.current)
    }
  })

  return (
    <>
      <FoodSources foodsRef={foodsRef} />
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
