// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { pinClass } from "@roboforge/ir";
import { rule, type RuleFinding } from "../engine";
import { fmtMa, fmtV, nameOf, netVoltage } from "../util";

export const hardwareRules = [
  rule({
    id: "hardware.unknown-component",
    category: "hardware",
    severity: "error",
    description: "Every component must resolve to a catalog definition.",
    evaluate: ({ ir }) =>
      ir.hardware.unresolved.map((c) => ({
        code: "UNKNOWN_COMPONENT",
        message: `'${c.name}' references ${c.ref.catalogId}@${c.ref.version}, which is not in the component library.`,
        componentIds: [c.id],
      })),
  }),

  rule({
    id: "hardware.controller",
    category: "hardware",
    severity: "error",
    description: "Exactly one primary controller must be identifiable.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      if (hw.controller) return [];
      if (hw.controllerCandidates.length === 0) {
        return hw.components.length
          ? [{ code: "NO_CONTROLLER", message: "No controller in the design. Add a microcontroller or SBC.", severity: "warning" }]
          : [];
      }
      return [
        {
          code: "AMBIGUOUS_CONTROLLER",
          message: `Several controllers (${hw.controllerCandidates.map((c) => c.instance.name).join(", ")}). Select the primary controller on the Robot page.`,
          componentIds: hw.controllerCandidates.map((c) => c.instance.id),
        },
      ];
    },
  }),

  rule({
    id: "hardware.duplicate-names",
    category: "hardware",
    severity: "error",
    description: "Component names are code identifiers and must be unique.",
    evaluate: ({ ir }) => {
      const seen = new Map<string, string>();
      const out: RuleFinding[] = [];
      for (const c of ir.spec.components) {
        const first = seen.get(c.name);
        if (first) out.push({ code: "DUPLICATE_COMPONENT_NAME", message: `Two components are named '${c.name}'.`, componentIds: [first, c.id] });
        else seen.set(c.name, c.id);
      }
      return out;
    },
  }),

  rule({
    id: "hardware.unconnected",
    category: "hardware",
    severity: "warning",
    description: "Components should be wired.",
    evaluate: ({ ir }) =>
      ir.hardware.components
        .filter((c) => !ir.spec.connections.some((w) => w.from.componentId === c.instance.id || w.to.componentId === c.instance.id))
        .map((c) => ({ code: "UNCONNECTED_COMPONENT", message: `'${c.instance.name}' is not connected to anything.`, componentIds: [c.instance.id] })),
  }),

  rule({
    id: "hardware.incompatible-connection",
    category: "electrical",
    severity: "error",
    description: "Pins on one net must be electrically compatible.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const net of hw.nets) {
        const classes = new Set(net.pins.map((p) => pinClass(p.def?.type)));
        if (classes.has("nc")) {
          out.push({ code: "NC_PIN_CONNECTED", message: `A no-connect pin is wired on net ${net.name}.`, connectionIds: net.connectionIds });
        }
        if (net.kind !== "mixed") continue;
        const describe = net.pins.map((p) => `${nameOf(hw, p.componentId)}.${p.pin} (${p.def?.type ?? "?"})`).join(", ");
        if (classes.has("power") && classes.has("ground")) {
          out.push({
            code: "POWER_SHORT_TO_GROUND",
            message: `Power is shorted to ground: ${describe}.`,
            connectionIds: net.connectionIds,
            componentIds: [...new Set(net.pins.map((p) => p.componentId))],
          });
        } else {
          out.push({
            code: "INCOMPATIBLE_CONNECTION",
            message: `Incompatible pins connected: ${describe}.`,
            connectionIds: net.connectionIds,
            componentIds: [...new Set(net.pins.map((p) => p.componentId))],
            hint: "Power connects to power, ground to ground, logic to logic, motor outputs to motor terminals.",
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "hardware.motor-binding",
    category: "hardware",
    severity: "error",
    description: "Every motor must be driven by exactly one driver channel with all control inputs wired.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      const channelUse = new Map<string, string[]>();
      for (const m of hw.motors) {
        const motorName = nameOf(hw, m.motorId);
        if (m.kind === "unbound") {
          out.push({ code: "MOTOR_UNBOUND", message: `${motorName}: ${m.reason}`, componentIds: [m.motorId] });
          continue;
        }
        if (m.kind === "can") continue;
        const key = `${m.driverId}:${m.channel}`;
        channelUse.set(key, [...(channelUse.get(key) ?? []), m.motorId]);
        const driverName = nameOf(hw, m.driverId);
        const driver = hw.byId.get(m.driverId)!;
        const channel = driver.def.driverChannels!.find((c) => c.id === m.channel)!;
        const missing = [
          !m.in1 && channel.inputs.in1,
          !m.in2 && channel.inputs.in2,
          !m.pwm && channel.inputs.pwm,
        ].filter(Boolean);
        if (missing.length) {
          out.push({
            code: "MOTOR_DRIVER_INPUT_UNCONNECTED",
            message: `${driverName} channel ${m.channel} (${motorName}): ${missing.join(", ")} not connected to the controller.`,
            componentIds: [m.driverId, m.motorId],
            pins: missing.map((p) => `${m.driverId}:${p}`),
          });
        }
        for (const en of m.enable) {
          if (!en.drive) {
            out.push({
              code: "MOTOR_DRIVER_DISABLED",
              message: `${driverName}.${en.pin} is not driven — the driver outputs stay disabled.`,
              componentIds: [m.driverId],
              pins: [`${m.driverId}:${en.pin}`],
              hint: "Connect it to a controller GPIO (recommended, lets firmware disable outputs on e-stop) or tie it to the logic supply.",
            });
          }
        }
        // Motor supply vs motor rating, stall current vs channel capability.
        const motor = hw.byId.get(m.motorId)!.def.motor!;
        const supply = m.supplyNetId ? hw.nets.find((n) => n.id === m.supplyNetId) : undefined;
        const v = netVoltage(hw, supply);
        if (v !== undefined && v > motor.ratedVoltage.max) {
          out.push({
            severity: "warning",
            code: "MOTOR_OVERVOLTAGE",
            message: `${motorName} is rated ${fmtV(motor.ratedVoltage.min)}–${fmtV(motor.ratedVoltage.max)} but its driver supply is ${fmtV(v)}.`,
            componentIds: [m.motorId, m.driverId],
            hint: "Limit the maximum PWM duty in firmware or lower the motor supply voltage.",
          });
        } else if (v !== undefined && v < motor.ratedVoltage.min) {
          out.push({
            severity: "warning",
            code: "MOTOR_UNDERVOLTAGE",
            message: `${motorName} is rated ${fmtV(motor.ratedVoltage.min)}–${fmtV(motor.ratedVoltage.max)} but its driver supply is only ${fmtV(v)}.`,
            componentIds: [m.motorId, m.driverId],
          });
        }
        if (motor.stallCurrentMa > channel.peakCurrentMa) {
          out.push({
            code: "MOTOR_EXCEEDS_DRIVER_PEAK",
            message: `${motorName} stall current ${fmtMa(motor.stallCurrentMa)} exceeds ${driverName} peak rating ${fmtMa(channel.peakCurrentMa)}.`,
            componentIds: [m.motorId, m.driverId],
          });
        } else if (motor.stallCurrentMa > channel.continuousCurrentMa) {
          out.push({
            severity: "warning",
            code: "MOTOR_EXCEEDS_DRIVER_CONTINUOUS",
            message: `${motorName} stall current ${fmtMa(motor.stallCurrentMa)} exceeds ${driverName} continuous rating ${fmtMa(channel.continuousCurrentMa)} (peak ${fmtMa(channel.peakCurrentMa)} is OK).`,
            componentIds: [m.motorId, m.driverId],
            hint: "Add current limiting / stall detection in firmware.",
          });
        }
      }
      for (const [key, motors] of channelUse) {
        if (motors.length > 1) {
          const [driverId, ch] = key.split(":");
          out.push({
            code: "MOTOR_CHANNEL_SHARED",
            message: `${motors.map((id) => nameOf(hw, id)).join(" and ")} share ${nameOf(hw, driverId!)} channel ${ch}.`,
            componentIds: [...motors, driverId!],
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "hardware.servo-signal",
    category: "hardware",
    severity: "error",
    description: "Servo signal pins must be connected to a PWM-capable controller pin.",
    evaluate: ({ ir }) =>
      ir.hardware.servos
        .filter((s) => !s.signal)
        .map((s) => ({ code: "SERVO_SIGNAL_UNCONNECTED", message: `${nameOf(ir.hardware, s.servoId)} signal is not connected to the controller.`, componentIds: [s.servoId] })),
  }),

  rule({
    id: "hardware.sensor-wiring",
    category: "hardware",
    severity: "error",
    description: "Required sensor signal pins must be wired to the controller.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      if (!hw.controller) return out;
      for (const s of ir.hardware.sensors) {
        const rc = hw.byId.get(s.sensorId)!;
        // Sensors intended for the Linux/ROS host (e.g. USB LiDAR) are allowed to be unwired.
        if (rc.def.interfaces.includes("usb") && Object.values(s.pins).every((p) => !p)) continue;
        const missing = rc.def.pins
          .filter((p) => !p.optional && !["power_in", "power_out", "ground", "nc", "can_h", "can_l", "ethernet", "usb"].includes(p.type))
          .filter((p) => !s.pins[p.name])
          .map((p) => p.name);
        if (missing.length) {
          out.push({
            code: "SENSOR_SIGNAL_UNCONNECTED",
            message: `${rc.instance.name}: ${missing.join(", ")} not connected to ${hw.controller.instance.name}.`,
            componentIds: [s.sensorId],
            pins: missing.map((p) => `${s.sensorId}:${p}`),
          });
        }
      }
      return out;
    },
  }),
];
