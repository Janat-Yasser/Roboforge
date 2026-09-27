"use client";
import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import clsx from "clsx";
import type { ComponentDefinition, ComponentInstance, PinDef, Severity } from "@roboforge/spec";
import { CATEGORY_COLOR, pinColumns, SIGNAL_COLOR, signalClass } from "./pin-style";

export interface ComponentNodeData extends Record<string, unknown> {
  instance: ComponentInstance;
  def: ComponentDefinition;
  isController: boolean;
  /** pin name → inferred function (controllers) */
  pinFns: Record<string, string | undefined>;
  connectedPins: Set<string>;
  pinSeverity: Record<string, Severity>;
  severity?: Severity;
}

export type ComponentFlowNode = Node<ComponentNodeData, "component">;

const SEV_RING: Record<Severity, string> = { error: "ring-2 ring-err", warning: "ring-2 ring-warn", info: "" };

function PinRow({ pin, side, data }: { pin: PinDef; side: "left" | "right"; data: ComponentNodeData }) {
  const fn = data.pinFns[pin.name];
  const cls = signalClass(pin.type, pin.type === "gpio" ? fn : undefined);
  const connected = data.connectedPins.has(pin.name);
  const sev = data.pinSeverity[pin.name];
  const flags = pin.flags ?? [];
  const title = [
    `${pin.name}${pin.label && pin.label !== pin.name ? ` (${pin.label})` : ""} — ${pin.type}`,
    pin.voltage ? `${pin.voltage.min}–${pin.voltage.max} V` : "",
    pin.outputVoltage ? `${pin.outputVoltage} V out` : "",
    fn ? `assigned: ${fn}` : "",
    flags.length ? `flags: ${flags.join(", ")}` : "",
    pin.notes ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <div className={clsx("relative flex h-[18px] items-center gap-1 px-2 text-[10.5px]", side === "right" && "flex-row-reverse text-right")} title={title}>
      <Handle
        type="source"
        id={pin.name}
        position={side === "left" ? Position.Left : Position.Right}
        style={{ background: connected ? SIGNAL_COLOR[cls] : "var(--color-panel-2)", borderColor: SIGNAL_COLOR[cls], width: 9, height: 9 }}
      />
      <span className={clsx("font-mono", flags.includes("reserved") ? "text-faint line-through" : connected ? "text-fg" : "text-muted", sev === "error" && "text-err", sev === "warning" && "text-warn")}>
        {pin.label ?? pin.name}
      </span>
      {fn && <span className="rounded px-1 text-[9px]" style={{ color: SIGNAL_COLOR[cls], background: "color-mix(in srgb, currentColor 12%, transparent)" }}>{fn}</span>}
    </div>
  );
}

export const ComponentNode = memo(function ComponentNode({ data, selected }: NodeProps<ComponentFlowNode>) {
  const { def, instance } = data;
  const [left, right] = pinColumns(def.pins, data.isController);
  const color = CATEGORY_COLOR[def.category];
  return (
    <div
      className={clsx(
        "min-w-[190px] rounded-md border bg-panel shadow-lg",
        selected ? "border-accent" : "border-border-strong",
        data.severity && SEV_RING[data.severity],
      )}
    >
      <div className="flex items-center gap-2 rounded-t-md border-b border-border px-2 py-1.5" style={{ background: `color-mix(in srgb, ${color} 14%, var(--color-panel))` }}>
        <span className="size-2 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <div className="truncate font-mono text-[12px] font-semibold">{instance.name}</div>
          <div className="truncate text-[10px] text-muted">{def.name}</div>
        </div>
      </div>
      <div className="flex justify-between gap-4 py-1">
        <div className="min-w-0">{left.map((p) => <PinRow key={p.name} pin={p} side="left" data={data} />)}</div>
        <div className="min-w-0">{right.map((p) => <PinRow key={p.name} pin={p} side="right" data={data} />)}</div>
      </div>
    </div>
  );
});
