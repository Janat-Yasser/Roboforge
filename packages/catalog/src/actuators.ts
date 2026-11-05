// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { ComponentDefinitionInput } from "./types";

const tb6612: ComponentDefinitionInput = {
  id: "tb6612fng-breakout",
  version: "1.0.0",
  name: "TB6612FNG Dual Motor Driver",
  manufacturer: "Toshiba (breakout)",
  category: "motor_driver",
  description: "Dual H-bridge MOSFET driver. 4.5–13.5 V motor supply, 1.2 A continuous / 3.2 A peak per channel. 2.7–5.5 V logic.",
  tags: ["h-bridge", "dc motor", "dual"],
  datasheetUrl: "https://toshiba.semicon-storage.com/info/TB6612FNG_datasheet_en_20141001.pdf",
  interfaces: ["gpio", "pwm"],
  electrical: { typicalCurrentMa: 2 },
  pins: [
    { name: "VM", type: "power_in", voltage: { min: 4.5, max: 13.5 }, currentMa: 0, notes: "Motor supply." },
    { name: "VCC", type: "power_in", voltage: { min: 2.7, max: 5.5 }, currentMa: 2, notes: "Logic supply." },
    { name: "GND", type: "ground" },
    { name: "AIN1", type: "digital_in", group: "A" },
    { name: "AIN2", type: "digital_in", group: "A" },
    { name: "PWMA", type: "pwm_in", group: "A" },
    { name: "BIN1", type: "digital_in", group: "B" },
    { name: "BIN2", type: "digital_in", group: "B" },
    { name: "PWMB", type: "pwm_in", group: "B" },
    { name: "STBY", type: "digital_in", notes: "Must be high to enable outputs." },
    { name: "AO1", type: "motor_out", group: "A" },
    { name: "AO2", type: "motor_out", group: "A" },
    { name: "BO1", type: "motor_out", group: "B" },
    { name: "BO2", type: "motor_out", group: "B" },
  ],
  driverChannels: [
    { id: "A", inputs: { in1: "AIN1", in2: "AIN2", pwm: "PWMA" }, outputs: ["AO1", "AO2"], motorSupplyPin: "VM", continuousCurrentMa: 1200, peakCurrentMa: 3200 },
    { id: "B", inputs: { in1: "BIN1", in2: "BIN2", pwm: "PWMB" }, outputs: ["BO1", "BO2"], motorSupplyPin: "VM", continuousCurrentMa: 1200, peakCurrentMa: 3200 },
  ],
  enablePins: ["STBY"],
  config: [{ key: "pwmFrequencyHz", label: "PWM frequency", type: "integer", default: 20000, min: 100, max: 100000, unit: "Hz" }],
  driver: "hbridge",
  geometry: { box: [0.02, 0.02, 0.003], massKg: 0.002 },
};

const l298n: ComponentDefinitionInput = {
  id: "l298n-module",
  version: "1.0.0",
  name: "L298N Dual H-Bridge Module",
  manufacturer: "Generic",
  category: "motor_driver",
  description: "Bipolar dual H-bridge module. 5–35 V motor supply, 2 A per channel, ~2 V drop. Logic 5 V (jumper removed).",
  tags: ["h-bridge", "dc motor", "dual"],
  interfaces: ["gpio", "pwm"],
  electrical: { typicalCurrentMa: 36 },
  pins: [
    { name: "12V", label: "+12V (VS)", type: "power_in", voltage: { min: 5, max: 35 }, currentMa: 0 },
    { name: "5V", label: "+5V (logic)", type: "power_in", voltage: { min: 4.5, max: 7 }, currentMa: 36 },
    { name: "GND", type: "ground" },
    { name: "ENA", type: "pwm_in", group: "A" },
    { name: "IN1", type: "digital_in", group: "A" },
    { name: "IN2", type: "digital_in", group: "A" },
    { name: "IN3", type: "digital_in", group: "B" },
    { name: "IN4", type: "digital_in", group: "B" },
    { name: "ENB", type: "pwm_in", group: "B" },
    { name: "OUT1", type: "motor_out", group: "A" },
    { name: "OUT2", type: "motor_out", group: "A" },
    { name: "OUT3", type: "motor_out", group: "B" },
    { name: "OUT4", type: "motor_out", group: "B" },
  ],
  driverChannels: [
    { id: "A", inputs: { in1: "IN1", in2: "IN2", pwm: "ENA" }, outputs: ["OUT1", "OUT2"], motorSupplyPin: "12V", continuousCurrentMa: 2000, peakCurrentMa: 3000 },
    { id: "B", inputs: { in1: "IN3", in2: "IN4", pwm: "ENB" }, outputs: ["OUT3", "OUT4"], motorSupplyPin: "12V", continuousCurrentMa: 2000, peakCurrentMa: 3000 },
  ],
  config: [{ key: "pwmFrequencyHz", label: "PWM frequency", type: "integer", default: 1000, min: 100, max: 40000, unit: "Hz" }],
  driver: "hbridge",
  geometry: { box: [0.043, 0.043, 0.027], massKg: 0.03 },
};

const canBldc: ComponentDefinitionInput = {
  id: "can-bldc-controller-24v",
  version: "1.0.0",
  name: "CAN BLDC Motor Controller (24 V)",
  manufacturer: "Generic",
  category: "motor_driver",
  description:
    "Field-oriented BLDC controller commanded over CAN 2.0 (ODrive CANSimple-compatible framing). Requires a 20–28 V bus.",
  tags: ["bldc", "foc", "can"],
  interfaces: ["can"],
  electrical: { typicalCurrentMa: 60 },
  pins: [
    { name: "VBUS", type: "power_in", voltage: { min: 20, max: 28 } },
    { name: "GND", type: "ground" },
    { name: "CANH", type: "can_h" },
    { name: "CANL", type: "can_l" },
    { name: "PH_A", type: "motor_out" },
    { name: "PH_B", type: "motor_out" },
    { name: "PH_C", type: "motor_out" },
  ],
  can: { defaultNodeId: 1, maxNodeId: 63 },
  config: [
    { key: "canId", label: "CAN node id", type: "integer", default: 1, min: 0, max: 63 },
    { key: "maxVelocityTurnsPerS", label: "Max velocity", type: "number", default: 10, min: 0.1, unit: "turn/s" },
  ],
  driver: "can_bldc",
  geometry: { box: [0.06, 0.05, 0.02], massKg: 0.06 },
};

const dcGearmotor12v: ComponentDefinitionInput = {
  id: "dc-gearmotor-12v",
  version: "1.0.0",
  name: "DC Gearmotor 25 mm, 12 V",
  manufacturer: "Generic",
  category: "motor",
  description: "Brushed DC gearmotor, 6–12 V, ~120 mA no-load, ~1.1 A stall at 12 V.",
  tags: ["dc motor", "gearmotor", "brushed"],
  interfaces: ["motor"],
  electrical: { typicalCurrentMa: 0 },
  pins: [
    { name: "M+", type: "motor_terminal" },
    { name: "M-", type: "motor_terminal" },
  ],
  motor: { kind: "dc", ratedVoltage: { min: 6, max: 12 }, noLoadCurrentMa: 120, stallCurrentMa: 1100, noLoadRpm: 200 },
  config: [
    { key: "invert", label: "Invert direction", type: "boolean", default: false },
    { key: "wheelRadiusM", label: "Wheel radius", type: "number", default: 0.035, unit: "m" },
  ],
  geometry: { box: [0.025, 0.025, 0.06], massKg: 0.1 },
};

const ttMotor: ComponentDefinitionInput = {
  id: "dc-gearmotor-tt",
  version: "1.0.0",
  name: "TT Gearmotor 3–6 V",
  manufacturer: "Generic",
  category: "motor",
  description: "Hobby plastic-gearbox DC motor, 3–6 V, ~150 mA no-load, ~1.2 A stall.",
  tags: ["dc motor", "tt", "hobby"],
  interfaces: ["motor"],
  pins: [
    { name: "M+", type: "motor_terminal" },
    { name: "M-", type: "motor_terminal" },
  ],
  motor: { kind: "dc", ratedVoltage: { min: 3, max: 6 }, noLoadCurrentMa: 150, stallCurrentMa: 1200, noLoadRpm: 200 },
  config: [
    { key: "invert", label: "Invert direction", type: "boolean", default: false },
    { key: "wheelRadiusM", label: "Wheel radius", type: "number", default: 0.033, unit: "m" },
  ],
  geometry: { box: [0.022, 0.019, 0.065], massKg: 0.03 },
};

const bldcHub: ComponentDefinitionInput = {
  id: "bldc-hub-motor-24v",
  version: "1.0.0",
  name: "BLDC Hub Motor 6.5\" 24 V",
  manufacturer: "Generic",
  category: "motor",
  description: "Outrunner hub wheel motor, 24–36 V, 15 pole pairs.",
  tags: ["bldc", "hub motor", "wheel"],
  interfaces: ["motor"],
  pins: [
    { name: "A", type: "motor_terminal" },
    { name: "B", type: "motor_terminal" },
    { name: "C", type: "motor_terminal" },
  ],
  motor: { kind: "bldc", ratedVoltage: { min: 24, max: 36 }, noLoadCurrentMa: 400, stallCurrentMa: 15000 },
  config: [
    { key: "invert", label: "Invert direction", type: "boolean", default: false },
    { key: "wheelRadiusM", label: "Wheel radius", type: "number", default: 0.0825, unit: "m" },
  ],
  geometry: { box: [0.165, 0.165, 0.045], massKg: 2.2 },
};

const sg90: ComponentDefinitionInput = {
  id: "servo-sg90",
  version: "1.0.0",
  name: "SG90 Micro Servo",
  manufacturer: "TowerPro",
  category: "servo",
  description: "9 g analog micro servo, 4.8–6 V, 180°.",
  tags: ["servo", "pwm"],
  interfaces: ["pwm"],
  electrical: { typicalCurrentMa: 100, peakCurrentMa: 650 },
  pins: [
    { name: "V+", type: "power_in", voltage: { min: 4.8, max: 6 } },
    { name: "GND", type: "ground" },
    { name: "SIG", type: "pwm_in" },
  ],
  servo: { angleRangeDeg: [0, 180], pulseRangeUs: [500, 2400], stallCurrentMa: 650 },
  config: [{ key: "trimDeg", label: "Trim", type: "number", default: 0, min: -20, max: 20, unit: "°" }],
  driver: "hobby_servo",
  geometry: { box: [0.023, 0.012, 0.029], massKg: 0.009 },
};

const mg996r: ComponentDefinitionInput = {
  id: "servo-mg996r",
  version: "1.0.0",
  name: "MG996R Servo",
  manufacturer: "TowerPro",
  category: "servo",
  description: "Metal-gear standard servo, 4.8–7.2 V, ~2.5 A stall.",
  tags: ["servo", "pwm", "metal gear"],
  interfaces: ["pwm"],
  electrical: { typicalCurrentMa: 200, peakCurrentMa: 2500 },
  pins: [
    { name: "V+", type: "power_in", voltage: { min: 4.8, max: 7.2 } },
    { name: "GND", type: "ground" },
    { name: "SIG", type: "pwm_in" },
  ],
  servo: { angleRangeDeg: [0, 180], pulseRangeUs: [500, 2500], stallCurrentMa: 2500 },
  config: [{ key: "trimDeg", label: "Trim", type: "number", default: 0, min: -20, max: 20, unit: "°" }],
  driver: "hobby_servo",
  geometry: { box: [0.04, 0.02, 0.043], massKg: 0.055 },
};

const n20Motor: ComponentDefinitionInput = {
  id: "n20-micro-gearmotor-6v",
  version: "1.0.0",
  name: "N20 Micro Metal Gearmotor 6 V",
  manufacturer: "Generic",
  category: "motor",
  description: "12 mm micro metal gearmotor for small robots and line followers. 3–6 V, ~60 mA no-load, ~0.75 A stall, about 300 rpm (100:1).",
  tags: ["dc motor", "gearmotor", "micro", "n20"],
  interfaces: ["motor"],
  pins: [
    { name: "M+", type: "motor_terminal" },
    { name: "M-", type: "motor_terminal" },
  ],
  motor: { kind: "dc", ratedVoltage: { min: 3, max: 6 }, noLoadCurrentMa: 60, stallCurrentMa: 750, noLoadRpm: 300 },
  config: [
    { key: "invert", label: "Invert direction", type: "boolean", default: false },
    { key: "wheelRadiusM", label: "Wheel radius", type: "number", default: 0.016, unit: "m" },
  ],
  geometry: { box: [0.012, 0.01, 0.034], massKg: 0.01 },
};

const jga25Motor: ComponentDefinitionInput = {
  id: "jga25-370-12v",
  version: "1.0.0",
  name: "JGA25-370 Gearmotor 12 V",
  manufacturer: "Generic",
  category: "motor",
  description: "25 mm metal-gear DC motor for rovers carrying a few kilograms. 6–12 V, ~100 mA no-load, ~1.8 A stall, 170 rpm.",
  tags: ["dc motor", "gearmotor", "metal gear"],
  interfaces: ["motor"],
  pins: [
    { name: "M+", type: "motor_terminal" },
    { name: "M-", type: "motor_terminal" },
  ],
  motor: { kind: "dc", ratedVoltage: { min: 6, max: 12 }, noLoadCurrentMa: 100, stallCurrentMa: 1800, noLoadRpm: 170 },
  config: [
    { key: "invert", label: "Invert direction", type: "boolean", default: false },
    { key: "wheelRadiusM", label: "Wheel radius", type: "number", default: 0.04, unit: "m" },
  ],
  geometry: { box: [0.025, 0.025, 0.075], massKg: 0.11 },
};

const ds3218: ComponentDefinitionInput = {
  id: "servo-ds3218",
  version: "1.0.0",
  name: "DS3218 20 kg Servo",
  manufacturer: "DSServo",
  category: "servo",
  description: "High-torque digital servo for arms and grippers, 4.8–6.8 V, about 20 kg·cm, ~2.5 A stall, 180°.",
  tags: ["servo", "pwm", "metal gear", "high torque"],
  interfaces: ["pwm"],
  electrical: { typicalCurrentMa: 250, peakCurrentMa: 2500 },
  pins: [
    { name: "V+", type: "power_in", voltage: { min: 4.8, max: 6.8 } },
    { name: "GND", type: "ground" },
    { name: "SIG", type: "pwm_in" },
  ],
  servo: { angleRangeDeg: [0, 180], pulseRangeUs: [500, 2500], stallCurrentMa: 2500 },
  config: [{ key: "trimDeg", label: "Trim", type: "number", default: 0, min: -20, max: 20, unit: "°" }],
  driver: "hobby_servo",
  geometry: { box: [0.04, 0.02, 0.04], massKg: 0.06 },
};

export const actuators = [tb6612, l298n, canBldc, dcGearmotor12v, ttMotor, n20Motor, jga25Motor, bldcHub, sg90, mg996r, ds3218];
