import { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

// Agent definitions matching Agentic Labs
const AGENTS = [
  { id: "scout", name: "SCOUT", role: "Research & Discovery", color: "#00ff88", x: -3.5, z: -1, height: 4.5 },
  { id: "wordsmith", name: "WORDSMITH", role: "Content & Copy", color: "#ff00ff", x: -1.5, z: 0.5, height: 6 },
  { id: "vanguard", name: "VANGUARD", role: "Strategy & Planning", color: "#00ddff", x: 0.5, z: -1.5, height: 7.5 },
  { id: "nova", name: "NOVA", role: "Lead Coordinator", color: "#ffdd00", x: 2.5, z: 0, height: 5.5 },
  { id: "cipher", name: "CIPHER", role: "Code & Engineering", color: "#ff4444", x: 4.5, z: -0.5, height: 5 },
  { id: "sentinel", name: "SENTINEL", role: "QA & Validation", color: "#8855ff", x: 1, z: 2, height: 4 },
];

const STATUSES = ["IDLE", "THINKING...", "EXECUTING", "IDLE", "IDLE", "THINKING..."];

// Simulated log messages
const LOG_MESSAGES = [
  { time: "12:02:51", agent: "SYS", msg: "Heartbeat: ok-token", color: "#444" },
  { time: "12:02:51", agent: "SCOUT", msg: "Finished research sweep", color: "#00ff88" },
  { time: "12:02:48", agent: "SCOUT", msg: "Started thinking...", color: "#00ff88" },
  { time: "12:02:33", agent: "SYS", msg: "Heartbeat: ok-token", color: "#444" },
  { time: "12:02:31", agent: "VANGUARD", msg: "Finished", color: "#00ddff" },
  { time: "12:02:31", agent: "VANGUARD", msg: "Started thinking...", color: "#00ddff" },
  { time: "12:02:28", agent: "SYS", msg: "Heartbeat: ok-token", color: "#444" },
  { time: "12:02:28", agent: "NOVA", msg: "Finished evaluation", color: "#ffdd00" },
  { time: "12:02:15", agent: "NOVA", msg: "Started thinking...", color: "#ffdd00" },
  { time: "12:02:13", agent: "SYS", msg: "6 agent(s) online", color: "#444" },
  { time: "12:02:13", agent: "SYS", msg: "Connected to gateway", color: "#444" },
  { time: "12:02:10", agent: "WORDSMITH", msg: "Started thinking...", color: "#ff00ff" },
  { time: "12:02:08", agent: "CIPHER", msg: "Finished", color: "#ff4444" },
  { time: "12:02:05", agent: "CIPHER", msg: "Started thinking...", color: "#ff4444" },
  { time: "12:01:58", agent: "SYS", msg: "Chat message delivered", color: "#444" },
  { time: "12:01:55", agent: "SENTINEL", msg: "Finished validation", color: "#8855ff" },
  { time: "12:01:52", agent: "SENTINEL", msg: "Started thinking...", color: "#8855ff" },
  { time: "12:01:48", agent: "WORDSMITH", msg: "Finished draft", color: "#ff00ff" },
  { time: "12:01:45", agent: "SYS", msg: "Heartbeat: ok-token", color: "#444" },
  { time: "12:01:40", agent: "SCOUT", msg: "Signal detected: market shift", color: "#00ff88" },
  { time: "12:01:38", agent: "VANGUARD", msg: "Pipeline update: stage 2", color: "#00ddff" },
  { time: "12:01:35", agent: "SYS", msg: "Chat message delivered", color: "#444" },
  { time: "12:01:30", agent: "NOVA", msg: "Approved idea: SlabFi v2", color: "#ffdd00" },
  { time: "12:01:28", agent: "CIPHER", msg: "Build artifact ready", color: "#ff4444" },
];

const NEW_MESSAGES = [
  { agent: "SCOUT", msg: "Scanning PokemonPriceTracker...", color: "#00ff88" },
  { agent: "SCOUT", msg: "Found 3 new price anomalies", color: "#00ff88" },
  { agent: "WORDSMITH", msg: "Drafting caption for PSA 10 Zard", color: "#ff00ff" },
  { agent: "NOVA", msg: "Reviewing Scout's findings...", color: "#ffdd00" },
  { agent: "VANGUARD", msg: "Updating pipeline scores", color: "#00ddff" },
  { agent: "SYS", msg: "Heartbeat: ok-token", color: "#444" },
  { agent: "CIPHER", msg: "Generating post image...", color: "#ff4444" },
  { agent: "SENTINEL", msg: "Validating data accuracy", color: "#8855ff" },
  { agent: "NOVA", msg: "Approved: post to @slabfi", color: "#ffdd00" },
  { agent: "SYS", msg: "Chat message delivered", color: "#444" },
  { agent: "SCOUT", msg: "New listing: Base Set Zard PSA 9", color: "#00ff88" },
  { agent: "WORDSMITH", msg: "Finished caption generation", color: "#ff00ff" },
  { agent: "VANGUARD", msg: "Strategy update complete", color: "#00ddff" },
  { agent: "CIPHER", msg: "Image rendered: 1080x1080", color: "#ff4444" },
  { agent: "SENTINEL", msg: "QA passed: ready to post", color: "#8855ff" },
];

export default function CyberpunkCity() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const buildingsRef = useRef([]);
  const particlesRef = useRef(null);
  const glowsRef = useRef([]);
  const connectionsRef = useRef([]);
  const frameRef = useRef(0);
  const [logs, setLogs] = useState(LOG_MESSAGES);
  const [agentStatuses, setAgentStatuses] = useState(STATUSES);
  const [clock, setClock] = useState("12:02:52");

  // Clock
  useEffect(() => {
    const now = new Date();
    const update = () => {
      const n = new Date();
      setClock(n.toLocaleTimeString("en-US", { hour12: false }));
    };
    update();
    const i = setInterval(update, 1000);
    return () => clearInterval(i);
  }, []);

  // Simulate new logs
  useEffect(() => {
    let idx = 0;
    const i = setInterval(() => {
      const msg = NEW_MESSAGES[idx % NEW_MESSAGES.length];
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour12: false });
      setLogs(prev => [{ time, ...msg }, ...prev].slice(0, 28));

      // Randomize statuses
      setAgentStatuses(prev => {
        const next = [...prev];
        const r = Math.floor(Math.random() * 6);
        next[r] = ["IDLE", "THINKING...", "EXECUTING", "FINISHED"][Math.floor(Math.random() * 4)];
        return next;
      });

      idx++;
    }, 2800);
    return () => clearInterval(i);
  }, []);

  // Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.04);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050510);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Grid floor
    const gridGeo = new THREE.PlaneGeometry(40, 40, 40, 40);
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.06 });
    const grid = new THREE.Mesh(gridGeo, gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -0.5;
    scene.add(grid);

    // Second grid layer
    const grid2Geo = new THREE.PlaneGeometry(40, 40, 80, 80);
    const grid2Mat = new THREE.MeshBasicMaterial({ color: 0x00ddff, wireframe: true, transparent: true, opacity: 0.02 });
    const grid2 = new THREE.Mesh(grid2Geo, grid2Mat);
    grid2.rotation.x = -Math.PI / 2;
    grid2.position.y = -0.48;
    scene.add(grid2);

    // Ambient light
    scene.add(new THREE.AmbientLight(0x111122, 0.5));

    // Agent buildings
    const buildings = [];
    const glows = [];
    AGENTS.forEach((agent, i) => {
      // Main building
      const geo = new THREE.BoxGeometry(1.2, agent.height, 1.2);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(agent.color).multiplyScalar(0.15),
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(agent.x, agent.height / 2 - 0.5, agent.z);
      scene.add(mesh);

      // Wireframe overlay
      const wireMat = new THREE.MeshBasicMaterial({
        color: agent.color,
        wireframe: true,
        transparent: true,
        opacity: 0.3,
      });
      const wire = new THREE.Mesh(geo, wireMat);
      wire.position.copy(mesh.position);
      scene.add(wire);

      // Top glow sphere
      const glowGeo = new THREE.SphereGeometry(0.25, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: agent.color,
        transparent: true,
        opacity: 0.8,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(agent.x, agent.height - 0.2, agent.z);
      scene.add(glow);
      glows.push(glow);

      // Antenna line on top
      const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 1, 4);
      const antennaMat = new THREE.MeshBasicMaterial({ color: agent.color, transparent: true, opacity: 0.5 });
      const antenna = new THREE.Mesh(antennaGeo, antennaMat);
      antenna.position.set(agent.x, agent.height + 0.3, agent.z);
      scene.add(antenna);

      buildings.push({ mesh, wire, glow, antenna, agent });
    });
    buildingsRef.current = buildings;
    glowsRef.current = glows;

    // Background buildings (decoration)
    for (let i = 0; i < 30; i++) {
      const bh = Math.random() * 6 + 1;
      const bw = Math.random() * 0.8 + 0.3;
      const geo = new THREE.BoxGeometry(bw, bh, bw);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x0a0a1a,
        transparent: true,
        opacity: 0.7,
      });
      const m = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 10;
      m.position.set(Math.cos(angle) * dist, bh / 2 - 0.5, Math.sin(angle) * dist);
      scene.add(m);

      // Faint wireframe
      const wm = new THREE.MeshBasicMaterial({
        color: [0x00ff88, 0xff00ff, 0x00ddff, 0xffdd00][Math.floor(Math.random() * 4)],
        wireframe: true,
        transparent: true,
        opacity: 0.05,
      });
      const wMesh = new THREE.Mesh(geo, wm);
      wMesh.position.copy(m.position);
      scene.add(wMesh);

      // Random window lights
      if (Math.random() > 0.5) {
        const windowGeo = new THREE.BoxGeometry(bw * 0.15, 0.1, bw + 0.02);
        const windowMat = new THREE.MeshBasicMaterial({
          color: [0x00ff88, 0xff00ff, 0x00ddff][Math.floor(Math.random() * 3)],
          transparent: true,
          opacity: Math.random() * 0.3 + 0.1,
        });
        for (let wy = 0; wy < bh - 1; wy += 0.8) {
          if (Math.random() > 0.6) {
            const wnd = new THREE.Mesh(windowGeo, windowMat);
            wnd.position.set(m.position.x, wy + 0.5, m.position.z);
            scene.add(wnd);
          }
        }
      }
    }

    // Floating particles
    const pCount = 200;
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pColors = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 30;
      pPositions[i * 3 + 1] = Math.random() * 12;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      const c = new THREE.Color([0x00ff88, 0xff00ff, 0x00ddff, 0xffdd00, 0xff4444][Math.floor(Math.random() * 5)]);
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pColors, 3));
    const pMat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.6 });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);
    particlesRef.current = points;

    // Connection lines between agents
    const connections = [];
    for (let i = 0; i < AGENTS.length; i++) {
      for (let j = i + 1; j < AGENTS.length; j++) {
        if (Math.random() > 0.4) {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(AGENTS[i].x, AGENTS[i].height * 0.6, AGENTS[i].z),
            new THREE.Vector3(AGENTS[j].x, AGENTS[j].height * 0.6, AGENTS[j].z),
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: AGENTS[i].color,
            transparent: true,
            opacity: 0.0,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          scene.add(line);
          connections.push({ line, mat: lineMat, from: i, to: j });
        }
      }
    }
    connectionsRef.current = connections;

    // Animation
    let animFrame;
    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      frameRef.current++;
      const t = frameRef.current * 0.01;

      // Slow camera orbit
      camera.position.x = Math.sin(t * 0.15) * 2;
      camera.position.z = 14 + Math.sin(t * 0.1) * 2;
      camera.lookAt(0, 2.5, 0);

      // Pulse glows
      glows.forEach((g, i) => {
        g.scale.setScalar(1 + Math.sin(t * 2 + i * 1.5) * 0.3);
        g.material.opacity = 0.5 + Math.sin(t * 3 + i) * 0.3;
      });

      // Pulse connections
      connections.forEach((c, i) => {
        const pulse = Math.sin(t * 2 + i * 2);
        c.mat.opacity = pulse > 0.7 ? (pulse - 0.7) * 2 : 0;
      });

      // Float particles
      const pos = points.geometry.attributes.position;
      for (let i = 0; i < pCount; i++) {
        pos.array[i * 3 + 1] += Math.sin(t + i) * 0.003;
        if (pos.array[i * 3 + 1] > 12) pos.array[i * 3 + 1] = 0;
      }
      pos.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      const nw = mountRef.current?.clientWidth || w;
      const nh = mountRef.current?.clientHeight || h;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", onResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{
      width: "100%", height: "100vh", background: "#050510",
      fontFamily: "'Courier New', monospace", color: "#00ff88",
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 20px", borderBottom: "1px solid rgba(0,255,136,0.1)",
        zIndex: 10, position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#00ff88", fontSize: 22, fontWeight: "bold", letterSpacing: 2 }}>
            {clock}
          </span>
          <span style={{ color: "#00ff88", fontSize: 10, opacity: 0.5, letterSpacing: 3, textTransform: "uppercase" }}>
            Agentic Labs // Neural Grid
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 8px #00ff88" }} />
          <span style={{ fontSize: 10, letterSpacing: 2, color: "#00ff88" }}>ONLINE</span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {/* 3D Scene */}
        <div ref={mountRef} style={{ flex: 1, position: "relative" }} />

        {/* Activity Log */}
        <div style={{
          width: 320, padding: "12px 16px",
          borderLeft: "1px solid rgba(0,255,136,0.08)",
          overflowY: "auto", zIndex: 10, position: "relative",
          background: "rgba(5,5,16,0.85)",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#444", marginBottom: 12, textTransform: "uppercase" }}>
            Activity Log
          </div>
          {logs.map((log, i) => (
            <div key={i} style={{
              fontSize: 10, lineHeight: 1.6, opacity: i < 3 ? 1 : 0.4 + (1 - i / logs.length) * 0.5,
              borderLeft: `2px solid ${log.color}22`,
              paddingLeft: 8,
              marginBottom: 2,
            }}>
              <span style={{ color: "#333" }}>{log.time} </span>
              <span style={{ color: log.color, fontWeight: "bold" }}>{log.agent}</span>
              <span style={{ color: "#555" }}> {log.msg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agent Status Bar */}
      <div style={{
        display: "flex", justifyContent: "center", gap: 4,
        padding: "10px 20px", borderTop: "1px solid rgba(0,255,136,0.1)",
        zIndex: 10, position: "relative",
        background: "rgba(5,5,16,0.9)",
      }}>
        {AGENTS.map((agent, i) => {
          const status = agentStatuses[i];
          const isActive = status === "THINKING..." || status === "EXECUTING";
          return (
            <div key={agent.id} style={{
              flex: 1, maxWidth: 160,
              padding: "8px 12px",
              border: `1px solid ${agent.color}${isActive ? "44" : "18"}`,
              borderRadius: 4,
              background: isActive ? `${agent.color}08` : "transparent",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 11, fontWeight: "bold", color: agent.color,
                letterSpacing: 2, marginBottom: 2,
              }}>
                {agent.name}
              </div>
              <div style={{
                fontSize: 8, color: isActive ? agent.color : "#333",
                letterSpacing: 1,
              }}>
                {status}
              </div>
              {/* Activity bar */}
              <div style={{
                marginTop: 4, height: 2, borderRadius: 1,
                background: `${agent.color}15`,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: 1,
                  background: agent.color,
                  width: isActive ? "70%" : "20%",
                  opacity: isActive ? 0.8 : 0.2,
                  transition: "all 0.5s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
