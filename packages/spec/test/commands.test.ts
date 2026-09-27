import { describe, expect, it } from "vitest";
import { builtinCatalog } from "@roboforge/catalog";
import { CommandError, applyCommands, createEmptySpec, parseSpecYaml, specToYaml, type Command } from "@roboforge/spec";

const catalog = builtinCatalog();
const ctx = { catalog };
const esp = catalog.get("esp32-devkitc")!;
const tof = catalog.get("vl53l0x-breakout")!;

const addMcu: Command = { type: "component.add", component: { id: "c1", name: "mcu", ref: { catalogId: esp.id, version: esp.version }, config: {}, layout: { x: 0, y: 0 } } };
const addTof: Command = { type: "component.add", component: { id: "c2", name: "tof", ref: { catalogId: tof.id, version: tof.version }, config: {}, layout: { x: 0, y: 0 } } };

describe("commands", () => {
  it("adds components and connections immutably", () => {
    const s0 = createEmptySpec("bot", "Bot");
    const s1 = applyCommands(s0, [addMcu, addTof, { type: "connection.add", connection: { id: "w1", from: { componentId: "c2", pin: "SDA" }, to: { componentId: "c1", pin: "GPIO21" } } }], ctx);
    expect(s0.components).toHaveLength(0);
    expect(s1.components.map((c) => c.name)).toEqual(["mcu", "tof"]);
    expect(s1.connections).toHaveLength(1);
  });

  it("rejects unknown pins, duplicate names and duplicate connections with the failing index", () => {
    const s = applyCommands(createEmptySpec("bot", "Bot"), [addMcu, addTof], ctx);
    expect(() => applyCommands(s, [{ type: "connection.add", connection: { id: "w", from: { componentId: "c2", pin: "NOPE" }, to: { componentId: "c1", pin: "GPIO21" } } }], ctx)).toThrow(/no pin 'NOPE'/);
    try {
      applyCommands(s, [{ type: "robot.update", patch: { displayName: "x" } }, { ...addTof, component: { ...(addTof as { component: object }).component, id: "c3" } } as Command], ctx);
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(CommandError);
      expect((e as CommandError).code).toBe("DUPLICATE_NAME");
      expect((e as CommandError).commandIndex).toBe(1);
    }
    const w: Command = { type: "connection.add", connection: { id: "w1", from: { componentId: "c2", pin: "SDA" }, to: { componentId: "c1", pin: "GPIO21" } } };
    const reversed: Command = { type: "connection.add", connection: { id: "w2", from: { componentId: "c1", pin: "GPIO21" }, to: { componentId: "c2", pin: "SDA" } } };
    expect(() => applyCommands(s, [w, reversed], ctx)).toThrow(/already connected/);
  });

  it("removing a component removes its wires but keeps behavior nodes for validation", () => {
    let s = applyCommands(createEmptySpec("bot", "Bot"), [addMcu, addTof], ctx);
    s = applyCommands(
      s,
      [
        { type: "connection.add", connection: { id: "w1", from: { componentId: "c2", pin: "SDA" }, to: { componentId: "c1", pin: "GPIO21" } } },
        { type: "behavior.variable.upsert", variable: { name: "d", initial: 0 } },
        { type: "behavior.node.add", node: { id: "n1", kind: "sensor.read", position: { x: 0, y: 0 }, params: { componentId: "c2", channel: "distance_m", variable: "d" } } },
        { type: "component.remove", componentId: "c2" },
      ],
      ctx,
    );
    expect(s.connections).toHaveLength(0);
    expect(s.behavior.nodes).toHaveLength(1);
  });

  it("validates behavior ports and params", () => {
    let s = createEmptySpec("bot", "Bot");
    s = applyCommands(
      s,
      [
        { type: "behavior.node.add", node: { id: "a", kind: "event.start", position: { x: 0, y: 0 }, params: {} } },
        { type: "behavior.node.add", node: { id: "b", kind: "sequence", position: { x: 0, y: 0 }, params: { steps: 3 } } },
        { type: "behavior.node.add", node: { id: "c", kind: "delay", position: { x: 0, y: 0 }, params: { ms: 10 } } },
        { type: "behavior.edge.add", edge: { id: "e1", source: "a", sourcePort: "next", target: "b" } },
        { type: "behavior.edge.add", edge: { id: "e2", source: "b", sourcePort: "step_3", target: "c" } },
      ],
      ctx,
    );
    expect(() => applyCommands(s, [{ type: "behavior.edge.add", edge: { id: "e3", source: "c", sourcePort: "true", target: "b" } }], ctx)).toThrow(/no output port/);
    expect(() => applyCommands(s, [{ type: "behavior.edge.add", edge: { id: "e3", source: "c", sourcePort: "next", target: "a" } }], ctx)).toThrow(/Event nodes/);
    expect(() => applyCommands(s, [{ type: "behavior.node.update", nodeId: "c", patch: { params: { ms: -5 } } }], ctx)).toThrow(/INVALID|Invalid/);
    // Reducing sequence steps drops edges from ports that disappeared.
    s = applyCommands(s, [{ type: "behavior.node.update", nodeId: "b", patch: { params: { steps: 2 } } }], ctx);
    expect(s.behavior.edges.map((e) => e.id)).toEqual(["e1"]);
    // Re-connecting an output port replaces the previous edge.
    s = applyCommands(s, [{ type: "behavior.edge.add", edge: { id: "e9", source: "a", sourcePort: "next", target: "c" } }], ctx);
    expect(s.behavior.edges.map((e) => e.id)).toEqual(["e9"]);
  });

  it("round-trips through YAML", () => {
    const s = applyCommands(createEmptySpec("bot", "Bot"), [addMcu, addTof], ctx);
    const parsed = parseSpecYaml(specToYaml(s));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.spec).toEqual(s);
    const bad = parseSpecYaml("schemaVersion: 1\nrobot: { name: 'Bad Name', displayName: x }\n");
    expect(bad.ok).toBe(false);
  });
});
