import { useState, useRef, useCallback } from 'react'
import SPECIES from '../creatures/species'

const FONT_HEADER = "'Chakra Petch', sans-serif"
const FONT_DATA = "'Space Mono', monospace"

const PANEL = {
  background: 'rgba(5, 10, 5, 0.92)',
  border: '1px solid rgba(255, 100, 50, 0.3)',
  borderRadius: '6px',
  padding: '12px',
  fontFamily: FONT_DATA,
  color: '#88aa88',
  fontSize: '12px',
  backdropFilter: 'blur(8px)',
}

const SECTION_TITLE = {
  fontSize: '10px',
  color: '#ff8844',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  marginBottom: '6px',
  paddingBottom: '4px',
  borderBottom: '1px solid rgba(255, 100, 50, 0.15)',
  fontFamily: FONT_HEADER,
}

const BTN = {
  background: 'rgba(255, 100, 50, 0.1)',
  border: '1px solid rgba(255, 100, 50, 0.3)',
  color: '#cc8866',
  fontSize: '10px',
  padding: '4px 8px',
  borderRadius: '3px',
  cursor: 'pointer',
  fontFamily: FONT_DATA,
}

const BTN_ACTIVE = {
  ...BTN,
  background: 'rgba(255, 100, 50, 0.3)',
  border: '1px solid rgba(255, 100, 50, 0.6)',
  color: '#ffaa66',
}

const SPECIES_NAMES = Object.keys(SPECIES)

export default function DebugPanel({
  debugRef, speedRef, creatures, selectedId, onSelect,
  showAllThinking, onToggleThinking,
}) {
  const [speed, setSpeed] = useState(speedRef?.current || 1)
  const [pos, setPos] = useState({ x: window.innerWidth / 2 - 260, y: 70 })
  const dragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const onDragStart = useCallback((e) => {
    dragging.current = true
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (e) => {
      if (!dragging.current) return
      setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y })
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  const selected = creatures.find(c => c.id === selectedId)

  function changeSpeed(val) {
    if (speedRef) speedRef.current = val
    setSpeed(val)
  }

  function getCreature(id) {
    return debugRef?.current?.creaturesRef?.current?.find(c => c.id === id)
  }

  function forceState(fn) {
    if (!selectedId) return
    const c = getCreature(selectedId)
    if (!c || !c.alive) return
    fn(c)
  }

  function spawnFight() {
    const api = debugRef?.current
    if (!api?.spawn) return
    const s1 = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)]
    let s2 = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)]
    while (s2 === s1 && SPECIES_NAMES.length > 1) {
      s2 = SPECIES_NAMES[Math.floor(Math.random() * SPECIES_NAMES.length)]
    }
    const cx = (Math.random() - 0.5) * 40
    const cz = (Math.random() - 0.5) * 40
    const id1 = api.spawn(s1, cx - 1.5, cz)
    const id2 = api.spawn(s2, cx + 1.5, cz)
    // Force both into combat
    const c1 = getCreature(id1)
    const c2 = getCreature(id2)
    if (c1 && c2) {
      c1.inCombat = true; c1._combatTarget = id2; c1._hitTimer = 0; c1._combatCooldown = 0; c1._fleeAttempts = 0
      c2.inCombat = true; c2._combatTarget = id1; c2._hitTimer = 0.5; c2._combatCooldown = 0; c2._fleeAttempts = 0
    }
  }

  function spawnAll() {
    const api = debugRef?.current
    if (!api?.spawn) return
    SPECIES_NAMES.forEach((name, i) => {
      const angle = (i / SPECIES_NAMES.length) * Math.PI * 2
      const r = 15 + Math.random() * 10
      api.spawn(name, Math.cos(angle) * r, Math.sin(angle) * r)
    })
  }

  function giveEquipment() {
    forceState(c => {
      if (!c.equipment.weapon) {
        c.equipment.weapon = { id: 'stone_blade', atkBonus: 8, durability: 50, maxDurability: 50 }
        c.atk += 8
      }
      if (!c.equipment.armor) {
        c.equipment.armor = { id: 'wooden_shield', maxHpBonus: 15, durability: 40, maxDurability: 40 }
        c.maxHp += 15
        c.hp += 15
      }
    })
  }

  function forceAttack() {
    if (!selectedId) return
    const creatures = debugRef?.current?.creaturesRef?.current
    if (!creatures) return
    const c = creatures.find(cr => cr.id === selectedId)
    if (!c || !c.alive) return
    let nearest = null, nearestDist = Infinity
    for (const other of creatures) {
      if (other.id === c.id || !other.alive) continue
      const dx = other.x - c.x, dz = other.z - c.z
      const dist = dx * dx + dz * dz
      if (dist < nearestDist) { nearestDist = dist; nearest = other }
    }
    if (!nearest) return
    // Clear any current activities
    c.sleeping = false; c.eating = false; c.gathering = false; c.crafting = false
    c.seekingFood = false; c.seekingResource = false; c.drinkingPotion = false
    nearest.sleeping = false; nearest.eating = false; nearest.gathering = false; nearest.crafting = false
    nearest.seekingFood = false; nearest.seekingResource = false; nearest.drinkingPotion = false
    // Force combat
    c.inCombat = true; c._combatTarget = nearest.id; c._hitTimer = 0; c._combatCooldown = 0; c._fleeAttempts = 0
    nearest.inCombat = true; nearest._combatTarget = c.id; nearest._hitTimer = 0.5; nearest._combatCooldown = 0; nearest._fleeAttempts = 0
  }

  function setStat(field, value) {
    forceState(c => { c[field] = value })
  }

  // Stat editor value from live creatures data (synced via displayData)
  const selData = selected && selected.alive ? selected : null

  return (
    <div style={{
      position: 'fixed', top: pos.y, left: pos.x,
      zIndex: 40, pointerEvents: 'auto', maxHeight: 'calc(100vh - 20px)',
      overflowY: 'auto',
    }}>
      <div style={{ ...PANEL, width: '520px' }}>
        {/* Header — drag handle */}
        <div
          onMouseDown={onDragStart}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '10px', paddingBottom: '6px',
            borderBottom: '1px solid rgba(255, 100, 50, 0.2)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: '14px', color: '#ff8844', fontWeight: 'bold', fontFamily: FONT_HEADER }}>
            DEBUG PANEL
          </span>
          <span style={{ fontSize: '9px', color: '#554433' }}>
            drag to move | ` to close
          </span>
        </div>

        {/* ── Speed Control ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={SECTION_TITLE}>Speed Control</div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {[
              { label: 'Pause', val: 0 },
              { label: '0.5x', val: 0.5 },
              { label: '1x', val: 1 },
              { label: '2x', val: 2 },
              { label: '5x', val: 5 },
              { label: '10x', val: 10 },
            ].map(s => (
              <button key={s.val} onClick={() => changeSpeed(s.val)}
                style={speed === s.val ? BTN_ACTIVE : BTN}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Spawn Controls ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={SECTION_TITLE}>Spawn</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={spawnFight} style={BTN}>Spawn Fight (2)</button>
            <button onClick={spawnAll} style={BTN}>Spawn All 6</button>
          </div>
        </div>

        {/* ── Force States ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={SECTION_TITLE}>
            Force States
            {selData && (
              <span style={{ color: SPECIES[selData.species]?.glow || '#aaa', marginLeft: '8px', fontSize: '11px' }}>
                {selData.name}
              </span>
            )}
          </div>
          {!selData ? (
            <div style={{ color: '#443322', fontSize: '10px', fontStyle: 'italic' }}>
              Select a creature first
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button onClick={() => forceState(c => { c.hp = c.maxHp; c.hunger = 100; c.energy = 100 })} style={BTN}>
                Full Heal
              </button>
              <button onClick={() => forceState(c => { c.hp = Math.round(c.maxHp * 0.5) })} style={BTN}>
                HP 50%
              </button>
              <button onClick={() => forceState(c => { c.hp = Math.round(c.maxHp * 0.1) })} style={BTN}>
                HP 10%
              </button>
              <button onClick={() => forceState(c => { c.energy = 0 })} style={BTN}>
                Energy 0
              </button>
              <button onClick={() => forceState(c => { c.hunger = 0 })} style={BTN}>
                Hunger 0
              </button>
              <button onClick={() => forceState(c => {
                c.inventory = [
                  { type: 'wood' }, { type: 'wood' },
                  { type: 'stone' }, { type: 'stone' },
                  { type: 'herb' }, { type: 'herb' },
                  { type: 'berry' }, { type: 'berry' },
                ]
              })} style={BTN}>
                Full Materials
              </button>
              <button onClick={giveEquipment} style={BTN}>Give Equipment</button>
              <button onClick={forceAttack} style={BTN}>Force Attack</button>
            </div>
          )}
        </div>

        {/* ── Stat Editor ── */}
        <div style={{ marginBottom: '12px' }}>
          <div style={SECTION_TITLE}>Stat Editor</div>
          {!selData ? (
            <div style={{ color: '#443322', fontSize: '10px', fontStyle: 'italic' }}>
              Select a creature first
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
              {[
                { label: 'HP', field: 'hp', min: 0, max: 999, step: 10 },
                { label: 'MaxHP', field: 'maxHp', min: 1, max: 999, step: 10 },
                { label: 'ATK', field: 'atk', min: 0, max: 200, step: 2 },
                { label: 'SPD', field: 'spd', min: 0.5, max: 20, step: 0.5 },
                { label: 'Energy', field: 'energy', min: 0, max: 100, step: 10 },
                { label: 'Hunger', field: 'hunger', min: 0, max: 100, step: 10 },
                { label: 'XP', field: 'xp', min: 0, max: 9999, step: 10 },
                { label: 'Level', field: 'level', min: 1, max: 10, step: 1 },
              ].map(s => (
                <div key={s.field} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    fontSize: '9px', color: '#557755', fontFamily: FONT_HEADER,
                    textTransform: 'uppercase', letterSpacing: '1px', width: '45px',
                  }}>
                    {s.label}
                  </span>
                  <button onClick={() => setStat(s.field, Math.max(s.min, (selData[s.field] || 0) - s.step))}
                    style={{ ...BTN, padding: '1px 5px', fontSize: '9px' }}>-</button>
                  <span style={{ fontSize: '10px', color: '#88aa88', fontFamily: FONT_DATA, width: '36px', textAlign: 'center' }}>
                    {typeof selData[s.field] === 'number' ? (Number.isInteger(selData[s.field]) ? selData[s.field] : selData[s.field].toFixed(1)) : selData[s.field]}
                  </span>
                  <button onClick={() => setStat(s.field, Math.min(s.max, (selData[s.field] || 0) + s.step))}
                    style={{ ...BTN, padding: '1px 5px', fontSize: '9px' }}>+</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Toggle: Show All Thinking ── */}
        <div>
          <div style={SECTION_TITLE}>Overlays</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAllThinking}
              onChange={() => onToggleThinking(!showAllThinking)}
              style={{ accentColor: '#ff8844' }}
            />
            <span style={{ fontSize: '11px', color: '#88aa88' }}>Show all creature thinking text</span>
          </label>
        </div>
      </div>
    </div>
  )
}
