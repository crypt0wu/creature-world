import SPECIES from './species'

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

export function createCreature(speciesName, index) {
  const spec = SPECIES[speciesName]
  const angle = (index / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
  const dist = 15 + Math.random() * 25

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
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
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
  }
}

export function createAllCreatures() {
  return Object.keys(SPECIES).map((name, i) => createCreature(name, i))
}
