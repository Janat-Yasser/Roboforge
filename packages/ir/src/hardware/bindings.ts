// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { CanNetwork, ControllerPinRef, I2cBus, MotorBinding, Net, ResolvedComponent, SensorBinding, ServoBinding, UartLink } from "../types";
import { canNodeIdOf } from "./buses";
import { controllerPinFor } from "./pins";

interface Ctx {
  components: ResolvedComponent[];
  byId: Map<string, ResolvedComponent>;
  controller: ResolvedComponent | undefined;
  netByPin: Map<string, Net>;
  i2cBuses: I2cBus[];
  canNetworks: CanNetwork[];
  uartLinks: UartLink[];
}

/**
 * Resolves which driver channel (and which controller pins) drive each motor.
 * H-bridge: motor terminals → driver channel outputs → channel inputs → controller pins.
 * CAN: motor phases → CAN motor controller → its node id on a CAN network.
 */
export function computeMotorBindings(ctx: Ctx): MotorBinding[] {
  const out: MotorBinding[] = [];
  for (const rc of ctx.components) {
    if (!rc.def.motor) continue;
    const motorId = rc.instance.id;
    const terminals = rc.def.pins.filter((p) => p.type === "motor_terminal");
    // Driver outputs on each terminal's net.
    const hits = terminals.map((t) => {
      const net = ctx.netByPin.get(`${motorId}:${t.name}`);
      const outs = (net?.pins ?? []).filter((p) => p.def?.type === "motor_out");
      return { terminal: t.name, outs };
    });
    const connected = hits.filter((h) => h.outs.length > 0);
    if (!connected.length) {
      out.push({ kind: "unbound", motorId, reason: "Motor terminals are not connected to a motor driver." });
      continue;
    }
    const driverIds = new Set(connected.flatMap((h) => h.outs.map((o) => o.componentId)));
    if (driverIds.size > 1) {
      out.push({ kind: "unbound", motorId, reason: "Motor terminals are connected to different drivers." });
      continue;
    }
    const driver = ctx.byId.get([...driverIds][0]!)!;

    if (driver.def.can) {
      const net = ctx.canNetworks.find((n) => n.nodes.some((x) => x.componentId === driver.instance.id));
      out.push({ kind: "can", motorId, driverId: driver.instance.id, nodeId: canNodeIdOf(driver) ?? 0, networkId: net?.id });
      continue;
    }

    if (connected.length < terminals.length) {
      out.push({ kind: "unbound", motorId, reason: "Only one motor terminal is connected." });
      continue;
    }
    const outputPins = new Set(connected.flatMap((h) => h.outs.map((o) => o.pin)));
    const channel = driver.def.driverChannels?.find((c) => c.outputs.every((o) => outputPins.has(o)) && outputPins.size === 2);
    if (!channel) {
      out.push({ kind: "unbound", motorId, reason: "Motor terminals must connect to both outputs of the same driver channel." });
      continue;
    }
    const first = hits[0]!;
    const reversedWiring = first.outs.some((o) => o.pin === channel.outputs[1]);
    const pinRef = (name: string | undefined): ControllerPinRef | undefined =>
      name ? controllerPinFor(ctx.controller, ctx.netByPin, driver.instance.id, name) : undefined;
    const enable = (driver.def.enablePins ?? []).map((pin) => {
      const ctrl = pinRef(pin);
      if (ctrl) return { pin, drive: ctrl };
      const net = ctx.netByPin.get(`${driver.instance.id}:${pin}`);
      const tied = net?.pins.some((p) => p.def?.type === "power_out");
      return { pin, drive: tied ? ("tied_high" as const) : undefined };
    });
    out.push({
      kind: "hbridge",
      motorId,
      driverId: driver.instance.id,
      channel: channel.id,
      in1: pinRef(channel.inputs.in1),
      in2: pinRef(channel.inputs.in2),
      pwm: pinRef(channel.inputs.pwm),
      enable,
      reversedWiring,
      supplyNetId: ctx.netByPin.get(`${driver.instance.id}:${channel.motorSupplyPin}`)?.id,
    });
  }
  return out;
}

export function computeServoBindings(ctx: Ctx): ServoBinding[] {
  return ctx.components
    .filter((rc) => rc.def.servo)
    .map((rc) => {
      const sig = rc.def.pins.find((p) => p.type === "pwm_in");
      return { servoId: rc.instance.id, signal: sig ? controllerPinFor(ctx.controller, ctx.netByPin, rc.instance.id, sig.name) : undefined };
    });
}

export function computeSensorBindings(ctx: Ctx): SensorBinding[] {
  const out: SensorBinding[] = [];
  for (const rc of ctx.components) {
    if (!rc.def.sensor) continue;
    const id = rc.instance.id;
    const pins: SensorBinding["pins"] = {};
    for (const p of rc.def.pins) {
      if (["power_in", "power_out", "ground", "nc"].includes(p.type)) continue;
      pins[p.name] = controllerPinFor(ctx.controller, ctx.netByPin, id, p.name);
    }
    const bus = ctx.i2cBuses.find((b) => b.devices.some((d) => d.componentId === id));
    const uart = ctx.uartLinks.find((u) => u.componentId === id);
    let iface: SensorBinding["iface"] = "none";
    if (bus) iface = "i2c";
    else if (uart) iface = "uart";
    else if (rc.def.pins.some((p) => p.type === "analog_out")) iface = "analog";
    else if (Object.values(pins).some(Boolean)) iface = "gpio";
    out.push({
      sensorId: id,
      kind: rc.def.sensor.kind,
      driver: rc.def.driver,
      iface,
      ...(bus ? { i2c: { bus: bus.id, address: bus.devices.find((d) => d.componentId === id)?.address } } : {}),
      ...(uart ? { uart: { bus: uart.bus } } : {}),
      pins,
    });
  }
  return out;
}
