import {
  outputPorts,
  type BehaviorGraph,
  type BehaviorNode,
  type Diagnostic,
  type Operand,
} from "@roboforge/spec";
import type { HardwareIR, ResolvedComponent } from "../types";
import { PC_END, type BehaviorIR, type CompiledNode, type FiberIR, type FiberTrigger, type OpIR, type OperandIR } from "./types";

const STEP_BUDGET = 32;

interface CompileResult {
  ir: BehaviorIR;
  diagnostics: Diagnostic[];
}

/**
 * Compiles the behavior graph into fibers of a cooperative state machine.
 *
 * - Every event node and every Sequence/Parallel branch becomes a fiber with its own program
 *   counter; the same node code can be executed by several fibers.
 * - Program counters are assigned in discovery order so generated code is stable for a given graph.
 */
export function compileBehavior(graph: BehaviorGraph, hw: HardwareIR): CompileResult {
  const diags: Diagnostic[] = [];
  const err = (code: string, message: string, nodeIds: string[], extra: Partial<Diagnostic> = {}) =>
    diags.push({ severity: "error", category: "software", code, message, nodeIds, source: "behavior-compiler", ...extra });
  const warn = (code: string, message: string, nodeIds: string[], extra: Partial<Diagnostic> = {}) =>
    diags.push({ severity: "warning", category: "software", code, message, nodeIds, source: "behavior-compiler", ...extra });

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const succ = new Map<string, string>(); // `${source}:${port}` -> target
  for (const e of graph.edges) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target)) {
      err("BEHAVIOR_DANGLING_EDGE", `Edge '${e.id}' references a node that does not exist.`, [e.source, e.target]);
      continue;
    }
    succ.set(`${e.source}:${e.sourcePort}`, e.target);
  }

  const variables = new Set(graph.variables.map((v) => v.name));
  const states = new Set(graph.states);
  const comp = (id: string) => hw.byId.get(id);
  const name = (id: string) => comp(id)?.instance.name ?? id;
  const title = (n: BehaviorNode) => n.label ?? n.kind;

  const checkVar = (n: BehaviorNode, v: string) => {
    if (!variables.has(v)) err("BEHAVIOR_UNDECLARED_VARIABLE", `'${title(n)}' uses undeclared variable '${v}'.`, [n.id], { hint: "Declare it in the Variables panel." });
  };
  const checkOperand = (n: BehaviorNode, o: Operand) => {
    if (o.kind === "var") checkVar(n, o.name);
  };
  const requireKind = (n: BehaviorNode, id: string, pred: (rc: ResolvedComponent) => boolean, what: string) => {
    const rc = comp(id);
    if (!rc) {
      err("BEHAVIOR_MISSING_COMPONENT", `'${title(n)}' references a component that does not exist.`, [n.id]);
      return false;
    }
    if (!pred(rc)) {
      err("BEHAVIOR_WRONG_COMPONENT", `'${title(n)}' expects ${what}, but '${rc.instance.name}' is a ${rc.def.category}.`, [n.id], { componentIds: [id] });
      return false;
    }
    return true;
  };
  const isMotor = (rc: ResolvedComponent) => !!rc.def.motor;

  // --- Semantic checks per node -------------------------------------------------------------
  for (const n of graph.nodes) {
    switch (n.kind) {
      case "sensor.read": {
        if (requireKind(n, n.params.componentId, (rc) => !!rc.def.sensor, "a sensor")) {
          const rc = comp(n.params.componentId)!;
          if (!rc.def.sensor!.channels.some((c) => c.id === n.params.channel)) {
            err("BEHAVIOR_UNKNOWN_CHANNEL", `'${rc.instance.name}' has no channel '${n.params.channel}'.`, [n.id], { componentIds: [rc.instance.id] });
          }
        }
        checkVar(n, n.params.variable);
        break;
      }
      case "motor.set":
        for (const c of n.params.commands) requireKind(n, c.componentId, isMotor, "a motor");
        break;
      case "motor.stop":
        for (const id of n.params.componentIds) requireKind(n, id, isMotor, "a motor");
        break;
      case "servo.set":
        if (requireKind(n, n.params.componentId, (rc) => !!rc.def.servo, "a servo")) {
          const [lo, hi] = comp(n.params.componentId)!.def.servo!.angleRangeDeg;
          if (n.params.angleDeg < lo || n.params.angleDeg > hi) {
            warn("BEHAVIOR_SERVO_RANGE", `Angle ${n.params.angleDeg}° is outside the servo range ${lo}–${hi}° and will be clamped.`, [n.id]);
          }
        }
        break;
      case "condition":
        checkOperand(n, n.params.left);
        checkOperand(n, n.params.right);
        break;
      case "variable.set":
        checkVar(n, n.params.variable);
        checkOperand(n, n.params.value);
        break;
      case "state.set":
      case "event.state_enter":
        if (!states.has(n.params.state)) err("BEHAVIOR_UNKNOWN_STATE", `State '${n.params.state}' is not declared.`, [n.id]);
        break;
      case "event.estop":
        requireKind(n, n.params.componentId, (rc) => rc.def.sensor?.kind === "switch", "a switch input");
        break;
      default:
        break;
    }
  }

  // --- Fiber discovery & program counter assignment ------------------------------------------
  const pcOf = new Map<string, number>();
  const order: BehaviorNode[] = [];
  const fibers: FiberIR[] = [];

  const visit = (startId: string | undefined): number => {
    if (!startId) return PC_END;
    const stack = [startId];
    while (stack.length) {
      const id = stack.pop()!;
      if (pcOf.has(id)) continue;
      const n = nodesById.get(id);
      if (!n) continue;
      pcOf.set(id, order.length + 1);
      order.push(n);
      const ports = outputPorts(n).filter((p) => !p.startsWith("step_") && !p.startsWith("branch_"));
      for (const p of [...ports].reverse()) {
        const t = succ.get(`${id}:${p}`);
        if (t) stack.push(t);
      }
    }
    return pcOf.get(startId) ?? PC_END;
  };

  const events = graph.nodes.filter((n) => n.kind.startsWith("event."));
  const addFiber = (trigger: FiberTrigger, entryNode: string | undefined, fname: string, eventNodeId?: string) => {
    const index = fibers.length;
    fibers.push({ index, name: fname, trigger, entry: PC_END, eventNodeId });
    fibers[index]!.entry = visit(entryNode);
    return index;
  };

  for (const ev of events) {
    const entry = succ.get(`${ev.id}:next`);
    let trigger: FiberTrigger;
    switch (ev.kind) {
      case "event.start": trigger = { kind: "start" }; break;
      case "event.timer": trigger = { kind: "timer", periodMs: ev.params.periodMs }; break;
      case "event.state_enter": trigger = { kind: "state_enter", state: ev.params.state }; break;
      case "event.estop": trigger = { kind: "estop" }; break;
      default: continue;
    }
    if (!entry) diags.push({ severity: "info", category: "software", code: "BEHAVIOR_EMPTY_EVENT", message: `Event '${title(ev)}' has nothing connected.`, nodeIds: [ev.id], source: "behavior-compiler" });
    addFiber(trigger, entry, ev.label ?? ev.kind.replace("event.", ""), ev.id);
  }

  // Child fibers for sequence/parallel branches (may discover further sequences — iterate).
  const spawned = new Set<string>();
  const childFibers = new Map<string, number[]>();
  for (let i = 0; i < order.length; i++) {
    const n = order[i]!;
    if (n.kind !== "sequence" && n.kind !== "parallel") continue;
    if (spawned.has(n.id)) continue;
    spawned.add(n.id);
    const ports = outputPorts(n).filter((p) => p.startsWith("step_") || p.startsWith("branch_"));
    const children: number[] = [];
    for (const port of ports) {
      const target = succ.get(`${n.id}:${port}`);
      const idx = addFiber({ kind: "child", parentPc: pcOf.get(n.id)! }, target, `${title(n)}.${port}`);
      children.push(idx);
      if (!target) warn("BEHAVIOR_EMPTY_BRANCH", `'${title(n)}' port '${port}' is not connected.`, [n.id]);
    }
    childFibers.set(n.id, children);
  }

  // --- Unreachable nodes ---------------------------------------------------------------------
  for (const n of graph.nodes) {
    if (!n.kind.startsWith("event.") && !pcOf.has(n.id)) {
      warn("BEHAVIOR_UNREACHABLE", `'${title(n)}' is not reachable from any event and will not be generated.`, [n.id]);
    }
  }
  if (graph.nodes.length > 0 && events.length === 0) {
    warn("BEHAVIOR_NO_EVENTS", "The behavior has no event nodes, so nothing will run.", []);
  }

  // --- Busy-loop detection (cycles without a delay) -------------------------------------------
  for (const scc of stronglyConnected(order, succ)) {
    const cyclic = scc.length > 1 || outputPorts(scc[0]!).some((p) => succ.get(`${scc[0]!.id}:${p}`) === scc[0]!.id);
    if (cyclic && !scc.some((n) => n.kind === "delay")) {
      warn(
        "BEHAVIOR_BUSY_LOOP",
        "A loop contains no Wait node. It will run as fast as the step budget allows and may starve other fibers.",
        scc.map((n) => n.id),
        { hint: "Add a Wait (e.g. 20–50 ms) inside the loop." },
      );
    }
  }

  // --- Lower to ops -------------------------------------------------------------------------
  const nx = (id: string, port: string) => {
    const t = succ.get(`${id}:${port}`);
    return t ? (pcOf.get(t) ?? PC_END) : PC_END;
  };
  const lowerOperand = (o: Operand): OperandIR => (o.kind === "const" ? { kind: "const", value: o.value } : { kind: "var", name: o.name });
  const allMotors = hw.components.filter((c) => c.def.motor).map((c) => ({ componentId: c.instance.id, component: c.instance.name }));
  const used = new Set<string>();

  const lower = (n: BehaviorNode): OpIR | undefined => {
    switch (n.kind) {
      case "sensor.read":
        used.add(n.params.componentId);
        return {
          op: "sensor_read",
          componentId: n.params.componentId,
          component: name(n.params.componentId),
          sensorKind: comp(n.params.componentId)?.def.sensor?.kind ?? "unknown",
          channel: n.params.channel,
          variable: n.params.variable,
          next: nx(n.id, "next"),
          error: nx(n.id, "error"),
        };
      case "motor.set":
        n.params.commands.forEach((c) => used.add(c.componentId));
        return { op: "motor_set", commands: n.params.commands.map((c) => ({ componentId: c.componentId, component: name(c.componentId), speed: c.speed })), next: nx(n.id, "next") };
      case "motor.stop": {
        const targets = n.params.componentIds.length
          ? n.params.componentIds.map((id) => ({ componentId: id, component: name(id) }))
          : allMotors;
        targets.forEach((t) => used.add(t.componentId));
        return { op: "motor_stop", components: targets, next: nx(n.id, "next") };
      }
      case "servo.set":
        used.add(n.params.componentId);
        return { op: "servo_set", componentId: n.params.componentId, component: name(n.params.componentId), angleDeg: n.params.angleDeg, next: nx(n.id, "next") };
      case "delay":
        return { op: "delay", ms: n.params.ms, next: nx(n.id, "next") };
      case "condition":
        return { op: "condition", left: lowerOperand(n.params.left), cmp: n.params.op, right: lowerOperand(n.params.right), onTrue: nx(n.id, "true"), onFalse: nx(n.id, "false") };
      case "variable.set":
        return { op: "var_set", variable: n.params.variable, mode: n.params.op, value: lowerOperand(n.params.value), next: nx(n.id, "next") };
      case "state.set":
        return { op: "state_set", state: n.params.state };
      case "function":
        return { op: "call", name: n.params.name, next: nx(n.id, "next"), error: nx(n.id, "error") };
      case "log":
        return { op: "log", message: n.params.message, next: nx(n.id, "next") };
      case "sequence":
        return { op: "sequence", children: childFibers.get(n.id) ?? [], next: nx(n.id, "done") };
      case "parallel":
        return { op: "parallel", children: childFibers.get(n.id) ?? [], next: nx(n.id, "done") };
      default:
        return undefined;
    }
  };

  const nodes: CompiledNode[] = [];
  for (const n of order) {
    const op = lower(n);
    if (op) nodes.push({ pc: pcOf.get(n.id)!, nodeId: n.id, title: n.label ?? defaultTitle(n), op });
  }

  const estopComponentIds = [
    ...new Set([
      ...hw.components.filter((c) => c.def.tags.includes("estop")).map((c) => c.instance.id),
      ...graph.nodes.flatMap((n) => (n.kind === "event.estop" ? [n.params.componentId] : [])),
    ]),
  ].filter((id) => hw.byId.has(id));
  estopComponentIds.forEach((id) => used.add(id));

  return {
    ir: {
      states: graph.states,
      initialState: graph.states[0],
      variables: graph.variables.map((v) => ({ name: v.name, initial: v.initial })),
      nodes,
      fibers,
      estopComponentIds,
      userFunctions: [...new Set(graph.nodes.flatMap((n) => (n.kind === "function" && pcOf.has(n.id) ? [n.params.name] : [])))].sort(),
      usedComponentIds: [...used].filter((id) => hw.byId.has(id)).sort(),
      stepBudget: STEP_BUDGET,
    },
    diagnostics: diags,
  };
}

function defaultTitle(n: BehaviorNode): string {
  switch (n.kind) {
    case "delay": return `Wait ${n.params.ms} ms`;
    case "condition": return "Condition";
    case "motor.set": return "Set motors";
    case "motor.stop": return "Stop motors";
    default: return n.kind;
  }
}

/** Tarjan's SCC over the sequential (non-spawn) control-flow edges. */
function stronglyConnected(nodes: BehaviorNode[], succ: Map<string, string>): BehaviorNode[][] {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: BehaviorNode[][] = [];
  const edges = (id: string) =>
    outputPorts(byId.get(id)!)
      .filter((p) => !p.startsWith("step_") && !p.startsWith("branch_"))
      .map((p) => succ.get(`${id}:${p}`))
      .filter((t): t is string => !!t && ids.has(t));

  const strong = (v: string) => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);
    for (const w of edges(v)) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: BehaviorNode[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(byId.get(w)!);
      } while (w !== v);
      out.push(comp);
    }
  };
  for (const n of nodes) if (!idx.has(n.id)) strong(n.id);
  return out;
}
