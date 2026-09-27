import type { BehaviorNode, BehaviorNodeKind, Command, ComponentDefinition, Operand, RobotSpec } from "@roboforge/spec";
import { newId } from "@roboforge/spec";

export const GROUP_COLOR: Record<string, string> = {
  Events: "#f2a541",
  Sensors: "#3cc6b8",
  Actuators: "#e879c6",
  Flow: "#4f9cf9",
  Data: "#b78cf7",
};

const opText = (o: Operand) => (o.kind === "const" ? String(o.value) : o.name);

export function summarize(n: BehaviorNode, spec: RobotSpec): string {
  const nm = (id: string) => spec.components.find((c) => c.id === id)?.name ?? (id ? "⚠ missing" : "— choose —");
  switch (n.kind) {
    case "event.start": return "once at boot";
    case "event.timer": return `every ${n.params.periodMs} ms`;
    case "event.state_enter": return `enter ${n.params.state}`;
    case "event.estop": return `${nm(n.params.componentId)} tripped`;
    case "sensor.read": return `${nm(n.params.componentId)}.${n.params.channel || "?"} → ${n.params.variable}`;
    case "motor.set": return n.params.commands.map((c) => `${nm(c.componentId)} ${c.speed >= 0 ? "+" : ""}${c.speed}`).join(", ");
    case "motor.stop": return n.params.componentIds.length ? n.params.componentIds.map(nm).join(", ") : "all motors";
    case "servo.set": return `${nm(n.params.componentId)} → ${n.params.angleDeg}°`;
    case "delay": return `${n.params.ms} ms`;
    case "condition": return `${opText(n.params.left)} ${n.params.op} ${opText(n.params.right)}`;
    case "sequence": return `${n.params.steps} steps`;
    case "parallel": return `${n.params.branches} branches`;
    case "variable.set": return `${n.params.variable} ${n.params.op === "set" ? "=" : n.params.op === "add" ? "+=" : n.params.op === "sub" ? "-=" : "*="} ${opText(n.params.value)}`;
    case "state.set": return `→ ${n.params.state}`;
    case "function": return `user::${n.params.name}()`;
    case "log": return `"${n.params.message}"`;
  }
}

/**
 * Commands that add a new node of `kind` with sensible, valid defaults drawn from the current
 * design (first matching component, first variable/state), declaring a variable if needed.
 */
export function newNodeCommands(kind: BehaviorNodeKind, spec: RobotSpec, defOf: (id: string) => ComponentDefinition | undefined, position: { x: number; y: number }): { id: string; commands: Command[] } {
  const id = newId("n");
  const find = (pred: (d: ComponentDefinition) => boolean) => spec.components.find((c) => {
    const d = defOf(c.id);
    return d ? pred(d) : false;
  });
  const commands: Command[] = [];
  const ensureVar = (name: string) => {
    if (!spec.behavior.variables.some((v) => v.name === name)) commands.push({ type: "behavior.variable.upsert", variable: { name, initial: 0 } });
    return name;
  };
  const motors = spec.components.filter((c) => defOf(c.id)?.motor);
  const state = spec.behavior.states[0] ?? "RUN";
  if ((kind === "state.set" || kind === "event.state_enter") && !spec.behavior.states.length) commands.push({ type: "behavior.states.set", states: ["RUN"] });
  let params: Record<string, unknown>;
  switch (kind) {
    case "event.timer": params = { periodMs: 1000 }; break;
    case "event.state_enter": params = { state }; break;
    case "event.estop": params = { componentId: find((d) => d.sensor?.kind === "switch")?.id ?? "" }; break;
    case "sensor.read": {
      const s = find((d) => !!d.sensor);
      const ch = s ? defOf(s.id)!.sensor!.channels[0]!.id : "";
      params = { componentId: s?.id ?? "", channel: ch, variable: ensureVar(spec.behavior.variables[0]?.name ?? "value") };
      break;
    }
    case "motor.set": params = { commands: (motors.length ? motors : [{ id: "" }]).map((m) => ({ componentId: m.id, speed: 0.5 })) }; break;
    case "motor.stop": params = { componentIds: [] }; break;
    case "servo.set": params = { componentId: find((d) => !!d.servo)?.id ?? "", angleDeg: 90 }; break;
    case "delay": params = { ms: 500 }; break;
    case "condition": {
      const v = ensureVar(spec.behavior.variables[0]?.name ?? "value");
      params = { left: { kind: "var", name: v }, op: "<", right: { kind: "const", value: 0.5 } };
      break;
    }
    case "sequence": params = { steps: 2 }; break;
    case "parallel": params = { branches: 2 }; break;
    case "variable.set": params = { variable: ensureVar(spec.behavior.variables[0]?.name ?? "value"), op: "set", value: { kind: "const", value: 0 } }; break;
    case "state.set": params = { state }; break;
    case "function": params = { name: "my_function" }; break;
    case "log": params = { message: "checkpoint" }; break;
    default: params = {};
  }
  commands.push({ type: "behavior.node.add", node: { id, kind, position, params } as BehaviorNode });
  return { id, commands };
}
