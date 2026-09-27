import type { CompareOp } from "@roboforge/spec";

/** Program counter value meaning "fiber finished". */
export const PC_END = 0;

export type OperandIR = { kind: "const"; value: number } | { kind: "var"; name: string };

export type OpIR =
  | { op: "sensor_read"; componentId: string; component: string; sensorKind: string; channel: string; variable: string; next: number; error: number }
  | { op: "motor_set"; commands: { componentId: string; component: string; speed: number }[]; next: number }
  | { op: "motor_stop"; components: { componentId: string; component: string }[]; next: number }
  | { op: "servo_set"; componentId: string; component: string; angleDeg: number; next: number }
  | { op: "delay"; ms: number; next: number }
  | { op: "condition"; left: OperandIR; cmp: CompareOp; right: OperandIR; onTrue: number; onFalse: number }
  | { op: "var_set"; variable: string; mode: "set" | "add" | "sub" | "mul"; value: OperandIR; next: number }
  | { op: "state_set"; state: string }
  | { op: "call"; name: string; next: number; error: number }
  | { op: "log"; message: string; next: number }
  | { op: "sequence"; children: number[]; next: number }
  | { op: "parallel"; children: number[]; next: number };

export interface CompiledNode {
  /** Program counter (1-based; 0 is PC_END). */
  pc: number;
  nodeId: string;
  title: string;
  op: OpIR;
}

export type FiberTrigger =
  | { kind: "start" }
  | { kind: "timer"; periodMs: number }
  | { kind: "state_enter"; state: string }
  | { kind: "estop" }
  | { kind: "child"; parentPc: number };

/**
 * A cooperative thread of execution. Child fibers (Sequence/Parallel branches) are started by
 * their spawning node at runtime, which records the parent for cancellation.
 */
export interface FiberIR {
  index: number;
  name: string;
  trigger: FiberTrigger;
  /** First program counter, or PC_END for an event with nothing attached. */
  entry: number;
  eventNodeId: string | undefined;
}

export interface BehaviorIR {
  states: string[];
  initialState: string | undefined;
  variables: { name: string; initial: number }[];
  nodes: CompiledNode[];
  fibers: FiberIR[];
  /** Switch components the runtime monitors as emergency stops (independent of the graph). */
  estopComponentIds: string[];
  userFunctions: string[];
  usedComponentIds: string[];
  /** Largest per-tick step budget used by generated runtimes. */
  stepBudget: number;
}
