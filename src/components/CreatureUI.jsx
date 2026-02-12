import { useState, useEffect } from 'react'
import SPECIES from '../creatures/species'
import { ITEM_DEFS, MAX_INVENTORY } from '../creatures/inventory'
import { EQUIPMENT_DEFS, RECIPES, canCraft } from '../creatures/crafting'

const FONT_HEADER = "'Chakra Petch', sans-serif"
const FONT_DATA = "'Space Mono', monospace"

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// ── Stack inventory items by type ────────────────────────────
function stackInventory(inventory) {
  if (!inventory || inventory.length === 0) return []
  const map = {}
  const order = []
  for (let i = 0; i < inventory.length; i++) {
    const type = inventory[i].type
    if (map[type] === undefined) {
      map[type] = order.length
      order.push({ type, count: 1 })
    } else {
      order[map[type]].count++
    }
  }
  return order
}

// ── Generate AI thinking text ────────────────────────────────
function generateThinkingText(c) {
  if (!c || !c.alive) return null

  const inv = c.inventory || []
  const eq = c.equipment || {}
  const hpPct = c.maxHp > 0 ? c.hp / c.maxHp : 1

  const counts = {}
  for (let i = 0; i < inv.length; i++) {
    const t = inv[i].type
    counts[t] = (counts[t] || 0) + 1
  }

  const woodCount = counts.wood || 0
  const stoneCount = counts.stone || 0
  const herbCount = counts.herb || 0
  const invFull = inv.length >= MAX_INVENTORY

  if (c._chasing) {
    if (c._chaseGoingForKill) return "Enemy is weak — finishing them off"
    return "They're running! I can catch them if I'm fast enough..."
  }

  if (c._fleeSprint > 0) {
    return "Running for my life! Need to get far away before they catch up."
  }

  if (c._scaredTimer > 0) {
    if (hpPct < 0.3) return "Badly hurt and terrified. Need to get far away and find healing..."
    return "Not safe here... need to keep moving. Can't stop until I'm sure they're gone."
  }

  if (c.drinkingPotion) {
    const pct = c.potionDuration > 0 ? Math.round((1 - c.potionTimer / c.potionDuration) * 100) : 0
    return `Drinking a Healing Potion... ${pct}% done. Can't move while drinking.`
  }

  if (c.inCombat) {
    const hpRatio = c.hp / c.maxHp
    if (hpRatio < 0.3) return "This fight is going badly... I need to escape!"
    if (hpRatio < 0.5) return "Taking heavy damage. Should I flee or fight to the end?"
    if (c.equipment?.weapon?.durability !== undefined && c.equipment.weapon.durability < 10) {
      return "My weapon is about to break! Need to end this fight quickly."
    }
    if (c.equipment?.weapon) return "Fighting! My weapon gives me an edge in this battle."
    return "In combat! Trading blows with the enemy."
  }

  if (c.sleeping) {
    if (c.energy < 10) return "Zzz... energy critically low. Need to rest before doing anything."
    if (hpPct < 0.5) return "Zzz... resting to recover HP. Vulnerable right now..."
    return "Zzz... recharging energy. The world can wait."
  }

  if (c.eating) {
    if (c.hunger < 15) return "Starving! Eating as fast as I can."
    return "Eating to restore hunger. Should be good for a while after this."
  }

  if (c.crafting && c.craftRecipe) {
    const pct = c.craftDuration > 0 ? Math.round((1 - c.craftTimer / c.craftDuration) * 100) : 0
    return `Crafting ${c.craftRecipe.label}... ${pct}% complete. Vulnerable while working.`
  }

  if (c.gathering) {
    const goal = c._gatherGoal
    const GATHER_ACTIONS = { tree: 'Chopping a tree', rock: 'Mining a rock', bush: 'Picking herbs' }
    const action = GATHER_ACTIONS[c.targetResourceType] || 'Gathering'
    if (goal?.reason) return `${action}. ${goal.reason}.`
    // Fallback
    if (c.targetResourceType === 'tree') return "Chopping this tree for wood."
    if (c.targetResourceType === 'rock') return "Mining this rock for stone."
    if (c.targetResourceType === 'bush') return "Gathering herbs from this bush."
    return "Gathering resources..."
  }

  if (c.seekingResource) {
    const goal = c._gatherGoal
    const targetNames = { tree: 'a tree', rock: 'a rock', bush: 'a bush' }
    const target = targetNames[c.targetResourceType] || 'a resource'
    if (goal?.reason) {
      if (invFull) return `${goal.reason}. Heading to ${target} — will drop something less useful.`
      return `${goal.reason}. Heading to ${target}.`
    }
    return `Heading to ${target}. Looking for useful materials.`
  }

  if (c.seekingFood) {
    const hasBerries = (counts.berry || 0) > 0
    if (c.hunger < 10) return "Desperately seeking food! HP draining from starvation."
    if (hasBerries) return "Heading to a berry bush, but I have backup berries just in case."
    return "Getting hungry... need to find food before things get worse."
  }

  if (c.state === 'hungry') {
    const hasBerries = (counts.berry || 0) > 0
    if (hasBerries) return "Getting hungry... I have berries saved, should eat soon."
    if (c.hunger < 10) return "Starving and can't find food. This is bad."
    return "Hunger is getting low. Need to find a berry bush."
  }

  if (c.state === 'tired') {
    if (c.energy < 5) return "About to collapse from exhaustion. Need to sleep soon."
    return "Running low on energy. Slowing down to conserve what I have."
  }

  // Low durability equipment — need replacement
  if (eq.weapon?.durability !== undefined) {
    const wpnPct = eq.weapon.durability / eq.weapon.maxDurability
    if (wpnPct < 0.30) {
      const label = EQUIPMENT_DEFS[eq.weapon.id]?.label || 'Weapon'
      return `${label} is wearing out (${eq.weapon.durability}/${eq.weapon.maxDurability}). Need to craft a replacement soon.`
    }
  }
  if (eq.armor?.durability !== undefined) {
    const armPct = eq.armor.durability / eq.armor.maxDurability
    if (armPct < 0.30) {
      const label = EQUIPMENT_DEFS[eq.armor.id]?.label || 'Armor'
      return `${label} is wearing out (${eq.armor.durability}/${eq.armor.maxDurability}). Need to craft a replacement soon.`
    }
  }

  // Idle/wandering — check if anything is craftable FIRST
  const craftableRecipes = RECIPES.filter(r => canCraft(inv, r))
  if (craftableRecipes.length > 0) {
    const names = craftableRecipes.map(r => r.label)
    const potionCount = Math.floor(herbCount / 2)
    if (potionCount > 1 && craftableRecipes.some(r => r.id === 'healing_potion')) {
      return `I have ${herbCount} herbs. I can craft ${potionCount} Healing Potions. Starting to craft.`
    }
    if (craftableRecipes.length === 1) {
      return `I have the materials for ${names[0]}. Time to craft!`
    }
    return `I can craft ${names.join(' and ')}. Let me get to work.`
  }

  // Decision engine goal (always show if present)
  const goal = c._gatherGoal
  if (goal && goal.reason) {
    if (goal.action === 'craft') return goal.reason
    if (goal.action === 'gather') return goal.reason
    if (goal.action === 'idle') return goal.reason
  }

  // Goal-based text — what should this creature be working toward?
  const potionCount = inv.filter(i => i.type === 'healing_potion').length

  if (!eq.weapon) {
    if (stoneCount >= 1 || woodCount >= 1) {
      return `Goal: Craft Stone Blade. Have ${stoneCount}/2 stone, ${woodCount}/1 wood.`
    }
    return "Goal: Craft a Stone Blade. Need to gather stone and wood."
  }

  if (!eq.armor) {
    if (woodCount >= 1) {
      return `Goal: Craft Wooden Shield. Have ${woodCount}/2 wood.`
    }
    return "Goal: Craft a Wooden Shield. Need to gather wood."
  }

  // Has weapon + armor — potion and endgame goals
  if (herbCount >= 1 && herbCount < 2) {
    return `Goal: Craft Healing Potion. Have ${herbCount}/2 herbs.`
  }
  if (potionCount > 0 && invFull) {
    return `Fully equipped with ${potionCount} potion${potionCount > 1 ? 's' : ''}. Exploring for crystals.`
  }
  if (eq.weapon && eq.armor) {
    return "Fully equipped. Gathering herbs for Healing Potions."
  }

  if (c.personality === 'lazy') return "Resting between tasks. Will get back to work soon."
  return "Planning next move..."
}

// ── Style constants ──────────────────────────────────────────
const PANEL = {
  background: 'rgba(5, 10, 5, 0.85)',
  border: '1px solid rgba(80, 200, 120, 0.2)',
  borderRadius: '6px',
  padding: '14px',
  fontFamily: FONT_DATA,
  color: '#88aa88',
  fontSize: '14px',
  backdropFilter: 'blur(8px)',
}

const LABEL = {
  fontSize: '11px',
  color: '#557755',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  marginBottom: '10px',
  borderBottom: '1px solid rgba(80, 200, 120, 0.15)',
  paddingBottom: '6px',
  fontFamily: FONT_HEADER,
}

const DIVIDER = {
  borderTop: '1px solid rgba(80, 200, 120, 0.1)',
  marginBottom: '10px',
  paddingTop: '8px',
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ color: '#557755', fontFamily: FONT_HEADER, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>{label}</span>
        <span style={{ fontFamily: FONT_DATA, fontSize: '12px' }}>{Math.round(value)}/{max}</span>
      </div>
      <div style={{
        height: '6px', background: 'rgba(0,0,0,0.5)',
        borderRadius: '3px', overflow: 'hidden', marginTop: '2px',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '12px' }}>
      <span style={{ color: '#557755', fontFamily: FONT_HEADER, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>{label}</span>
      <span style={{ color: color || '#88aa88', fontFamily: FONT_DATA }}>{value}</span>
    </div>
  )
}

const SECTION = { marginBottom: '16px' }

const SECTION_TITLE = {
  fontSize: '13px',
  color: '#66ff88',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  marginBottom: '8px',
  paddingBottom: '4px',
  borderBottom: '1px solid rgba(80, 200, 120, 0.15)',
  fontFamily: FONT_HEADER,
}

const HELP_TEXT = { fontSize: '13px', color: '#88aa88', lineHeight: '1.6', fontFamily: FONT_DATA }
const HELP_KEY = { color: '#66ff88', fontWeight: 'bold' }
const HELP_DIM = { color: '#557755' }

// ── Item SVG icons ──────────────────────────────────────────
function ItemIcon({ type }) {
  if (type === 'wood') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="7" y="4" width="10" height="16" rx="2" fill="#6b4226" />
      <rect x="9" y="4" width="6" height="16" rx="1" fill="#8b5e3c" />
      <ellipse cx="12" cy="4" rx="5" ry="2" fill="#a0714f" />
      <ellipse cx="12" cy="20" rx="5" ry="2" fill="#5a3520" />
      <line x1="10" y1="8" x2="10" y2="16" stroke="#5a3520" strokeWidth="0.5" opacity="0.4" />
      <line x1="14" y1="6" x2="14" y2="18" stroke="#5a3520" strokeWidth="0.5" opacity="0.3" />
    </svg>
  )
  if (type === 'stone') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <polygon points="12,3 20,9 18,19 6,19 4,9" fill="#6a6a6a" />
      <polygon points="12,3 20,9 16,10 12,5 8,10 4,9" fill="#888" />
      <polygon points="8,10 12,5 16,10 14,15 10,15" fill="#7a7a7a" />
      <line x1="8" y1="10" x2="14" y2="15" stroke="#555" strokeWidth="0.5" opacity="0.5" />
    </svg>
  )
  if (type === 'herb') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12,20 Q12,14 8,10 Q12,12 12,8 Q12,12 16,10 Q12,14 12,20" fill="#3a8a3a" />
      <path d="M12,18 Q10,14 6,12 Q10,13 12,10" fill="#2d7a2d" stroke="#4a9a4a" strokeWidth="0.3" />
      <path d="M12,18 Q14,14 18,12 Q14,13 12,10" fill="#2d7a2d" stroke="#4a9a4a" strokeWidth="0.3" />
      <line x1="12" y1="20" x2="12" y2="8" stroke="#2a6a2a" strokeWidth="1" />
    </svg>
  )
  if (type === 'crystal') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <polygon points="12,2 16,8 14,22 10,22 8,8" fill="#9955dd" />
      <polygon points="12,2 16,8 12,10 8,8" fill="#bb77ff" />
      <polygon points="8,8 12,10 10,22" fill="#7744aa" />
      <polygon points="16,8 12,10 14,22" fill="#8855cc" />
      <line x1="12" y1="2" x2="12" y2="10" stroke="#ddaaff" strokeWidth="0.5" opacity="0.6" />
      <circle cx="12" cy="10" r="6" fill="#aa66ff" opacity="0.15" />
    </svg>
  )
  if (type === 'stone_blade') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="11" y="14" width="2" height="8" fill="#aa7744" rx="0.5" />
      <rect x="8" y="13" width="8" height="2" rx="1" fill="#aa8855" />
      <polygon points="10,3 14,3 14,13 10,13" fill="#aaa" />
      <polygon points="10,3 14,3 12,1" fill="#ccc" />
      <line x1="12" y1="3" x2="12" y2="13" stroke="#ddd" strokeWidth="0.5" opacity="0.4" />
    </svg>
  )
  if (type === 'wooden_shield') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12,2 L20,6 L20,13 Q20,20 12,23 Q4,20 4,13 L4,6 Z" fill="#8b5e3c" />
      <path d="M12,4 L18,7 L18,13 Q18,19 12,21 Q6,19 6,13 L6,7 Z" fill="#aa7744" />
      <line x1="12" y1="4" x2="12" y2="21" stroke="#cc9966" strokeWidth="1.5" opacity="0.5" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="#cc9966" strokeWidth="1.5" opacity="0.5" />
      <circle cx="12" cy="12" r="2" fill="#cc9966" opacity="0.4" />
    </svg>
  )
  if (type === 'healing_potion') return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <rect x="9" y="2" width="6" height="4" rx="1" fill="#bbb" />
      <rect x="10" y="3" width="4" height="2" rx="0.5" fill="#ddd" />
      <path d="M9,6 L7,10 L7,20 Q7,22 9,22 L15,22 Q17,22 17,20 L17,10 L15,6 Z" fill="#33aa55" />
      <path d="M8,10 L16,10 L16,20 Q16,21.5 15,21.5 L9,21.5 Q8,21.5 8,20 Z" fill="#44dd66" opacity="0.6" />
      <rect x="10.5" y="14" width="3" height="1.5" rx="0.5" fill="#aaffcc" />
      <rect x="11.25" y="12.5" width="1.5" height="4" rx="0.5" fill="#aaffcc" />
    </svg>
  )
  // berry (default)
  return (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <ellipse cx="12" cy="18" rx="9" ry="5" fill="#1a4a1a" />
      <ellipse cx="12" cy="17" rx="8" ry="4.5" fill="#1e5a1e" />
      <circle cx="7" cy="16" r="3.5" fill="#1a4a1a" />
      <circle cx="17" cy="16" r="3.5" fill="#1a4a1a" />
      <circle cx="12" cy="14" r="4" fill="#1e5a1e" />
      <circle cx="10" cy="10" r="3" fill="#ff4488" />
      <circle cx="10" cy="10" r="1.5" fill="#ff6699" opacity="0.6" />
      <circle cx="15" cy="11" r="2.5" fill="#ff5588" />
      <circle cx="15" cy="11" r="1.2" fill="#ff77aa" opacity="0.5" />
      <circle cx="12" cy="7" r="2.2" fill="#ff4488" />
      <circle cx="12" cy="7" r="1" fill="#ff6699" opacity="0.6" />
      <circle cx="12" cy="9" r="6" fill="#ff2266" opacity="0.1" />
    </svg>
  )
}

const ITEM_BORDER_COLORS = {
  berry:          'rgba(255, 100, 160, 0.5)',
  wood:           'rgba(170, 119, 68, 0.5)',
  stone:          'rgba(153, 170, 170, 0.5)',
  herb:           'rgba(102, 204, 102, 0.5)',
  crystal:        'rgba(170, 102, 255, 0.5)',
  stone_blade:    'rgba(255, 204, 68, 0.5)',
  wooden_shield:  'rgba(68, 170, 255, 0.5)',
  healing_potion: 'rgba(68, 255, 136, 0.5)',
}

const ITEM_BG_COLORS = {
  berry:          'rgba(255, 68, 136, 0.08)',
  wood:           'rgba(170, 119, 68, 0.08)',
  stone:          'rgba(153, 170, 170, 0.08)',
  herb:           'rgba(102, 204, 102, 0.08)',
  crystal:        'rgba(170, 102, 255, 0.08)',
  stone_blade:    'rgba(255, 204, 68, 0.08)',
  wooden_shield:  'rgba(68, 170, 255, 0.08)',
  healing_potion: 'rgba(68, 255, 136, 0.08)',
}

const ITEM_LABEL_COLORS = {
  berry:          '#ff6699',
  wood:           '#aa7744',
  stone:          '#99aaaa',
  herb:           '#66cc66',
  crystal:        '#aa66ff',
  stone_blade:    '#ffcc44',
  wooden_shield:  '#44aaff',
  healing_potion: '#44ff88',
}

const ITEM_TOOLTIPS = {
  berry:          'Eat to restore 60 hunger',
  wood:           'Crafting material from trees',
  stone:          'Crafting material from rocks',
  herb:           'Crafting material from bushes',
  crystal:        'Rare crafting material',
  stone_blade:    'Equipped: +8 ATK',
  wooden_shield:  'Equipped: +15 max HP',
  healing_potion: 'Restores 40 HP',
}

// ── Help Modal ──────────────────────────────────────────────
function HelpModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0, 0, 0, 0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        ...PANEL,
        width: '560px', maxHeight: '80vh', overflowY: 'auto',
        padding: '24px', border: '1px solid rgba(80, 200, 120, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '20px', paddingBottom: '10px',
          borderBottom: '1px solid rgba(80, 200, 120, 0.2)',
        }}>
          <span style={{ fontSize: '20px', color: '#66ff88', fontWeight: 'bold', fontFamily: FONT_HEADER }}>
            Creature World
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255, 100, 68, 0.1)',
            border: '1px solid rgba(255, 100, 68, 0.3)',
            color: '#cc6644', fontSize: '14px', padding: '4px 12px',
            borderRadius: '4px', cursor: 'pointer', fontFamily: FONT_DATA,
          }}>
            x
          </button>
        </div>

        {/* Controls */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Controls</div>
          <div style={HELP_TEXT}>
            <span style={HELP_KEY}>WASD</span> <span style={HELP_DIM}>—</span> move camera<br />
            <span style={HELP_KEY}>Mouse drag</span> <span style={HELP_DIM}>—</span> orbit camera<br />
            <span style={HELP_KEY}>Scroll</span> <span style={HELP_DIM}>—</span> zoom in/out<br />
            <span style={HELP_KEY}>Click terrain</span> <span style={HELP_DIM}>—</span> glide camera to point<br />
            <span style={HELP_KEY}>Click creature</span> <span style={HELP_DIM}>—</span> select and view stats<br />
            <span style={HELP_KEY}>Shift</span> <span style={HELP_DIM}>—</span> hold for fast camera movement<br />
            <span style={HELP_KEY}>Escape</span> <span style={HELP_DIM}>—</span> close this menu
          </div>
        </div>

        {/* Species */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Species</div>
          <div style={HELP_TEXT}>
            Six autonomous creatures roam the world as glowing orbs:<br /><br />
            <span style={{ color: '#ff6600' }}>Embrix</span> <span style={HELP_DIM}>(Fire)</span> — Fast and aggressive, burns energy quickly<br />
            <span style={{ color: '#44aaff' }}>Aqualis</span> <span style={HELP_DIM}>(Water)</span> — Tanky and efficient, hard to take down<br />
            <span style={{ color: '#44ff66' }}>Verdox</span> <span style={HELP_DIM}>(Grass)</span> — Passive and slow, outlasts everything<br />
            <span style={{ color: '#ffee44' }}>Voltik</span> <span style={HELP_DIM}>(Electric)</span> — Erratic and restless, never stops moving<br />
            <span style={{ color: '#bb66ff' }}>Shadeyn</span> <span style={HELP_DIM}>(Dark)</span> — Stealthy and calculated, picks fights carefully<br />
            <span style={{ color: '#88eeff' }}>Glacira</span> <span style={HELP_DIM}>(Ice)</span> — Slow but powerful, glacial metabolism
          </div>
        </div>

        {/* Stats Panel */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Stats Panel</div>
          <div style={HELP_TEXT}>
            Click any creature to open the stats panel. It shows six sections:<br /><br />
            <span style={HELP_KEY}>Stat Bars</span> <span style={HELP_DIM}>—</span> HP, Hunger, Energy with color-coded progress bars<br />
            <span style={HELP_KEY}>Stats Grid</span> <span style={HELP_DIM}>—</span> ATK (with equipment bonus), SPD, XP, Kills, Personality, Age<br />
            <span style={HELP_KEY}>Equipment</span> <span style={HELP_DIM}>—</span> Weapon and armor slots. Empty slots shown as dashed outlines<br />
            <span style={HELP_KEY}>Inventory</span> <span style={HELP_DIM}>—</span> 8 individual slots, 1 item each. Hover for details<br />
            <span style={HELP_KEY}>Thinking</span> <span style={HELP_DIM}>—</span> Shows the creature's current AI reasoning and strategy
          </div>
        </div>

        {/* Hunger & Food */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Hunger & Food</div>
          <div style={HELP_TEXT}>
            Berry bushes <span style={HELP_DIM}>(glowing pink)</span> spawn across the world. When a creature gets hungry, it seeks the nearest bush and eats for 3 seconds, restoring 60 hunger.<br /><br />
            Consumed bushes respawn after 2–3 minutes at a new location. If hunger hits 0, the creature starves and loses 0.5 HP per second until it eats or dies.<br /><br />
            Personality affects hunger behavior — bold creatures eat sooner, lazy ones wait longer, and timid creatures avoid food if others are nearby.
          </div>
        </div>

        {/* Energy & Sleep */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Energy & Sleep</div>
          <div style={HELP_TEXT}>
            Energy drains over time, faster while moving. When energy drops below 25, a creature becomes <span style={{ color: '#44aaff' }}>tired</span> and moves slower.<br /><br />
            When energy is critically low, the creature falls <span style={{ color: '#6688cc' }}>asleep</span> — it stops moving, dims its glow, and shows floating "zZz" text. During sleep, energy regenerates at 4/s and HP at 0.5/s.<br /><br />
            <span style={{ color: '#ff6644' }}>Sleeping creatures are vulnerable</span> — they cannot move, eat, or seek food until they wake up.
          </div>
        </div>

        {/* Gathering */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Gathering</div>
          <div style={HELP_TEXT}>
            When idle with enough energy ({'>'} 20), creatures seek nearby resources:<br /><br />
            <span style={{ color: '#aa7744' }}>Trees</span> <span style={HELP_DIM}>—</span> 1–3 wood (5s, 12 energy, 20% fail, regrow 5–8 min)<br />
            <span style={{ color: '#99aaaa' }}>Rocks</span> <span style={HELP_DIM}>—</span> 1–2 stone (4s, 10 energy, 15% fail, regrow 8–12 min)<br />
            <span style={{ color: '#66cc66' }}>Bushes</span> <span style={HELP_DIM}>—</span> 1–2 herbs (3s, 4 energy, 10% fail, regrow 3–5 min)<br /><br />
            <span style={{ color: '#aa66ff' }}>Crystals</span> <span style={HELP_DIM}>—</span> 12% chance when mining rocks. Rare and valuable!
          </div>
        </div>

        {/* Crafting */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Crafting</div>
          <div style={HELP_TEXT}>
            When idle with materials, creatures auto-craft equipment and potions. Crafting takes time:<br /><br />
            <span style={{ color: '#ffcc44' }}>Stone Blade</span> <span style={HELP_DIM}>—</span> 2 stone + 1 wood = +8 ATK (15–20s, 15 energy)<br />
            <span style={{ color: '#44aaff' }}>Wooden Shield</span> <span style={HELP_DIM}>—</span> 2 wood = +15 max HP (20–25s, 20 energy)<br />
            <span style={{ color: '#44ff88' }}>Healing Potion</span> <span style={HELP_DIM}>—</span> 2 herbs = +40 HP heal (10–12s, 8 energy)<br /><br />
            A gold progress bar shows crafting progress. Creatures are vulnerable while crafting — if attacked, crafting is interrupted and materials are returned. Crafted items auto-equip after 2 seconds.
          </div>
        </div>

        {/* Combat */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Combat</div>
          <div style={HELP_TEXT}>
            When two creatures get within 12 units, there's a chance a fight starts based on personality and aggression stats.<br /><br />
            <span style={HELP_KEY}>Engagement</span> <span style={HELP_DIM}>—</span> Fierce/bold attack on sight, timid/gentle try to flee, sneaky only attacks weaker targets, curious evaluates first<br />
            <span style={HELP_KEY}>Damage</span> <span style={HELP_DIM}>—</span> ATK x random(0.7-1.3), equipment bonuses included. Armor reduces incoming damage<br />
            <span style={HELP_KEY}>Type matchups</span> <span style={HELP_DIM}>—</span> 1.5x damage bonus:<br />
            &nbsp;&nbsp;<span style={{ color: '#ff6600' }}>Fire</span> {'>'} <span style={{ color: '#44ff66' }}>Grass</span> {'>'} <span style={{ color: '#44aaff' }}>Water</span> {'>'} <span style={{ color: '#ff6600' }}>Fire</span><br />
            &nbsp;&nbsp;<span style={{ color: '#ffee44' }}>Electric</span> {'>'} <span style={{ color: '#44aaff' }}>Water</span>, <span style={{ color: '#bb66ff' }}>Dark</span> {'>'} <span style={{ color: '#ffee44' }}>Electric</span>, <span style={{ color: '#88eeff' }}>Ice</span> {'>'} <span style={{ color: '#ff6600' }}>Fire</span><br /><br />
            <span style={HELP_KEY}>Fleeing</span> <span style={HELP_DIM}>—</span> Creatures can flee mid-combat. 60% chance if faster, 20% if slower<br />
            <span style={HELP_KEY}>Death</span> <span style={HELP_DIM}>—</span> HP 0 = permanent death. Orb shatters into particles. Winner gets XP and loots 1-2 items<br />
            <span style={HELP_KEY}>Cooldown</span> <span style={HELP_DIM}>—</span> 60 seconds after combat before fighting again<br />
            <span style={HELP_KEY}>Interrupts</span> <span style={HELP_DIM}>—</span> Sleeping, eating, or gathering creatures can be ambushed
          </div>
        </div>

        {/* Leveling */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Leveling</div>
          <div style={HELP_TEXT}>
            <span style={HELP_KEY}>XP threshold</span> <span style={HELP_DIM}>—</span> Level x 30 XP to level up (Lv.1 = 30 XP, Lv.5 = 150 XP)<br />
            <span style={HELP_KEY}>XP sources</span> <span style={HELP_DIM}>—</span> Defeating a creature grants (opponent level x 25) XP<br />
            <span style={HELP_KEY}>Stat gains</span> <span style={HELP_DIM}>—</span> +10 max HP, +2 ATK, +1 SPD per level<br />
            <span style={HELP_KEY}>Max level</span> <span style={HELP_DIM}>—</span> 10<br />
            <span style={HELP_KEY}>Visuals</span> <span style={HELP_DIM}>—</span> Bright glow burst + floating "LEVEL UP!" text
          </div>
        </div>

        {/* Smart Drops */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Smart Drops</div>
          <div style={HELP_TEXT}>
            When inventory is full and a creature finds a better item, it drops the least valuable one. Items are scored based on HP, hunger, recipe completion, equipment, personality, and species learning.<br /><br />
            Dropped items appear on the ground for 15 seconds and flash faster in the last 5. Nearby creatures can grab them if they value them.
          </div>
        </div>

        {/* Status */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Status</div>
          <div style={HELP_TEXT}>
            <span style={{ color: '#ff4444' }}>FIGHTING</span> <span style={HELP_DIM}>—</span> In combat with another creature<br />
            <span style={{ color: '#666' }}>IDLE</span> <span style={HELP_DIM}>—</span> Resting between wander targets<br />
            <span style={{ color: '#88aa88' }}>WANDERING</span> <span style={HELP_DIM}>—</span> Moving to a random point<br />
            <span style={{ color: '#ffcc44' }}>SEEKING FOOD</span> <span style={HELP_DIM}>—</span> Hungry, heading toward food<br />
            <span style={{ color: '#44ff88' }}>EATING</span> <span style={HELP_DIM}>—</span> Consuming food (3 seconds)<br />
            <span style={{ color: '#888866' }}>SEEKING RESOURCE</span> <span style={HELP_DIM}>—</span> Heading to harvest<br />
            <span style={{ color: '#aa7744' }}>GATHERING</span> <span style={HELP_DIM}>—</span> Harvesting (3–5 seconds)<br />
            <span style={{ color: '#ffcc44' }}>CRAFTING</span> <span style={HELP_DIM}>—</span> Crafting an item (10–25 seconds, vulnerable)<br />
            <span style={{ color: '#6688cc' }}>SLEEPING</span> <span style={HELP_DIM}>—</span> Resting (vulnerable)<br />
            <span style={{ color: '#44aaff' }}>TIRED</span> <span style={HELP_DIM}>—</span> Low energy, slower<br />
            <span style={{ color: '#ffaa44' }}>HUNGRY</span> <span style={HELP_DIM}>—</span> Low hunger, no food targeted
          </div>
        </div>

        {/* UI Guide */}
        <div style={{ ...SECTION, marginBottom: 0 }}>
          <div style={SECTION_TITLE}>UI Guide</div>
          <div style={HELP_TEXT}>
            <span style={HELP_KEY}>Left panel</span> <span style={HELP_DIM}>—</span> Creature roster. Click to select.<br />
            <span style={HELP_KEY}>Right panel</span> <span style={HELP_DIM}>—</span> Activity log of creature events<br />
            <span style={HELP_KEY}>Bottom panel</span> <span style={HELP_DIM}>—</span> 6-section stats panel for selected creature<br />
            <span style={HELP_KEY}>Follow button</span> <span style={HELP_DIM}>—</span> Camera tracks the selected creature<br />
            <span style={HELP_KEY}>Hover</span> <span style={HELP_DIM}>—</span> Hover over inventory items for tooltips<br />
            <span style={HELP_KEY}>Top left</span> <span style={HELP_DIM}>—</span> Simulation clock
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main UI Component ───────────────────────────────────────
export default function CreatureUI({
  creatures, selectedId, followingId,
  onSelect, onFollow,
  activityLog, worldClock, onReset,
}) {
  const sel = creatures.find(c => c.id === selectedId)
  const selected = sel && sel.alive ? sel : null
  const thinkingText = selected ? generateThinkingText(selected) : null
  const [showHelp, setShowHelp] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showLog, setShowLog] = useState(true)
  const [hoveredSlot, setHoveredSlot] = useState(null)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: 20,
    }}>
      {/* ── Top bar: clock + reset ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', padding: '12px 16px',
      }}>
        <div style={{ ...PANEL, pointerEvents: 'auto' }}>
          <div style={{ fontSize: '10px', color: '#557755', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: FONT_HEADER }}>
            Simulation Time
          </div>
          <div style={{ fontSize: '22px', color: '#66ff88', fontWeight: 'bold', marginTop: '3px', fontFamily: FONT_DATA }}>
            {formatTime(worldClock)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              ...PANEL, pointerEvents: 'auto', cursor: 'pointer',
              color: '#88cc88', border: '1px solid rgba(80, 200, 120, 0.3)',
              fontSize: '16px', fontWeight: 'bold', padding: '8px 16px',
              fontFamily: FONT_HEADER,
            }}
          >
            ?
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              ...PANEL, pointerEvents: 'auto', cursor: 'pointer',
              color: '#ff6644', border: '1px solid rgba(255, 100, 68, 0.3)',
              fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px',
              padding: '10px 20px', fontFamily: FONT_HEADER,
            }}
          >
            Reset World
          </button>
        </div>
      </div>

      {/* ── Left: creature roster ── */}
      <div style={{
        position: 'absolute', top: '90px', left: '12px',
        width: '240px', pointerEvents: 'auto',
      }}>
        <div style={PANEL}>
          <div style={LABEL}>Creatures</div>
          {creatures.map(c => {
            const spec = SPECIES[c.species]
            const hpPct = c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 0
            const isDead = !c.alive
            return (
              <div
                key={c.id}
                onClick={isDead ? undefined : () => onSelect(c.id)}
                style={{
                  padding: '7px 10px', marginBottom: '4px', borderRadius: '4px',
                  cursor: isDead ? 'default' : 'pointer',
                  background: !isDead && selectedId === c.id ? 'rgba(80, 200, 120, 0.15)' : 'transparent',
                  borderLeft: `3px solid ${isDead ? '#333' : (spec?.color || '#888')}`,
                  opacity: isDead ? 0.35 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    color: isDead ? '#555' : (spec?.glow || '#aaa'),
                    fontSize: '13px', fontWeight: 'bold', fontFamily: FONT_HEADER,
                    textDecoration: isDead ? 'line-through' : 'none',
                  }}>
                    {c.name}
                  </span>
                  <span style={{
                    flex: 1, fontSize: '9px', fontFamily: FONT_DATA,
                    fontWeight: isDead ? 'bold' : 'normal',
                    textAlign: 'right',
                    color: isDead ? '#ff4444'
                      : c.state === 'fighting' ? '#ff4444'
                      : c.state === 'chasing' ? '#ff6644'
                      : c.state === 'fleeing' ? '#ff8844'
                      : c.state === 'scared' ? '#ff8844'
                      : c.state === 'drinking potion' ? '#44ff88'
                      : c.state === 'sleeping' ? '#6688cc'
                      : c.state === 'gathering' ? '#aa7744'
                      : c.state === 'crafting' ? '#ffcc44'
                      : c.state === 'seeking resource' ? '#888866'
                      : '#667766',
                  }}>
                    {isDead ? 'DEAD' : c.state}
                  </span>
                  <span style={{ color: isDead ? '#444' : '#556655', fontSize: '10px', fontFamily: FONT_DATA }}>
                    Lv.{c.level}
                  </span>
                </div>
                <div style={{
                  height: '5px', marginTop: '4px',
                  background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden',
                }}>
                  {!isDead && (
                    <div style={{
                      width: `${hpPct}%`, height: '100%',
                      background: hpPct > 50 ? '#44ff44' : hpPct > 25 ? '#ffaa00' : '#ff4444',
                      borderRadius: '3px', transition: 'width 0.3s ease',
                    }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: activity log ── */}
      <div style={{
        position: 'absolute', top: '70px', right: '12px',
        pointerEvents: 'auto',
      }}>
        {showLog ? (
          <div style={{ width: '300px' }}>
            <div style={{ ...PANEL, maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{
                ...LABEL,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Activity Log</span>
                <button
                  onClick={() => setShowLog(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#557755', fontSize: '11px', padding: '0 2px',
                    fontFamily: FONT_DATA,
                  }}
                >
                  x
                </button>
              </div>
              {activityLog.length === 0 ? (
                <div style={{ color: '#445544', fontSize: '12px', fontStyle: 'italic' }}>
                  No activity yet...
                </div>
              ) : (
                activityLog.slice(0, 30).map((entry, i) => {
                  const spec = SPECIES[entry.species]
                  return (
                    <div key={i} style={{
                      fontSize: '11px', padding: '4px 0',
                      borderBottom: '1px solid rgba(80, 200, 120, 0.05)',
                      lineHeight: '1.5',
                    }}>
                      <span style={{ color: '#445544', marginRight: '8px' }}>
                        {formatTime(entry.time)}
                      </span>
                      <span style={{ color: spec?.glow || '#88aa88' }}>
                        {entry.msg}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowLog(true)}
            style={{
              ...PANEL, cursor: 'pointer',
              color: '#88cc88', border: '1px solid rgba(80, 200, 120, 0.3)',
              fontSize: '11px', fontWeight: 'bold', padding: '8px 14px',
              textTransform: 'uppercase', letterSpacing: '2px',
              fontFamily: FONT_HEADER,
            }}
          >
            Log
          </button>
        )}
      </div>

      {/* ── Bottom: selected creature stats ── */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: '16px',
          left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'auto',
        }}>
          <div style={{ ...PANEL, width: '680px', padding: '10px 14px' }}>

            {/* ━━ ROW 1: HEADER ━━ */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '8px', borderBottom: '1px solid rgba(80, 200, 120, 0.15)',
              paddingBottom: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{
                  color: SPECIES[selected.species]?.glow || '#aaa',
                  fontSize: '16px', fontWeight: 700, fontFamily: FONT_HEADER,
                }}>
                  {selected.name}
                </span>
                <span style={{ color: '#557755', fontSize: '10px', fontFamily: FONT_DATA }}>
                  {selected.species}
                </span>
                <span style={{
                  color: '#66ff88', fontSize: '9px', fontFamily: FONT_DATA,
                  background: 'rgba(80, 200, 120, 0.1)',
                  padding: '1px 5px', borderRadius: '3px',
                  border: '1px solid rgba(80, 200, 120, 0.2)',
                }}>
                  Lv.{selected.level}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => onFollow(followingId === selected.id ? null : selected.id)}
                  style={{
                    background: followingId === selected.id ? 'rgba(80, 200, 120, 0.3)' : 'rgba(80, 200, 120, 0.1)',
                    border: '1px solid rgba(80, 200, 120, 0.3)',
                    color: '#88cc88', fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                    cursor: 'pointer', fontFamily: FONT_DATA,
                  }}
                >
                  {followingId === selected.id ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={() => { onSelect(null); onFollow(null) }}
                  style={{
                    background: 'rgba(255, 100, 68, 0.1)',
                    border: '1px solid rgba(255, 100, 68, 0.3)',
                    color: '#cc6644', fontSize: '10px', padding: '3px 8px', borderRadius: '4px',
                    cursor: 'pointer', fontFamily: FONT_DATA,
                  }}
                >
                  x
                </button>
              </div>
            </div>

            {/* ━━ ROW 2: BARS + STATS GRID side by side ━━ */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              {/* Left: stat bars */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <StatBar label="HP" value={selected.hp} max={selected.maxHp} color="#44ff44" />
                <StatBar label="Hunger" value={selected.hunger} max={100} color="#ffaa44" />
                <StatBar
                  label={selected.sleeping ? 'Energy (sleeping)' : 'Energy'}
                  value={selected.energy} max={100}
                  color={selected.sleeping ? '#6688cc' : '#44aaff'}
                />
              </div>
              {/* Right: stats grid */}
              <div style={{
                flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '2px 14px', alignContent: 'start',
              }}>
                <StatRow label="ATK" value={
                  selected.equipment?.weapon
                    ? <>{Math.round(selected.atk)} <span style={{ color: '#ff6644', fontSize: '10px' }}>(+{selected.equipment.weapon.atkBonus})</span></>
                    : Math.round(selected.atk)
                } />
                <StatRow label="SPD" value={Math.round(selected.spd)} />
                <StatRow label="XP" value={`${selected.xp}/${selected.level * 30}`} />
                <StatRow label="Kills" value={selected.kills} />
                <StatRow label="Personality" value={selected.personality} />
                <StatRow
                  label="Status"
                  value={selected.alive ? selected.state : 'DEAD'}
                  color={selected.alive ? '#88aa88' : '#ff4444'}
                />
              </div>
            </div>

            {/* ━━ ROW 3: EQUIPMENT + INVENTORY side by side ━━ */}
            {selected.alive && (
              <div style={{
                display: 'flex', gap: '16px',
                borderTop: '1px solid rgba(80, 200, 120, 0.1)',
                paddingTop: '8px', marginBottom: '6px',
              }}>
                {/* Equipment (2 slots stacked) */}
                <div style={{ minWidth: '150px' }}>
                  <div style={{
                    fontSize: '9px', color: '#66ff88', textTransform: 'uppercase',
                    letterSpacing: '2px', marginBottom: '4px', fontFamily: FONT_HEADER,
                  }}>
                    Equipment
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Weapon slot */}
                    {selected.equipment?.weapon ? (() => {
                      const wpn = selected.equipment.weapon
                      const hasDur = wpn.durability !== undefined
                      const durPct = hasDur ? wpn.durability / wpn.maxDurability : 1
                      const durColor = durPct > 0.5 ? '#44ff44' : durPct > 0.25 ? '#ffcc44' : '#ff4444'
                      return (
                        <div style={{
                          padding: '4px 6px', borderRadius: '4px',
                          background: 'rgba(255, 100, 68, 0.06)',
                          border: '1px solid rgba(255, 100, 68, 0.2)',
                          borderLeft: '3px solid rgba(255, 100, 68, 0.5)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px' }}>&#9876;&#65039;</span>
                            <span style={{ color: '#ffcc44', fontSize: '11px', fontFamily: FONT_DATA }}>
                              {EQUIPMENT_DEFS[wpn.id]?.label || 'Weapon'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#ff6644', fontFamily: FONT_DATA }}>
                              +{wpn.atkBonus}
                            </span>
                            {hasDur && (
                              <span style={{ fontSize: '9px', color: '#667766', fontFamily: FONT_DATA, marginLeft: 'auto' }}>
                                {wpn.durability}/{wpn.maxDurability}
                              </span>
                            )}
                          </div>
                          {hasDur && (
                            <div style={{
                              width: '100%', height: '3px',
                              background: 'rgba(0,0,0,0.5)',
                              borderRadius: '2px', overflow: 'hidden',
                              marginTop: '3px',
                            }}>
                              <div style={{
                                width: `${durPct * 100}%`,
                                height: '100%',
                                background: durColor,
                                borderRadius: '2px',
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                          )}
                        </div>
                      )
                    })() : (
                      <div style={{
                        padding: '4px 6px', borderRadius: '4px',
                        border: '1px dashed rgba(80, 200, 120, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minHeight: '28px',
                      }}>
                        <span style={{ fontSize: '9px', color: '#334433', fontFamily: FONT_DATA }}>weapon</span>
                      </div>
                    )}
                    {/* Armor slot */}
                    {selected.equipment?.armor ? (() => {
                      const arm = selected.equipment.armor
                      const hasDur = arm.durability !== undefined
                      const durPct = hasDur ? arm.durability / arm.maxDurability : 1
                      const durColor = durPct > 0.5 ? '#44ff44' : durPct > 0.25 ? '#ffcc44' : '#ff4444'
                      return (
                        <div style={{
                          padding: '4px 6px', borderRadius: '4px',
                          background: 'rgba(68, 170, 255, 0.06)',
                          border: '1px solid rgba(68, 170, 255, 0.2)',
                          borderLeft: '3px solid rgba(68, 170, 255, 0.5)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px' }}>&#128737;&#65039;</span>
                            <span style={{ color: '#44aaff', fontSize: '11px', fontFamily: FONT_DATA }}>
                              {EQUIPMENT_DEFS[arm.id]?.label || 'Armor'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#44aaff', fontFamily: FONT_DATA }}>
                              +{arm.maxHpBonus}
                            </span>
                            {hasDur && (
                              <span style={{ fontSize: '9px', color: '#667766', fontFamily: FONT_DATA, marginLeft: 'auto' }}>
                                {arm.durability}/{arm.maxDurability}
                              </span>
                            )}
                          </div>
                          {hasDur && (
                            <div style={{
                              width: '100%', height: '3px',
                              background: 'rgba(0,0,0,0.5)',
                              borderRadius: '2px', overflow: 'hidden',
                              marginTop: '3px',
                            }}>
                              <div style={{
                                width: `${durPct * 100}%`,
                                height: '100%',
                                background: durColor,
                                borderRadius: '2px',
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                          )}
                        </div>
                      )
                    })() : (
                      <div style={{
                        padding: '4px 6px', borderRadius: '4px',
                        border: '1px dashed rgba(80, 200, 120, 0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        minHeight: '28px',
                      }}>
                        <span style={{ fontSize: '9px', color: '#334433', fontFamily: FONT_DATA }}>armor</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Inventory (individual slots, no stacking) */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '4px',
                  }}>
                    <span style={{
                      fontSize: '9px', color: '#66ff88', textTransform: 'uppercase',
                      letterSpacing: '2px', fontFamily: FONT_HEADER,
                    }}>
                      Inventory
                    </span>
                    <span style={{ fontSize: '9px', color: '#557755', fontFamily: FONT_DATA }}>
                      {selected.inventory?.length || 0}/{MAX_INVENTORY}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', position: 'relative' }}>
                    {Array.from({ length: MAX_INVENTORY }, (_, i) => {
                      const item = selected.inventory?.[i]
                      const itemType = item?.type || null
                      return (
                        <div key={i}
                          onMouseEnter={() => item && setHoveredSlot(i)}
                          onMouseLeave={() => setHoveredSlot(null)}
                          style={{
                            width: '34px', height: '34px',
                            borderRadius: '4px',
                            border: item
                              ? `1px solid ${ITEM_BORDER_COLORS[itemType] || 'rgba(80, 200, 120, 0.3)'}`
                              : '1px dashed rgba(80, 200, 120, 0.1)',
                            background: item
                              ? (ITEM_BG_COLORS[itemType] || 'rgba(0, 0, 0, 0.3)')
                              : 'rgba(0, 0, 0, 0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative',
                            cursor: item ? 'help' : 'default',
                            opacity: item ? 1 : 0.5,
                          }}>
                          {item && <ItemIcon type={itemType} />}
                          {/* Tooltip */}
                          {item && hoveredSlot === i && (
                            <div style={{
                              position: 'absolute',
                              bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                              background: 'rgba(5, 10, 5, 0.95)',
                              border: '1px solid rgba(80, 200, 120, 0.3)',
                              borderRadius: '4px',
                              padding: '5px 8px',
                              fontFamily: FONT_DATA,
                              fontSize: '10px',
                              whiteSpace: 'nowrap',
                              zIndex: 60,
                              pointerEvents: 'none',
                              backdropFilter: 'blur(4px)',
                            }}>
                              <span style={{
                                color: ITEM_LABEL_COLORS[itemType] || '#88aa88',
                                fontWeight: 'bold',
                              }}>
                                {ITEM_DEFS[itemType]?.label || itemType}
                              </span>
                              <span style={{ color: '#557755' }}> — </span>
                              <span style={{ color: '#88aa88' }}>
                                {ITEM_TOOLTIPS[itemType] || ''}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ━━ ROW 4: THINKING (compact) ━━ */}
            {selected.alive && thinkingText && (
              <div style={{
                borderTop: '1px solid rgba(80, 200, 120, 0.1)',
                paddingTop: '6px',
              }}>
                <div style={{
                  background: 'rgba(100, 60, 180, 0.08)',
                  border: '1px solid rgba(140, 100, 220, 0.2)',
                  borderRadius: '4px',
                  padding: '5px 8px',
                  display: 'flex', alignItems: 'baseline', gap: '6px',
                }}>
                  <span style={{
                    fontSize: '9px', color: '#aa88cc', textTransform: 'uppercase',
                    letterSpacing: '1px', fontFamily: FONT_HEADER, flexShrink: 0,
                  }}>
                    &#129504; Thinking
                  </span>
                  <span style={{
                    fontSize: '11px', color: '#bbaacc', fontStyle: 'italic',
                    fontFamily: FONT_DATA,
                  }}>
                    &ldquo;{thinkingText}&rdquo;
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Reset confirmation ── */}
      {showResetConfirm && (
        <div onClick={() => setShowResetConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            ...PANEL,
            width: '360px', padding: '24px',
            border: '1px solid rgba(255, 100, 68, 0.4)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '16px', color: '#ff6644', fontWeight: 'bold',
              marginBottom: '12px', fontFamily: FONT_HEADER,
            }}>
              Reset World?
            </div>
            <div style={{
              fontSize: '13px', color: '#88aa88', lineHeight: '1.6',
              marginBottom: '20px',
            }}>
              This will erase all creature progress, stats, and the simulation clock. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                style={{
                  background: 'rgba(80, 200, 120, 0.1)',
                  border: '1px solid rgba(80, 200, 120, 0.3)',
                  color: '#88cc88',
                  fontSize: '12px', padding: '8px 20px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: FONT_DATA,
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowResetConfirm(false); onReset() }}
                style={{
                  background: 'rgba(255, 100, 68, 0.2)',
                  border: '1px solid rgba(255, 100, 68, 0.5)',
                  color: '#ff6644',
                  fontSize: '12px', padding: '8px 20px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: FONT_DATA,
                  textTransform: 'uppercase', letterSpacing: '1px',
                  fontWeight: 'bold',
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
