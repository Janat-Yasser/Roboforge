"use client";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { newId, type ComponentCategory, type ComponentDefinition } from "@roboforge/spec";
import { api } from "@/lib/api";
import { useProject } from "@/lib/store";
import { DRAG_MIME, defaultInstanceName, estimateNodeSize, findFreeSpot } from "./hardware-canvas";
import { CATEGORY_COLOR } from "./pin-style";

const CATEGORIES: { id: ComponentCategory | ""; label: string }[] = [
  { id: "", label: "All" },
  { id: "controller", label: "Controllers" },
  { id: "sbc", label: "SBCs" },
  { id: "motor_driver", label: "Motor drivers" },
  { id: "motor", label: "Motors" },
  { id: "servo", label: "Servos" },
  { id: "sensor", label: "Sensors" },
  { id: "switch", label: "Switches" },
  { id: "power", label: "Batteries" },
  { id: "regulator", label: "Regulators" },
  { id: "communication", label: "Communication" },
];

/** Searchable component library. Drag onto the canvas or click + to add. */
export function LibraryPanel() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<ComponentCategory | "">("");
  const [items, setItems] = useState<ComponentDefinition[]>([]);
  const addDefinitions = useProject((s) => s.addDefinitions);
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ components: ComponentDefinition[] }>(`/api/components?q=${encodeURIComponent(q)}&category=${category}`).then((r) => {
        setItems(r.components);
        addDefinitions(r.components);
      });
    }, 150);
    return () => clearTimeout(t);
  }, [q, category, addDefinitions]);

  function add(def: ComponentDefinition) {
    const spec = useProject.getState().spec!;
    const id = newId("c");
    const catalog = useProject.getState().catalog;
    const occupied = spec.components.flatMap((c) => {
      const d = catalog.get(c.ref.catalogId, c.ref.version);
      return d ? [{ ...c.layout, ...estimateNodeSize(d) }] : [];
    });
    const layout = findFreeSpot(occupied, estimateNodeSize(def));
    const name = defaultInstanceName(def, new Set(spec.components.map((c) => c.name)));
    if (dispatch([{ type: "component.add", component: { id, name, ref: { catalogId: def.id, version: def.version }, config: {}, layout } }])) {
      select({ kind: "component", id });
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-panel">
      <div className="panel-title">Component library</div>
      <div className="space-y-2 border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1.5 size-3.5 text-faint" />
          <input className="input pl-7" placeholder="Search parts, interfaces, tags…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="library-search" />
        </div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value as ComponentCategory | "")}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-auto p-1.5">
        {items.map((d) => (
          <div
            key={`${d.id}@${d.version}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ id: d.id, version: d.version }));
              e.dataTransfer.effectAllowed = "copy";
            }}
            className="group mb-1 cursor-grab rounded-md border border-transparent p-2 hover:border-border hover:bg-raised"
            title={d.description}
            data-testid={`lib-${d.id}`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: CATEGORY_COLOR[d.category] }} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.name}</div>
                <div className="truncate text-[11px] text-faint">{d.manufacturer} · {d.interfaces.join(", ")}</div>
              </div>
              <button className="btn btn-ghost px-1 opacity-0 group-hover:opacity-100" onClick={() => add(d)} title="Add to design" data-testid={`add-${d.id}`}>
                <Plus className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {!items.length && <p className="p-2 text-muted">No matching parts.</p>}
      </div>
      <p className="border-t border-border p-2 text-[11px] text-faint">Drag onto the canvas, then wire pins or use Auto-wire.</p>
    </aside>
  );
}
