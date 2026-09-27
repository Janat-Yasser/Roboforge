import { rule, type RuleFinding } from "../engine";
import { nameOf } from "../util";

export const safetyRules = [
  rule({
    id: "safety.estop",
    category: "safety",
    severity: "warning",
    description: "Robots with motors should have a wired emergency stop monitored by firmware.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      const motors = hw.components.filter((c) => c.def.motor);
      const estops = ir.behavior.estopComponentIds;
      if (motors.length && !estops.length) {
        out.push({
          code: "NO_ESTOP",
          message: "The robot has motors but no emergency stop input.",
          componentIds: motors.map((m) => m.instance.id),
          hint: "Add an e-stop button (Switches) — the generated runtime latches and stops all motors when it trips.",
        });
      }
      for (const id of estops) {
        const s = hw.sensors.find((x) => x.sensorId === id);
        if (!s || !Object.values(s.pins).some(Boolean)) {
          out.push({ severity: "error", code: "ESTOP_NOT_WIRED", message: `E-stop '${nameOf(hw, id)}' is not wired to the controller.`, componentIds: [id] });
        }
      }
      return out;
    },
  }),

  rule({
    id: "safety.driver-enable",
    category: "safety",
    severity: "info",
    description: "Driver enable pins controlled by firmware allow a hard output cut-off.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const seen = new Set<string>();
      const out: RuleFinding[] = [];
      for (const m of hw.motors) {
        if (m.kind !== "hbridge" || seen.has(m.driverId)) continue;
        seen.add(m.driverId);
        if (m.enable.some((e) => e.drive === "tied_high")) {
          out.push({
            code: "DRIVER_ENABLE_TIED_HIGH",
            message: `${nameOf(hw, m.driverId)} enable is tied high; firmware cannot hard-disable the outputs on e-stop.`,
            componentIds: [m.driverId],
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "safety.behavior-stop",
    category: "safety",
    severity: "warning",
    description: "Behaviors that drive motors should contain an explicit stop path.",
    evaluate: ({ ir }) => {
      const nodes = ir.behavior.nodes;
      const drives = nodes.some((n) => n.op.op === "motor_set" && n.op.commands.some((c) => c.speed !== 0));
      const stops = nodes.some((n) => n.op.op === "motor_stop" || (n.op.op === "motor_set" && n.op.commands.every((c) => c.speed === 0)));
      if (drives && !stops) {
        return [{ code: "BEHAVIOR_NO_STOP", message: "The behavior drives motors but never stops them.", nodeIds: nodes.filter((n) => n.op.op === "motor_set").map((n) => n.nodeId) }];
      }
      return [];
    },
  }),
];
