// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";
import { BehaviorEdge, BehaviorNode, BehaviorVariable, Identifier, StateName, outputPorts } from "./behavior";
import type { Catalog } from "./component";
import { ComponentInstance, ConfigValue, Connection, DriveConfig, Pose, RobotSpec, RosDistro } from "./schema";

/**
 * Commands are the ONLY way to change a Robot Specification. Every editor, the YAML view and the
 * AI assistant produce commands; the server and the client apply them with the same function.
 *
 * Commands enforce structural integrity (ids exist, pins exist, no duplicates). Engineering
 * correctness (voltages, conflicts…) is the validation engine's job — engineers must be able to
 * sketch an invalid design and see what is wrong with it.
 */

const Position = z.object({ x: z.number(), y: z.number() });

export const Command = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("robot.update"),
    patch: z
      .object({ name: Identifier, displayName: z.string().min(1), description: z.string(), version: z.string() })
      .partial(),
  }),
  z.object({ type: z.literal("robot.setDrive"), drive: DriveConfig.nullable() }),
  z.object({
    type: z.literal("targets.update"),
    patch: z.object({
      controllerId: z.string().nullable().optional(),
      firmwareEnabled: z.boolean().optional(),
      ros2Enabled: z.boolean().optional(),
      ros2Distro: RosDistro.optional(),
    }),
  }),
  z.object({ type: z.literal("component.add"), component: ComponentInstance }),
  z.object({ type: z.literal("component.remove"), componentId: z.string() }),
  z.object({
    type: z.literal("component.update"),
    componentId: z.string(),
    patch: z.object({
      name: Identifier.optional(),
      /** Merged into existing config; a null value deletes the key. */
      config: z.record(ConfigValue.nullable()).optional(),
      layout: Position.optional(),
      mount: Pose.nullable().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({ type: z.literal("connection.add"), connection: Connection }),
  z.object({ type: z.literal("connection.remove"), connectionId: z.string() }),
  z.object({
    type: z.literal("connection.update"),
    connectionId: z.string(),
    patch: z.object({ label: z.string().optional(), wire: Connection.shape.wire }),
  }),
  z.object({ type: z.literal("behavior.node.add"), node: BehaviorNode }),
  z.object({
    type: z.literal("behavior.node.update"),
    nodeId: z.string(),
    patch: z.object({
      label: z.string().optional(),
      position: Position.optional(),
      /** Replaces params entirely (validated against the node kind). */
      params: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({ type: z.literal("behavior.node.remove"), nodeId: z.string() }),
  z.object({ type: z.literal("behavior.edge.add"), edge: BehaviorEdge }),
  z.object({ type: z.literal("behavior.edge.remove"), edgeId: z.string() }),
  z.object({ type: z.literal("behavior.variable.upsert"), variable: BehaviorVariable }),
  z.object({ type: z.literal("behavior.variable.remove"), name: Identifier }),
  z.object({ type: z.literal("behavior.states.set"), states: z.array(StateName) }),
  z.object({ type: z.literal("spec.replace"), spec: RobotSpec }),
]);
export type Command = z.infer<typeof Command>;
export type CommandType = Command["type"];

export class CommandError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly commandIndex?: number,
  ) {
    super(message);
    this.name = "CommandError";
  }
}

export interface CommandContext {
  catalog: Catalog;
}

const fail = (code: string, message: string): never => {
  throw new CommandError(code, message);
};

function requireComponent(spec: RobotSpec, id: string) {
  return spec.components.find((c) => c.id === id) ?? fail("COMPONENT_NOT_FOUND", `Component '${id}' does not exist.`);
}

function requirePin(spec: RobotSpec, ctx: CommandContext, componentId: string, pin: string): void {
  const comp = requireComponent(spec, componentId);
  const def = ctx.catalog.get(comp.ref.catalogId, comp.ref.version);
  if (!def) return; // Unknown definitions are reported by validation, not rejected here.
  if (!def.pins.some((p) => p.name === pin)) {
    fail("PIN_NOT_FOUND", `Component '${comp.name}' has no pin '${pin}'.`);
  }
}

function applyOne(spec: RobotSpec, cmd: Command, ctx: CommandContext): RobotSpec {
  // Commands operate on a private clone; callers always receive a new object.
  const s = structuredClone(spec);
  switch (cmd.type) {
    case "robot.update": {
      Object.assign(s.robot, cmd.patch);
      return s;
    }
    case "robot.setDrive": {
      if (cmd.drive) {
        for (const id of [...cmd.drive.leftMotors, ...cmd.drive.rightMotors]) requireComponent(s, id);
        s.robot.drive = cmd.drive;
      } else {
        delete s.robot.drive;
      }
      return s;
    }
    case "targets.update": {
      const p = cmd.patch;
      if (p.controllerId !== undefined) {
        if (p.controllerId === null) delete s.targets.controllerId;
        else {
          requireComponent(s, p.controllerId);
          s.targets.controllerId = p.controllerId;
        }
      }
      if (p.firmwareEnabled !== undefined) s.targets.firmware.enabled = p.firmwareEnabled;
      if (p.ros2Enabled !== undefined) s.targets.ros2.enabled = p.ros2Enabled;
      if (p.ros2Distro !== undefined) s.targets.ros2.distro = p.ros2Distro;
      return s;
    }
    case "component.add": {
      const c = cmd.component;
      if (s.components.some((x) => x.id === c.id)) fail("DUPLICATE_ID", `Component id '${c.id}' already exists.`);
      if (s.components.some((x) => x.name === c.name)) fail("DUPLICATE_NAME", `Component name '${c.name}' is already used.`);
      if (!ctx.catalog.get(c.ref.catalogId, c.ref.version)) {
        fail("UNKNOWN_COMPONENT", `Catalog component '${c.ref.catalogId}@${c.ref.version}' not found.`);
      }
      s.components.push(c);
      return s;
    }
    case "component.remove": {
      requireComponent(s, cmd.componentId);
      s.components = s.components.filter((c) => c.id !== cmd.componentId);
      s.connections = s.connections.filter(
        (w) => w.from.componentId !== cmd.componentId && w.to.componentId !== cmd.componentId,
      );
      if (s.targets.controllerId === cmd.componentId) delete s.targets.controllerId;
      if (s.robot.drive) {
        const d = s.robot.drive;
        d.leftMotors = d.leftMotors.filter((m) => m !== cmd.componentId);
        d.rightMotors = d.rightMotors.filter((m) => m !== cmd.componentId);
        if (!d.leftMotors.length || !d.rightMotors.length) delete s.robot.drive;
      }
      // Behavior nodes referencing the component are kept so the engineer sees the broken
      // reference in validation instead of silently losing logic.
      return s;
    }
    case "component.update": {
      const c = requireComponent(s, cmd.componentId);
      const p = cmd.patch;
      if (p.name !== undefined && p.name !== c.name) {
        if (s.components.some((x) => x.name === p.name)) fail("DUPLICATE_NAME", `Component name '${p.name}' is already used.`);
        c.name = p.name;
      }
      if (p.config) {
        for (const [k, v] of Object.entries(p.config)) {
          if (v === null) delete c.config[k];
          else c.config[k] = v;
        }
      }
      if (p.layout) c.layout = p.layout;
      if (p.mount !== undefined) {
        if (p.mount === null) delete c.mount;
        else c.mount = p.mount;
      }
      if (p.notes !== undefined) c.notes = p.notes;
      return s;
    }
    case "connection.add": {
      const w = cmd.connection;
      if (s.connections.some((x) => x.id === w.id)) fail("DUPLICATE_ID", `Connection id '${w.id}' already exists.`);
      if (w.from.componentId === w.to.componentId && w.from.pin === w.to.pin) {
        fail("SELF_CONNECTION", "A pin cannot be connected to itself.");
      }
      requirePin(s, ctx, w.from.componentId, w.from.pin);
      requirePin(s, ctx, w.to.componentId, w.to.pin);
      const same = (a: typeof w.from, b: typeof w.from) => a.componentId === b.componentId && a.pin === b.pin;
      if (s.connections.some((x) => (same(x.from, w.from) && same(x.to, w.to)) || (same(x.from, w.to) && same(x.to, w.from)))) {
        fail("DUPLICATE_CONNECTION", "These pins are already connected.");
      }
      s.connections.push(w);
      return s;
    }
    case "connection.remove": {
      if (!s.connections.some((w) => w.id === cmd.connectionId)) fail("CONNECTION_NOT_FOUND", `Connection '${cmd.connectionId}' does not exist.`);
      s.connections = s.connections.filter((w) => w.id !== cmd.connectionId);
      return s;
    }
    case "connection.update": {
      const w = s.connections.find((x) => x.id === cmd.connectionId) ?? fail("CONNECTION_NOT_FOUND", `Connection '${cmd.connectionId}' does not exist.`);
      if (cmd.patch.label !== undefined) w.label = cmd.patch.label;
      if (cmd.patch.wire !== undefined) w.wire = cmd.patch.wire;
      return s;
    }
    case "behavior.node.add": {
      if (s.behavior.nodes.some((n) => n.id === cmd.node.id)) fail("DUPLICATE_ID", `Node id '${cmd.node.id}' already exists.`);
      s.behavior.nodes.push(cmd.node);
      return s;
    }
    case "behavior.node.update": {
      const idx = s.behavior.nodes.findIndex((n) => n.id === cmd.nodeId);
      if (idx < 0) fail("NODE_NOT_FOUND", `Node '${cmd.nodeId}' does not exist.`);
      const current = s.behavior.nodes[idx]!;
      const merged = {
        ...current,
        ...(cmd.patch.label !== undefined ? { label: cmd.patch.label } : {}),
        ...(cmd.patch.position ? { position: cmd.patch.position } : {}),
        ...(cmd.patch.params ? { params: cmd.patch.params } : {}),
      };
      const parsed = BehaviorNode.safeParse(merged);
      if (!parsed.success) fail("INVALID_PARAMS", `Invalid parameters for ${current.kind}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
      const next = parsed.data!;
      s.behavior.nodes[idx] = next;
      // Drop edges from ports that no longer exist (e.g. sequence steps reduced).
      const ports = new Set(outputPorts(next));
      s.behavior.edges = s.behavior.edges.filter((e) => e.source !== next.id || ports.has(e.sourcePort));
      return s;
    }
    case "behavior.node.remove": {
      if (!s.behavior.nodes.some((n) => n.id === cmd.nodeId)) fail("NODE_NOT_FOUND", `Node '${cmd.nodeId}' does not exist.`);
      s.behavior.nodes = s.behavior.nodes.filter((n) => n.id !== cmd.nodeId);
      s.behavior.edges = s.behavior.edges.filter((e) => e.source !== cmd.nodeId && e.target !== cmd.nodeId);
      return s;
    }
    case "behavior.edge.add": {
      const e = cmd.edge;
      const src = s.behavior.nodes.find((n) => n.id === e.source) ?? fail("NODE_NOT_FOUND", `Node '${e.source}' does not exist.`);
      const tgt = s.behavior.nodes.find((n) => n.id === e.target) ?? fail("NODE_NOT_FOUND", `Node '${e.target}' does not exist.`);
      if (!outputPorts(src).includes(e.sourcePort)) fail("INVALID_PORT", `Node '${src.id}' has no output port '${e.sourcePort}'.`);
      if (tgt.kind.startsWith("event.")) fail("INVALID_TARGET", "Event nodes cannot have incoming edges.");
      if (s.behavior.edges.some((x) => x.id === e.id)) fail("DUPLICATE_ID", `Edge id '${e.id}' already exists.`);
      // An output port drives exactly one successor; replace any existing edge from it.
      s.behavior.edges = s.behavior.edges.filter((x) => !(x.source === e.source && x.sourcePort === e.sourcePort));
      s.behavior.edges.push(e);
      return s;
    }
    case "behavior.edge.remove": {
      s.behavior.edges = s.behavior.edges.filter((e) => e.id !== cmd.edgeId);
      return s;
    }
    case "behavior.variable.upsert": {
      const i = s.behavior.variables.findIndex((v) => v.name === cmd.variable.name);
      if (i >= 0) s.behavior.variables[i] = cmd.variable;
      else s.behavior.variables.push(cmd.variable);
      return s;
    }
    case "behavior.variable.remove": {
      s.behavior.variables = s.behavior.variables.filter((v) => v.name !== cmd.name);
      return s;
    }
    case "behavior.states.set": {
      if (new Set(cmd.states).size !== cmd.states.length) fail("DUPLICATE_STATE", "State names must be unique.");
      s.behavior.states = cmd.states;
      return s;
    }
    case "spec.replace": {
      const ids = new Set<string>();
      for (const c of cmd.spec.components) {
        if (ids.has(c.id)) fail("DUPLICATE_ID", `Duplicate component id '${c.id}'.`);
        ids.add(c.id);
      }
      for (const w of cmd.spec.connections) {
        if (!ids.has(w.from.componentId) || !ids.has(w.to.componentId)) {
          fail("COMPONENT_NOT_FOUND", `Connection '${w.id}' references a missing component.`);
        }
      }
      return structuredClone(cmd.spec);
    }
  }
}

/** Parses and applies a batch atomically. Throws CommandError (with the failing index) on failure. */
export function applyCommands(spec: RobotSpec, commands: unknown[], ctx: CommandContext): RobotSpec {
  let current = spec;
  commands.forEach((raw, index) => {
    const parsed = Command.safeParse(raw);
    if (!parsed.success) {
      throw new CommandError(
        "INVALID_COMMAND",
        `Command ${index}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        index,
      );
    }
    try {
      current = applyOne(current, parsed.data, ctx);
    } catch (e) {
      if (e instanceof CommandError) throw new CommandError(e.code, e.message, index);
      throw e;
    }
  });
  return current;
}

export function applyCommand(spec: RobotSpec, command: Command, ctx: CommandContext): RobotSpec {
  return applyCommands(spec, [command], ctx);
}

/** Short random id with a readable prefix. Stable once assigned. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`;
}
