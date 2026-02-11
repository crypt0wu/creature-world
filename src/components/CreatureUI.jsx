import { useState, useEffect } from 'react'
import SPECIES from '../creatures/species'

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const PANEL = {
  background: 'rgba(5, 10, 5, 0.85)',
  border: '1px solid rgba(80, 200, 120, 0.2)',
  borderRadius: '6px',
  padding: '14px',
  fontFamily: "'Courier New', monospace",
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
}

function StatBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: '#557755' }}>{label}</span>
        <span>{Math.round(value)}/{max}</span>
      </div>
      <div style={{
        height: '6px', background: 'rgba(0,0,0,0.5)',
        borderRadius: '3px', overflow: 'hidden', marginTop: '2px',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: color, borderRadius: '3px',
        }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <span style={{ color: '#557755' }}>{label}</span>
      <span style={{ color: color || '#88aa88' }}>{value}</span>
    </div>
  )
}

const SECTION = {
  marginBottom: '16px',
}

const SECTION_TITLE = {
  fontSize: '13px',
  color: '#66ff88',
  textTransform: 'uppercase',
  letterSpacing: '2px',
  marginBottom: '8px',
  paddingBottom: '4px',
  borderBottom: '1px solid rgba(80, 200, 120, 0.15)',
}

const HELP_TEXT = { fontSize: '13px', color: '#88aa88', lineHeight: '1.6' }
const HELP_KEY = { color: '#66ff88', fontWeight: 'bold' }
const HELP_DIM = { color: '#557755' }

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
          <span style={{ fontSize: '20px', color: '#66ff88', fontWeight: 'bold' }}>
            Creature World
          </span>
          <button onClick={onClose} style={{
            background: 'rgba(255, 100, 68, 0.1)',
            border: '1px solid rgba(255, 100, 68, 0.3)',
            color: '#cc6644', fontSize: '14px', padding: '4px 12px',
            borderRadius: '4px', cursor: 'pointer',
            fontFamily: "'Courier New', monospace",
          }}>
            ✕
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

        {/* Stats */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Stats</div>
          <div style={HELP_TEXT}>
            <span style={HELP_KEY}>HP</span> <span style={HELP_DIM}>—</span> Hit points. Reaches 0 = death<br />
            <span style={HELP_KEY}>Hunger</span> <span style={HELP_DIM}>—</span> Drains over time. At 0, creature starves (loses HP)<br />
            <span style={HELP_KEY}>Energy</span> <span style={HELP_DIM}>—</span> Drains over time. Low energy = tired, then sleep<br />
            <span style={HELP_KEY}>ATK / SPD</span> <span style={HELP_DIM}>—</span> Attack power and movement speed<br />
            <span style={HELP_KEY}>Level / XP</span> <span style={HELP_DIM}>—</span> Creatures level up, gaining HP and ATK
          </div>
        </div>

        {/* Hunger & Food */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Hunger & Food</div>
          <div style={HELP_TEXT}>
            Berry bushes <span style={HELP_DIM}>(glowing pink)</span> spawn across the world. When a creature gets hungry, it seeks the nearest bush and eats for 3 seconds, restoring 60 hunger.<br /><br />
            Consumed bushes respawn after 30–60 seconds at a new location. If hunger hits 0, the creature starves and loses 0.5 HP per second until it eats or dies.<br /><br />
            Personality affects hunger behavior — bold creatures eat sooner, lazy ones wait longer, and timid creatures avoid food if others are nearby.
          </div>
        </div>

        {/* Energy & Sleep */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Energy & Sleep</div>
          <div style={HELP_TEXT}>
            Energy drains over time, faster while moving. When energy drops below 25, a creature becomes <span style={{ color: '#44aaff' }}>tired</span> and moves slower (down to 50% speed at 0 energy).<br /><br />
            When energy is critically low, the creature falls <span style={{ color: '#6688cc' }}>asleep</span> — it stops moving, dims its glow, and shows floating "zZz" text. During sleep, energy regenerates at 4/s and HP regenerates at 0.5/s. Hunger does not drain while sleeping.<br /><br />
            <span style={HELP_KEY}>Personality affects sleep:</span> Lazy creatures sleep sooner (energy {'<'} 20) and longer (20–40s). Fierce creatures push through until energy {'<'} 3, then sleep briefly (10–20s). Others sleep at energy {'<'} 10 for 15–30s.<br /><br />
            <span style={{ color: '#ff6644' }}>Sleeping creatures are vulnerable</span> — they cannot move, eat, or seek food until they wake up.
          </div>
        </div>

        {/* Inventory */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Inventory</div>
          <div style={HELP_TEXT}>
            Creatures can carry up to 5 items. When a creature finishes eating at a berry bush, there's a chance it picks up an extra berry to store for later.<br /><br />
            When hunger drops below 40 and the creature has berries in inventory, it eats from inventory first — no need to seek food on the map. Each stored berry restores 60 hunger, same as eating at a bush.<br /><br />
            <span style={HELP_KEY}>Personality affects hoarding:</span> Sneaky creatures pick up food most often (55%), curious creatures are also natural hoarders (45%). Bold and fierce creatures never hoard — they eat everything immediately.
          </div>
        </div>

        {/* Status */}
        <div style={SECTION}>
          <div style={SECTION_TITLE}>Status</div>
          <div style={HELP_TEXT}>
            <span style={{ color: '#666' }}>IDLE</span> <span style={HELP_DIM}>—</span> Resting between wander targets<br />
            <span style={{ color: '#88aa88' }}>WANDERING</span> <span style={HELP_DIM}>—</span> Moving to a random point<br />
            <span style={{ color: '#ffcc44' }}>SEEKING FOOD</span> <span style={HELP_DIM}>—</span> Hungry and heading toward a berry bush<br />
            <span style={{ color: '#44ff88' }}>EATING</span> <span style={HELP_DIM}>—</span> Consuming food (3 seconds)<br />
            <span style={{ color: '#6688cc' }}>SLEEPING</span> <span style={HELP_DIM}>—</span> Resting to recover energy (vulnerable)<br />
            <span style={{ color: '#44aaff' }}>TIRED</span> <span style={HELP_DIM}>—</span> Low energy, moving slower<br />
            <span style={{ color: '#ffaa44' }}>HUNGRY</span> <span style={HELP_DIM}>—</span> Low hunger but no food targeted yet
          </div>
        </div>

        {/* UI Guide */}
        <div style={{ ...SECTION, marginBottom: 0 }}>
          <div style={SECTION_TITLE}>UI Guide</div>
          <div style={HELP_TEXT}>
            <span style={HELP_KEY}>Left panel</span> <span style={HELP_DIM}>—</span> Creature roster. Click to select.<br />
            <span style={HELP_KEY}>Right panel</span> <span style={HELP_DIM}>—</span> Activity log of creature events<br />
            <span style={HELP_KEY}>Bottom panel</span> <span style={HELP_DIM}>—</span> Full stats for selected creature<br />
            <span style={HELP_KEY}>Follow button</span> <span style={HELP_DIM}>—</span> Camera tracks the selected creature<br />
            <span style={HELP_KEY}>Hover</span> <span style={HELP_DIM}>—</span> Hover over anything for a tooltip<br />
            <span style={HELP_KEY}>Top left</span> <span style={HELP_DIM}>—</span> Simulation clock
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CreatureUI({
  creatures, selectedId, followingId,
  onSelect, onFollow,
  activityLog, worldClock, onReset,
}) {
  const selected = creatures.find(c => c.id === selectedId)
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
          <div style={{ fontSize: '11px', color: '#557755', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Simulation Time
          </div>
          <div style={{ fontSize: '22px', color: '#66ff88', fontWeight: 'bold', marginTop: '3px' }}>
            {formatTime(worldClock)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              ...PANEL,
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#88cc88',
              border: '1px solid rgba(80, 200, 120, 0.3)',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '8px 16px',
            }}
          >
            ?
          </button>
          <button
            onClick={() => setShowResetConfirm(true)}
            style={{
              ...PANEL,
              pointerEvents: 'auto',
              cursor: 'pointer',
              color: '#ff6644',
              border: '1px solid rgba(255, 100, 68, 0.3)',
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              padding: '10px 20px',
            }}
          >
            Reset World
          </button>
        </div>
      </div>

      {/* ── Left: creature roster ── */}
      <div style={{
        position: 'absolute', top: '70px', left: '12px',
        width: '240px', pointerEvents: 'auto',
      }}>
        <div style={PANEL}>
          <div style={LABEL}>Creatures</div>
          {creatures.map(c => {
            const spec = SPECIES[c.species]
            const hpPct = c.maxHp > 0 ? (c.hp / c.maxHp) * 100 : 0
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{
                  padding: '7px 10px',
                  marginBottom: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: selectedId === c.id ? 'rgba(80, 200, 120, 0.15)' : 'transparent',
                  borderLeft: `3px solid ${spec?.color || '#888'}`,
                  opacity: c.alive ? 1 : 0.4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: spec?.glow || '#aaa', fontSize: '14px', fontWeight: 'bold' }}>
                    {c.name}
                  </span>
                  <span style={{ color: '#556655', fontSize: '11px' }}>
                    Lv.{c.level}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <div style={{
                    flex: 1, height: '5px',
                    background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${hpPct}%`, height: '100%',
                      background: hpPct > 50 ? '#44ff44' : hpPct > 25 ? '#ffaa00' : '#ff4444',
                      borderRadius: '3px',
                    }} />
                  </div>
                  <span style={{
                    fontSize: '10px',
                    color: c.alive && c.state === 'sleeping' ? '#6688cc' : '#667766',
                    minWidth: '50px', textAlign: 'right',
                  }}>
                    {c.alive ? c.state : 'dead'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: activity log (toggleable) ── */}
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
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  ✕
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
                      fontSize: '12px', padding: '4px 0',
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
              ...PANEL,
              cursor: 'pointer',
              color: '#88cc88',
              border: '1px solid rgba(80, 200, 120, 0.3)',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '8px 14px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}
          >
            Log
          </button>
        )}
      </div>

      {/* ── Bottom: selected creature stats ── */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: '50px',
          left: '50%', transform: 'translateX(-50%)',
          pointerEvents: 'auto',
        }}>
          <div style={{ ...PANEL, width: '420px' }}>
            {/* Header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '10px', borderBottom: '1px solid rgba(80, 200, 120, 0.15)',
              paddingBottom: '8px',
            }}>
              <div>
                <span style={{
                  color: SPECIES[selected.species]?.glow || '#aaa',
                  fontSize: '18px', fontWeight: 'bold',
                }}>
                  {selected.name}
                </span>
                <span style={{ color: '#556655', fontSize: '13px', marginLeft: '10px' }}>
                  {selected.species} · {selected.type}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onFollow(followingId === selected.id ? null : selected.id)}
                  style={{
                    background: followingId === selected.id ? 'rgba(80, 200, 120, 0.3)' : 'rgba(80, 200, 120, 0.1)',
                    border: '1px solid rgba(80, 200, 120, 0.3)',
                    color: '#88cc88',
                    fontSize: '12px', padding: '5px 12px', borderRadius: '4px',
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                  }}
                >
                  {followingId === selected.id ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={() => { onSelect(null); onFollow(null) }}
                  style={{
                    background: 'rgba(255, 100, 68, 0.1)',
                    border: '1px solid rgba(255, 100, 68, 0.3)',
                    color: '#cc6644',
                    fontSize: '12px', padding: '5px 12px', borderRadius: '4px',
                    cursor: 'pointer', fontFamily: "'Courier New', monospace",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
              <StatBar label="HP" value={selected.hp} max={selected.maxHp} color="#44ff44" />
              <StatBar label="Hunger" value={selected.hunger} max={100} color="#ffaa44" />
              <StatBar
                label={selected.sleeping ? 'Energy (sleeping)' : 'Energy'}
                value={selected.energy} max={100}
                color={selected.sleeping ? '#6688cc' : '#44aaff'}
              />
              <StatRow label="ATK" value={selected.atk} />
              <StatRow label="SPD" value={selected.spd} />
              <StatRow label="Level" value={selected.level} />
              <StatRow label="XP" value={selected.xp} />
              <StatRow label="Kills" value={selected.kills} />
              <StatRow label="Personality" value={selected.personality} />
              <StatRow label="Age" value={formatTime(selected.age)} />
              <StatRow
                label="Status"
                value={selected.alive ? selected.state : 'DEAD'}
                color={selected.alive ? '#88aa88' : '#ff4444'}
              />
              <StatRow label="Species" value={`${selected.species} (${selected.type})`} />
            </div>

            {/* Inventory */}
            {selected.alive && (
              <div style={{
                marginTop: '10px', paddingTop: '8px',
                borderTop: '1px solid rgba(80, 200, 120, 0.15)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '6px',
                }}>
                  <span style={{ fontSize: '11px', color: '#557755', textTransform: 'uppercase', letterSpacing: '2px' }}>
                    Inventory
                  </span>
                  <span style={{ fontSize: '11px', color: '#557755' }}>
                    {selected.inventory?.length || 0}/5
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', position: 'relative' }}>
                  {[0, 1, 2, 3, 4].map(i => {
                    const item = selected.inventory?.[i]
                    return (
                      <div key={i}
                        onMouseEnter={() => item && setHoveredSlot(i)}
                        onMouseLeave={() => setHoveredSlot(null)}
                        style={{
                        width: '32px', height: '32px',
                        borderRadius: '4px',
                        border: item
                          ? '1px solid rgba(255, 100, 160, 0.5)'
                          : '1px solid rgba(80, 200, 120, 0.1)',
                        background: item
                          ? 'rgba(255, 68, 136, 0.08)'
                          : 'rgba(0, 0, 0, 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        cursor: item ? 'help' : 'default',
                      }}>
                        {item && (
                          <svg width="24" height="24" viewBox="0 0 24 24">
                            {/* Green bush base */}
                            <ellipse cx="12" cy="18" rx="9" ry="5" fill="#1a4a1a" />
                            <ellipse cx="12" cy="17" rx="8" ry="4.5" fill="#1e5a1e" />
                            {/* Bush leaf bumps */}
                            <circle cx="7" cy="16" r="3.5" fill="#1a4a1a" />
                            <circle cx="17" cy="16" r="3.5" fill="#1a4a1a" />
                            <circle cx="12" cy="14" r="4" fill="#1e5a1e" />
                            {/* Berries on top — bright pink/red matching 3D food */}
                            <circle cx="10" cy="10" r="3" fill="#ff4488" />
                            <circle cx="10" cy="10" r="1.5" fill="#ff6699" opacity="0.6" />
                            <circle cx="15" cy="11" r="2.5" fill="#ff5588" />
                            <circle cx="15" cy="11" r="1.2" fill="#ff77aa" opacity="0.5" />
                            <circle cx="12" cy="7" r="2.2" fill="#ff4488" />
                            <circle cx="12" cy="7" r="1" fill="#ff6699" opacity="0.6" />
                            {/* Berry glow */}
                            <circle cx="12" cy="9" r="6" fill="#ff2266" opacity="0.1" />
                          </svg>
                        )}
                        {/* Tooltip */}
                        {item && hoveredSlot === i && (
                          <div style={{
                            position: 'absolute',
                            bottom: '38px', left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(5, 10, 5, 0.95)',
                            border: '1px solid rgba(80, 200, 120, 0.3)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            fontFamily: "'Courier New', monospace",
                            fontSize: '11px',
                            whiteSpace: 'nowrap',
                            zIndex: 60,
                            pointerEvents: 'none',
                            backdropFilter: 'blur(4px)',
                          }}>
                            <div style={{ color: '#ff6699', fontWeight: 'bold', marginBottom: '2px' }}>
                              Wild Berry
                            </div>
                            <div style={{ color: '#88aa88' }}>
                              Restores 60 hunger when eaten
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div onClick={() => setShowResetConfirm(false)} style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'auto',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            ...PANEL,
            width: '360px',
            padding: '24px',
            border: '1px solid rgba(255, 100, 68, 0.4)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '16px', color: '#ff6644', fontWeight: 'bold',
              marginBottom: '12px',
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
                  fontSize: '13px', padding: '8px 20px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: "'Courier New', monospace",
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
                  fontSize: '13px', padding: '8px 20px', borderRadius: '4px',
                  cursor: 'pointer', fontFamily: "'Courier New', monospace",
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
