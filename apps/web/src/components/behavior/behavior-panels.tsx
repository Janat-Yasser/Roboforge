// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { Plus, Trash2, X } from "lucide-react";
import { CompareOp, NODE_KINDS, type BehaviorNode, type BehaviorNodeKind, type ComponentDefinition, type Operand } from "@roboforge/spec";
import { useAnalysis, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { CommitInput } from "../hardware/properties-panel";
import { SeverityIcon } from "../ide/validation-bar";
import { NODE_DRAG_MIME } from "./behavior-canvas";
import { GROUP_COLOR, newNodeCommands } from "./node-meta";

function useDefOf() {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  return (id: string): ComponentDefinition | undefined => {
    const c = spec.components.find((x) => x.id === id);
    return c ? catalog.get(c.ref.catalogId, c.ref.version) : undefined;
  };
}

export function BehaviorPalette() {
  const spec = useProject((s) => s.spec)!;
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const defOf = useDefOf();
  const groups = [...new Set(NODE_KINDS.map((k) => k.group))];
  function add(kind: BehaviorNodeKind) {
    const maxY = Math.max(0, ...spec.behavior.nodes.map((n) => n.position.y));
    const { id, commands } = newNodeCommands(kind, spec, defOf, { x: 0, y: maxY + 160 });
    if (dispatch(commands)) select({ kind: "node", id });
  }
  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-auto border-r border-border bg-panel">
      <div className="panel-title">Nodes</div>
      {groups.map((g) => (
        <div key={g} className="px-2 pb-2">
          <div className="px-1 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: GROUP_COLOR[g] }}>{g}</div>
          {NODE_KINDS.filter((k) => k.group === g).map((k) => (
            <div
              key={k.kind}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(NODE_DRAG_MIME, k.kind)}
              onDoubleClick={() => add(k.kind)}
              className="group flex cursor-grab items-center justify-between rounded px-2 py-1 hover:bg-raised"
              title={`${k.description}\nDrag onto the canvas or double-click.`}
              data-testid={`palette-${k.kind}`}
            >
              <span>{k.title}</span>
              <button className="opacity-0 group-hover:opacity-100" onClick={() => add(k.kind)}><Plus className="size-3.5 text-muted" /></button>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

function OperandInput({ value, onChange, variables }: { value: Operand; onChange: (o: Operand) => void; variables: string[] }) {
  return (
    <div className="flex gap-1">
      <select className="input w-20" value={value.kind} onChange={(e) => onChange(e.target.value === "var" ? { kind: "var", name: variables[0] ?? "value" } : { kind: "const", value: 0 })}>
        <option value="var">var</option>
        <option value="const">const</option>
      </select>
      {value.kind === "var" ? (
        <select className="input font-mono" value={value.name} onChange={(e) => onChange({ kind: "var", name: e.target.value })}>
          {!variables.includes(value.name) && <option value={value.name}>{value.name} (undeclared)</option>}
          {variables.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : (
        <CommitInput className="input font-mono" value={String(value.value)} onCommit={(v) => Number.isFinite(Number(v)) && onChange({ kind: "const", value: Number(v) })} />
      )}
    </div>
  );
}

function ComponentSelect({ value, onChange, filter }: { value: string; onChange: (id: string) => void; filter: (d: ComponentDefinition) => boolean }) {
  const spec = useProject((s) => s.spec)!;
  const defOf = useDefOf();
  const options = spec.components.filter((c) => {
    const d = defOf(c.id);
    return d ? filter(d) : false;
  });
  return (
    <select className="input font-mono" value={value} onChange={(e) => onChange(e.target.value)}>
      {!options.some((o) => o.id === value) && <option value={value}>{value ? "⚠ missing component" : "— choose —"}</option>}
      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function NodeProperties({ node }: { node: BehaviorNode }) {
  const spec = useProject((s) => s.spec)!;
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const defOf = useDefOf();
  const vars = spec.behavior.variables.map((v) => v.name);
  const states = spec.behavior.states;
  const info = NODE_KINDS.find((k) => k.kind === node.kind)!;
  const setParams = (params: object) => dispatch([{ type: "behavior.node.update", nodeId: node.id, patch: { params: params as Record<string, unknown> } }]);
  const p = node.params as Record<string, unknown>;
  const num = (key: string, label: string, unit?: string) => (
    <Field label={`${label}${unit ? ` (${unit})` : ""}`}>
      <CommitInput className="input font-mono" value={String(p[key])} onCommit={(v) => (Number.isFinite(Number(v)) ? setParams({ ...p, [key]: Number(v) }) : toast.error("Not a number"))} />
    </Field>
  );
  const diags = analysis?.report.diagnostics.filter((d) => d.nodeIds?.includes(node.id)) ?? [];

  let body: React.ReactNode = null;
  switch (node.kind) {
    case "event.timer": body = num("periodMs", "Period", "ms"); break;
    case "delay": body = num("ms", "Duration", "ms"); break;
    case "event.state_enter":
    case "state.set":
      body = (
        <Field label="State">
          <select className="input font-mono" value={node.params.state} onChange={(e) => setParams({ state: e.target.value })}>
            {!states.includes(node.params.state) && <option>{node.params.state}</option>}
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      );
      break;
    case "event.estop":
      body = <Field label="Switch input"><ComponentSelect value={node.params.componentId} filter={(d) => d.sensor?.kind === "switch"} onChange={(id) => setParams({ componentId: id })} /></Field>;
      break;
    case "sensor.read": {
      const channels = defOf(node.params.componentId)?.sensor?.channels ?? [];
      body = (
        <>
          <Field label="Sensor">
            <ComponentSelect value={node.params.componentId} filter={(d) => !!d.sensor} onChange={(id) => setParams({ ...node.params, componentId: id, channel: defOf(id)?.sensor?.channels[0]?.id ?? "" })} />
          </Field>
          <Field label="Channel">
            <select className="input font-mono" value={node.params.channel} onChange={(e) => setParams({ ...node.params, channel: e.target.value })}>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.unit})</option>)}
            </select>
          </Field>
          <Field label="Store in variable">
            <select className="input font-mono" value={node.params.variable} onChange={(e) => setParams({ ...node.params, variable: e.target.value })}>
              {!vars.includes(node.params.variable) && <option>{node.params.variable}</option>}
              {vars.map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <p className="text-[11px] text-faint">The <b>error</b> port runs when a read fails; if unconnected, the read is retried on the next tick.</p>
        </>
      );
      break;
    }
    case "motor.set":
      body = (
        <Field label="Motor commands (−1 … 1)">
          <div className="space-y-1">
            {node.params.commands.map((c, i) => (
              <div key={i} className="flex gap-1">
                <ComponentSelect value={c.componentId} filter={(d) => !!d.motor} onChange={(id) => setParams({ commands: node.params.commands.map((x, j) => (j === i ? { ...x, componentId: id } : x)) })} />
                <CommitInput className="input w-20 font-mono" value={String(c.speed)} onCommit={(v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n) || n < -1 || n > 1) return toast.error("Speed must be between -1 and 1");
                  setParams({ commands: node.params.commands.map((x, j) => (j === i ? { ...x, speed: n } : x)) });
                }} />
                <button className="btn btn-ghost px-1" disabled={node.params.commands.length === 1} onClick={() => setParams({ commands: node.params.commands.filter((_, j) => j !== i) })}><X className="size-3" /></button>
              </div>
            ))}
            <button className="btn" onClick={() => setParams({ commands: [...node.params.commands, { componentId: "", speed: 0 }] })}><Plus className="size-3" /> Motor</button>
          </div>
        </Field>
      );
      break;
    case "motor.stop":
      body = (
        <Field label="Motors (none selected = all)">
          <div className="space-y-1">
            {spec.components.filter((c) => defOf(c.id)?.motor).map((c) => (
              <label key={c.id} className="flex items-center gap-2 font-mono text-[12px]">
                <input type="checkbox" checked={node.params.componentIds.includes(c.id)} onChange={(e) => setParams({ componentIds: e.target.checked ? [...node.params.componentIds, c.id] : node.params.componentIds.filter((x) => x !== c.id) })} />
                {c.name}
              </label>
            ))}
          </div>
        </Field>
      );
      break;
    case "servo.set":
      body = (
        <>
          <Field label="Servo"><ComponentSelect value={node.params.componentId} filter={(d) => !!d.servo} onChange={(id) => setParams({ ...node.params, componentId: id })} /></Field>
          {num("angleDeg", "Angle", "°")}
        </>
      );
      break;
    case "condition":
      body = (
        <>
          <Field label="Left"><OperandInput value={node.params.left} variables={vars} onChange={(o) => setParams({ ...node.params, left: o })} /></Field>
          <Field label="Operator">
            <select className="input font-mono" value={node.params.op} onChange={(e) => setParams({ ...node.params, op: e.target.value })}>
              {CompareOp.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Right"><OperandInput value={node.params.right} variables={vars} onChange={(o) => setParams({ ...node.params, right: o })} /></Field>
        </>
      );
      break;
    case "sequence": body = num("steps", "Steps"); break;
    case "parallel": body = num("branches", "Branches"); break;
    case "variable.set":
      body = (
        <>
          <Field label="Variable">
            <select className="input font-mono" value={node.params.variable} onChange={(e) => setParams({ ...node.params, variable: e.target.value })}>
              {!vars.includes(node.params.variable) && <option>{node.params.variable}</option>}
              {vars.map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Operation">
            <select className="input" value={node.params.op} onChange={(e) => setParams({ ...node.params, op: e.target.value })}>
              <option value="set">=</option><option value="add">+=</option><option value="sub">−=</option><option value="mul">×=</option>
            </select>
          </Field>
          <Field label="Value"><OperandInput value={node.params.value} variables={vars} onChange={(o) => setParams({ ...node.params, value: o })} /></Field>
        </>
      );
      break;
    case "function":
      body = (
        <>
          <Field label="Function name"><CommitInput className="input font-mono" value={node.params.name} onCommit={(v) => setParams({ name: v })} /></Field>
          <p className="text-[11px] text-faint">Generates a stub in <code>firmware/src/user/user_functions.cpp</code> and <code>user_functions.py</code> inside a USER region you own.</p>
        </>
      );
      break;
    case "log":
      body = <Field label="Message"><CommitInput value={node.params.message} onCommit={(v) => setParams({ message: v })} /></Field>;
      break;
    default:
      body = null;
  }

  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="font-semibold">{info.title}</div>
        <p className="text-[12px] text-muted">{info.description}</p>
      </div>
      <Field label="Label"><CommitInput value={node.label ?? ""} onCommit={(v) => dispatch([{ type: "behavior.node.update", nodeId: node.id, patch: { label: v } }])} /></Field>
      {body}
      {diags.map((d, i) => (
        <div key={i} className="flex gap-1.5 text-[12px]"><SeverityIcon s={d.severity} className="mt-0.5" /><span>{d.message}{d.hint && <span className="block text-muted">{d.hint}</span>}</span></div>
      ))}
      <button className="btn btn-danger" onClick={() => { dispatch([{ type: "behavior.node.remove", nodeId: node.id }]); select(null); }}><Trash2 className="size-3.5" /> Delete node</button>
    </div>
  );
}

function VariablesAndStates() {
  const spec = useProject((s) => s.spec)!;
  const dispatch = useProject((s) => s.dispatch);
  const analysis = useAnalysis();
  const b = spec.behavior;
  return (
    <div className="space-y-5 p-3">
      <div>
        <div className="label">Variables (float)</div>
        <div className="space-y-1">
          {b.variables.map((v) => (
            <div key={v.name} className="flex items-center gap-1">
              <span className="flex-1 font-mono text-[12px]">{v.name}</span>
              <CommitInput className="input w-20 font-mono" value={String(v.initial)} onCommit={(x) => Number.isFinite(Number(x)) && dispatch([{ type: "behavior.variable.upsert", variable: { ...v, initial: Number(x) } }])} />
              <button className="btn btn-ghost px-1" onClick={() => dispatch([{ type: "behavior.variable.remove", name: v.name }])}><X className="size-3" /></button>
            </div>
          ))}
          <CommitInput className="input font-mono" value="" placeholder="+ new_variable" onCommit={(x) => x.trim() && dispatch([{ type: "behavior.variable.upsert", variable: { name: x.trim(), initial: 0 } }])} />
        </div>
      </div>
      <div>
        <div className="label">States (first is initial)</div>
        <div className="space-y-1">
          {b.states.map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className="flex-1 font-mono text-[12px]">{s}</span>
              <button className="btn btn-ghost px-1" onClick={() => dispatch([{ type: "behavior.states.set", states: b.states.filter((x) => x !== s) }])}><X className="size-3" /></button>
            </div>
          ))}
          <CommitInput className="input font-mono" value="" placeholder="+ NEW_STATE" onCommit={(x) => x.trim() && dispatch([{ type: "behavior.states.set", states: [...b.states, x.trim().toUpperCase()] }])} />
        </div>
      </div>
      {analysis && (
        <div>
          <div className="label">Compiled runtime</div>
          <ul className="space-y-0.5 text-[12px] text-muted">
            {analysis.ir.behavior.fibers.map((f) => (
              <li key={f.index}><span className="font-mono text-faint">fiber {f.index}</span> {f.name} <span className="text-faint">({f.trigger.kind === "timer" ? `every ${f.trigger.periodMs} ms` : f.trigger.kind})</span></li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-faint">Each event and each Sequence/Parallel branch becomes a cooperative fiber in firmware/src/behavior.cpp and the ROS 2 node. Waits never block; e-stop latching is enforced by the runtime.</p>
        </div>
      )}
    </div>
  );
}

export function BehaviorProperties() {
  const selection = useProject((s) => s.selection);
  const spec = useProject((s) => s.spec)!;
  const dispatch = useProject((s) => s.dispatch);
  const node = selection?.kind === "node" ? spec.behavior.nodes.find((n) => n.id === selection.id) : undefined;
  const edge = selection?.kind === "edge" ? spec.behavior.edges.find((e) => e.id === selection.id) : undefined;
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-panel">
      <div className="panel-title">{node ? "Node" : edge ? "Transition" : "Behavior"}</div>
      <div className="flex-1 overflow-auto">
        {node ? (
          <NodeProperties key={node.id} node={node} />
        ) : edge ? (
          <div className="space-y-3 p-3 text-[12px]">
            <p className="font-mono">{edge.source} —{edge.sourcePort}→ {edge.target}</p>
            <button className="btn btn-danger" onClick={() => dispatch([{ type: "behavior.edge.remove", edgeId: edge.id }])}><Trash2 className="size-3.5" /> Delete transition</button>
          </div>
        ) : (
          <VariablesAndStates />
        )}
      </div>
    </aside>
  );
}
