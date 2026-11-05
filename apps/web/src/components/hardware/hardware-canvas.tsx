// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection as FlowConnection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { newId, toIdentifier, type ComponentDefinition, type Severity } from "@roboforge/spec";
import { useAnalysis, useProject } from "@/lib/store";
import { ComponentNode, type ComponentFlowNode } from "./component-node";
import { CATEGORY_COLOR, SIGNAL_COLOR, signalClass } from "./pin-style";

const nodeTypes = { component: ComponentNode };
export const DRAG_MIME = "application/roboforge-component";

const worse = (a: Severity | undefined, b: Severity): Severity => (a === "error" || b === "error" ? "error" : a === "warning" || b === "warning" ? "warning" : "info");

/** Picks a unique, meaningful identifier for a new component instance. */
export function defaultInstanceName(def: ComponentDefinition, taken: Set<string>): string {
  const base = toIdentifier(
    def.category === "controller" || def.category === "sbc"
      ? "mcu"
      : def.sensor
        ? def.sensor.kind === "switch" ? (def.tags.includes("estop") ? "estop" : "switch") : def.sensor.kind === "distance" ? "range_sensor" : def.sensor.kind
        : def.category === "motor_driver" ? "motor_driver" : def.category === "power" ? "battery" : def.category,
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}_${i}`)) return `${base}_${i}`;
}

/** Rough on-canvas size of a component node (pins are split over two columns). */
export function estimateNodeSize(def: ComponentDefinition): { w: number; h: number } {
  const isCtrl = def.category === "controller" || def.category === "sbc";
  const rows = isCtrl ? Math.ceil(def.pins.length / 2) : Math.max(1, ...[0, 1].map((side) => def.pins.filter((p) => ["power_out", "digital_out", "analog_out", "uart_tx", "motor_out", "can_h", "can_l", "can_rxd", "ethernet", "usb"].includes(p.type) === (side === 1)).length));
  return { w: isCtrl ? 280 : 240, h: 52 + rows * 18 };
}

/** First free grid slot (left-to-right, top-to-bottom) that does not overlap existing nodes. */
export function findFreeSpot(existing: { x: number; y: number; w: number; h: number }[], size: { w: number; h: number }): { x: number; y: number } {
  const gap = 40;
  for (let y = 60; y < 6000; y += 40) {
    for (let col = 0; col < 5; col++) {
      const x = 60 + col * 340;
      const hit = existing.some((r) => x < r.x + r.w + gap && x + size.w + gap > r.x && y < r.y + r.h + gap && y + size.h + gap > r.y);
      if (!hit) return { x, y };
    }
  }
  return { x: 60, y: 60 };
}

function CanvasInner() {
  const { resolvedTheme } = useTheme();
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const selection = useProject((s) => s.selection);
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const { screenToFlowPosition } = useReactFlow();

  const derived = useMemo(() => {
    const hw = analysis?.ir.hardware;
    const compSev: Record<string, Severity> = {};
    const pinSev: Record<string, Record<string, Severity>> = {};
    const connSev: Record<string, Severity> = {};
    for (const d of analysis?.report.diagnostics ?? []) {
      if (d.severity === "info") continue;
      for (const id of d.componentIds ?? []) compSev[id] = worse(compSev[id], d.severity);
      for (const id of d.connectionIds ?? []) connSev[id] = worse(connSev[id], d.severity);
      for (const p of d.pins ?? []) {
        const [cid, pin] = p.split(":");
        (pinSev[cid!] ??= {})[pin!] = worse(pinSev[cid!]?.[pin!], d.severity);
      }
    }
    const nodes: ComponentFlowNode[] = spec.components.flatMap((c) => {
      const def = catalog.get(c.ref.catalogId, c.ref.version);
      if (!def) return [];
      const isController = hw?.controller?.instance.id === c.id || def.category === "controller" || def.category === "sbc";
      const pinFns: Record<string, string | undefined> = {};
      if (hw?.controller?.instance.id === c.id) for (const a of hw.pinAssignments) pinFns[a.pin] = a.fn;
      const connectedPins = new Set(spec.connections.flatMap((w) => [w.from, w.to]).filter((e) => e.componentId === c.id).map((e) => e.pin));
      return [
        {
          id: c.id,
          type: "component" as const,
          position: c.layout,
          selected: selection?.kind === "component" && selection.id === c.id,
          data: { instance: c, def, isController, pinFns, connectedPins, pinSeverity: pinSev[c.id] ?? {}, severity: compSev[c.id] },
        },
      ];
    });
    const edges: Edge[] = spec.connections.map((w) => {
      const fromDef = catalog.get(spec.components.find((c) => c.id === w.from.componentId)?.ref.catalogId ?? "")?.pins.find((p) => p.name === w.from.pin);
      const toDef = catalog.get(spec.components.find((c) => c.id === w.to.componentId)?.ref.catalogId ?? "")?.pins.find((p) => p.name === w.to.pin);
      const devicePin = fromDef?.type === "gpio" ? toDef : fromDef;
      const cls = signalClass(devicePin?.type);
      const sev = connSev[w.id];
      const color = sev === "error" ? "var(--color-err)" : sev === "warning" ? "var(--color-warn)" : SIGNAL_COLOR[cls];
      return {
        id: w.id,
        source: w.from.componentId,
        sourceHandle: w.from.pin,
        target: w.to.componentId,
        targetHandle: w.to.pin,
        type: "smoothstep",
        selected: selection?.kind === "connection" && selection.id === w.id,
        style: { stroke: color, strokeWidth: sev ? 2.5 : 1.6, strokeDasharray: cls === "ground" ? "4 3" : undefined },
        label: w.label,
      };
    });
    return { nodes, edges };
  }, [spec, catalog, analysis, selection]);

  const [nodes, setNodes] = useState<ComponentFlowNode[]>(derived.nodes);
  const [edges, setEdges] = useState<Edge[]>(derived.edges);
  useEffect(() => setNodes(derived.nodes), [derived.nodes]);
  useEffect(() => setEdges(derived.edges), [derived.edges]);

  const onNodesChange = useCallback((changes: NodeChange<ComponentFlowNode>[]) => {
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), ns));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((es) => applyEdgeChanges(changes.filter((c) => c.type !== "remove"), es));
  }, []);

  const onConnect = useCallback(
    (c: FlowConnection) => {
      if (!c.source || !c.target || !c.sourceHandle || !c.targetHandle) return;
      dispatch([{ type: "connection.add", connection: { id: newId("w"), from: { componentId: c.source, pin: c.sourceHandle }, to: { componentId: c.target, pin: c.targetHandle } } }]);
    },
    [dispatch],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;
      e.preventDefault();
      const { id, version } = JSON.parse(raw) as { id: string; version: string };
      const def = catalog.get(id, version);
      if (!def) return;
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const cid = newId("c");
      const name = defaultInstanceName(def, new Set(spec.components.map((c) => c.name)));
      if (dispatch([{ type: "component.add", component: { id: cid, name, ref: { catalogId: def.id, version: def.version }, config: {}, layout: { x: Math.round(pos.x), y: Math.round(pos.y) } } }])) {
        select({ kind: "component", id: cid });
      }
    },
    [catalog, dispatch, screenToFlowPosition, select, spec.components],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      connectionMode={ConnectionMode.Loose}
      onNodeDragStop={(_, __, dragged) =>
        dispatch(dragged.map((n) => ({ type: "component.update" as const, componentId: n.id, patch: { layout: { x: Math.round(n.position.x), y: Math.round(n.position.y) } } })), "Move components")
      }
      onNodeClick={(_, n) => select({ kind: "component", id: n.id })}
      onEdgeClick={(_, e) => select({ kind: "connection", id: e.id })}
      onPaneClick={() => select(null)}
      onNodesDelete={(ns) => {
        dispatch(ns.map((n) => ({ type: "component.remove" as const, componentId: n.id })));
        select(null);
      }}
      onEdgesDelete={(es) => dispatch(es.map((e) => ({ type: "connection.remove" as const, connectionId: e.id })))}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={onDrop}
      deleteKeyCode={["Delete", "Backspace"]}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.15}
      proOptions={{ hideAttribution: true }}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
    >
      <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="var(--rf-grid-dot)" />
      <Controls />
      <MiniMap pannable zoomable nodeColor={(n) => CATEGORY_COLOR[(n.data as { def: ComponentDefinition }).def.category]} maskColor="var(--rf-minimap-mask)" bgColor="var(--rf-panel)" />
    </ReactFlow>
  );
}

export function HardwareCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
