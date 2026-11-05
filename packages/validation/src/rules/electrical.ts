// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { ResolvedComponent } from "@roboforge/ir";
import type { PinDef } from "@roboforge/spec";
import { rule, type RuleFinding } from "../engine";
import { fmtV, isConnected, netOf, netVoltage } from "../util";

/** Pin types through which a device can drive a voltage onto a controller pin. */
const DRIVING_TYPES = new Set<PinDef["type"]>(["digital_out", "analog_out", "uart_tx", "can_rxd", "i2c_sda", "i2c_scl"]);

export const electricalRules = [
  rule({
    id: "electrical.logic-level",
    category: "electrical",
    severity: "error",
    description: "Device outputs must not exceed the controller input voltage tolerance.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const ctrl = hw.controller;
      if (!ctrl?.def.controller) return [];
      const out: RuleFinding[] = [];
      const deviceLevel = (rc: ResolvedComponent, pin: PinDef): number | undefined => {
        if (pin.logicLevelV !== undefined) return pin.logicLevelV;
        if (rc.def.electrical.logicFollowsSupplyPin) {
          return netVoltage(hw, netOf(hw, rc.instance.id, rc.def.electrical.logicFollowsSupplyPin));
        }
        return rc.def.electrical.logicLevelV;
      };
      for (const a of hw.pinAssignments) {
        const cpin = ctrl.def.pins.find((p) => p.name === a.pin)!;
        const tolerance = cpin.fiveVoltTolerant ? 5.5 : ctrl.def.controller.logicLevelV + 0.3;
        for (const d of a.devices) {
          const rc = hw.byId.get(d.componentId);
          const pdef = rc?.def.pins.find((p) => p.name === d.pin);
          if (!rc || !pdef || !DRIVING_TYPES.has(pdef.type)) continue;
          const level = deviceLevel(rc, pdef);
          if (level !== undefined && level > tolerance) {
            out.push({
              code: "LOGIC_LEVEL_MISMATCH",
              message: `${rc.instance.name}.${d.pin} drives ${fmtV(level)} into ${ctrl.instance.name}.${a.pin}, which tolerates ${fmtV(tolerance)}.`,
              componentIds: [rc.instance.id, ctrl.instance.id],
              pins: [`${rc.instance.id}:${d.pin}`, `${ctrl.instance.id}:${a.pin}`],
              connectionIds: netOf(hw, rc.instance.id, d.pin)?.connectionIds,
              hint: rc.def.electrical.logicFollowsSupplyPin
                ? `Power ${rc.instance.name}.${rc.def.electrical.logicFollowsSupplyPin} from ${fmtV(ctrl.def.controller.logicLevelV)} or add a level shifter.`
                : "Add a level shifter or a resistor divider.",
            });
          }
        }
      }
      return out;
    },
  }),

  rule({
    id: "electrical.controller-pins-shorted",
    category: "electrical",
    severity: "error",
    description: "Two controller pins must never be tied together.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const ctrl = hw.controller;
      if (!ctrl) return [];
      return hw.nets
        .map((n) => ({ n, pins: n.pins.filter((p) => p.componentId === ctrl.instance.id && p.def?.type === "gpio") }))
        .filter(({ pins }) => pins.length > 1)
        .map(({ n, pins }) => ({
          code: "CONTROLLER_PINS_SHORTED",
          message: `${pins.map((p) => `${ctrl.instance.name}.${p.pin}`).join(" and ")} are connected together.`,
          connectionIds: n.connectionIds,
          pins: pins.map((p) => `${ctrl.instance.id}:${p.pin}`),
        }));
    },
  }),

  rule({
    id: "electrical.ground",
    category: "electrical",
    severity: "error",
    description: "Components must be grounded, and signal partners must share the controller ground.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      const ctrl = hw.controller;
      const ctrlGround = ctrl?.def.pins
        .filter((p) => p.type === "ground")
        .map((p) => netOf(hw, ctrl.instance.id, p.name))
        .find(Boolean);
      for (const rc of hw.components) {
        const grounds = rc.def.pins.filter((p) => p.type === "ground");
        if (!grounds.length) continue;
        const hasAny = rc.def.pins.some((p) => isConnected(hw, rc.instance.id, p.name));
        if (!hasAny) continue; // reported as unconnected
        const groundNets = grounds.map((g) => netOf(hw, rc.instance.id, g.name)).filter(Boolean);
        if (!groundNets.length) {
          out.push({ code: "MISSING_GROUND", message: `${rc.instance.name} has no ground connection.`, componentIds: [rc.instance.id], pins: grounds.map((g) => `${rc.instance.id}:${g.name}`) });
          continue;
        }
        if (!ctrl || rc === ctrl || !ctrlGround) continue;
        const talksToController = hw.pinAssignments.some((a) => a.devices.some((d) => d.componentId === rc.instance.id));
        if (talksToController && !groundNets.some((n) => n!.id === ctrlGround.id)) {
          out.push({
            code: "NO_COMMON_GROUND",
            message: `${rc.instance.name} exchanges signals with ${ctrl.instance.name} but does not share its ground.`,
            componentIds: [rc.instance.id, ctrl.instance.id],
          });
        }
      }
      if (ctrl && !ctrlGround && ctrl.def.pins.some((p) => isConnected(hw, ctrl.instance.id, p.name))) {
        out.push({ code: "MISSING_GROUND", message: `${ctrl.instance.name} has no ground connection.`, componentIds: [ctrl.instance.id] });
      }
      return out;
    },
  }),
];
