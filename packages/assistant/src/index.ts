/**
 * AI robotics assistant.
 *
 * The model never writes files or code. It operates on the Robot Specification exclusively
 * through typed tools that emit the same commands the editors use, against an in-memory draft.
 * The result is a *proposal* (commands + explanation + validation delta) that the engineer
 * reviews and applies — important engineering decisions stay visible.
 */
import { z } from "zod";
import { applyCommands, BehaviorNode, BehaviorEdge, BehaviorVariable, CommandError, newId, type Catalog, type Command, type ComponentDefinition, type RobotSpec } from "@roboforge/spec";
import { planAutoWire, summarizeIR } from "@roboforge/ir";
import { analyzeProject } from "@roboforge/codegen";

/* ---------------------------------------------------------------------------------------- */
/* Minimal Messages-API types (subset used here)                                             */
/* ---------------------------------------------------------------------------------------- */

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: Message[];
  tools: ToolDef[];
  max_tokens: number;
}

export interface LlmResponse {
  content: ContentBlock[];
  stop_reason: string;
}

export interface LlmClient {
  createMessage(req: LlmRequest): Promise<LlmResponse>;
}

/** Messages API client over fetch (no SDK dependency). */
export class AnthropicClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async createMessage(req: LlmRequest): Promise<LlmResponse> {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: this.model, ...req }),
    });
    if (!res.ok) throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as LlmResponse;
    return { content: json.content, stop_reason: json.stop_reason };
  }
}

/* ---------------------------------------------------------------------------------------- */
/* Tools                                                                                     */
/* ---------------------------------------------------------------------------------------- */

interface Draft {
  spec: RobotSpec;
  commands: Command[];
  catalog: Catalog & { all?: () => ComponentDefinition[] };
}

const byName = (d: Draft, name: string) => d.spec.components.find((c) => c.name === name || c.id === name);

function apply(d: Draft, cmds: Command[]): void {
  d.spec = applyCommands(d.spec, cmds, { catalog: d.catalog });
  d.commands.push(...cmds);
}

const PinPath = z.string().regex(/^[^.]+\.[^.]+$/, "use component_name.PIN");

interface Tool {
  def: ToolDef;
  run(d: Draft, input: unknown): unknown;
}

const tool = <S extends z.ZodTypeAny>(name: string, description: string, schema: S, jsonSchema: Record<string, unknown>, run: (d: Draft, input: z.infer<S>) => unknown): Tool => ({
  def: { name, description, input_schema: jsonSchema },
  run: (d, raw) => run(d, schema.parse(raw)),
});

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });

export const TOOLS: Tool[] = [
  tool("get_design", "Summarize the current robot design: components, wiring-derived pin assignments, buses, power, behavior.", z.object({}), obj({}), (d) => {
    const a = analyzeProject(d.spec, d.catalog);
    const s = summarizeIR(a.ir);
    return {
      robot: d.spec.robot,
      components: d.spec.components.map((c) => ({ id: c.id, name: c.name, part: c.ref.catalogId, config: c.config })),
      controller: s.controller,
      pins: s.pinAssignments.map((p) => `${p.pin}: ${p.fn ?? "?"} → ${p.devices.map((x) => `${x.component}.${x.pin}`).join(", ")}`),
      i2c: s.i2cBuses,
      power: s.power.map((p) => ({ net: p.net, voltage: p.voltage, typicalMa: p.loadTypicalMa })),
      motors: s.motors,
      behavior: { states: d.spec.behavior.states, variables: d.spec.behavior.variables, nodes: d.spec.behavior.nodes, edges: d.spec.behavior.edges },
      problems: a.report.diagnostics.filter((x) => x.severity !== "info").map((x) => `${x.severity} ${x.code}: ${x.message}`),
    };
  }),
  tool("search_components", "Search the component library.", z.object({ query: z.string().default(""), category: z.string().optional() }), obj({ query: { type: "string" }, category: { type: "string" } }), (d, i) => {
    const all = d.catalog.all?.() ?? [];
    const terms = i.query.toLowerCase().split(/\s+/).filter(Boolean);
    return all
      .filter((c) => !i.category || c.category === i.category)
      .filter((c) => terms.every((t) => [c.id, c.name, c.description, ...c.tags, ...c.interfaces].join(" ").toLowerCase().includes(t)))
      .slice(0, 15)
      .map((c) => ({ catalogId: c.id, version: c.version, name: c.name, category: c.category, interfaces: c.interfaces, description: c.description, i2cDefault: c.i2c?.defaultAddress }));
  }),
  tool("get_component_definition", "Full pin-level definition of a catalog part.", z.object({ catalogId: z.string() }), obj({ catalogId: { type: "string" } }, ["catalogId"]), (d, i) => {
    const def = d.catalog.get(i.catalogId);
    if (!def) throw new Error(`Unknown catalog id '${i.catalogId}'.`);
    return def;
  }),
  tool(
    "add_component",
    "Add a catalog part to the design. Returns its component id. Follow with auto_wire unless the user asked for specific wiring.",
    z.object({ catalogId: z.string(), name: z.string().regex(/^[a-z_][a-z0-9_]*$/), config: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}) }),
    obj({ catalogId: { type: "string" }, name: { type: "string", description: "lower_snake_case code identifier" }, config: { type: "object" } }, ["catalogId", "name"]),
    (d, i) => {
      const def = d.catalog.get(i.catalogId);
      if (!def) throw new Error(`Unknown catalog id '${i.catalogId}'.`);
      const id = newId("c");
      const n = d.spec.components.length;
      apply(d, [{ type: "component.add", component: { id, name: i.name, ref: { catalogId: def.id, version: def.version }, config: i.config, layout: { x: 200 + (n % 4) * 320, y: 700 + Math.floor(n / 4) * 220 } } }]);
      return { componentId: id };
    },
  ),
  tool("auto_wire", "Wire a component's unconnected pins (ground, compatible supply, free capable controller pins, shared buses, free driver channel).", z.object({ component: z.string() }), obj({ component: { type: "string", description: "component name or id" } }, ["component"]), (d, i) => {
    const c = byName(d, i.component);
    if (!c) throw new Error(`No component '${i.component}'.`);
    const plan = planAutoWire(d.spec, d.catalog, c.id);
    apply(d, plan.commands);
    return { connected: plan.notes, skipped: plan.skipped };
  }),
  tool("connect", "Connect two pins, e.g. from 'imu.SDA' to 'mcu.GPIO21'.", z.object({ from: PinPath, to: PinPath }), obj({ from: { type: "string" }, to: { type: "string" } }, ["from", "to"]), (d, i) => {
    const [fc, fp] = i.from.split(".");
    const [tc, tp] = i.to.split(".");
    const a = byName(d, fc!);
    const b = byName(d, tc!);
    if (!a || !b) throw new Error("Unknown component in pin path.");
    const id = newId("w");
    apply(d, [{ type: "connection.add", connection: { id, from: { componentId: a.id, pin: fp! }, to: { componentId: b.id, pin: tp! } } }]);
    return { connectionId: id };
  }),
  tool("disconnect", "Remove a connection by id.", z.object({ connectionId: z.string() }), obj({ connectionId: { type: "string" } }, ["connectionId"]), (d, i) => {
    apply(d, [{ type: "connection.remove", connectionId: i.connectionId }]);
    return { ok: true };
  }),
  tool(
    "update_component",
    "Rename a component or change its configuration (e.g. i2cAddress, canId, outputVoltage).",
    z.object({ component: z.string(), name: z.string().optional(), config: z.record(z.union([z.number(), z.string(), z.boolean(), z.null()])).optional() }),
    obj({ component: { type: "string" }, name: { type: "string" }, config: { type: "object" } }, ["component"]),
    (d, i) => {
      const c = byName(d, i.component);
      if (!c) throw new Error(`No component '${i.component}'.`);
      apply(d, [{ type: "component.update", componentId: c.id, patch: { ...(i.name ? { name: i.name } : {}), ...(i.config ? { config: i.config } : {}) } }]);
      return { ok: true };
    },
  ),
  tool("remove_component", "Remove a component and its wires.", z.object({ component: z.string() }), obj({ component: { type: "string" } }, ["component"]), (d, i) => {
    const c = byName(d, i.component);
    if (!c) throw new Error(`No component '${i.component}'.`);
    apply(d, [{ type: "component.remove", componentId: c.id }]);
    return { ok: true };
  }),
  tool(
    "edit_behavior",
    "Add/replace behavior graph elements. Node kinds: event.start, event.timer{periodMs}, event.state_enter{state}, event.estop{componentId}, sensor.read{componentId,channel,variable}, motor.set{commands:[{componentId,speed}]}, motor.stop{componentIds}, servo.set{componentId,angleDeg}, delay{ms}, condition{left,op,right} (operands {kind:'var',name}|{kind:'const',value}; ports true/false), sequence{steps}, parallel{branches}, variable.set{variable,op,value}, state.set{state}, function{name}, log{message}. Ports: next (most), error (sensor.read/function), step_N/branch_N/done. componentId must be the component ID.",
    z.object({
      variables: z.array(BehaviorVariable).default([]),
      states: z.array(z.string()).optional(),
      removeNodeIds: z.array(z.string()).default([]),
      nodes: z.array(z.unknown()).default([]),
      edges: z.array(z.object({ source: z.string(), sourcePort: z.string(), target: z.string() })).default([]),
    }),
    obj({ variables: { type: "array" }, states: { type: "array" }, removeNodeIds: { type: "array" }, nodes: { type: "array" }, edges: { type: "array" } }),
    (d, i) => {
      const cmds: Command[] = [];
      if (i.states) cmds.push({ type: "behavior.states.set", states: i.states });
      for (const v of i.variables) cmds.push({ type: "behavior.variable.upsert", variable: v });
      for (const id of i.removeNodeIds) cmds.push({ type: "behavior.node.remove", nodeId: id });
      for (const raw of i.nodes) {
        const n = BehaviorNode.parse({ position: { x: 0, y: 0 }, ...(raw as object) });
        if (d.spec.behavior.nodes.some((x) => x.id === n.id)) cmds.push({ type: "behavior.node.remove", nodeId: n.id });
        cmds.push({ type: "behavior.node.add", node: n });
      }
      for (const e of i.edges) cmds.push({ type: "behavior.edge.add", edge: BehaviorEdge.parse({ id: newId("e"), ...e }) });
      apply(d, cmds);
      return { ok: true, nodeCount: d.spec.behavior.nodes.length };
    },
  ),
  tool("validate", "Run validation on the draft and return errors and warnings.", z.object({}), obj({}), (d) => {
    const a = analyzeProject(d.spec, d.catalog);
    return a.report.diagnostics.filter((x) => x.severity !== "info").map((x) => ({ severity: x.severity, code: x.code, message: x.message, hint: x.hint }));
  }),
];

const SYSTEM = `You are RoboForge's robotics engineering assistant working on a canonical Robot Specification.
Rules:
- Change the design ONLY through the provided tools. Never output source code; code is generated from the spec.
- Start with get_design. Prefer parts from search_components. Name components in lower_snake_case.
- After hardware changes, auto_wire new parts, then run validate and resolve errors you introduced (e.g. I2C address conflicts via update_component config).
- Behavior edits: lay nodes out top-to-bottom with position {x,y} spaced ~150px; reuse existing variables.
- Finish with a concise engineering summary: what changed, pin/bus/address decisions, and any remaining warnings the engineer must decide on. The engineer reviews your proposal before it is applied.`;

export interface AssistantResult {
  reply: string;
  commands: Command[];
  proposedSpec: RobotSpec;
  before: { errors: number; warnings: number };
  after: { errors: number; warnings: number };
  toolCalls: { name: string; ok: boolean; summary: string }[];
}

export async function runAssistant(opts: { spec: RobotSpec; catalog: Draft["catalog"]; prompt: string; history?: Message[]; client: LlmClient; maxTurns?: number }): Promise<AssistantResult> {
  const draft: Draft = { spec: opts.spec, commands: [], catalog: opts.catalog };
  const count = (s: RobotSpec) => {
    const r = analyzeProject(s, opts.catalog).report;
    return { errors: r.counts.error, warnings: r.counts.warning };
  };
  const before = count(opts.spec);
  const messages: Message[] = [...(opts.history ?? []), { role: "user", content: opts.prompt }];
  const toolCalls: AssistantResult["toolCalls"] = [];
  let reply = "";

  for (let turn = 0; turn < (opts.maxTurns ?? 12); turn++) {
    const res = await opts.client.createMessage({ system: SYSTEM, messages, tools: TOOLS.map((t) => t.def), max_tokens: 4096 });
    messages.push({ role: "assistant", content: res.content });
    const uses = res.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    reply = res.content.filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim() || reply;
    if (!uses.length) break;
    const results: ContentBlock[] = [];
    for (const u of uses) {
      const t = TOOLS.find((x) => x.def.name === u.name);
      try {
        if (!t) throw new Error(`Unknown tool '${u.name}'.`);
        const out = t.run(draft, u.input ?? {});
        toolCalls.push({ name: u.name, ok: true, summary: JSON.stringify(u.input).slice(0, 160) });
        results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 12000) });
      } catch (e) {
        const msg = e instanceof CommandError ? `${e.code}: ${e.message}` : e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : (e as Error).message;
        toolCalls.push({ name: u.name, ok: false, summary: msg.slice(0, 200) });
        results.push({ type: "tool_result", tool_use_id: u.id, content: msg, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  return { reply, commands: draft.commands, proposedSpec: draft.spec, before, after: count(draft.spec), toolCalls };
}
