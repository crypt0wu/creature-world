const CREATURE_KEY = 'creature-world-creatures'
const CLOCK_KEY = 'creature-world-clock'
const RESOURCE_KEY = 'creature-world-resources'
const SPECIES_MEMORY_KEY = 'creature-world-species-memory'

export function saveCreatures(creatures) {
  try { localStorage.setItem(CREATURE_KEY, JSON.stringify(creatures)) } catch (e) { /* quota */ }
}

export function loadCreatures() {
  try {
    const data = localStorage.getItem(CREATURE_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

export function saveWorldClock(time) {
  try { localStorage.setItem(CLOCK_KEY, JSON.stringify(time)) } catch (e) { /* quota */ }
}

export function loadWorldClock() {
  try {
    const data = localStorage.getItem(CLOCK_KEY)
    return data ? JSON.parse(data) || 0 : 0
  } catch { return 0 }
}

export function saveResourceStates(states) {
  try { localStorage.setItem(RESOURCE_KEY, JSON.stringify(states)) } catch (e) { /* quota */ }
}

export function loadResourceStates() {
  try {
    const data = localStorage.getItem(RESOURCE_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

export function saveSpeciesMemory(memory) {
  try { localStorage.setItem(SPECIES_MEMORY_KEY, JSON.stringify(memory)) } catch (e) { /* quota */ }
}

export function loadSpeciesMemory() {
  try {
    const data = localStorage.getItem(SPECIES_MEMORY_KEY)
    return data ? JSON.parse(data) : {}
  } catch { return {} }
}

export function clearAll() {
  localStorage.removeItem(CREATURE_KEY)
  localStorage.removeItem(CLOCK_KEY)
  localStorage.removeItem(RESOURCE_KEY)
  localStorage.removeItem(SPECIES_MEMORY_KEY)
}
