// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { OctagonX, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { ARENAS, RobotSim, type Arena, type Obstacle } from "@roboforge/ir";
import { useAnalysis, useBasePath } from "@/lib/store";

const SPEEDS = [1, 2, 4];

function cloneArena(a: Arena): Arena {
  return { ...a, start: { ...a.start }, obstacles: a.obstacles.map((o) => ({ ...o })) };
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Draws the arena, trail, sensor rays and robot. Returns the world-to-screen mapping. */
export function drawArena(cv: HTMLCanvasElement, W: number, H: number, sim: RobotSim, pad = 28): { scale: number; ox: number; oy: number } {
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== W * dpr || cv.height !== H * dpr) {
    cv.width = W * dpr;
    cv.height = H * dpr;
    cv.style.width = `${W}px`;
    cv.style.height = `${H}px`;
  }
  const A = sim.arena;
  const scale = Math.min((W - pad * 2) / A.width, (H - pad * 2) / A.height);
  const ox = (W - A.width * scale) / 2;
  const oy = (H - A.height * scale) / 2;
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy + (A.height - y) * scale;

  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const col = {
    floor: cssVar("--rf-panel", "#fff"),
    grid: cssVar("--rf-grid", "rgba(0,0,0,.06)"),
    border: cssVar("--rf-border-strong", "#c7d1e0"),
    block: cssVar("--rf-raised", "#eef2f8"),
    fg: cssVar("--rf-fg", "#0e1b3d"),
    faint: cssVar("--rf-faint", "#8794ae"),
    accent: cssVar("--rf-accent", "#1e6bff"),
    ray: cssVar("--rf-sig-uart", "#0ea5a0"),
    err: cssVar("--rf-err", "#e5484d"),
    warn: cssVar("--rf-warn", "#d98a00"),
  };

  // Floor and 0.5 m grid
  c.fillStyle = col.floor;
  c.strokeStyle = col.border;
  c.lineWidth = 1.5;
  c.beginPath();
  c.roundRect(X(0), Y(A.height), A.width * scale, A.height * scale, 10);
  c.fill();
  c.stroke();
  c.strokeStyle = col.grid;
  c.lineWidth = 1;
  for (let gx = 0.5; gx < A.width; gx += 0.5) {
    c.beginPath();
    c.moveTo(X(gx), Y(0));
    c.lineTo(X(gx), Y(A.height));
    c.stroke();
  }
  for (let gy = 0.5; gy < A.height; gy += 0.5) {
    c.beginPath();
    c.moveTo(X(0), Y(gy));
    c.lineTo(X(A.width), Y(gy));
    c.stroke();
  }
  c.fillStyle = col.faint;
  c.font = "11px Inter, system-ui, sans-serif";
  c.fillText("0.5 m grid", X(0) + 8, Y(0) - 8);

  // Obstacles
  for (const o of A.obstacles) {
    c.fillStyle = col.block;
    c.strokeStyle = col.border;
    c.lineWidth = 1.5;
    c.beginPath();
    if (o.kind === "box") c.roundRect(X(o.x), Y(o.y + o.h), o.w * scale, o.h * scale, 4);
    else c.arc(X(o.x), Y(o.y), o.r * scale, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  // Trail
  if (sim.trail.length > 1) {
    c.strokeStyle = col.accent;
    c.globalAlpha = 0.35;
    c.lineWidth = 2;
    c.lineJoin = "round";
    c.beginPath();
    sim.trail.forEach((p, i) => (i ? c.lineTo(X(p.x), Y(p.y)) : c.moveTo(X(p.x), Y(p.y))));
    c.lineTo(X(sim.pose.x), Y(sim.pose.y));
    c.stroke();
    c.globalAlpha = 1;
  }

  // Sensor rays
  for (const s of sim.sensors) {
    if (s.kind !== "distance" || !s.hit) continue;
    const p = sim.sensorPose(s);
    c.strokeStyle = col.ray;
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(X(p.x), Y(p.y));
    c.lineTo(X(s.hit.x), Y(s.hit.y));
    c.stroke();
    c.setLineDash([]);
    if ((s.last ?? 99) < s.range[1] - 1e-3) {
      c.fillStyle = col.ray;
      c.beginPath();
      c.arc(X(s.hit.x), Y(s.hit.y), 3.5, 0, Math.PI * 2);
      c.fill();
    }
  }

  // Robot: chassis, wheels, heading
  const { x, y, theta } = sim.pose;
  const r = sim.radius * scale;
  c.save();
  c.translate(X(x), Y(y));
  c.rotate(-theta);
  const wheelW = 0.025 * scale;
  const wheelL = 0.07 * scale;
  c.fillStyle = col.fg;
  for (const side of [-1, 1]) c.fillRect(-wheelL / 2, side * (r - wheelW / 2) - wheelW / 2, wheelL, wheelW);
  c.fillStyle = col.floor;
  c.strokeStyle = sim.touching ? col.err : sim.runtime.estop ? col.warn : col.accent;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.fillStyle = sim.touching ? col.err : col.accent;
  c.beginPath();
  c.moveTo(r * 0.7, 0);
  c.lineTo(r * 0.2, -r * 0.28);
  c.lineTo(r * 0.2, r * 0.28);
  c.closePath();
  c.fill();
  c.restore();

  if (sim.runtime.estop) {
    c.fillStyle = col.warn;
    c.font = "600 12px Inter, system-ui, sans-serif";
    c.fillText("E-stop latched", X(x) + r + 6, Y(y) - r);
  }
  return { scale, ox, oy };
}

function hitObstacle(o: Obstacle, x: number, y: number): boolean {
  return o.kind === "circle" ? Math.hypot(x - o.x, y - o.y) <= o.r : x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
}

type Drag = { kind: "obstacle"; index: number; dx: number; dy: number } | { kind: "robot"; dx: number; dy: number } | null;

/**
 * Top-down 2D simulator. Runs the compiled behavior with the firmware's semantics against
 * simulated sensors, so you can watch the robot before you build it.
 */
export function Simulator() {
  const analysis = useAnalysis();
  const base = useBasePath();
  const ir = analysis?.ir;
  const errors = analysis?.report.diagnostics.filter((d) => d.severity === "error" && d.category === "software") ?? [];

  const [arenaId, setArenaId] = useState(ARENAS[0]!.id);
  const [arena, setArena] = useState<Arena>(() => cloneArena(ARENAS[0]!));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [, setFrame] = useState(0);
  const simRef = useRef<RobotSim | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const view = useRef({ scale: 100, ox: 0, oy: 0 });

  const reset = useCallback(() => {
    if (!ir) return;
    simRef.current = new RobotSim(ir, { arena: cloneArena(arena), seed: 7 });
    setFrame((f) => f + 1);
  }, [ir, arena]);

  // A new sim whenever the design or the arena changes.
  useEffect(() => {
    reset();
  }, [reset]);

  const chooseArena = (id: string) => {
    setArenaId(id);
    setArena(cloneArena(ARENAS.find((a) => a.id === id)!));
    setRunning(false);
  };

  // Main loop: advance in real time × speed, redraw every frame, refresh the side panel ~10 Hz.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let panelAt = 0;
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const sim = simRef.current;
      if (sim && running) sim.advance(dt * speed);
      draw();
      if (now - panelAt > 100) {
        panelAt = now;
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed]);

  function draw() {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    const sim = simRef.current;
    if (!cv || !wrap || !sim) return;
    view.current = drawArena(cv, wrap.clientWidth, wrap.clientHeight, sim);
  }

  // Pointer interaction: drag obstacles or the robot, double-click to add or remove a box.
  const toWorld = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { scale, ox, oy } = view.current;
    const A = simRef.current!.arena;
    return { x: (e.clientX - rect.left - ox) / scale, y: A.height - (e.clientY - rect.top - oy) / scale };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    const sim = simRef.current;
    if (!sim) return;
    const p = toWorld(e);
    if (Math.hypot(p.x - sim.pose.x, p.y - sim.pose.y) <= sim.radius) {
      drag.current = { kind: "robot", dx: sim.pose.x - p.x, dy: sim.pose.y - p.y };
    } else {
      const i = sim.arena.obstacles.findIndex((o) => hitObstacle(o, p.x, p.y));
      if (i < 0) return;
      const o = sim.arena.obstacles[i]!;
      drag.current = { kind: "obstacle", index: i, dx: o.x - p.x, dy: o.y - p.y };
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const sim = simRef.current;
    const d = drag.current;
    const cv = canvasRef.current;
    if (!sim || !cv) return;
    const p = toWorld(e);
    if (!d) {
      const over = Math.hypot(p.x - sim.pose.x, p.y - sim.pose.y) <= sim.radius || sim.arena.obstacles.some((o) => hitObstacle(o, p.x, p.y));
      cv.style.cursor = over ? "grab" : "crosshair";
      return;
    }
    cv.style.cursor = "grabbing";
    if (d.kind === "robot") {
      sim.pose = { ...sim.pose, x: p.x + d.dx, y: p.y + d.dy };
      sim.trail.length = 0;
      sim.trail.push({ x: sim.pose.x, y: sim.pose.y });
    } else {
      const o = sim.arena.obstacles[d.index]!;
      o.x = p.x + d.dx;
      o.y = p.y + d.dy;
    }
  };
  const onPointerUp = () => {
    // Remember the edited layout for the next reset without restarting the run.
    if (drag.current?.kind === "obstacle") arena.obstacles = simRef.current!.arena.obstacles.map((o) => ({ ...o }));
    drag.current = null;
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    const sim = simRef.current;
    if (!sim) return;
    const p = toWorld(e);
    const obs = sim.arena.obstacles;
    const i = obs.findIndex((o) => hitObstacle(o, p.x, p.y));
    if (i >= 0) obs.splice(i, 1);
    else if (p.x > 0 && p.y > 0 && p.x < sim.arena.width && p.y < sim.arena.height) obs.push({ kind: "box", x: p.x - 0.15, y: p.y - 0.15, w: 0.3, h: 0.3 });
    // Edit in place so the robot keeps going; the next reset starts from this layout.
    arena.obstacles = obs.map((o) => ({ ...o }));
  };
  const addBox = () => {
    const sim = simRef.current;
    if (!sim) return;
    sim.arena.obstacles.push({ kind: "box", x: sim.arena.width / 2 - 0.15, y: sim.arena.height - 0.6, w: 0.3, h: 0.3 });
    arena.obstacles = sim.arena.obstacles.map((o) => ({ ...o }));
  };

  const sim = simRef.current;
  const hasEstop = (ir?.behavior.estopComponentIds.length ?? 0) > 0;
  const nodeTitles = useMemo(() => new Map(ir?.behavior.nodes.map((n) => [n.nodeId, n.title]) ?? []), [ir]);
  const names = useMemo(() => new Map(ir?.hardware.components.map((c) => [c.instance.id, c.instance.name]) ?? []), [ir]);

  if (!ir || !sim) return <div className="p-6 text-[13px] text-muted">Loading the simulator…</div>;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
          <button className="btn btn-primary min-w-20" onClick={() => setRunning((r) => !r)} disabled={!sim.drivable && !ir.behavior.fibers.length}>
            {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Run"}
          </button>
          <button className="btn" onClick={() => { reset(); setRunning(false); }} title="Put the robot back at the start and restart the behavior">
            <RotateCcw className="size-4" /> Reset
          </button>
          <div className="ml-1 flex overflow-hidden rounded-lg border border-border">
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setSpeed(s)} className={clsx("px-2.5 py-1 text-[12px] font-medium", speed === s ? "bg-accent text-white" : "bg-panel text-muted hover:bg-panel-2")}>
                {s}×
              </button>
            ))}
          </div>
          <select className="input w-auto" value={arenaId} onChange={(e) => chooseArena(e.target.value)} aria-label="Arena">
            {ARENAS.map((a) => (
              <option key={a.id} value={a.id}>{a.title}</option>
            ))}
          </select>
          <button className="btn" onClick={addBox}><Plus className="size-4" /> Box</button>
          {hasEstop && (
            <button
              className={clsx("btn ml-auto", sim.estopPressed ? "btn-danger" : "")}
              onClick={() => { sim.estopPressed = !sim.estopPressed; setFrame((f) => f + 1); }}
              title="The e-stop latches: release it and press Reset to start again, like power-cycling the robot"
            >
              <OctagonX className="size-4" /> {sim.estopPressed ? "Release e-stop" : "Press e-stop"}
            </button>
          )}
        </div>
        {sim.problem && (
          <div className="border-b border-warn/30 bg-warn/10 px-3 py-2 text-[12.5px] text-fg">
            {sim.problem} <Link href={`${base}/robot`} className="font-medium text-accent hover:underline">Open Robot</Link>
          </div>
        )}
        {errors.length > 0 && (
          <div className="border-b border-err/30 bg-err/10 px-3 py-2 text-[12.5px] text-fg">
            The behavior has {errors.length} error{errors.length > 1 ? "s" : ""}, so parts of it may not run: {errors[0]!.message}{" "}
            <Link href={`${base}/behavior`} className="font-medium text-accent hover:underline">Open Behavior</Link>
          </div>
        )}
        <div ref={wrapRef} className="relative min-h-0 flex-1 bg-bg">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
            aria-label="Simulation arena. Drag the robot or obstacles; double-click to add or remove a box."
          />
          <p className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-faint">Drag the robot or a box · double-click to add or remove a box</p>
        </div>
      </div>

      <aside className="w-[300px] shrink-0 overflow-auto border-l border-border bg-panel">
        <div className="panel-title">Run</div>
        <dl className="grid grid-cols-3 gap-2 p-3 text-center">
          <Stat label="Time" value={`${(sim.t / 1000).toFixed(1)} s`} />
          <Stat label="Driven" value={`${sim.distance.toFixed(1)} m`} />
          <Stat label="Bumps" value={String(sim.collisions)} warn={sim.collisions > 0} />
        </dl>

        {ir.behavior.states.length > 0 && (
          <>
            <div className="panel-title">State</div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {ir.behavior.states.map((s) => (
                <span key={s} className={clsx("chip font-mono", sim.runtime.state === s ? "bg-accent text-white" : "bg-raised text-muted")}>{s}</span>
              ))}
            </div>
          </>
        )}

        <div className="panel-title">Running now</div>
        <ul className="space-y-1 p-3 text-[12.5px]">
          {sim.runtime.estop ? (
            <li className="text-warn">E-stop latched. Everything is stopped.</li>
          ) : sim.runtime.activeNodeIds().length ? (
            sim.runtime.activeNodeIds().map((id) => (
              <li key={id} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-accent" />{nodeTitles.get(id) ?? id}</li>
            ))
          ) : (
            <li className="text-faint">Nothing is running.</li>
          )}
        </ul>

        {ir.behavior.variables.length > 0 && (
          <>
            <div className="panel-title">Variables</div>
            <table className="w-full text-[12.5px]">
              <tbody>
                {ir.behavior.variables.map((v) => (
                  <tr key={v.name} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-1.5 font-mono text-muted">{v.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{(sim.runtime.vars[v.name] ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="panel-title">Motors</div>
        <div className="space-y-2 p-3">
          {[...sim.motorSpeed.keys()].length === 0 && <p className="text-[12.5px] text-faint">No motor commands yet.</p>}
          {[...sim.motorSpeed.entries()].map(([id, v]) => (
            <div key={id}>
              <div className="flex justify-between text-[12px]"><span className="font-mono text-muted">{names.get(id) ?? id}</span><span className="font-mono tabular-nums">{(sim.motorCmd.get(id) ?? 0).toFixed(2)}</span></div>
              <div className="relative mt-1 h-1.5 rounded-full bg-raised">
                <span className="absolute top-0 h-full rounded-full bg-[var(--rf-sig-motor)]" style={{ left: `${50 + Math.min(0, v) * 50}%`, width: `${Math.abs(v) * 50}%` }} />
                <span className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-border-strong" />
              </div>
            </div>
          ))}
        </div>

        <div className="panel-title">Sensors</div>
        <ul className="space-y-1 p-3 text-[12.5px]">
          {sim.sensors.length === 0 && <li className="text-faint">No sensors on this robot.</li>}
          {sim.sensors.map((s) => (
            <li key={s.componentId} className="flex justify-between">
              <span className="font-mono text-muted">{s.name}</span>
              <span className="font-mono tabular-nums">
                {s.last === undefined ? "–" : s.kind === "switch" ? (s.last ? "pressed" : "open") : `${s.last.toFixed(2)} m`}
              </span>
            </li>
          ))}
        </ul>

        <div className="panel-title">Log</div>
        <ul className="max-h-48 space-y-1 overflow-auto p-3 font-mono text-[11.5px]">
          {sim.log.length === 0 && <li className="font-sans text-faint">Log nodes write here.</li>}
          {sim.log.slice(-40).map((l, i) => (
            <li key={i} className={l.level === "warn" ? "text-warn" : "text-muted"}>
              <span className="text-faint">{(l.t / 1000).toFixed(1)}s</span> {l.message}
            </li>
          ))}
        </ul>
        <p className="border-t border-border p-3 text-[11.5px] leading-relaxed text-faint">
          The simulator runs your behavior with the same rules as the generated firmware: fibers, non-blocking waits, states and the e-stop latch. Sensors are ray-cast from where they're mounted on the Robot page.
        </p>
      </aside>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg bg-panel-2 px-2 py-1.5">
      <dt className="text-[10.5px] text-faint">{label}</dt>
      <dd className={clsx("font-mono text-[13px] font-semibold tabular-nums", warn ? "text-warn" : "text-fg")}>{value}</dd>
    </div>
  );
}
