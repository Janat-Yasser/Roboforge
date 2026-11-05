// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { Box, Columns2, LayoutGrid } from "lucide-react";
import { HardwareCanvas } from "@/components/hardware/hardware-canvas";
import { LibraryPanel } from "@/components/hardware/library-panel";
import { HardwarePropertiesPanel } from "@/components/hardware/properties-panel";
import { BomTable } from "@/components/hardware/bom-table";
import { Robot3DPanel } from "@/components/hardware/robot-3d-panel";

type View = "canvas" | "3d" | "split";
const VIEWS: { id: View; label: string; icon: typeof Box }[] = [
  { id: "canvas", label: "Canvas", icon: LayoutGrid },
  { id: "split", label: "Split", icon: Columns2 },
  { id: "3d", label: "3D", icon: Box },
];
const KEY = "rf.hardware.view";

export default function HardwarePage() {
  return (
    <Suspense>
      <HardwareWorkspace />
    </Suspense>
  );
}

function HardwareWorkspace() {
  const params = useSearchParams();
  const [view, setView] = useState<View>("split");
  useEffect(() => {
    const fromUrl = params.get("view");
    if (fromUrl === "3d" || fromUrl === "canvas" || fromUrl === "split") return setView(fromUrl);
    try {
      const v = localStorage.getItem(KEY) as View | null;
      if (v) setView(v);
    } catch {}
  }, [params]);
  function choose(v: View) {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  }

  return (
    <div className="flex min-h-0 flex-1">
      <LibraryPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1">
          <AnimatePresence initial={false}>
            {view !== "3d" && (
              <motion.div key="canvas" layout className="min-w-0 flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HardwareCanvas />
              </motion.div>
            )}
            {view !== "canvas" && (
              <motion.div
                key="3d"
                layout
                className={clsx("min-w-0", view === "split" ? "w-[42%] border-l border-border" : "flex-1")}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              >
                <Robot3DPanel />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="glass absolute right-3 top-3 z-10 flex rounded-xl p-1 shadow-[var(--rf-shadow)]" role="tablist" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                onClick={() => choose(v.id)}
                className={clsx("relative flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors", view === v.id ? "text-white" : "text-muted hover:text-fg")}
              >
                {view === v.id && <motion.span layoutId="hw-view" className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                <v.icon className="relative size-3.5" />
                <span className="relative">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
        <BomTable />
      </div>
      <HardwarePropertiesPanel />
    </div>
  );
}
