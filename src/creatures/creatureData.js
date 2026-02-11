import SPECIES from './species'
import { getTerrainHeight } from '../components/Terrain'
import { PONDS } from '../worldData'

export { default as SPECIES } from './species'

export const PERSONALITIES = ['bold', 'timid', 'curious', 'lazy', 'fierce', 'gentle', 'sneaky', 'loyal']

const PREFIXES = [
  'Pyr', 'Zal', 'Nyx', 'Vor', 'Ash', 'Kir', 'Dex', 'Lum', 'Rav', 'Sol',
  'Hex', 'Grim', 'Flux', 'Vex', 'Ori', 'Cryo', 'Zel', 'Myr', 'Thr', 'Kor',
]
const SUFFIXES = [
  'axis', 'ion', 'ara', 'yx', 'en', 'is', 'ox', 'us', 'ith', 'or',
  'ax', 'iel', 'une', 'ek', 'an', 'os', 'ix', 'al', 'um', 'ir',
]

export function generateName() {
  return PREFIXES[Math.floor(Math.random() * PREFIXES.length)] +
         SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]
}

// ── Find a valid random spawn position for a creature ──
// Avoids ponds, underwater terrain, and maintains min distance from others
function findCreatureSpawn(placedPositions, minDist) {
  const SPREAD = 140
  for (let attempt = 0; attempt < 100; attempt++) {
    const x = (Math.random() - 0.5) * SPREAD
    const z = (Math.random() - 0.5) * SPREAD
    const y = getTerrainHeight(x, z)

    // Skip underwater
    if (y < -0.5) continue

    // Skip ponds
    let inPond = false
    for (let i = 0; i < PONDS.length; i++) {
      const dx = x - PONDS[i].cx, dz = z - PONDS[i].cz
      if (dx * dx + dz * dz < (PONDS[i].radius + 6) ** 2) { inPond = true; break }
    }
    if (inPond) continue

    // Min distance from already-placed creatures
    let tooClose = false
    for (let i = 0; i < placedPositions.length; i++) {
      const dx = x - placedPositions[i][0], dz = z - placedPositions[i][1]
      if (dx * dx + dz * dz < minDist * minDist) { tooClose = true; break }
    }
    if (tooClose) continue

    return [x, z]
  }
  // Fallback: random position near center
  const x = (Math.random() - 0.5) * 60
  const z = (Math.random() - 0.5) * 60
  return [x, z]
}

export function createCreature(speciesName, index, placedPositions) {
  const spec = SPECIES[speciesName]
  const minDist = 18
  const [spawnX, spawnZ] = findCreatureSpawn(placedPositions || [], minDist)

  return {
    id: `creature-${index}`,
    name: generateName(),
    species: speciesName,
    type: spec.type,
    personality: PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)],
    hp: spec.baseHp,
    maxHp: spec.baseHp,
    atk: spec.baseAtk,
    spd: spec.baseSpd,
    baseSpd: spec.baseSpd,
    hunger: 100,
    energy: 100,
    level: 1,
    xp: 0,
    kills: 0,
    age: 0,
    alive: true,
    x: spawnX,
    z: spawnZ,
    rotY: Math.random() * Math.PI * 2,
    targetX: 0,
    targetZ: 0,
    currentSpeed: 0,
    targetSpeed: 0,
    moving: false,
    pause: 2 + Math.random() * 3,
    state: 'idle',
    phase: Math.random() * Math.PI * 2,
    stuckTimer: 0,
    lastDist: 999,
    seekingFood: false,
    targetFoodIdx: -1,
    eating: false,
    eatTimer: 0,
    lastHungerGain: 0,
    sleeping: false,
    sleepTimer: 0,
    sleepDuration: 0,
    vulnerable: false,
    inventory: [],
    equipment: { weapon: null, armor: null },
    strategyMemory: [],
    justCrafted: null,
    justDropped: null,
    _craftCooldown: 0,
    crafting: false,
    craftTimer: 0,
    craftDuration: 0,
    craftRecipe: null,
    // Potion drinking (timed)
    drinkingPotion: false,
    potionTimer: 0,
    potionDuration: 0,
    potionHealTotal: 0,
    potionHealedSoFar: 0,
    potionStarted: null,
    justUsedPotion: null,
    ateFromInventory: false,
    pickedUpBerry: false,
    gathering: false,
    gatherTimer: 0,
    gatherDuration: 0,
    seekingResource: false,
    targetResourceIdx: -1,
    targetResourceType: '',
    gatherResult: null,
    gatherDone: false,
    foundCrystal: false,
    _gatherGoal: null,
    _wantsCraftNow: false,
    _decisionTimer: 0,
    // Combat
    inCombat: false,
    _combatTarget: null,
    _combatCooldown: 0,
    _hitTimer: 0,
    _fleeTimer: 0,
    combatHitDealt: null,
    combatHitTaken: null,
    combatKill: null,
    combatDeath: null,
    combatEngaged: null,
    combatFled: null,
    combatInterrupted: false,
    deathCause: null,
    killedBy: null,
    _combatDuration: 0,
    _combatTurns: 0,
    // Flee / escape
    _fleeAttempts: 0,
    _scaredTimer: 0,
    _scaredOfId: null,
    _fleeSprint: 0,
    _fleeFromX: 0,
    _fleeFromZ: 0,
    combatIntimidated: null,
    // Chase (pursuer)
    _chasing: false,
    _chaseTargetId: null,
    _chaseTimer: 0,
    // Flee distance enforcement (runner)
    _fleeMinDist: 0,
    // Chase event flags
    combatChaseStarted: null,
    combatChaseCaught: null,
    combatChaseEscaped: null,
    combatChaseGaveUp: null,
    // Equipment durability flags
    equipmentBroke: null,
    equipmentLow: null,
    // Leveling
    justLeveledUp: null,
  }
}

export function createAllCreatures() {
  const placedPositions = []
  const speciesNames = Object.keys(SPECIES)
  return speciesNames.map((name, i) => {
    const creature = createCreature(name, i, placedPositions)
    placedPositions.push([creature.x, creature.z])
    return creature
  })
}
