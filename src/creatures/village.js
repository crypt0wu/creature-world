// Village system — Steps 1-5: Home claiming, return-to-sleep, shelter, campfire, storage

import { OBSTACLES } from '../worldData'

const CLAIM_THRESHOLD = 8
const SHELTER_COST = { wood: 5, stone: 3 }
const SHELTER_BUILD_TIME = 8
const CAMPFIRE_COST = { wood: 3 }
const CAMPFIRE_BUILD_TIME = 6
const STORAGE_COST = { wood: 8, stone: 2 }
const STORAGE_BUILD_TIME = 10
const STORAGE_MAX_INVENTORY = 20
const RESOURCE_CLEARANCE = 3
const BUILDING_CLEARANCE = 4

export function trackGather(c, count) {
  if (!count || count <= 0) return
  c._totalGathered = (c._totalGathered || 0) + count
  if (c._totalGathered >= CLAIM_THRESHOLD && !c.village) {
    c.village = { x: c.x, z: c.z, buildings: [] }
    c.villageClaimed = true
    c.floatingText = { text: 'Home claimed!', color: '#ffdd44', timer: 2.0 }
    console.log(`[VILLAGE] ${c.name} claimed home at (${c.x.toFixed(1)}, ${c.z.toFixed(1)})`)
  }
}

// Check if creature has materials for a shelter
export function canBuildShelter(c) {
  if (!c.village) return false
  // Already has a shelter
  for (let i = 0; i < c.village.buildings.length; i++) {
    if (c.village.buildings[i].type === 'shelter') return false
  }
  // Check materials
  let wood = 0, stone = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
    if (c.inventory[i].type === 'stone') stone++
  }
  return wood >= SHELTER_COST.wood && stone >= SHELTER_COST.stone
}

// Find a valid position for a building, checking collisions
function findBuildingPosition(villageX, villageZ, allCreatures, dist) {
  const radius = dist || 3
  // Collect all existing buildings from all creatures
  const allBuildings = []
  for (let i = 0; i < allCreatures.length; i++) {
    const cr = allCreatures[i]
    if (cr.village && cr.village.buildings) {
      for (let j = 0; j < cr.village.buildings.length; j++) {
        allBuildings.push(cr.village.buildings[j])
      }
    }
  }

  function isPositionClear(x, z) {
    // Check against world objects (trees, rocks, bushes, crystals)
    for (let i = 0; i < OBSTACLES.length; i++) {
      const obs = OBSTACLES[i]
      const dx = x - obs.x
      const dz = z - obs.z
      if (dx * dx + dz * dz < RESOURCE_CLEARANCE * RESOURCE_CLEARANCE) return false
    }
    // Check against all existing buildings
    for (let i = 0; i < allBuildings.length; i++) {
      const b = allBuildings[i]
      const dx = x - b.x
      const dz = z - b.z
      if (dx * dx + dz * dz < BUILDING_CLEARANCE * BUILDING_CLEARANCE) return false
    }
    return true
  }

  // Try 8 positions in a circle at radius (45 degree increments)
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8
    const x = villageX + Math.cos(angle) * radius
    const z = villageZ + Math.sin(angle) * radius
    if (isPositionClear(x, z)) return { x, z }
  }

  // Try 8 positions at radius + 2
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8
    const x = villageX + Math.cos(angle) * (radius + 2)
    const z = villageZ + Math.sin(angle) * (radius + 2)
    if (isPositionClear(x, z)) return { x, z }
  }

  // Fallback: radius east
  return { x: villageX + radius, z: villageZ }
}

// Consume materials and start building
export function startBuildingShelter(c, allCreatures) {
  // Find valid position before consuming materials
  const pos = findBuildingPosition(c.village.x, c.village.z, allCreatures, 2)
  c._buildingPos = pos

  // Remove materials
  let woodLeft = SHELTER_COST.wood
  let stoneLeft = SHELTER_COST.stone
  for (let i = c.inventory.length - 1; i >= 0; i--) {
    if (c.inventory[i].type === 'wood' && woodLeft > 0) {
      c.inventory.splice(i, 1)
      woodLeft--
    } else if (c.inventory[i].type === 'stone' && stoneLeft > 0) {
      c.inventory.splice(i, 1)
      stoneLeft--
    }
  }
  c._buildingType = 'shelter'
  c._buildingTimer = SHELTER_BUILD_TIME
  c._buildingDuration = SHELTER_BUILD_TIME
  c.moving = false
  c.currentSpeed = 0
  c.floatingText = { text: 'Building...', color: '#ffcc44', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} started building shelter at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
}

// Complete the shelter
export function completeShelter(c) {
  const pos = c._buildingPos || { x: c.village.x + 2, z: c.village.z }
  c.village.buildings.push({
    type: 'shelter',
    x: pos.x,
    z: pos.z,
  })
  c._buildingType = null
  c._buildingTimer = 0
  c._buildingDuration = 0
  c._buildingPos = null
  c.buildingComplete = { type: 'shelter', label: 'Shelter' }
  c.floatingText = { text: 'Shelter built!', color: '#44ff88', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} built a Shelter at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
}

// Check if creature is near its own shelter (for sleep bonus)
export function isNearShelter(c) {
  if (!c.village) return false
  for (let i = 0; i < c.village.buildings.length; i++) {
    const b = c.village.buildings[i]
    if (b.type === 'shelter') {
      const dx = c.x - b.x
      const dz = c.z - b.z
      if (dx * dx + dz * dz < 9) return true
    }
  }
  return false
}

// ── Campfire ──────────────────────────────────────────────────

function _hasBuilding(c, type) {
  if (!c.village) return false
  for (let i = 0; i < c.village.buildings.length; i++) {
    if (c.village.buildings[i].type === type) return true
  }
  return false
}

export function canBuildCampfire(c) {
  if (!c.village) return false
  if (!_hasBuilding(c, 'shelter')) return false  // shelter first
  if (_hasBuilding(c, 'campfire')) return false   // already has one
  let wood = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
  }
  return wood >= CAMPFIRE_COST.wood
}

export function needsCampfireWood(c) {
  if (!c.village) return false
  if (!_hasBuilding(c, 'shelter')) return false
  if (_hasBuilding(c, 'campfire')) return false
  let wood = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
  }
  return wood < CAMPFIRE_COST.wood
}

export function startBuildingCampfire(c, allCreatures) {
  const pos = findBuildingPosition(c.village.x, c.village.z, allCreatures, 3)
  c._buildingPos = pos

  // Remove materials
  let woodLeft = CAMPFIRE_COST.wood
  for (let i = c.inventory.length - 1; i >= 0; i--) {
    if (c.inventory[i].type === 'wood' && woodLeft > 0) {
      c.inventory.splice(i, 1)
      woodLeft--
    }
  }
  c._buildingType = 'campfire'
  c._buildingTimer = CAMPFIRE_BUILD_TIME
  c._buildingDuration = CAMPFIRE_BUILD_TIME
  c.moving = false
  c.currentSpeed = 0
  c.floatingText = { text: 'Building...', color: '#ffcc44', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} started building campfire at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
}

export function completeCampfire(c) {
  const pos = c._buildingPos || { x: c.village.x + 3, z: c.village.z }
  c.village.buildings.push({ type: 'campfire', x: pos.x, z: pos.z })
  c._buildingType = null
  c._buildingTimer = 0
  c._buildingDuration = 0
  c._buildingPos = null
  c.buildingComplete = { type: 'campfire', label: 'Campfire' }
  c.floatingText = { text: 'Campfire built!', color: '#ff8844', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} built a Campfire at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
}

// Check if creature is within 5 units of its own campfire (for hunger drain reduction)
export function isNearCampfire(c) {
  if (!c.village) return false
  for (let i = 0; i < c.village.buildings.length; i++) {
    const b = c.village.buildings[i]
    if (b.type === 'campfire') {
      const dx = c.x - b.x
      const dz = c.z - b.z
      if (dx * dx + dz * dz < 25) return true  // 5^2 = 25
    }
  }
  return false
}

// ── Storage Chest ─────────────────────────────────────────────

export function canBuildStorage(c) {
  if (!c.village) return false
  if (!_hasBuilding(c, 'shelter')) return false
  if (!_hasBuilding(c, 'campfire')) return false
  if (_hasBuilding(c, 'storage')) return false
  let wood = 0, stone = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
    if (c.inventory[i].type === 'stone') stone++
  }
  return wood >= STORAGE_COST.wood && stone >= STORAGE_COST.stone
}

export function needsStorageMaterials(c) {
  if (!c.village) return false
  if (!_hasBuilding(c, 'shelter')) return false
  if (!_hasBuilding(c, 'campfire')) return false
  if (_hasBuilding(c, 'storage')) return false
  let wood = 0, stone = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
    if (c.inventory[i].type === 'stone') stone++
  }
  return wood < STORAGE_COST.wood || stone < STORAGE_COST.stone
}

export function getStorageNeed(c) {
  let wood = 0, stone = 0
  for (let i = 0; i < c.inventory.length; i++) {
    if (c.inventory[i].type === 'wood') wood++
    if (c.inventory[i].type === 'stone') stone++
  }
  return { wood, stone, needWood: wood < STORAGE_COST.wood, needStone: stone < STORAGE_COST.stone }
}

export function startBuildingStorage(c, allCreatures) {
  const pos = findBuildingPosition(c.village.x, c.village.z, allCreatures, 3)
  c._buildingPos = pos

  let woodLeft = STORAGE_COST.wood
  let stoneLeft = STORAGE_COST.stone
  for (let i = c.inventory.length - 1; i >= 0; i--) {
    if (c.inventory[i].type === 'wood' && woodLeft > 0) {
      c.inventory.splice(i, 1)
      woodLeft--
    } else if (c.inventory[i].type === 'stone' && stoneLeft > 0) {
      c.inventory.splice(i, 1)
      stoneLeft--
    }
  }
  c._buildingType = 'storage'
  c._buildingTimer = STORAGE_BUILD_TIME
  c._buildingDuration = STORAGE_BUILD_TIME
  c.moving = false
  c.currentSpeed = 0
  c.floatingText = { text: 'Building...', color: '#ffcc44', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} started building storage at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
}

export function completeStorage(c) {
  const pos = c._buildingPos || { x: c.village.x + 3, z: c.village.z }
  c.village.buildings.push({ type: 'storage', x: pos.x, z: pos.z, items: [] })
  c._buildingType = null
  c._buildingTimer = 0
  c._buildingDuration = 0
  c._buildingPos = null
  c.buildingComplete = { type: 'storage', label: 'Storage' }
  c.floatingText = { text: 'Storage built!', color: '#88ccff', timer: 2.0 }
  console.log(`[VILLAGE] ${c.name} built a Storage at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`)
  console.log(`[VILLAGE] ${c.name} completed all Tier 1 buildings!`)
}

// Dynamic max inventory: 20 if creature has storage, else 12
export function getMaxInventory(c) {
  if (c.village && _hasBuilding(c, 'storage')) return STORAGE_MAX_INVENTORY
  return 12 // base MAX_INVENTORY
}

// Deposit excess resources into storage when creature is at home
// Keeps up to 4 food items (berries), stores the rest
export function depositToStorage(c) {
  if (!c.village) return
  const storage = _getStorageBuilding(c)
  if (!storage) return

  // Count food items to keep
  const KEEP_FOOD = 4
  let foodKept = 0
  const toDeposit = []
  const toKeep = []

  for (let i = 0; i < c.inventory.length; i++) {
    const item = c.inventory[i]
    if (item.type === 'berry' && foodKept < KEEP_FOOD) {
      foodKept++
      toKeep.push(item)
    } else if (item.type === 'berry') {
      // Extra food → deposit
      toDeposit.push(item)
    } else {
      // Resources/crafted items → deposit
      toDeposit.push(item)
    }
  }

  if (toDeposit.length === 0) return

  // Move items to storage
  for (let i = 0; i < toDeposit.length; i++) {
    storage.items.push(toDeposit[i])
  }
  c.inventory.length = 0
  for (let i = 0; i < toKeep.length; i++) {
    c.inventory.push(toKeep[i])
  }
  console.log(`[VILLAGE] ${c.name} deposited ${toDeposit.length} items into storage (total: ${storage.items.length})`)
}

function _getStorageBuilding(c) {
  if (!c.village) return null
  for (let i = 0; i < c.village.buildings.length; i++) {
    if (c.village.buildings[i].type === 'storage') return c.village.buildings[i]
  }
  return null
}

export function getStorageItemCount(c) {
  const s = _getStorageBuilding(c)
  return s ? s.items.length : 0
}

export function hasAllTier1(c) {
  return c.village && _hasBuilding(c, 'shelter') && _hasBuilding(c, 'campfire') && _hasBuilding(c, 'storage')
}
