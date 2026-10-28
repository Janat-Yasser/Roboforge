import type { Catalog, ComponentDefinition, RobotSpec } from "@roboforge/spec";

/**
 * Turns a Robot Specification into a simple 3D arrangement: chassis, wheels, and a part model per
 * component. Positions use three.js axes (y up). Robot frame (ROS): x forward, y left, z up —
 * three.x = ros.x, three.y = ros.z, three.z = −ros.y.
 */

export type PartShape =
  | "controller"
  | "board"
  | "driver"
  | "regulator"
  | "battery"
  | "tof"
  | "sonar"
  | "ir"
  | "imu"
  | "lidar"
  | "estop"
  | "switch"
  | "servo"
  | "motor"
  | "transceiver";

export interface PlacedPart {
  id: string;
  name: string;
  title: string;
  shape: PartShape;
  position: [number, number, number];
  size: [number, number, number];
  yaw: number;
}

export interface PlacedWheel {
  id: string;
  name: string;
  position: [number, number, number];
  radius: number;
  side: "left" | "right";
}

export interface RobotLayout {
  chassis: { size: [number, number, number]; center: [number, number, number] };
  deckY: number;
  wheels: PlacedWheel[];
  casters: [number, number, number][];
  parts: PlacedPart[];
  senseCones: { id: string; position: [number, number, number]; yaw: number; range: number }[];
}

function shapeOf(def: ComponentDefinition): PartShape {
  if (def.category === "controller" || def.category === "sbc") return "controller";
  if (def.category === "motor_driver") return "driver";
  if (def.category === "regulator") return "regulator";
  if (def.category === "communication") return "transceiver";
  if (def.power?.kind === "battery") return "battery";
  if (def.servo) return "servo";
  if (def.motor) return "motor";
  switch (def.sensor?.kind) {
    case "distance":
      return def.driver === "hcsr04" ? "sonar" : def.driver === "sharp_ir" ? "ir" : "tof";
    case "imu":
      return "imu";
    case "lidar":
      return "lidar";
    case "switch":
      return def.tags.includes("estop") ? "estop" : "switch";
    default:
      return "board";
  }
}

const MIN: Record<PartShape, [number, number, number]> = {
  controller: [0.056, 0.012, 0.03],
  board: [0.03, 0.006, 0.025],
  driver: [0.03, 0.01, 0.024],
  regulator: [0.045, 0.014, 0.022],
  battery: [0.105, 0.024, 0.034],
  tof: [0.014, 0.018, 0.012],
  sonar: [0.012, 0.022, 0.046],
  ir: [0.014, 0.014, 0.044],
  imu: [0.022, 0.004, 0.018],
  lidar: [0.07, 0.05, 0.07],
  estop: [0.04, 0.035, 0.04],
  switch: [0.02, 0.01, 0.012],
  servo: [0.023, 0.03, 0.012],
  motor: [0.05, 0.025, 0.025],
  transceiver: [0.02, 0.005, 0.016],
};

export function layoutRobot(spec: RobotSpec, catalog: Catalog): RobotLayout {
  const comps = spec.components
    .map((c) => ({ c, def: catalog.get(c.ref.catalogId, c.ref.version) }))
    .filter((x): x is { c: (typeof spec.components)[number]; def: ComponentDefinition } => !!x.def);

  const drive = spec.robot.drive;
  const motors = comps.filter((x) => x.def.motor);
  let left = drive ? motors.filter((m) => drive.leftMotors.includes(m.c.id)) : [];
  let right = drive ? motors.filter((m) => drive.rightMotors.includes(m.c.id)) : [];
  if (!drive && motors.length >= 2) {
    left = motors.filter((_, i) => i % 2 === 0);
    right = motors.filter((_, i) => i % 2 === 1);
  }
  const wheelMotorIds = new Set([...left, ...right].map((m) => m.c.id));
  const radiusOf = (m: (typeof motors)[number]) => {
    const r = m.c.config["wheelRadiusM"];
    return typeof r === "number" ? r : drive?.wheelRadiusM ?? 0.035;
  };
  const wheelR = Math.max(0.025, ...[...left, ...right].map(radiusOf), 0);
  const track = drive?.trackWidthM ?? 0.18;
  const chassisW = Math.max(0.12, track - 0.04);
  const chassisL = 0.26;
  const chassisH = 0.03;
  const clearance = wheelR * 0.55;
  const center: [number, number, number] = [0, clearance + chassisH / 2, 0];
  const deckY = clearance + chassisH;

  const wheels: PlacedWheel[] = [];
  const place = (list: typeof motors, side: "left" | "right") => {
    list.forEach((m, i) => {
      const x = m.c.mount?.x ?? (list.length === 1 ? -0.02 : -0.06 + (i * 0.12) / Math.max(1, list.length - 1));
      const zRos = side === "left" ? track / 2 : -track / 2;
      wheels.push({ id: m.c.id, name: m.c.name, position: [x, radiusOf(m), -zRos], radius: radiusOf(m), side });
    });
  };
  place(left, "left");
  place(right, "right");
  const casters: [number, number, number][] = wheels.length && wheels.length <= 2 ? [[chassisL / 2 - 0.03, 0.012, 0]] : [];

  const parts: PlacedPart[] = [];
  const senseCones: RobotLayout["senseCones"] = [];
  // Deck packing: items without a mount pose are laid out back-to-front in two lanes.
  const laneX = [-chassisL / 2 + 0.015, -chassisL / 2 + 0.015];
  const laneZ = [-chassisW / 4, chassisW / 4];

  for (const { c, def } of comps) {
    if (wheelMotorIds.has(c.id)) continue;
    const shape = shapeOf(def);
    const box = def.geometry?.box;
    const base = MIN[shape];
    // Catalog boxes are [length, width, height] in metres; normalise to three.js [x, y, z] = [len, h, w].
    const size: [number, number, number] = box && !["sonar", "tof", "ir", "lidar", "estop", "servo"].includes(shape)
      ? [Math.max(box[0], base[0] * 0.6), Math.max(Math.min(box[2], 0.03), base[1] * 0.6), Math.max(box[1], base[2] * 0.6)]
      : base;
    let position: [number, number, number];
    let yaw = 0;
    if (c.mount && (c.mount.x || c.mount.y || c.mount.z)) {
      position = [c.mount.x, Math.max(c.mount.z, deckY + size[1] / 2), -c.mount.y];
      yaw = (c.mount.yawDeg * Math.PI) / 180;
    } else if (shape === "tof" || shape === "sonar" || shape === "ir") {
      const n = parts.filter((p) => ["tof", "sonar", "ir"].includes(p.shape)).length;
      position = [chassisL / 2 + size[0] / 2, deckY + size[1] / 2, (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 0.05];
    } else if (shape === "lidar") {
      position = [0.02, deckY + 0.045 + size[1] / 2, 0];
    } else if (shape === "estop") {
      position = [-chassisL / 2 + 0.03, deckY + size[1] / 2, chassisW / 2 - 0.03];
    } else {
      const lane = laneX[0]! <= laneX[1]! ? 0 : 1;
      const x = laneX[lane]! + size[0] / 2;
      laneX[lane] = laneX[lane]! + size[0] + 0.012;
      position = [x, deckY + size[1] / 2 + (shape === "battery" ? 0 : 0.004), laneZ[lane]!];
    }
    parts.push({ id: c.id, name: c.name, title: def.name, shape, position, size, yaw });
    if (def.sensor?.kind === "distance") {
      const range = Math.min(0.35, def.sensor.channels[0]?.range?.[1] ?? 0.3);
      senseCones.push({ id: c.id, position: [position[0] + size[0] / 2, position[1], position[2]], yaw, range });
    }
  }
  return { chassis: { size: [chassisL, chassisH, chassisW], center }, deckY, wheels, casters, parts, senseCones };
}
