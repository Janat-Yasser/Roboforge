"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { newId, type BehaviorNodeKind, type Severity } from "@roboforge/spec";
import { useAnalysis, useProject } from "@/lib/store";
import { BehaviorNodeView, type BehaviorFlowNode } from "./behavior-node";
import { newNodeCommands, summarize } from "./node-meta";

const nodeTypes = { behavior: BehaviorNodeView };
export const NODE_DRAG_MIME = "application/roboforge-node";
const PORT_STROKE: Record<string, string> = { true: "var(--color-ok)", false: "var(--color-err)", error: "var(--color-warn)" };

function Inner() {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const selection = useProject((s) => s.selection);
  const dispatch = useProject((s) => s.dispatch);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const { screenToFlowPosition } = useReactFlow();

  const derived = useMemo(() => {
    const sev: Record<string, Severity> = {};
    for (const d of analysis?.report.diagnostics ?? []) {
      if (d.severity === "info") continue;
      for (const id of d.nodeIds ?? []) sev[id] = sev[id] === "error" ? "error" : d.severity;
    }
    const pcOf = new Map(analysis?.ir.behavior.nodes.map((n) => [n.nodeId, n.pc]) ?? []);
    const nodes: BehaviorFlowNode[] = spec.behavior.nodes.map((n) => ({
      id: n.id,
      type: "behavior",
      position: n.position,
      selected: selection?.kind === "node" && selection.id === n.id,
      data: { node: n, summary: summarize(n, spec), severity: sev[n.id], pc: pcOf.get(n.id) },
    }));
    const edges: Edge[] = spec.behavior.edges.map((e) => ({
      id: e.id,
      source: e.source,
      sourceHandle: e.sourcePort,
      target: e.target,
      targetHandle: "in",
      type: "smoothstep",
      selected: selection?.kind === "edge" && selection.id === e.id,
      markerEnd: { type: MarkerType.ArrowClosed, color: PORT_STROKE[e.sourcePort] ?? "#5d6b7e" },
      style: { stroke: PORT_STROKE[e.sourcePort] ?? "#6b7a8f", strokeWidth: 1.6 },
    }));
    return { nodes, edges };
  }, [spec, analysis, selection]);

  const [nodes, setNodes] = useState(derived.nodes);
  const [edges, setEdges] = useState(derived.edges);
  useEffect(() => setNodes(derived.nodes), [derived.nodes]);
  useEffect(() => setEdges(derived.edges), [derived.edges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || !c.sourceHandle) return;
      dispatch([{ type: "behavior.edge.add", edge: { id: newId("e"), source: c.source, sourcePort: c.sourceHandle, target: c.target } }]);
    },
    [dispatch],
  );

  const defOf = useCallback(
    (id: string) => {
      const c = spec.components.find((x) => x.id === id);
      return c ? catalog.get(c.ref.catalogId, c.ref.version) : undefined;
    },
    [spec.components, catalog],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={(ch: NodeChange<BehaviorFlowNode>[]) => setNodes((ns) => applyNodeChanges(ch.filter((c) => c.type !== "remove"), ns))}
      onEdgesChange={(ch: EdgeChange[]) => setEdges((es) => applyEdgeChanges(ch.filter((c) => c.type !== "remove"), es))}
      onConnect={onConnect}
      onNodeDragStop={(_, __, dragged) =>
        dispatch(dragged.map((n) => ({ type: "behavior.node.update" as const, nodeId: n.id, patch: { position: { x: Math.round(n.position.x), y: Math.round(n.position.y) } } })), "Move nodes")
      }
      onNodeClick={(_, n) => select({ kind: "node", id: n.id })}
      onEdgeClick={(_, e) => select({ kind: "edge", id: e.id })}
      onPaneClick={() => select(null)}
      onNodesDelete={(ns) => {
        dispatch(ns.map((n) => ({ type: "behavior.node.remove" as const, nodeId: n.id })));
        select(null);
      }}
      onEdgesDelete={(es) => dispatch(es.map((e) => ({ type: "behavior.edge.remove" as const, edgeId: e.id })))}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        const kind = e.dataTransfer.getData(NODE_DRAG_MIME) as BehaviorNodeKind;
        if (!kind) return;
        e.preventDefault();
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const { id, commands } = newNodeCommands(kind, spec, defOf, { x: Math.round(p.x - 105), y: Math.round(p.y - 30) });
        if (dispatch(commands)) select({ kind: "node", id });
      }}
      deleteKeyCode={["Delete", "Backspace"]}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Lines} gap={24} color="#18212e" />
      <Controls />
      <MiniMap pannable zoomable maskColor="rgba(13,17,23,0.7)" />
    </ReactFlow>
  );
}

export function BehaviorCanvas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
