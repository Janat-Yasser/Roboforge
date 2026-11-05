// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useProject } from "@/lib/store";

/** Bill of materials derived from the spec. */
export function BomTable() {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const [open, setOpen] = useState(false);
  const rows = new Map<string, { name: string; manufacturer: string; qty: number; refs: string[]; category: string }>();
  for (const c of spec.components) {
    const d = catalog.get(c.ref.catalogId, c.ref.version);
    const key = `${c.ref.catalogId}@${c.ref.version}`;
    const r = rows.get(key) ?? { name: d?.name ?? c.ref.catalogId, manufacturer: d?.manufacturer ?? "?", qty: 0, refs: [], category: d?.category ?? "?" };
    r.qty++;
    r.refs.push(c.name);
    rows.set(key, r);
  }
  return (
    <div className="shrink-0 border-t border-border bg-panel">
      <button className="panel-title w-full border-b-0 hover:text-fg" onClick={() => setOpen((v) => !v)}>
        <span>Bill of materials · {spec.components.length} parts</span>
        {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
      </button>
      {open && (
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase text-faint">
                <th className="px-3 py-1">Qty</th><th>Part</th><th>Manufacturer</th><th>Category</th><th>Designators</th>
              </tr>
            </thead>
            <tbody>
              {[...rows.entries()].map(([k, r]) => (
                <tr key={k} className="border-t border-border/60">
                  <td className="px-3 py-1">{r.qty}</td><td>{r.name}</td><td className="text-muted">{r.manufacturer}</td><td className="text-muted">{r.category}</td><td className="font-mono text-[11px]">{r.refs.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
