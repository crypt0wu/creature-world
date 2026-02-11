import { useState, useEffect, useRef, useCallback } from "react";

// ============================================
// CREATURE TYPES & TRAITS
// ============================================
const SPECIES = [
  { name: "Embrix", type: "fire", emoji: "🔥", baseColor: "#ff4422", bgColor: "#ff442215", traits: "aggressive, fast", baseHP: 120, baseATK: 14, baseSPD: 8 },
  { name: "Aqualis", type: "water", emoji: "💧", baseColor: "#22aaff", bgColor: "#22aaff15", traits: "calm, defensive", baseHP: 140, baseATK: 10, baseSPD: 5 },
  { name: "Verdox", type: "grass", emoji: "🌿", baseColor: "#44dd44", bgColor: "#44dd4415", traits: "passive, healer", baseHP: 110, baseATK: 8, baseSPD: 6 },
  { name: "Voltik", type: "electric", emoji: "⚡", baseColor: "#ffdd00", bgColor: "#ffdd0015", traits: "erratic, fast", baseHP: 90, baseATK: 16, baseSPD: 10 },
  { name: "Shadeyn", type: "dark", emoji: "🌑", baseColor: "#8855ff", bgColor: "#8855ff15", traits: "stealthy, cunning", baseHP: 100, baseATK: 13, baseSPD: 9 },
  { name: "Glacira", type: "ice", emoji: "❄️", baseColor: "#88ddff", bgColor: "#88ddff15", traits: "slow, powerful", baseHP: 150, baseATK: 12, baseSPD: 3 },
];

const PERSONALITIES = ["bold", "timid", "curious", "lazy", "fierce", "gentle", "sneaky", "loyal"];
const NAMES_PREFIX = ["Shadow", "Storm", "Crystal", "Blaze", "Frost", "Vine", "Spark", "Dusk", "Luna", "Rex", "Zen", "Nyx", "Ash", "Coral", "Thorn"];
const NAMES_SUFFIX = ["fang", "claw", "wing", "tail", "eye", "heart", "scale", "horn", "bite", "flux"];

function randomName() {
  return NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)] +
    NAMES_SUFFIX[Math.floor(Math.random() * NAMES_SUFFIX.length)];
}

function createCreature(id, worldW, worldH) {
  const species = SPECIES[Math.floor(Math.random() * SPECIES.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const level = Math.floor(Math.random() * 5) + 1;
  return {
    id,
    name: randomName(),
    species,
    personality,
    level,
    xp: 0,
    hp: species.baseHP + level * 5,
    maxHp: species.baseHP + level * 5,
    atk: species.baseATK + level * 2,
    spd: species.baseSPD + Math.random() * 3,
    hunger: 70 + Math.random() * 30,
    energy: 60 + Math.random() * 40,
    x: 50 + Math.random() * (worldW - 100),
    y: 50 + Math.random() * (worldH - 100),
    targetX: null,
    targetY: null,
    state: "idle", // idle, wandering, hunting, fighting, eating, sleeping, dead
    stateTimer: 0,
    alive: true,
    kills: 0,
    age: 0, // in ticks
    fightTarget: null,
    fightCooldown: 0,
    size: 18 + level * 2,
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

// ============================================
// WORLD CONFIG
// ============================================
const WORLD_W = 800;
const WORLD_H = 500;
const NUM_CREATURES = 12;
const TICK_MS = 80;
const FOOD_SPOTS = Array.from({ length: 8 }, () => ({
  x: 40 + Math.random() * (WORLD_W - 80),
  y: 40 + Math.random() * (WORLD_H - 80),
  amount: 50 + Math.random() * 50,
}));

// ============================================
// MAIN COMPONENT
// ============================================
export default function CreatureWorld() {
  const canvasRef = useRef(null);
  const creaturesRef = useRef([]);
  const logsRef = useRef([]);
  const tickRef = useRef(0);
  const [logs, setLogs] = useState([]);
  const [creatures, setCreatures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [worldTime, setWorldTime] = useState(0);
  const [paused, setPaused] = useState(false);

  // Initialize creatures
  useEffect(() => {
    const initial = Array.from({ length: NUM_CREATURES }, (_, i) =>
      createCreature(i, WORLD_W, WORLD_H)
    );
    creaturesRef.current = initial;
    setCreatures([...initial]);
  }, []);

  const addLog = useCallback((msg, color = "#555") => {
    const entry = { msg, color, tick: tickRef.current };
    logsRef.current = [entry, ...logsRef.current].slice(0, 50);
    setLogs([...logsRef.current]);
  }, []);

  // Distance helper
  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // ============================================
  // SIMULATION LOOP
  // ============================================
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      tickRef.current++;
      const tick = tickRef.current;
      const cs = creaturesRef.current;
      const alive = cs.filter(c => c.alive);

      alive.forEach(c => {
        c.age++;
        c.pulsePhase += 0.1;
        c.hunger = Math.max(0, c.hunger - 0.08);
        c.energy = Math.max(0, c.energy - 0.03);
        if (c.fightCooldown > 0) c.fightCooldown--;

        // Starvation
        if (c.hunger <= 0) {
          c.hp -= 0.5;
          if (c.hp <= 0) {
            c.alive = false;
            c.state = "dead";
            addLog(`💀 ${c.name} (${c.species.name}) starved to death!`, c.species.baseColor);
          }
        }

        // State machine
        if (!c.alive) return;

        c.stateTimer--;

        if (c.state === "idle" && c.stateTimer <= 0) {
          // Decide what to do
          if (c.hunger < 30) {
            // Find food
            const nearest = FOOD_SPOTS.reduce((best, f) =>
              dist(c, f) < dist(c, best) ? f : best
            );
            c.targetX = nearest.x + (Math.random() - 0.5) * 20;
            c.targetY = nearest.y + (Math.random() - 0.5) * 20;
            c.state = "hunting";
            c.stateTimer = 200;
          } else if (c.energy < 20) {
            c.state = "sleeping";
            c.stateTimer = 60 + Math.floor(Math.random() * 40);
            addLog(`😴 ${c.name} fell asleep`, c.species.baseColor);
          } else if (c.personality === "fierce" || c.personality === "bold") {
            // Look for a fight
            const target = alive.find(o =>
              o.id !== c.id && dist(c, o) < 150 && o.fightCooldown <= 0 && c.fightCooldown <= 0
            );
            if (target) {
              c.fightTarget = target.id;
              c.state = "fighting";
              c.stateTimer = 30;
              target.fightTarget = c.id;
              target.state = "fighting";
              target.stateTimer = 30;
              addLog(`⚔️ ${c.name} attacks ${target.name}!`, "#ff4444");
            } else {
              c.targetX = 30 + Math.random() * (WORLD_W - 60);
              c.targetY = 30 + Math.random() * (WORLD_H - 60);
              c.state = "wandering";
              c.stateTimer = 80 + Math.floor(Math.random() * 60);
            }
          } else {
            c.targetX = 30 + Math.random() * (WORLD_W - 60);
            c.targetY = 30 + Math.random() * (WORLD_H - 60);
            c.state = "wandering";
            c.stateTimer = 80 + Math.floor(Math.random() * 60);
          }
        }

        // Movement
        if ((c.state === "wandering" || c.state === "hunting") && c.targetX != null) {
          const dx = c.targetX - c.x;
          const dy = c.targetY - c.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 3) {
            const speed = c.spd * 0.4;
            c.x += (dx / d) * speed;
            c.y += (dy / d) * speed;
          } else {
            if (c.state === "hunting") {
              c.state = "eating";
              c.stateTimer = 30;
              c.hunger = Math.min(100, c.hunger + 40);
              addLog(`🍖 ${c.name} found food!`, c.species.baseColor);
            } else {
              c.state = "idle";
              c.stateTimer = 10 + Math.floor(Math.random() * 30);
            }
          }
        }

        // Fighting
        if (c.state === "fighting") {
          const target = cs.find(o => o.id === c.fightTarget);
          if (target && target.alive) {
            // Move toward target
            const dx = target.x - c.x;
            const dy = target.y - c.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 20) {
              c.x += (dx / d) * c.spd * 0.5;
              c.y += (dy / d) * c.spd * 0.5;
            }
            // Deal damage on timer
            if (c.stateTimer % 8 === 0) {
              const dmg = c.atk * (0.7 + Math.random() * 0.6);
              target.hp -= dmg;
              if (target.hp <= 0) {
                target.alive = false;
                target.state = "dead";
                c.kills++;
                c.xp += 20;
                c.state = "idle";
                c.stateTimer = 20;
                c.fightCooldown = 50;
                c.fightTarget = null;
                // Level up check
                if (c.xp >= c.level * 30) {
                  c.level++;
                  c.xp = 0;
                  c.maxHp += 10;
                  c.hp = Math.min(c.hp + 20, c.maxHp);
                  c.atk += 2;
                  c.size += 2;
                  addLog(`⬆️ ${c.name} leveled up to Lv.${c.level}!`, "#ffdd00");
                }
                addLog(`☠️ ${c.name} defeated ${target.name}!`, "#ff4444");
              }
            }
          } else {
            c.state = "idle";
            c.stateTimer = 15;
            c.fightTarget = null;
            c.fightCooldown = 30;
          }
        }

        // Sleeping
        if (c.state === "sleeping") {
          c.energy = Math.min(100, c.energy + 0.5);
          c.hp = Math.min(c.maxHp, c.hp + 0.2);
          if (c.stateTimer <= 0) {
            c.state = "idle";
            c.stateTimer = 10;
            addLog(`💤 ${c.name} woke up`, c.species.baseColor);
          }
        }

        // Eating
        if (c.state === "eating" && c.stateTimer <= 0) {
          c.state = "idle";
          c.stateTimer = 15;
        }

        // Random encounters
        if (tick % 100 === 0 && Math.random() > 0.7 && c.state === "wandering") {
          const nearby = alive.find(o =>
            o.id !== c.id && dist(c, o) < 80 && o.state !== "fighting" && c.fightCooldown <= 0
          );
          if (nearby && (c.personality === "fierce" || Math.random() > 0.6)) {
            c.fightTarget = nearby.id;
            c.state = "fighting";
            c.stateTimer = 30;
            nearby.fightTarget = c.id;
            nearby.state = "fighting";
            nearby.stateTimer = 30;
            addLog(`💥 Wild encounter! ${c.name} vs ${nearby.name}!`, "#ff8800");
          }
        }

        // Bounds
        c.x = Math.max(15, Math.min(WORLD_W - 15, c.x));
        c.y = Math.max(15, Math.min(WORLD_H - 15, c.y));
      });

      creaturesRef.current = cs;
      setCreatures([...cs]);
      setWorldTime(tick);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [paused, addLog]);

  // ============================================
  // CANVAS RENDERING
  // ============================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD_W * dpr;
    canvas.height = WORLD_H * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = "#0a0a10";
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
    }
    for (let y = 0; y < WORLD_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
    }

    // Food spots
    FOOD_SPOTS.forEach(f => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68,221,68,0.08)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(68,221,68,0.3)";
      ctx.fill();
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(68,221,68,0.2)";
      ctx.fillText("🌿", f.x - 5, f.y + 4);
    });

    // Creatures
    creatures.forEach(c => {
      if (!c.alive) {
        // Dead marker
        ctx.font = "12px monospace";
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillText("💀", c.x - 6, c.y + 4);
        return;
      }

      const pulse = Math.sin(c.pulsePhase) * 0.3 + 1;
      const isSelected = selected?.id === c.id;
      const isFighting = c.state === "fighting";

      // Glow
      const glowRadius = (c.size + 8) * pulse;
      const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, glowRadius);
      glow.addColorStop(0, c.species.baseColor + (isFighting ? "40" : "20"));
      glow.addColorStop(1, c.species.baseColor + "00");
      ctx.beginPath();
      ctx.arc(c.x, c.y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Fight flash
      if (isFighting && Math.sin(c.pulsePhase * 3) > 0) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size + 15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,68,68,0.1)";
        ctx.fill();
      }

      // Body
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * 0.5 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = c.species.baseColor + "cc";
      ctx.fill();

      // Inner
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = c.species.baseColor;
      ctx.fill();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 0.7 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      // Name label
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = isSelected ? "#fff" : c.species.baseColor + "aa";
      ctx.fillText(c.name, c.x, c.y - c.size * 0.5 - 8);

      // HP bar
      const barW = 24;
      const barH = 3;
      const barX = c.x - barW / 2;
      const barY = c.y - c.size * 0.5 - 5;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(barX, barY, barW, barH);
      const hpPct = c.hp / c.maxHp;
      ctx.fillStyle = hpPct > 0.5 ? "#44dd44" : hpPct > 0.2 ? "#ffaa00" : "#ff4444";
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      // State indicator
      if (c.state === "sleeping") {
        ctx.font = "10px monospace";
        ctx.fillText("💤", c.x + c.size * 0.4, c.y - c.size * 0.3);
      } else if (c.state === "eating") {
        ctx.font = "10px monospace";
        ctx.fillText("🍖", c.x + c.size * 0.4, c.y - c.size * 0.3);
      } else if (c.state === "fighting") {
        ctx.font = "10px monospace";
        ctx.fillText("⚔️", c.x + c.size * 0.4, c.y - c.size * 0.3);
      }

      ctx.textAlign = "start";
    });

    // Fight lines
    creatures.filter(c => c.alive && c.state === "fighting" && c.fightTarget != null).forEach(c => {
      const target = creatures.find(o => o.id === c.fightTarget);
      if (target && target.alive) {
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = "rgba(255,68,68,0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }
    });

  }, [creatures, selected]);

  // Click handler
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = WORLD_W / rect.width;
    const scaleY = WORLD_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const clicked = creatures.find(c => c.alive && Math.sqrt((c.x - mx) ** 2 + (c.y - my) ** 2) < c.size);
    setSelected(clicked || null);
  };

  const aliveCount = creatures.filter(c => c.alive).length;
  const deadCount = creatures.filter(c => !c.alive).length;
  const formatTime = (ticks) => {
    const secs = Math.floor(ticks * TICK_MS / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#06060c",
      fontFamily: "'Courier New', monospace", color: "#ccc",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,10,16,0.95)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: "bold", letterSpacing: 3, color: "#fff" }}>
            CREATURE WORLD
          </span>
          <span style={{ fontSize: 9, color: "#333", letterSpacing: 2 }}>AUTONOMOUS SIMULATION</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10 }}>
          <span style={{ color: "#44dd44" }}>● ALIVE: {aliveCount}</span>
          <span style={{ color: "#ff4444" }}>● DEAD: {deadCount}</span>
          <span style={{ color: "#555" }}>⏱ {formatTime(worldTime)}</span>
          <button onClick={() => setPaused(!paused)} style={{
            background: paused ? "#44dd4420" : "#ff444420",
            border: `1px solid ${paused ? "#44dd4444" : "#ff444444"}`,
            color: paused ? "#44dd44" : "#ff4444",
            padding: "3px 10px", borderRadius: 3, cursor: "pointer",
            fontFamily: "monospace", fontSize: 10, letterSpacing: 1,
          }}>
            {paused ? "▶ RESUME" : "⏸ PAUSE"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* World Canvas */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 8 }}>
          <canvas
            ref={canvasRef}
            width={WORLD_W}
            height={WORLD_H}
            onClick={handleCanvasClick}
            style={{
              width: "100%", flex: 1, borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.06)",
              cursor: "crosshair", objectFit: "contain",
            }}
          />
          {/* Creature roster */}
          <div style={{
            display: "flex", gap: 3, padding: "8px 0", overflowX: "auto",
            flexWrap: "wrap",
          }}>
            {creatures.map(c => (
              <div
                key={c.id}
                onClick={() => setSelected(c.alive ? c : null)}
                style={{
                  padding: "4px 8px", borderRadius: 4, cursor: c.alive ? "pointer" : "default",
                  border: `1px solid ${c.alive ? c.species.baseColor + "30" : "#222"}`,
                  background: selected?.id === c.id ? c.species.baseColor + "15" : "transparent",
                  opacity: c.alive ? 1 : 0.3, fontSize: 9,
                  display: "flex", alignItems: "center", gap: 4,
                  minWidth: 0, whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: c.species.baseColor }}>{c.species.emoji}</span>
                <span style={{ color: c.alive ? "#aaa" : "#444" }}>{c.name}</span>
                <span style={{ color: "#333" }}>Lv.{c.level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{
          width: 280, display: "flex", flexDirection: "column",
          borderLeft: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(10,10,16,0.9)",
        }}>
          {/* Selected creature info */}
          {selected && selected.alive ? (
            <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{selected.species.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: selected.species.baseColor }}>
                    {selected.name}
                  </div>
                  <div style={{ fontSize: 9, color: "#555" }}>
                    {selected.species.name} · {selected.personality} · Lv.{selected.level}
                  </div>
                </div>
              </div>
              {/* Stats */}
              {[
                { label: "HP", value: selected.hp, max: selected.maxHp, color: "#44dd44" },
                { label: "HGR", value: selected.hunger, max: 100, color: "#ffaa00" },
                { label: "NRG", value: selected.energy, max: 100, color: "#22aaff" },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444", marginBottom: 2 }}>
                    <span>{s.label}</span>
                    <span>{Math.round(s.value)}/{s.max}</span>
                  </div>
                  <div style={{ height: 4, background: "#111", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${(s.value / s.max) * 100}%`,
                      background: s.color, borderRadius: 2,
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 9, color: "#444" }}>
                <span>ATK: {selected.atk}</span>
                <span>SPD: {selected.spd.toFixed(1)}</span>
                <span>Kills: {selected.kills}</span>
              </div>
              <div style={{
                marginTop: 6, fontSize: 9, color: "#333",
                padding: "4px 6px", background: "rgba(255,255,255,0.02)", borderRadius: 3,
              }}>
                State: <span style={{ color: selected.species.baseColor }}>{selected.state.toUpperCase()}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#333", fontSize: 10 }}>
              Click a creature to inspect
            </div>
          )}

          {/* Activity Log */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{
              fontSize: 9, letterSpacing: 3, color: "#333", padding: "8px 12px",
              textTransform: "uppercase", borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              Activity Feed
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 12px" }}>
              {logs.map((log, i) => (
                <div key={i} style={{
                  fontSize: 10, lineHeight: 1.7,
                  opacity: i < 3 ? 1 : 0.3 + (1 - i / logs.length) * 0.5,
                  color: "#555",
                }}>
                  <span style={{ color: log.color }}>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
