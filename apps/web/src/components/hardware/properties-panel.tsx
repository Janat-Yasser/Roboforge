"use client";
import { useEffect, useState } from "react";
import { Cable, ExternalLink, Trash2, Wand2, X } from "lucide-react";
import { planAutoWire } from "@roboforge/ir";
import type { Command, ComponentDefinition, ComponentInstance, ConfigField } from "@roboforge/spec";

type ComponentPatch = Extract<Command, { type: "component.update" }>["patch"];
import { useAnalysis, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { SeverityIcon } from "../ide/validation-bar";
import { CATEGORY_COLOR } from "./pin-style";

/** Text input that commits on blur/Enter, so typing does not create a revision per keystroke. */
export function CommitInput({ value, onCommit, className, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      {...rest}
      className={className ?? "input"}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setV(value);
      }}
    />
  );
}

function ConfigInput({ field, value, onChange }: { field: ConfigField; value: unknown; onChange: (v: number | string | boolean | null) => void }) {
  const current = value ?? field.default;
  if (field.type === "boolean") {
    return <input type="checkbox" checked={!!current} onChange={(e) => onChange(e.target.checked)} />;
  }
  if (field.type === "enum") {
    return (
      <select className="input" value={String(current ?? "")} onChange={(e) => onChange(typeof field.options?.[0] === "number" ? Number(e.target.value) : e.target.value)}>
        {field.options?.map((o) => (
          <option key={String(o)} value={String(o)}>
            {typeof o === "number" && field.key.toLowerCase().includes("address") ? `0x${o.toString(16).toUpperCase()}` : String(o)}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "hex") {
    return (
      <CommitInput
        value={typeof current === "number" ? `0x${current.toString(16).toUpperCase()}` : String(current ?? "")}
        onCommit={(v) => {
          const n = parseInt(v, v.trim().toLowerCase().startsWith("0x") ? 16 : 10);
          if (Number.isFinite(n)) onChange(n);
          else toast.error("Enter a number such as 0x29");
        }}
        className="input font-mono"
      />
    );
  }
  if (field.type === "number" || field.type === "integer") {
    return (
      <CommitInput
        value={String(current ?? "")}
        onCommit={(v) => (v.trim() === "" ? onChange(null) : Number.isFinite(Number(v)) ? onChange(Number(v)) : toast.error("Not a number"))}
        className="input font-mono"
        inputMode="decimal"
      />
    );
  }
  return <CommitInput value={String(current ?? "")} onCommit={(v) => onChange(v)} />;
}

function ComponentProps({ c, def }: { c: ComponentInstance; def: ComponentDefinition }) {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const diags = analysis?.report.diagnostics.filter((d) => d.componentIds?.includes(c.id) || d.pins?.some((p) => p.startsWith(`${c.id}:`))) ?? [];
  const wires = spec.connections.filter((w) => w.from.componentId === c.id || w.to.componentId === c.id);
  const nameOf = (id: string) => spec.components.find((x) => x.id === id)?.name ?? id;
  const isControllerLike = def.category === "controller" || def.category === "sbc";
  const isPrimary = analysis?.ir.hardware.controller?.instance.id === c.id;
  const update = (patch: ComponentPatch) => dispatch([{ type: "component.update", componentId: c.id, patch }]);

  function autowire() {
    const plan = planAutoWire(spec, catalog, c.id);
    if (!plan.commands.length) {
      toast.info(plan.skipped.length ? `Nothing wired: ${plan.skipped.map((s) => `${s.pin} — ${s.reason}`).join("; ")}` : "All required pins are already connected.");
      return;
    }
    if (dispatch(plan.commands, `Auto-wire ${c.name}`)) {
      toast.ok(`Auto-wired ${plan.commands.length} pin(s)${plan.skipped.length ? `; skipped ${plan.skipped.map((s) => s.pin).join(", ")}` : ""}.`);
    }
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: CATEGORY_COLOR[def.category] }} />
          <span className="font-semibold">{def.name}</span>
        </div>
        <p className="mt-1 text-[12px] text-muted">{def.description}</p>
        <div className="mt-1 flex items-center gap-3 font-mono text-[10.5px] text-faint">
          <span>{def.id}@{def.version}</span>
          {def.datasheetUrl && (
            <a className="flex items-center gap-0.5 text-accent" href={def.datasheetUrl} target="_blank" rel="noreferrer">
              datasheet <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>

      <div>
        <label className="label">Name (code identifier)</label>
        <CommitInput value={c.name} onCommit={(v) => update({ name: v })} className="input font-mono" data-testid="component-name" />
      </div>

      {isControllerLike && (
        <label className="flex items-center gap-2 text-[12px]">
          <input type="checkbox" checked={isPrimary} onChange={(e) => dispatch([{ type: "targets.update", patch: { controllerId: e.target.checked ? c.id : null } }])} />
          Primary controller (code-generation target)
        </label>
      )}

      {def.config.length > 0 && (
        <div className="space-y-2">
          <div className="label">Configuration</div>
          {def.config.map((f) => (
            <div key={f.key} className="grid grid-cols-[1fr_120px] items-center gap-2">
              <span className="text-[12px]" title={f.description}>
                {f.label} {f.unit && <span className="text-faint">({f.unit})</span>}
              </span>
              <ConfigInput field={f} value={c.config[f.key]} onChange={(v) => update({ config: { [f.key]: v } })} />
            </div>
          ))}
        </div>
      )}

      {(def.sensor || def.motor || def.servo) && (
        <div>
          <div className="label">Mount pose (URDF / TF)</div>
          <div className="grid grid-cols-4 gap-1">
            {(["x", "y", "z", "yawDeg"] as const).map((k) => (
              <div key={k}>
                <span className="text-[10px] text-faint">{k === "yawDeg" ? "yaw°" : `${k} m`}</span>
                <CommitInput
                  value={String(c.mount?.[k] ?? 0)}
                  onCommit={(v) => Number.isFinite(Number(v)) && update({ mount: { x: 0, y: 0, z: 0, yawDeg: 0, ...c.mount, [k]: Number(v) } })}
                  className="input px-1 font-mono"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn" onClick={autowire} data-testid="autowire"><Wand2 className="size-3.5" /> Auto-wire</button>
        <button
          className="btn btn-danger"
          onClick={() => {
            dispatch([{ type: "component.remove", componentId: c.id }]);
            select(null);
          }}
        >
          <Trash2 className="size-3.5" /> Remove
        </button>
      </div>

      {diags.length > 0 && (
        <div>
          <div className="label">Problems</div>
          <ul className="space-y-1.5">
            {diags.map((d, i) => (
              <li key={i} className="flex gap-1.5 text-[12px]">
                <SeverityIcon s={d.severity} className="mt-0.5" />
                <span>
                  {d.message}
                  {d.hint && <span className="block text-muted">{d.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="label">Connections ({wires.length})</div>
        <ul className="space-y-0.5 font-mono text-[11px]">
          {wires.map((w) => {
            const mine = w.from.componentId === c.id ? w.from : w.to;
            const other = w.from.componentId === c.id ? w.to : w.from;
            return (
              <li key={w.id} className="group flex items-center gap-1 rounded px-1 hover:bg-raised">
                <Cable className="size-3 text-faint" />
                <button className="flex-1 text-left" onClick={() => select({ kind: "connection", id: w.id })}>
                  {mine.pin} → {nameOf(other.componentId)}.{other.pin}
                </button>
                <button className="opacity-0 group-hover:opacity-100" onClick={() => dispatch([{ type: "connection.remove", connectionId: w.id }])} title="Disconnect">
                  <X className="size-3 text-err" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ConnectionProps({ id }: { id: string }) {
  const spec = useProject((s) => s.spec)!;
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const w = spec.connections.find((x) => x.id === id);
  if (!w) return <p className="p-3 text-muted">Connection removed.</p>;
  const nameOf = (cid: string) => spec.components.find((x) => x.id === cid)?.name ?? cid;
  const net = analysis?.ir.hardware.netByPin.get(`${w.from.componentId}:${w.from.pin}`);
  const diags = analysis?.report.diagnostics.filter((d) => d.connectionIds?.includes(id)) ?? [];
  return (
    <div className="space-y-4 p-3">
      <div className="font-mono text-[12px]">
        {nameOf(w.from.componentId)}.{w.from.pin} <span className="text-faint">↔</span> {nameOf(w.to.componentId)}.{w.to.pin}
      </div>
      {net && (
        <div>
          <div className="label">Net {net.name} ({net.kind})</div>
          <ul className="font-mono text-[11px] text-muted">
            {net.pins.map((p) => (
              <li key={`${p.componentId}:${p.pin}`}>{nameOf(p.componentId)}.{p.pin} <span className="text-faint">{p.def?.type}</span></li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label className="label">Label</label>
        <CommitInput value={w.label ?? ""} onCommit={(v) => dispatch([{ type: "connection.update", connectionId: id, patch: { label: v } }])} />
      </div>
      {diags.map((d, i) => (
        <div key={i} className="flex gap-1.5 text-[12px]"><SeverityIcon s={d.severity} className="mt-0.5" /> {d.message}</div>
      ))}
      <button
        className="btn btn-danger"
        onClick={() => {
          dispatch([{ type: "connection.remove", connectionId: id }]);
          select(null);
        }}
      >
        <Trash2 className="size-3.5" /> Disconnect
      </button>
    </div>
  );
}

export function HardwarePropertiesPanel({ empty }: { empty?: React.ReactNode }) {
  const selection = useProject((s) => s.selection);
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  let body: React.ReactNode = empty ?? <p className="p-3 text-muted">Select a component or wire.</p>;
  if (selection?.kind === "component") {
    const c = spec.components.find((x) => x.id === selection.id);
    const def = c && catalog.get(c.ref.catalogId, c.ref.version);
    if (c && def) body = <ComponentProps key={c.id} c={c} def={def} />;
  } else if (selection?.kind === "connection") {
    body = <ConnectionProps id={selection.id} />;
  }
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-panel">
      <div className="panel-title">Properties</div>
      <div className="flex-1 overflow-auto">{body}</div>
    </aside>
  );
}
