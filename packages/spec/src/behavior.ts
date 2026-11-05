// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";

/**
 * Behavior graph — a node-based description of robot behavior. It is part of the Robot
 * Specification and is compiled (by @roboforge/ir) into fibers of a cooperative state machine.
 */

export const Identifier = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*$/, "must be a lower_snake_case identifier");

export const StateName = z.string().regex(/^[A-Z][A-Z0-9_]*$/, "must be an UPPER_SNAKE_CASE state name");

export const Operand = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("const"), value: z.number() }),
  z.object({ kind: z.literal("var"), name: Identifier }),
]);
export type Operand = z.infer<typeof Operand>;

export const CompareOp = z.enum(["<", "<=", ">", ">=", "==", "!="]);
export type CompareOp = z.infer<typeof CompareOp>;

const Position = z.object({ x: z.number(), y: z.number() });

const base = {
  id: z.string().min(1),
  label: z.string().optional(),
  position: Position.default({ x: 0, y: 0 }),
};

const node = <K extends string, P extends z.ZodRawShape>(kind: K, params: P) =>
  z.object({ ...base, kind: z.literal(kind), params: z.object(params) });

export const BehaviorNode = z.discriminatedUnion("kind", [
  // Events — entry points; each starts a fiber.
  node("event.start", {}),
  node("event.timer", { periodMs: z.number().int().min(1) }),
  node("event.state_enter", { state: StateName }),
  node("event.estop", { componentId: z.string() }),
  // Sensors / actuators
  node("sensor.read", { componentId: z.string(), channel: z.string(), variable: Identifier }),
  node("motor.set", {
    commands: z.array(z.object({ componentId: z.string(), speed: z.number().min(-1).max(1) })).min(1),
  }),
  node("motor.stop", { componentIds: z.array(z.string()).default([]) }),
  node("servo.set", { componentId: z.string(), angleDeg: z.number() }),
  // Flow control
  node("delay", { ms: z.number().int().min(0) }),
  node("condition", { left: Operand, op: CompareOp, right: Operand }),
  node("sequence", { steps: z.number().int().min(1).max(8) }),
  node("parallel", { branches: z.number().int().min(2).max(8) }),
  // Data / state
  node("variable.set", {
    variable: Identifier,
    op: z.enum(["set", "add", "sub", "mul"]).default("set"),
    value: Operand,
  }),
  node("state.set", { state: StateName }),
  node("function", { name: Identifier }),
  node("log", { message: z.string().max(120) }),
]);
export type BehaviorNode = z.infer<typeof BehaviorNode>;
export type BehaviorNodeKind = BehaviorNode["kind"];
export type BehaviorNodeOf<K extends BehaviorNodeKind> = Extract<BehaviorNode, { kind: K }>;

export const BehaviorEdge = z.object({
  id: z.string().min(1),
  source: z.string(),
  sourcePort: z.string(),
  target: z.string(),
});
export type BehaviorEdge = z.infer<typeof BehaviorEdge>;

export const BehaviorVariable = z.object({
  name: Identifier,
  initial: z.number().default(0),
  description: z.string().optional(),
});
export type BehaviorVariable = z.infer<typeof BehaviorVariable>;

export const BehaviorGraph = z.object({
  /** Named top-level states. The first is the initial state. */
  states: z.array(StateName).default([]),
  variables: z.array(BehaviorVariable).default([]),
  nodes: z.array(BehaviorNode).default([]),
  edges: z.array(BehaviorEdge).default([]),
});
export type BehaviorGraph = z.infer<typeof BehaviorGraph>;

export const EVENT_KINDS = ["event.start", "event.timer", "event.state_enter", "event.estop"] as const;

export function isEventNode(n: BehaviorNode): boolean {
  return (EVENT_KINDS as readonly string[]).includes(n.kind);
}

/** Output ports of a node, in display order. The input port is always "in" (events have none). */
export function outputPorts(n: BehaviorNode): string[] {
  switch (n.kind) {
    case "condition":
      return ["true", "false"];
    case "sensor.read":
    case "function":
      return ["next", "error"];
    case "sequence":
      return [...Array.from({ length: n.params.steps }, (_, i) => `step_${i + 1}`), "done"];
    case "parallel":
      return [...Array.from({ length: n.params.branches }, (_, i) => `branch_${i + 1}`), "done"];
    case "state.set":
      return [];
    default:
      return ["next"];
  }
}

export function hasInput(n: BehaviorNode): boolean {
  return !isEventNode(n);
}

export interface NodeKindInfo {
  kind: BehaviorNodeKind;
  title: string;
  group: "Events" | "Sensors" | "Actuators" | "Flow" | "Data";
  description: string;
}

export const NODE_KINDS: NodeKindInfo[] = [
  { kind: "event.start", title: "Robot Started", group: "Events", description: "Runs once after boot." },
  { kind: "event.timer", title: "Every N ms", group: "Events", description: "Runs periodically (skipped if still running)." },
  { kind: "event.state_enter", title: "On State Enter", group: "Events", description: "Runs when the robot enters a state; cancelled when it leaves." },
  { kind: "event.estop", title: "Emergency Stop", group: "Events", description: "Runs after an e-stop input latches. Motors are already stopped by the runtime." },
  { kind: "sensor.read", title: "Read Sensor", group: "Sensors", description: "Reads a sensor channel into a variable. 'error' if the read fails." },
  { kind: "motor.set", title: "Set Motors", group: "Actuators", description: "Sets normalized speed (-1..1) on one or more motors." },
  { kind: "motor.stop", title: "Stop Motors", group: "Actuators", description: "Stops the listed motors (all motors if empty)." },
  { kind: "servo.set", title: "Set Servo", group: "Actuators", description: "Moves a servo to an angle." },
  { kind: "delay", title: "Wait", group: "Flow", description: "Non-blocking delay." },
  { kind: "condition", title: "Condition", group: "Flow", description: "Branches on a comparison." },
  { kind: "sequence", title: "Sequence", group: "Flow", description: "Runs each step branch to completion in order, then 'done'." },
  { kind: "parallel", title: "Parallel", group: "Flow", description: "Runs branches concurrently; 'done' when all finish." },
  { kind: "variable.set", title: "Set Variable", group: "Data", description: "Assigns or updates a variable." },
  { kind: "state.set", title: "Go To State", group: "Data", description: "Transitions the top-level state machine." },
  { kind: "function", title: "Call Function", group: "Data", description: "Calls a user-owned C++/Python function." },
  { kind: "log", title: "Log", group: "Data", description: "Writes a log line." },
];
