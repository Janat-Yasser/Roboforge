// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { ControllerPlatform, Diagnostic } from "@roboforge/spec";
import type { ControllerPinRef, RobotIR, ResolvedComponent } from "@roboforge/ir";
import { sourceVoltage } from "@roboforge/ir";
import { cppFloat, hex2, upper } from "../../util/text";
import { FIRMWARE_DRIVERS, HAL_TYPE, type FirmwareDriver, type HalKind } from "./drivers";

/** A component instantiated in firmware, with everything the emitters need. */
export interface FirmwareDevice {
  rc: ResolvedComponent;
  name: string;
  member: string;
  driver: FirmwareDriver;
  hal: HalKind;
  halType: string;
  /** Config macros: name → value (C++ literal). */
  macros: [string, string, string?][];
  ctorArgs: string[];
}

export interface FirmwarePlan {
  platform: ControllerPlatform;
  controller: ResolvedComponent;
  devices: FirmwareDevice[];
  i2c: { id: string; wire: string; sdaMacro: string; sclMacro: string; sda: string; scl: string }[];
  can: { id: string; txMacro: string; rxMacro: string; tx: string; rx: string; bitrate: number } | undefined;
  enablePins: { macro: string; codeRef: string; label: string }[];
  diagnostics: Diagnostic[];
}

const numCfg = (rc: ResolvedComponent, key: string, fallback: number): number => {
  const v = rc.instance.config[key];
  if (typeof v === "number") return v;
  const d = rc.def.config.find((f) => f.key === key)?.default;
  return typeof d === "number" ? d : fallback;
};
const boolCfg = (rc: ResolvedComponent, key: string, fallback: boolean): boolean => {
  const v = rc.instance.config[key];
  if (typeof v === "boolean") return v;
  const d = rc.def.config.find((f) => f.key === key)?.default;
  return typeof d === "boolean" ? d : fallback;
};

const pin = (p: ControllerPinRef | undefined) => p?.codeRef ?? "0 /* UNWIRED */";

export const FIRMWARE_PLATFORMS: ControllerPlatform[] = ["esp32", "avr", "stm32"];

/**
 * Decides which components become firmware devices and with which driver/arguments.
 * Components without a firmware driver for the platform are excluded with a diagnostic.
 */
export function planFirmware(ir: RobotIR): FirmwarePlan | undefined {
  const hw = ir.hardware;
  const controller = hw.controller;
  const platform = controller?.def.controller?.platform;
  if (!controller || !platform || !FIRMWARE_PLATFORMS.includes(platform)) return undefined;

  const diagnostics: Diagnostic[] = [];
  const devices: FirmwareDevice[] = [];
  const usedInBehavior = new Set(ir.behavior.usedComponentIds);
  let pwmChannel = 15;

  const exclude = (rc: ResolvedComponent, why: string) => {
    diagnostics.push({
      severity: usedInBehavior.has(rc.instance.id) ? "error" : "warning",
      category: "software",
      code: "FIRMWARE_DRIVER_UNAVAILABLE",
      message: `${rc.instance.name}: ${why}${usedInBehavior.has(rc.instance.id) ? " It is used by the behavior." : " It is left out of the firmware."}`,
      componentIds: [rc.instance.id],
      source: "target:firmware",
    });
  };

  // ---- Motors -------------------------------------------------------------------------------
  for (const b of hw.motors) {
    const rc = hw.byId.get(b.motorId)!;
    const M = upper(rc.instance.name);
    if (b.kind === "unbound") continue;
    if (b.kind === "hbridge") {
      const drv = hw.byId.get(b.driverId)!;
      const supplyNet = hw.nets.find((n) => n.id === b.supplyNetId);
      const supplyPin = supplyNet?.pins.find((p) => p.def?.type === "power_out");
      const supplyV = supplyPin ? sourceVoltage(hw.byId.get(supplyPin.componentId)!, supplyPin.def!).voltage : undefined;
      const rated = rc.def.motor!.ratedVoltage.max;
      const maxDuty = supplyV && supplyV > rated ? Math.floor((rated / supplyV) * 100) / 100 : 1;
      const invert = boolCfg(rc, "invert", false) !== b.reversedWiring;
      const channel = pwmChannel--;
      devices.push({
        rc,
        name: rc.instance.name,
        member: `${rc.instance.name}_`,
        driver: FIRMWARE_DRIVERS.hbridge!,
        hal: "motor",
        halType: HAL_TYPE.motor,
        macros: [
          [`RF_${M}_IN1`, pin(b.in1), `${drv.instance.name} channel ${b.channel}`],
          [`RF_${M}_IN2`, pin(b.in2)],
          [`RF_${M}_PWM`, pin(b.pwm)],
          [`RF_${M}_PWM_CHANNEL`, String(channel), "LEDC channel (ESP32 core 2.x)"],
          [`RF_${M}_PWM_FREQ_HZ`, String(numCfg(drv, "pwmFrequencyHz", 20000))],
          [`RF_${M}_INVERT`, String(invert), b.reversedWiring ? "wiring is reversed relative to M+/M-" : undefined],
          [`RF_${M}_MAX_DUTY`, cppFloat(maxDuty), maxDuty < 1 ? `limits ${supplyV} V supply to the motor's ${rated} V rating` : undefined],
        ],
        ctorArgs: [`RF_${M}_IN1`, `RF_${M}_IN2`, `RF_${M}_PWM`, `RF_${M}_PWM_CHANNEL`, `RF_${M}_PWM_FREQ_HZ`, `RF_${M}_INVERT`, `RF_${M}_MAX_DUTY`],
      });
    } else {
      const drv = hw.byId.get(b.driverId)!;
      if (platform !== "esp32") {
        exclude(rc, `CAN motor control is only generated for ESP32 (TWAI) in this version.`);
        continue;
      }
      devices.push({
        rc,
        name: rc.instance.name,
        member: `${rc.instance.name}_`,
        driver: FIRMWARE_DRIVERS.can_bldc!,
        hal: "motor",
        halType: HAL_TYPE.motor,
        macros: [
          [`RF_${M}_CAN_NODE_ID`, String(b.nodeId), `${drv.instance.name}`],
          [`RF_${M}_MAX_VEL_TURNS_S`, cppFloat(numCfg(drv, "maxVelocityTurnsPerS", 10))],
          [`RF_${M}_INVERT`, String(boolCfg(rc, "invert", false))],
        ],
        ctorArgs: [`RF_${M}_CAN_NODE_ID`, `RF_${M}_MAX_VEL_TURNS_S`, `RF_${M}_INVERT`],
      });
    }
  }

  // ---- Servos -------------------------------------------------------------------------------
  for (const s of hw.servos) {
    const rc = hw.byId.get(s.servoId)!;
    const drv = FIRMWARE_DRIVERS[rc.def.driver ?? ""];
    if (!drv || !drv.platforms.includes(platform)) {
      exclude(rc, `no firmware driver for ${rc.def.name} on ${platform}.`);
      continue;
    }
    if (!s.signal) continue;
    const S = upper(rc.instance.name);
    const [minUs, maxUs] = rc.def.servo!.pulseRangeUs;
    const [minDeg, maxDeg] = rc.def.servo!.angleRangeDeg;
    devices.push({
      rc,
      name: rc.instance.name,
      member: `${rc.instance.name}_`,
      driver: drv,
      hal: "servo",
      halType: HAL_TYPE.servo,
      macros: [
        [`RF_${S}_PIN`, pin(s.signal)],
        [`RF_${S}_MIN_US`, String(minUs)],
        [`RF_${S}_MAX_US`, String(maxUs)],
        [`RF_${S}_TRIM_DEG`, cppFloat(numCfg(rc, "trimDeg", 0))],
      ],
      ctorArgs: [`RF_${S}_PIN`, `RF_${S}_MIN_US`, `RF_${S}_MAX_US`, cppFloat(minDeg), cppFloat(maxDeg), `RF_${S}_TRIM_DEG`],
    });
  }

  // ---- Sensors ------------------------------------------------------------------------------
  const busIndex = new Map(hw.i2cBuses.map((b, i) => [b.id, i]));
  const wireFor = (busId: string) => {
    const i = busIndex.get(busId) ?? 0;
    return i === 0 ? "Wire" : platform === "esp32" && i === 1 ? "Wire1" : `rfWire${i}`;
  };
  for (const sb of hw.sensors) {
    const rc = hw.byId.get(sb.sensorId)!;
    const drv = FIRMWARE_DRIVERS[rc.def.driver ?? ""];
    if (!drv || !drv.platforms.includes(platform)) {
      exclude(rc, `no firmware driver for ${rc.def.name} on ${platform}${rc.def.sensor?.kind === "lidar" ? " (LiDAR is handled by the ROS 2 target)" : ""}.`);
      continue;
    }
    const S = upper(rc.instance.name);
    const base = { rc, name: rc.instance.name, member: `${rc.instance.name}_`, driver: drv, hal: drv.hal, halType: HAL_TYPE[drv.hal] };
    const range = rc.def.sensor?.channels[0]?.range;
    switch (drv.key) {
      case "vl53l0x":
        if (!sb.i2c) continue;
        devices.push({
          ...base,
          macros: [
            [`RF_${S}_I2C_ADDRESS`, hex2(sb.i2c.address ?? 0x29), `on ${sb.i2c.bus}`],
            [`RF_${S}_TIMING_BUDGET_MS`, String(numCfg(rc, "timingBudgetMs", 33))],
            [`RF_${S}_MAX_RANGE_M`, cppFloat(range?.[1] ?? 2)],
          ],
          ctorArgs: [wireFor(sb.i2c.bus), `RF_${S}_I2C_ADDRESS`, `RF_${S}_TIMING_BUDGET_MS`, `RF_${S}_MAX_RANGE_M`],
        });
        break;
      case "mpu6050":
      case "bno08x":
        if (!sb.i2c) continue;
        devices.push({
          ...base,
          macros: [[`RF_${S}_I2C_ADDRESS`, hex2(sb.i2c.address ?? 0x68), `on ${sb.i2c.bus}`]],
          ctorArgs: [wireFor(sb.i2c.bus), `RF_${S}_I2C_ADDRESS`],
        });
        break;
      case "hcsr04":
        devices.push({
          ...base,
          macros: [
            [`RF_${S}_TRIG`, pin(sb.pins["TRIG"])],
            [`RF_${S}_ECHO`, pin(sb.pins["ECHO"])],
            [`RF_${S}_TIMEOUT_US`, String(numCfg(rc, "timeoutUs", 25000))],
            [`RF_${S}_MAX_RANGE_M`, cppFloat(range?.[1] ?? 4)],
          ],
          ctorArgs: [`RF_${S}_TRIG`, `RF_${S}_ECHO`, `RF_${S}_TIMEOUT_US`, `RF_${S}_MAX_RANGE_M`],
        });
        break;
      case "sharp_ir":
        devices.push({ ...base, macros: [[`RF_${S}_PIN`, pin(sb.pins["VO"])]], ctorArgs: [`RF_${S}_PIN`] });
        break;
      case "switch_input": {
        const sig = Object.values(sb.pins).find(Boolean);
        devices.push({
          ...base,
          macros: [
            [`RF_${S}_PIN`, pin(sig)],
            [`RF_${S}_ACTIVE_HIGH`, String(boolCfg(rc, "activeHigh", true))],
            [`RF_${S}_DEBOUNCE_MS`, "5"],
          ],
          ctorArgs: [`RF_${S}_PIN`, `RF_${S}_ACTIVE_HIGH`, `RF_${S}_DEBOUNCE_MS`],
        });
        break;
      }
      default:
        exclude(rc, `driver '${drv.key}' has no firmware binding.`);
    }
  }

  const i2c = hw.i2cBuses
    .filter((b) => b.sda && b.scl)
    .map((b) => ({ id: b.id, wire: wireFor(b.id), sdaMacro: `RF_${upper(b.id)}_SDA`, sclMacro: `RF_${upper(b.id)}_SCL`, sda: b.sda!.codeRef, scl: b.scl!.codeRef }));
  if (platform === "avr" && i2c.length > 1) {
    diagnostics.push({ severity: "error", category: "software", code: "FIRMWARE_I2C_BUSES", message: "AVR targets support a single I²C bus.", source: "target:firmware" });
  }
  const canNet = hw.canNetworks.find((n) => n.controllerTx && n.controllerRx);
  const can = canNet
    ? { id: canNet.id, txMacro: `RF_${upper(canNet.id)}_TX`, rxMacro: `RF_${upper(canNet.id)}_RX`, tx: canNet.controllerTx!.codeRef, rx: canNet.controllerRx!.codeRef, bitrate: canNet.bitrate ?? 500000 }
    : undefined;

  const enablePins: FirmwarePlan["enablePins"] = [];
  const seen = new Set<string>();
  for (const b of hw.motors) {
    if (b.kind !== "hbridge") continue;
    for (const en of b.enable) {
      if (!en.drive || en.drive === "tied_high") continue;
      const key = `${b.driverId}:${en.pin}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const drv = hw.byId.get(b.driverId)!;
      enablePins.push({ macro: `RF_${upper(drv.instance.name)}_${upper(en.pin)}`, codeRef: en.drive.codeRef, label: `${drv.instance.name}.${en.pin}` });
    }
  }

  return { platform, controller, devices, i2c, can, enablePins, diagnostics };
}
