// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { SHAREABLE_FNS } from "@roboforge/ir";
import { rule, type RuleFinding } from "../engine";
import { nameOf } from "../util";

export const pinRules = [
  rule({
    id: "pins.assignment",
    category: "pin-assignment",
    severity: "error",
    description: "Controller pins must support their role and not be claimed twice.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const ctrl = hw.controller;
      if (!ctrl) return [];
      const out: RuleFinding[] = [];
      for (const a of hw.pinAssignments) {
        const pin = ctrl.def.pins.find((p) => p.name === a.pin)!;
        const cid = ctrl.instance.id;
        const devs = a.devices.map((d) => `${nameOf(hw, d.componentId)}.${d.pin}`).join(", ");
        const componentIds = [cid, ...new Set(a.devices.map((d) => d.componentId))];
        const pins = [`${cid}:${a.pin}`, ...a.devices.map((d) => `${d.componentId}:${d.pin}`)];

        if (pin.flags?.includes("reserved")) {
          out.push({ code: "PIN_RESERVED", message: `${ctrl.instance.name}.${a.pin} is reserved (${pin.notes ?? "on-board function"}) but is wired to ${devs}.`, componentIds, pins });
          continue;
        }
        if (a.requestedFns.length > 1) {
          out.push({
            code: "PIN_FUNCTION_CONFLICT",
            message: `${ctrl.instance.name}.${a.pin} is already assigned: ${devs} need incompatible roles (${a.requestedFns.join(" vs ")}).`,
            componentIds,
            pins,
          });
          continue;
        }
        if (a.fn && !a.supported) {
          out.push({
            code: "PIN_FUNCTION_UNSUPPORTED",
            message: `${ctrl.instance.name}.${a.pin} cannot act as ${a.fn}${pin.flags?.includes("input_only") ? " (input-only pin)" : ""}, required by ${devs}.`,
            componentIds,
            pins,
          });
        }
        if (a.fn && a.devices.length > 1 && !SHAREABLE_FNS.has(a.fn)) {
          const fanout = a.fn === "gpio_out" || a.fn === "pwm";
          out.push({
            severity: fanout ? "warning" : "error",
            code: fanout ? "PIN_FANOUT" : "PIN_SHARED",
            message: fanout
              ? `${ctrl.instance.name}.${a.pin} drives several inputs (${devs}). They will always switch together.`
              : `Two devices use the same GPIO: ${ctrl.instance.name}.${a.pin} ← ${devs}.`,
            componentIds,
            pins,
          });
        }
        if (pin.flags?.includes("strapping")) {
          out.push({
            severity: "warning",
            code: "PIN_STRAPPING",
            message: `${ctrl.instance.name}.${a.pin} is a boot strapping pin; external pull-ups/downs from ${devs} can prevent booting.`,
            componentIds,
            pins,
          });
        }
        if (pin.flags?.includes("console")) {
          out.push({ severity: "warning", code: "PIN_CONSOLE", message: `${ctrl.instance.name}.${a.pin} is shared with the USB serial console; logging and flashing will interfere.`, componentIds, pins });
        }
        if (a.fn === "adc" && pin.flags?.includes("adc2")) {
          out.push({ severity: "warning", code: "PIN_ADC2_WIFI", message: `${ctrl.instance.name}.${a.pin} is on ADC2, which is unavailable while Wi-Fi is active.`, componentIds, pins });
        }
        if (a.fn === "gpio_in" && pin.flags?.includes("input_only")) {
          const switches = a.devices.filter((d) => hw.byId.get(d.componentId)?.def.sensor?.kind === "switch");
          if (switches.length) {
            out.push({
              severity: "warning",
              code: "PIN_NO_PULLUP",
              message: `${ctrl.instance.name}.${a.pin} has no internal pull-up; ${switches.map((d) => nameOf(hw, d.componentId)).join(", ")} needs an external 10 kΩ pull-up.`,
              componentIds,
              pins,
            });
          }
        }
      }
      return out;
    },
  }),
];
