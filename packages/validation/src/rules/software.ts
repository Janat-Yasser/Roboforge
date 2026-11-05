// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { rule, type RuleFinding } from "../engine";
import { nameOf } from "../util";

export const softwareRules = [
  rule({
    id: "software.behavior-hardware",
    category: "software",
    severity: "error",
    description: "Behavior nodes may only command actuators that are fully wired.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const n of ir.behavior.nodes) {
        const targets =
          n.op.op === "motor_set" ? n.op.commands.map((c) => c.componentId) : n.op.op === "motor_stop" ? n.op.components.map((c) => c.componentId) : [];
        for (const id of targets) {
          const b = hw.motors.find((m) => m.motorId === id);
          if (b?.kind === "unbound") {
            out.push({ code: "BEHAVIOR_ACTUATOR_UNBOUND", message: `'${n.title}' commands ${nameOf(hw, id)}, which is not bound to a driver.`, nodeIds: [n.nodeId], componentIds: [id] });
          }
        }
        if (n.op.op === "servo_set") {
          const s = hw.servos.find((x) => x.servoId === (n.op as { componentId: string }).componentId);
          if (s && !s.signal) out.push({ code: "BEHAVIOR_ACTUATOR_UNBOUND", message: `'${n.title}' commands ${nameOf(hw, s.servoId)}, whose signal is not wired.`, nodeIds: [n.nodeId] });
        }
      }
      return out;
    },
  }),
];
