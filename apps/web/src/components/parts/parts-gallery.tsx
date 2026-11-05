// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Search } from "lucide-react";
import type { ComponentDefinition } from "@roboforge/spec";
import { CATEGORY_COLOR } from "@/components/hardware/pin-style";
import { PartGlyph } from "./part-glyph";

const CATS: [string, string][] = [
  ["", "All parts"],
  ["controller", "Controllers"],
  ["sbc", "Computers"],
  ["motor", "Motors"],
  ["motor_driver", "Motor drivers"],
  ["servo", "Servos"],
  ["sensor", "Sensors"],
  ["switch", "Switches"],
  ["power", "Batteries"],
  ["regulator", "Regulators"],
  ["communication", "Communication"],
];

export function PartsGallery({ parts }: { parts: ComponentDefinition[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const shown = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return parts.filter((p) => (!cat || p.category === cat) && terms.every((t) => [p.name, p.manufacturer, p.description, ...p.tags, ...p.interfaces].join(" ").toLowerCase().includes(t)));
  }, [parts, q, cat]);
  const count = (c: string) => parts.filter((p) => !c || p.category === c).length;
  return (
    <>
      <div className="sticky top-[72px] z-20 -mx-5 mt-10 bg-bg/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex w-full items-center sm:w-80">
            <Search className="absolute left-4 size-4 text-faint" />
            <input className="h-12 w-full rounded-2xl border-2 border-border bg-panel pl-11 pr-4 text-[15px] font-medium outline-none transition-colors placeholder:text-faint focus:border-accent" placeholder="Search: i2c, distance, 24 V…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="no-scrollbar -mx-1 flex flex-1 gap-2 overflow-x-auto px-1 py-1">
            {CATS.filter(([id]) => count(id) > 0).map(([id, label]) => (
              <button key={id} onClick={() => setCat(id)} className={clsx("relative shrink-0 rounded-full px-4 py-2 text-[14px] font-bold transition-colors", cat === id ? "text-white" : "bg-panel text-muted shadow-[var(--rf-shadow)] hover:text-fg")}>
                {cat === id && <motion.span layoutId="cat-pill" className="absolute inset-0 -z-10 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                {label} <span className={clsx("ml-1 text-[12px]", cat === id ? "text-white/70" : "text-faint")}>{count(id)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <motion.div layout className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {shown.map((p) => {
            const color = CATEGORY_COLOR[p.category];
            return (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.25 }}>
                <Link href={`/parts/${p.id}`} className="card-pop group flex h-full flex-col overflow-hidden">
                  <div className="relative grid h-44 place-items-center overflow-hidden" style={{ background: `color-mix(in srgb, ${color} 14%, var(--rf-panel))` }}>
                    <span className="absolute -right-6 -top-6 size-24 rounded-full opacity-25 transition-transform duration-500 group-hover:scale-150" style={{ background: color }} />
                    <div className="relative transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-4deg] group-hover:scale-110"><PartGlyph def={p} size={110} /></div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-[12.5px] font-bold" style={{ color }}>{p.manufacturer}</div>
                    <h3 className="mt-1 text-[17px] font-bold leading-snug transition-colors group-hover:text-accent">{p.name}</h3>
                    <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-muted">{p.description}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      {p.interfaces.slice(0, 4).map((x) => <span key={x} className="rounded-lg bg-raised px-2 py-0.5 text-[12px] font-bold uppercase text-muted">{x}</span>)}
                      <ArrowRight className="ml-auto size-4 text-accent opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
      {!shown.length && <p className="py-24 text-center text-[18px] font-semibold text-muted">No parts match that search.</p>}
    </>
  );
}
