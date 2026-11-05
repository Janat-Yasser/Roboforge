// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/**
 * A soft follower dot that grows over links and shows "View" over [data-cursor=view] elements.
 * Pointer-fine devices only; the native cursor stays visible.
 */
export function Cursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });
  const [mode, setMode] = useState<"dot" | "link" | "view">("dot");
  const [label, setLabel] = useState("View");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setEnabled(true);
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target as HTMLElement | null;
      const v = t?.closest<HTMLElement>("[data-cursor]");
      if (v) {
        setMode("view");
        setLabel(v.dataset.cursor || "View");
      } else setMode(t?.closest("a,button,[role=button],input,select,textarea") ? "link" : "dot");
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [x, y]);
  if (!enabled) return null;
  const size = mode === "view" ? 88 : mode === "link" ? 40 : 10;
  return (
    <motion.div aria-hidden className={mode === "view" ? "pointer-events-none fixed left-0 top-0 z-[70]" : "pointer-events-none fixed left-0 top-0 z-[70] mix-blend-difference"} style={{ x: sx, y: sy }}>
      <motion.div
        className="grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[11px] font-medium uppercase tracking-widest text-white"
        animate={{ width: size, height: size, backgroundColor: mode === "view" ? "#e4481c" : "#f3efe6" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {mode === "view" && <span className="font-mono">{label}</span>}
      </motion.div>
    </motion.div>
  );
}
