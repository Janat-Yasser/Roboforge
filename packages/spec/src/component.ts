// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";

/**
 * Component definition schema — the structured technical metadata for a catalog part.
 * Definitions are versioned and immutable once published; project specs reference
 * `{ catalogId, version }`.
 */

export const PinType = z.enum([
  "power_in",
  "power_out",
  "ground",
  /** Controller general-purpose pin; what it may do is described by `functions`. */
  "gpio",
  /** Device logic input (driven by a controller output). */
  "digital_in",
  /** Device logic output (read by a controller input). */
  "digital_out",
  /** Device input expecting a PWM signal (motor driver PWM, servo signal). */
  "pwm_in",
  /** Device analog output voltage (read by an ADC). */
  "analog_out",
  "i2c_sda",
  "i2c_scl",
  "spi_sck",
  "spi_mosi",
  "spi_miso",
  "spi_cs",
  /** Device UART TX (connects to controller RX). */
  "uart_tx",
  /** Device UART RX (connects to controller TX). */
  "uart_rx",
  /** CAN transceiver logic-side input, driven by the controller CAN TX. */
  "can_txd",
  /** CAN transceiver logic-side output, read by the controller CAN RX. */
  "can_rxd",
  "can_h",
  "can_l",
  /** Motor driver output terminal. */
  "motor_out",
  /** Motor lead. */
  "motor_terminal",
  "ethernet",
  "usb",
  "nc",
]);
export type PinType = z.infer<typeof PinType>;

export const ControllerFunction = z.enum([
  "gpio_out",
  "gpio_in",
  "pwm",
  "adc",
  "i2c_sda",
  "i2c_scl",
  "spi_sck",
  "spi_mosi",
  "spi_miso",
  "uart_tx",
  "uart_rx",
  "can_tx",
  "can_rx",
]);
export type ControllerFunction = z.infer<typeof ControllerFunction>;

export const PinFlag = z.enum([
  /** Boot-mode strapping pin: usable but affects boot if pulled at reset. */
  "strapping",
  /** Input only (no output driver). */
  "input_only",
  /** Reserved for on-board function (e.g. SPI flash) — must not be used. */
  "reserved",
  /** ESP32 ADC2 channel — unavailable while Wi-Fi is active. */
  "adc2",
  /** Pin used by USB serial / bootloader console. */
  "console",
]);
export type PinFlag = z.infer<typeof PinFlag>;

export const VoltageRange = z.object({ min: z.number(), max: z.number() });
export type VoltageRange = z.infer<typeof VoltageRange>;

export const PinFunctionDef = z.object({
  fn: ControllerFunction,
  /** Hardware peripheral instance. "*" means routable to any instance (e.g. ESP32 GPIO matrix). */
  bus: z.string().optional(),
});
export type PinFunctionDef = z.infer<typeof PinFunctionDef>;

export const PinDef = z.object({
  name: z.string().min(1),
  type: PinType,
  label: z.string().optional(),
  /** Identifier used in generated code (e.g. "21", "A0", "PA5"). Controllers only. */
  codeRef: z.string().optional(),
  functions: z.array(PinFunctionDef).optional(),
  flags: z.array(PinFlag).optional(),
  /** power_in: acceptable supply range. */
  voltage: VoltageRange.optional(),
  /** power_in: typical current drawn through this pin (defaults to the component typical current). */
  currentMa: z.number().nonnegative().optional(),
  /** power_out: fixed output voltage. */
  outputVoltage: z.number().optional(),
  /** power_out: output voltage taken from an instance config key (regulators). */
  outputVoltageConfigKey: z.string().optional(),
  /** power_out: maximum continuous current the pin can source. */
  maxCurrentMa: z.number().nonnegative().optional(),
  /** Signal pins: logic high level emitted by this pin. Defaults to component logic level. */
  logicLevelV: z.number().optional(),
  /** Controller inputs: tolerates 5 V even though logic is lower. */
  fiveVoltTolerant: z.boolean().optional(),
  /** Optional pin: not required for the device to work; skipped by auto-wiring. */
  optional: z.boolean().optional(),
  /** Driver/motor side grouping (e.g. channel "A"). */
  group: z.string().optional(),
  notes: z.string().optional(),
});
export type PinDef = z.infer<typeof PinDef>;

export const ComponentCategory = z.enum([
  "controller",
  "sbc",
  "motor",
  "motor_driver",
  "servo",
  "sensor",
  "power",
  "regulator",
  "communication",
  "switch",
  "connector",
]);
export type ComponentCategory = z.infer<typeof ComponentCategory>;

export const ConfigField = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["number", "integer", "boolean", "string", "enum", "hex"]),
  default: z.union([z.number(), z.string(), z.boolean()]).optional(),
  options: z.array(z.union([z.string(), z.number()])).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
});
export type ConfigField = z.infer<typeof ConfigField>;

export const ControllerPlatform = z.enum(["esp32", "avr", "stm32", "rp2040", "linux"]);
export type ControllerPlatform = z.infer<typeof ControllerPlatform>;

export const ControllerInfo = z.object({
  platform: ControllerPlatform,
  /** Logic level of the controller I/O. */
  logicLevelV: z.number(),
  /** PlatformIO environment settings. */
  platformio: z
    .object({ platform: z.string(), board: z.string(), framework: z.string() })
    .optional(),
  /** Preferred default bus pins, used by the auto-wiring planner. */
  defaultBuses: z
    .object({
      i2c: z.array(z.object({ bus: z.string(), sda: z.string(), scl: z.string() })).optional(),
      can: z.array(z.object({ bus: z.string(), tx: z.string(), rx: z.string() })).optional(),
      uart: z.array(z.object({ bus: z.string(), tx: z.string(), rx: z.string() })).optional(),
    })
    .default({}),
  /** Hardware peripheral instances available. */
  peripherals: z
    .object({
      i2c: z.array(z.string()).default([]),
      uart: z.array(z.string()).default([]),
      can: z.array(z.string()).default([]),
      spi: z.array(z.string()).default([]),
    })
    .default({}),
  /** Max total current the board can source from its GPIOs. */
  maxPinCurrentMa: z.number().optional(),
});
export type ControllerInfo = z.infer<typeof ControllerInfo>;

export const DriverChannel = z.object({
  id: z.string(),
  /** Logical control input -> pin name. */
  inputs: z.object({ in1: z.string(), in2: z.string(), pwm: z.string().optional() }),
  outputs: z.tuple([z.string(), z.string()]),
  /** Pin that supplies motor power to this channel. */
  motorSupplyPin: z.string(),
  continuousCurrentMa: z.number(),
  peakCurrentMa: z.number(),
});
export type DriverChannel = z.infer<typeof DriverChannel>;

export const MotorInfo = z.object({
  kind: z.enum(["dc", "bldc", "stepper"]),
  ratedVoltage: VoltageRange,
  noLoadCurrentMa: z.number(),
  stallCurrentMa: z.number(),
  noLoadRpm: z.number().optional(),
  encoderCpr: z.number().optional(),
});

export const ServoInfo = z.object({
  angleRangeDeg: z.tuple([z.number(), z.number()]),
  pulseRangeUs: z.tuple([z.number(), z.number()]),
  stallCurrentMa: z.number().optional(),
});

export const SensorKind = z.enum(["distance", "imu", "switch", "gps", "lidar", "camera", "encoder"]);
export type SensorKind = z.infer<typeof SensorKind>;

export const SensorChannel = z.object({
  id: z.string(),
  label: z.string(),
  unit: z.string(),
  range: z.tuple([z.number(), z.number()]).optional(),
});
export type SensorChannel = z.infer<typeof SensorChannel>;

export const SensorInfo = z.object({
  kind: SensorKind,
  channels: z.array(SensorChannel),
  /** ROS 2 message type used when bridged (e.g. sensor_msgs/msg/Range). */
  rosMessage: z.string().optional(),
});

export const PowerInfo = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("battery"),
    chemistry: z.string(),
    nominalV: z.number(),
    fullV: z.number(),
    capacityMah: z.number(),
    maxDischargeMa: z.number(),
  }),
  z.object({
    kind: z.literal("regulator"),
    topology: z.enum(["buck", "boost", "linear", "buck_boost"]),
    efficiency: z.number().min(0.1).max(1),
    /** Minimum headroom between input and output (buck/linear). */
    dropoutV: z.number().default(0),
    inputPin: z.string(),
    outputPin: z.string(),
  }),
]);
export type PowerInfo = z.infer<typeof PowerInfo>;

export const ComponentDefinition = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  name: z.string(),
  manufacturer: z.string(),
  category: ComponentCategory,
  description: z.string(),
  tags: z.array(z.string()).default([]),
  datasheetUrl: z.string().url().optional(),
  interfaces: z.array(z.string()).default([]),
  electrical: z
    .object({
      typicalCurrentMa: z.number().nonnegative().default(0),
      peakCurrentMa: z.number().nonnegative().optional(),
      /** Logic high level of the component's signal outputs. */
      logicLevelV: z.number().optional(),
      /** Logic high level equals the voltage on this power pin (boards with pull-ups to VIN). */
      logicFollowsSupplyPin: z.string().optional(),
    })
    .default({}),
  pins: z.array(PinDef).min(1),
  controller: ControllerInfo.optional(),
  driverChannels: z.array(DriverChannel).optional(),
  /** Driver pins that must be held high for the outputs to be enabled (e.g. TB6612 STBY). */
  enablePins: z.array(z.string()).optional(),
  motor: MotorInfo.optional(),
  servo: ServoInfo.optional(),
  sensor: SensorInfo.optional(),
  power: PowerInfo.optional(),
  i2c: z.object({ defaultAddress: z.number(), allowedAddresses: z.array(z.number()) }).optional(),
  can: z.object({ defaultNodeId: z.number(), maxNodeId: z.number() }).optional(),
  config: z.array(ConfigField).default([]),
  /** Firmware driver key understood by code generators. */
  driver: z.string().optional(),
  /** Physical footprint for URDF generation (metres). */
  geometry: z
    .object({ box: z.tuple([z.number(), z.number(), z.number()]).optional(), massKg: z.number().optional() })
    .optional(),
});
export type ComponentDefinition = z.infer<typeof ComponentDefinition>;
export type ComponentDefinitionInput = z.input<typeof ComponentDefinition>;

/** Read access to component definitions. Implemented by the static catalog, the DB, and test fakes. */
export interface Catalog {
  get(catalogId: string, version?: string): ComponentDefinition | undefined;
}

export class MapCatalog implements Catalog {
  private readonly byKey = new Map<string, ComponentDefinition>();
  private readonly latest = new Map<string, ComponentDefinition>();

  constructor(definitions: Iterable<ComponentDefinition>) {
    for (const def of definitions) this.add(def);
  }

  add(def: ComponentDefinition): void {
    this.byKey.set(`${def.id}@${def.version}`, def);
    const current = this.latest.get(def.id);
    if (!current || compareSemver(def.version, current.version) > 0) this.latest.set(def.id, def);
  }

  get(catalogId: string, version?: string): ComponentDefinition | undefined {
    if (version) return this.byKey.get(`${catalogId}@${version}`);
    return this.latest.get(catalogId);
  }

  all(): ComponentDefinition[] {
    return [...this.latest.values()];
  }
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
