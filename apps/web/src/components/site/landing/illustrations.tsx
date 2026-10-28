"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

function PanelHead({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="-mx-5 -mt-5 mb-4 flex items-center gap-3 border-b border-border bg-panel-2 px-4 py-2.5">
      <span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-accent-3" /><span className="size-2.5 rounded-full bg-accent-2" /><span className="size-2.5 rounded-full bg-green" /></span>
      <span className="text-[12.5px] font-semibold text-muted">{title}</span>
      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green/12 px-2 py-0.5 text-[11px] font-bold text-green"><span className="size-1.5 animate-pulse rounded-full bg-green" />{meta}</span>
    </div>
  );
}

function useTicker(n: number, ms: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return i;
}

/* ------------------------------------------------------------------------------------------ */

const CHECKS = [
  { s: "ok", t: "Battery 7.4 V within motor driver range (4.5–13.5 V)" },
  { s: "ok", t: "I²C: front_tof at 0x29 on GPIO21/GPIO22 — no conflicts" },
  { s: "err", t: "HC-SR04 ECHO drives 5 V into GPIO14 (max 3.6 V)" },
  { s: "warn", t: "GPIO12 is a boot strapping pin — robot may not boot" },
  { s: "ok", t: "Power budget: 325 mA typical, 6.8 h battery life" },
] as const;

export function WiringIllustration() {
  const i = useTicker(CHECKS.length, 2200);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-[var(--rf-shadow-lg)]">
      <PanelHead title="Design checks" meta="live" />
      <svg viewBox="0 0 420 220" className="w-full">
        <defs>
          <linearGradient id="wire-i2c" x1="0" x2="1"><stop offset="0" stopColor="var(--rf-sig-i2c)" /><stop offset="1" stopColor="var(--rf-accent)" /></linearGradient>
        </defs>
        {/* boards */}
        <g>
          <rect x="160" y="40" width="100" height="140" rx="12" fill="var(--rf-panel-2)" stroke="var(--rf-border-strong)" />
          <text x="210" y="62" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--rf-fg)" fontFamily="var(--font-mono)">ESP32</text>
          {Array.from({ length: 8 }, (_, k) => (
            <g key={k}>
              <circle cx="160" cy={80 + k * 12} r="3.2" fill="var(--rf-sig-logic)" />
              <circle cx="260" cy={80 + k * 12} r="3.2" fill="var(--rf-sig-logic)" />
            </g>
          ))}
          <rect x="20" y="60" width="90" height="60" rx="10" fill="var(--rf-panel-2)" stroke="var(--rf-border-strong)" />
          <text x="65" y="84" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--rf-fg)" fontFamily="var(--font-mono)">ToF sensor</text>
          <text x="65" y="100" textAnchor="middle" fontSize="9" fill="var(--rf-muted)">VL53L0X</text>
          <rect x="310" y="50" width="95" height="70" rx="10" fill="var(--rf-panel-2)" stroke="var(--rf-border-strong)" />
          <text x="357" y="78" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--rf-fg)" fontFamily="var(--font-mono)">Motor driver</text>
          <text x="357" y="94" textAnchor="middle" fontSize="9" fill="var(--rf-muted)">TB6612FNG</text>
          <rect x="310" y="140" width="95" height="50" rx="10" fill="var(--rf-panel-2)" stroke="var(--rf-border-strong)" />
          <text x="357" y="170" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--rf-fg)" fontFamily="var(--font-mono)">Battery 2S</text>
        </g>
        {/* wires */}
        {[
          { d: "M110 80 C 135 80, 135 92, 160 92", c: "url(#wire-i2c)" },
          { d: "M110 96 C 135 96, 135 104, 160 104", c: "url(#wire-i2c)" },
          { d: "M260 80 C 285 80, 285 70, 310 70", c: "var(--rf-sig-logic)" },
          { d: "M260 92 C 285 92, 285 84, 310 84", c: "var(--rf-sig-logic)" },
          { d: "M260 104 C 285 104, 285 98, 310 98", c: "var(--rf-sig-pwm)" },
          { d: "M357 140 L 357 120", c: "var(--rf-sig-power)" },
          { d: "M310 170 C 240 200, 150 200, 110 110", c: "var(--rf-sig-ground)" },
        ].map((w, k) => (
          <path key={k} d={w.d} fill="none" stroke={w.c} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="6 6" className="animate-dash" />
        ))}
      </svg>
      <div className="relative mt-2 h-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={clsx(
              "absolute inset-0 flex items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold",
              CHECKS[i]!.s === "ok" && "border-ok/30 bg-ok/10 text-ok",
              CHECKS[i]!.s === "err" && "border-err/30 bg-err/10 text-err",
              CHECKS[i]!.s === "warn" && "border-warn/30 bg-warn/10 text-warn",
            )}
          >
            {CHECKS[i]!.s === "ok" ? <CheckCircle2 className="size-4 shrink-0" /> : CHECKS[i]!.s === "err" ? <XCircle className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
            {CHECKS[i]!.t}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

const BLOCKS = [
  { t: "Robot started", c: "var(--rf-accent-3)", indent: 0 },
  { t: "Read front_tof → distance", c: "var(--rf-sig-uart)", indent: 0 },
  { t: "If distance < 0.5 m", c: "var(--rf-accent)", indent: 0 },
  { t: "Stop all motors", c: "var(--rf-sig-motor)", indent: 1 },
  { t: "Wait 1 s", c: "var(--rf-accent)", indent: 1 },
  { t: "Otherwise: drive forward 40 %", c: "var(--rf-sig-motor)", indent: 1 },
  { t: "Repeat", c: "var(--rf-accent)", indent: 0 },
];

export function BehaviorIllustration() {
  const i = useTicker(BLOCKS.length, 900);
  return (
    <div className="space-y-2 overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-[var(--rf-shadow-lg)]">
      <PanelHead title="Behavior · obstacle avoider" meta="running" />
      {BLOCKS.map((b, k) => (
        <motion.div
          key={b.t}
          animate={{ scale: i === k ? 1.03 : 1, x: i === k ? 6 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className={clsx("flex items-center gap-3 rounded-xl border bg-panel-2 px-3 py-2.5 text-[13px] font-semibold", i === k ? "border-accent shadow-[var(--rf-shadow-lg)]" : "border-border")}
          style={{ marginLeft: b.indent * 28 }}
        >
          <span className="h-6 w-1.5 rounded-full" style={{ background: b.c }} />
          {b.t}
          {i === k && <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">running</span>}
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

const CODE = `case 2: {  // distance < 0.5 m? [n_check]
  f.pc = (v_.distance < 0.5f) ? 3 : 5;
  break;
}
case 3: {  // Stop [n_stop]
  r_.left_motor.stop();
  r_.right_motor.stop();
  f.pc = 4;
  break;
}
case 4: {  // Wait 1 s — never blocks
  if (!f.waiting) { f.waiting = true; f.wakeAt = now + 1000u; }
  if (static_cast<int32_t>(now - f.wakeAt) < 0) return;
  f.waiting = false;
  f.pc = 1;
  break;
}`;

function highlight(line: string) {
  const parts = line.split(/(\/\/.*$|\b(?:case|if|return|break|static_cast|true|false)\b|\b\d+(?:\.\d+)?[fu]?\b)/g);
  return parts.map((p, k) =>
    p.startsWith("//") ? <span key={k} className="text-faint italic">{p}</span>
    : /^(case|if|return|break|static_cast|true|false)$/.test(p) ? <span key={k} className="text-accent">{p}</span>
    : /^\d/.test(p) ? <span key={k} className="text-accent-3">{p}</span>
    : <span key={k}>{p}</span>,
  );
}

export function CodeIllustration() {
  const lines = CODE.split("\n");
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => (x >= lines.length + 6 ? 0 : x + 1)), 180);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-[var(--rf-shadow-lg)]">
      <div className="flex items-center gap-2 border-b border-border bg-panel-2 px-3 py-2">
        <span className="size-2.5 rounded-full bg-accent-3" />
        <span className="size-2.5 rounded-full bg-accent-2" />
        <span className="size-2.5 rounded-full bg-green" />
        <div className="ml-3 flex gap-1 text-[11.5px]">
          <span className="rounded-md bg-panel px-2 py-0.5 font-medium">behavior.cpp</span>
          <span className="px-2 py-0.5 text-muted">robot_config.h</span>
          <span className="px-2 py-0.5 text-muted">behavior.py</span>
        </div>
      </div>
      <pre className="h-[300px] overflow-hidden p-4 font-mono text-[12px] leading-[1.7]">
        {lines.slice(0, Math.min(n, lines.length)).map((l, k) => (
          <div key={k}>
            <span className="mr-4 inline-block w-5 select-none text-right text-faint">{k + 1}</span>
            {highlight(l)}
          </div>
        ))}
        <span className="inline-block h-4 w-2 animate-pulse bg-accent align-middle" />
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------ */

const PARTS = [
  { name: "ESP32-DevKitC V4", spec: "3.3 V logic · Wi-Fi · 34 GPIO", c: "var(--rf-sig-logic)" },
  { name: "TB6612FNG driver", spec: "4.5–13.5 V · 1.2 A/ch", c: "var(--rf-sig-motor)" },
  { name: "VL53L0X ToF", spec: "I²C 0x29 · 2 m range", c: "var(--rf-sig-i2c)" },
  { name: "DC gearmotor ×2", spec: "6–12 V · stall 1.6 A", c: "var(--rf-sig-motor)" },
  { name: "LiPo 2S 2200 mAh", spec: "7.4 V nominal", c: "var(--rf-sig-power)" },
];

export function PartsIllustration() {
  const i = useTicker(PARTS.length + 2, 1100);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-panel p-5 shadow-[var(--rf-shadow-lg)]">
      <PanelHead title="Bill of materials" meta={`${Math.min(i, PARTS.length)} / ${PARTS.length}`} />
      <ul className="divide-y divide-fg/10">
        {PARTS.map((p, k) => (
          <motion.li
            key={p.name}
            animate={{ opacity: k < i ? 1 : 0.25, x: k < i ? 0 : -6 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="size-3 shrink-0 rounded-md" style={{ background: p.c }} />
            <span className="text-[13.5px] font-medium">{p.name}</span>
            <span className="ml-auto font-mono text-[11px] text-muted">{p.spec}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
