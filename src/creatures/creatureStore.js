const CREATURE_KEY = 'creature-world-creatures'
const CLOCK_KEY = 'creature-world-clock'

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

export function clearAll() {
  localStorage.removeItem(CREATURE_KEY)
  localStorage.removeItem(CLOCK_KEY)
}
