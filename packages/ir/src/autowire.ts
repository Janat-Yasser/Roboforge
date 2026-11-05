import { newId, type Catalog, type Command, type ControllerFunction, type PinDef, type RobotSpec } from "@roboforge/spec";
import { resolveHardware } from "./hardware/resolve";
import { REQUIRED_CONTROLLER_FN, pinSupports } from "./hardware/pins";
import { sourceVoltage } from "./hardware/power";
import type { HardwareIR, ResolvedComponent } from "./types";

export interface AutoWirePlan {
  commands: Command[];
  /** Human-readable explanation of each decision, in order. */
  notes: string[];
  /** Pins that could not be wired, with the reason. */
  skipped: { pin: string; reason: string }[];
}

const FLAG_COST: Record<string, number> = { adc2: 1, strapping: 4, console: 8 };

/**
 * Plans connections for one component's unconnected pins: ground, power (voltage-compatible
 * source), motor terminals (free driver channel) and signals (free controller pin that supports
 * the required function, preferring pins without boot/Wi-Fi/console caveats).
 *
 * Returns commands only — the caller decides whether to apply them (UI button, AI proposal).
 */
export function planAutoWire(spec: RobotSpec, catalog: Catalog, componentId: string): AutoWirePlan {
  const hw = resolveHardware(spec, catalog);
  const rc = hw.byId.get(componentId);
  const plan: AutoWirePlan = { commands: [], notes: [], skipped: [] };
  if (!rc) {
    plan.skipped.push({ pin: "*", reason: "Component not found." });
    return plan;
  }
  const ctrl = hw.controller;
  const connected = new Set(spec.connections.flatMap((w) => [`${w.from.componentId}:${w.from.pin}`, `${w.to.componentId}:${w.to.pin}`]));
  const claimed = new Set<string>(); // controller pins claimed by this plan
  const isFree = (c: ResolvedComponent, pin: string) => !connected.has(`${c.instance.id}:${pin}`) && !claimed.has(`${c.instance.id}:${pin}`);

  const connect = (fromPin: string, to: { componentId: string; pin: string }, note: string) => {
    plan.commands.push({
      type: "connection.add",
      connection: { id: newId("w"), from: { componentId, pin: fromPin }, to },
    });
    claimed.add(`${to.componentId}:${to.pin}`);
    connected.add(`${componentId}:${fromPin}`);
    plan.notes.push(note);
  };

  const groundTarget = findGround(hw, rc);
  let motorOutputs: Map<string, { componentId: string; pin: string }> | undefined;
  const isController = rc === ctrl;

  for (const pin of rc.def.pins) {
    if (!isFree(rc, pin.name) || pin.optional) continue;
    const label = `${rc.instance.name}.${pin.name}`;

    if (pin.type === "ground") {
      if (!groundTarget) plan.skipped.push({ pin: pin.name, reason: "No ground reference (add a controller or battery)." });
      else connect(pin.name, groundTarget, `${label} → ${hw.byId.get(groundTarget.componentId)!.instance.name}.${groundTarget.pin} (common ground)`);
      continue;
    }

    if (pin.type === "power_in") {
      const src = findSupply(hw, rc, pin);
      if (!src) plan.skipped.push({ pin: pin.name, reason: `No power source within ${pin.voltage?.min ?? "?"}–${pin.voltage?.max ?? "?"} V.` });
      else connect(pin.name, { componentId: src.rc.instance.id, pin: src.pin.name }, `${label} → ${src.rc.instance.name}.${src.pin.name} (${src.voltage} V)`);
      continue;
    }

    if (pin.type === "motor_terminal") {
      motorOutputs ??= chooseMotorOutputs(hw, rc, (k) => connected.has(k) || claimed.has(k));
      const target = motorOutputs.get(pin.name);
      if (!target) plan.skipped.push({ pin: pin.name, reason: "No free motor driver channel." });
      else connect(pin.name, target, `${label} → ${hw.byId.get(target.componentId)!.instance.name}.${target.pin}`);
      continue;
    }

    const fn = REQUIRED_CONTROLLER_FN[pin.type];
    if (!fn || isController) continue;
    if (!ctrl) {
      plan.skipped.push({ pin: pin.name, reason: "No controller in the project." });
      continue;
    }
    const target = pickControllerPin(hw, ctrl, fn, connected, claimed);
    if (!target) plan.skipped.push({ pin: pin.name, reason: `No free ${ctrl.instance.name} pin supports ${fn}.` });
    else connect(pin.name, { componentId: ctrl.instance.id, pin: target }, `${label} → ${ctrl.instance.name}.${target} (${fn})`);
  }
  return plan;
}

function findGround(hw: HardwareIR, rc: ResolvedComponent): { componentId: string; pin: string } | undefined {
  const ref = hw.controller && hw.controller !== rc ? hw.controller : hw.components.find((c) => c !== rc && c.def.power?.kind === "battery");
  const gnd = ref?.def.pins.find((p) => p.type === "ground");
  return ref && gnd ? { componentId: ref.instance.id, pin: gnd.name } : undefined;
}

function findSupply(hw: HardwareIR, rc: ResolvedComponent, pin: PinDef) {
  const range = pin.voltage;
  const isMotorSupply = rc.def.driverChannels?.some((c) => c.motorSupplyPin === pin.name) || !!rc.def.can;
  // A regulator's input wants the raw supply (a battery), never a controller's regulated output.
  const isRegulatorInput = rc.def.power?.kind === "regulator" && rc.def.power.inputPin === pin.name;
  const wantsRaw = isMotorSupply || isRegulatorInput;
  const logic = hw.controller?.def.controller?.logicLevelV;
  const candidates: { rc: ResolvedComponent; pin: PinDef; voltage: number; rank: number }[] = [];
  for (const c of hw.components) {
    if (c === rc) continue;
    for (const p of c.def.pins) {
      if (p.type !== "power_out") continue;
      const v = sourceVoltage(c, p);
      if (v.voltage === undefined) continue;
      if (range && (v.voltage < range.min || (v.maxVoltage ?? v.voltage) > range.max)) continue;
      let rank: number;
      if (wantsRaw) rank = c.def.power?.kind === "battery" ? 0 : c.def.power?.kind === "regulator" ? 1 : 3;
      else if (c === hw.controller) rank = v.voltage === logic ? 0 : 1;
      else rank = c.def.power?.kind === "regulator" ? 2 : 3;
      candidates.push({ rc: c, pin: p, voltage: v.voltage, rank });
    }
  }
  candidates.sort((a, b) => a.rank - b.rank || (wantsRaw ? b.voltage - a.voltage : a.voltage - b.voltage));
  return candidates[0];
}

/**
 * Chooses the driver outputs for all of a motor's terminals at once: a channel this motor is
 * already partly wired to, otherwise the first completely free channel; for multi-phase (CAN/BLDC)
 * drivers without channels, the free phase outputs in order.
 */
function chooseMotorOutputs(hw: HardwareIR, motor: ResolvedComponent, isTaken: (key: string) => boolean): Map<string, { componentId: string; pin: string }> {
  const result = new Map<string, { componentId: string; pin: string }>();
  const terminals = motor.def.pins.filter((p) => p.type === "motor_terminal");
  const channelOf = (drv: ResolvedComponent) => drv.def.driverChannels ?? [];

  const assign = (drv: ResolvedComponent, outs: string[]) => {
    terminals.forEach((t, i) => {
      const out = outs[i];
      if (out && !isTaken(`${drv.instance.id}:${out}`)) result.set(t.name, { componentId: drv.instance.id, pin: out });
    });
  };

  for (const drv of hw.components) {
    for (const ch of channelOf(drv)) {
      const partlyMine = terminals.some((t) =>
        hw.netByPin.get(`${motor.instance.id}:${t.name}`)?.pins.some((p) => p.componentId === drv.instance.id && ch.outputs.includes(p.pin)),
      );
      if (partlyMine) {
        assign(drv, ch.outputs);
        return result;
      }
    }
  }
  for (const drv of hw.components) {
    for (const ch of channelOf(drv)) {
      if (ch.outputs.every((o) => !isTaken(`${drv.instance.id}:${o}`))) {
        assign(drv, ch.outputs);
        return result;
      }
    }
  }
  for (const drv of hw.components) {
    if (drv.def.driverChannels || drv.def.category !== "motor_driver") continue;
    const outs = drv.def.pins.filter((p) => p.type === "motor_out").map((p) => p.name);
    if (outs.length >= terminals.length && outs.every((o) => !isTaken(`${drv.instance.id}:${o}`))) {
      assign(drv, outs);
      return result;
    }
  }
  return result;
}

function pickControllerPin(
  hw: HardwareIR,
  ctrl: ResolvedComponent,
  fn: ControllerFunction,
  connected: Set<string>,
  claimed: Set<string>,
): string | undefined {
  const info = ctrl.def.controller;
  const free = (pin: string) => !connected.has(`${ctrl.instance.id}:${pin}`) && !claimed.has(`${ctrl.instance.id}:${pin}`);

  // Shared buses: reuse an existing bus before opening a new one.
  if (fn === "i2c_sda" || fn === "i2c_scl") {
    const bus = hw.i2cBuses.find((b) => b.sda && b.scl);
    if (bus) return fn === "i2c_sda" ? bus.sda!.pin : bus.scl!.pin;
    const pending = [...claimed].map((k) => k.split(":")[1]!);
    const def = info?.defaultBuses.i2c?.find((d) => (fn === "i2c_sda" ? free(d.sda) : free(d.scl)) || pending.includes(d.sda) || pending.includes(d.scl));
    if (def) return fn === "i2c_sda" ? def.sda : def.scl;
  }
  if (fn === "can_tx" || fn === "can_rx") {
    const def = info?.defaultBuses.can?.find((d) => free(fn === "can_tx" ? d.tx : d.rx));
    if (def) return fn === "can_tx" ? def.tx : def.rx;
  }
  if (fn === "uart_tx" || fn === "uart_rx") {
    const def = info?.defaultBuses.uart?.find((d) => free(d.tx) && free(d.rx));
    if (def) return fn === "uart_tx" ? def.tx : def.rx;
  }

  const busPins = new Set(
    [
      ...(info?.defaultBuses.i2c ?? []).flatMap((b) => [b.sda, b.scl]),
      ...(info?.defaultBuses.can ?? []).flatMap((b) => [b.tx, b.rx]),
      ...(info?.defaultBuses.uart ?? []).flatMap((b) => [b.tx, b.rx]),
    ],
  );
  const scored = ctrl.def.pins
    .filter((p) => p.type === "gpio" && free(p.name) && pinSupports(p, fn).ok && !p.flags?.includes("reserved"))
    .map((p) => {
      let cost = (p.flags ?? []).reduce((s, f) => s + (FLAG_COST[f] ?? 0), 0);
      if (busPins.has(p.name)) cost += 3;
      // ESP32 input-only pins have no internal pull-ups (switch inputs rely on them).
      if (p.flags?.includes("input_only")) cost += 6;
      if (fn === "adc" && p.flags?.includes("adc2")) cost += 5;
      return { name: p.name, cost };
    })
    .sort((a, b) => a.cost - b.cost);
  return scored[0]?.name;
}
