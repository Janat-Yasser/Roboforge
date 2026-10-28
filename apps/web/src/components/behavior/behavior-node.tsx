"use client";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import { NODE_KINDS, outputPorts, hasInput, type BehaviorNode as SpecNode, type Severity } from "@roboforge/spec";
import { GROUP_COLOR } from "./node-meta";

export interface BehaviorNodeData extends Record<string, unknown> {
  node: SpecNode;
  summary: string;
  severity?: Severity;
  pc?: number;
}

export type BehaviorFlowNode = Node<BehaviorNodeData, "behavior">;

const PORT_COLOR: Record<string, string> = { true: "var(--color-ok)", false: "var(--color-err)", error: "var(--color-warn)", done: "var(--color-accent)" };

export const BehaviorNodeView = memo(function BehaviorNodeView({ data, selected }: NodeProps<BehaviorFlowNode>) {
  const n = data.node;
  const info = NODE_KINDS.find((k) => k.kind === n.kind)!;
  const color = GROUP_COLOR[info.group]!;
  const ports = outputPorts(n);
  const isEvent = !hasInput(n);
  return (
    <div
      className={clsx(
        "w-[210px] border border-l-4 bg-panel shadow-[var(--rf-shadow)] transition-[box-shadow,border-color] duration-200 hover:shadow-[var(--rf-shadow-lg)]",
        isEvent ? "rounded-2xl" : "rounded-xl",
        selected ? "border-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--rf-accent)_20%,transparent)]" : "border-border-strong",
        data.severity === "error" && "ring-2 ring-err",
        data.severity === "warning" && "ring-2 ring-warn",
      )}
      style={{ borderLeftColor: color }}
    >
      {!isEvent && <Handle type="target" position={Position.Top} id="in" style={{ width: 10, height: 10, background: "var(--color-panel-2)", borderColor: color }} />}
      <div className={clsx("flex items-center gap-1.5 border-b border-border px-2.5 py-1", isEvent ? "rounded-tr-2xl" : "rounded-tr-xl")} style={{ background: `color-mix(in srgb, ${color} 16%, var(--color-panel))` }}>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{info.title}</span>
        {data.pc !== undefined && <span className="ml-auto font-mono text-[9px] text-faint" title="Program counter in generated code">pc {data.pc}</span>}
      </div>
      <div className="px-2.5 py-1.5">
        {n.label && <div className="truncate text-[12px] font-medium">{n.label}</div>}
        <div className="truncate font-mono text-[11px] text-muted">{data.summary}</div>
      </div>
      {ports.length > 0 && (
        <div className="relative flex h-5 justify-around border-t border-border/60 text-[9.5px] text-muted">
          {ports.map((p) => (
            <div key={p} className="relative flex flex-1 items-start justify-center pt-0.5" style={{ color: PORT_COLOR[p] }}>
              {ports.length > 1 || p !== "next" ? p.replace("_", " ") : ""}
              <Handle
                type="source"
                position={Position.Bottom}
                id={p}
                style={{ left: "50%", width: 10, height: 10, background: PORT_COLOR[p] ?? color, borderColor: "var(--color-bg)" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
