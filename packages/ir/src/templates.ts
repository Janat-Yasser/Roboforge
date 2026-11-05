import {
  applyCommands,
  createEmptySpec,
  newId,
  type BehaviorNode,
  type Catalog,
  type Command,
  type RobotSpec,
} from "@roboforge/spec";
import { planAutoWire } from "./autowire";

export type TemplateId = "blank" | "obstacle-avoider";

export const TEMPLATES: { id: TemplateId; title: string; description: string }[] = [
  { id: "blank", title: "Blank robot", description: "Empty specification." },
  {
    id: "obstacle-avoider",
    title: "Differential-drive obstacle avoider",
    description: "ESP32, TB6612FNG, two DC gearmotors, VL53L0X ToF, 2S LiPo + 5 V buck, e-stop, and an obstacle-avoidance behavior.",
  },
];

interface Part {
  key: string;
  name: string;
  catalogId: string;
  x: number;
  y: number;
  config?: Record<string, number | string | boolean>;
  mount?: { x: number; y: number; z: number; yawDeg: number };
}

/**
 * Creates a new specification from a template. Templates are built exclusively through the public
 * command API and the auto-wiring planner — the same path the editors and the AI assistant use.
 */
export function createFromTemplate(template: TemplateId, catalog: Catalog, name: string, displayName: string): RobotSpec {
  let spec = createEmptySpec(name, displayName);
  if (template === "blank") return spec;

  const ctx = { catalog };
  const parts: Part[] = [
    { key: "battery", name: "battery", catalogId: "lipo-2s-2200", x: 40, y: 40 },
    { key: "buck", name: "buck_5v", catalogId: "lm2596-buck", x: 40, y: 260, config: { outputVoltage: 5 } },
    { key: "mcu", name: "mcu", catalogId: "esp32-devkitc", x: 420, y: 40 },
    { key: "driver", name: "motor_driver", catalogId: "tb6612fng-breakout", x: 860, y: 60 },
    { key: "left", name: "left_motor", catalogId: "dc-gearmotor-12v", x: 1220, y: 40, mount: { x: 0, y: 0.09, z: 0.035, yawDeg: 0 } },
    { key: "right", name: "right_motor", catalogId: "dc-gearmotor-12v", x: 1220, y: 260, mount: { x: 0, y: -0.09, z: 0.035, yawDeg: 0 } },
    { key: "tof", name: "front_tof", catalogId: "vl53l0x-breakout", x: 860, y: 520, mount: { x: 0.12, y: 0, z: 0.05, yawDeg: 0 } },
    { key: "estop", name: "estop", catalogId: "estop-button-nc", x: 40, y: 520 },
  ];
  const ids: Record<string, string> = {};
  const add: Command[] = parts.map((p) => {
    const def = catalog.get(p.catalogId);
    if (!def) throw new Error(`Template requires catalog component '${p.catalogId}'.`);
    ids[p.key] = newId("c");
    return {
      type: "component.add",
      component: {
        id: ids[p.key]!,
        name: p.name,
        ref: { catalogId: def.id, version: def.version },
        config: p.config ?? {},
        layout: { x: p.x, y: p.y },
        ...(p.mount ? { mount: p.mount } : {}),
      },
    };
  });
  spec = applyCommands(spec, add, ctx);

  // Wire in dependency order: power first, then controller, then peripherals.
  for (const key of ["buck", "mcu", "driver", "left", "right", "tof", "estop"]) {
    const plan = planAutoWire(spec, catalog, ids[key]!);
    spec = applyCommands(spec, plan.commands, ctx);
  }

  spec = applyCommands(
    spec,
    [
      {
        type: "robot.setDrive",
        drive: { kind: "differential", leftMotors: [ids.left!], rightMotors: [ids.right!], wheelRadiusM: 0.035, trackWidthM: 0.18, maxSpeedMps: 0.5 },
      },
      { type: "targets.update", patch: { ros2Enabled: true } },
      ...obstacleAvoidance(ids.tof!, ids.left!, ids.right!, ids.estop!),
    ],
    ctx,
  );
  return spec;
}

/** The canonical obstacle-avoidance behavior (also used by tests and docs). */
export function obstacleAvoidance(tofId: string, leftId: string, rightId: string, estopId?: string): Command[] {
  const n = (id: string, x: number, y: number, rest: Omit<BehaviorNode, "id" | "position">): Command => ({
    type: "behavior.node.add",
    node: { id, position: { x, y }, ...rest } as BehaviorNode,
  });
  const e = (source: string, sourcePort: string, target: string): Command => ({
    type: "behavior.edge.add",
    edge: { id: `e_${source}_${sourcePort}`, source, sourcePort, target },
  });
  const cmds: Command[] = [
    { type: "behavior.variable.upsert", variable: { name: "distance", initial: 0, description: "Front distance in metres" } },
    n("n_start", 0, 0, { kind: "event.start", label: "Robot Started", params: {} }),
    n("n_read", 0, 140, { kind: "sensor.read", label: "Read front ToF", params: { componentId: tofId, channel: "distance_m", variable: "distance" } }),
    n("n_check", 0, 300, {
      kind: "condition",
      label: "distance < 0.5 m?",
      params: { left: { kind: "var", name: "distance" }, op: "<", right: { kind: "const", value: 0.5 } },
    }),
    n("n_turn", -220, 460, {
      kind: "motor.set",
      label: "Turn away",
      params: { commands: [{ componentId: leftId, speed: -0.35 }, { componentId: rightId, speed: 0.35 }] },
    }),
    n("n_wait_turn", -220, 600, { kind: "delay", label: "Wait 400 ms", params: { ms: 400 } }),
    n("n_drive", 220, 460, {
      kind: "motor.set",
      label: "Drive forward",
      params: { commands: [{ componentId: leftId, speed: 0.4 }, { componentId: rightId, speed: 0.4 }] },
    }),
    n("n_wait_drive", 220, 600, { kind: "delay", label: "Wait 50 ms", params: { ms: 50 } }),
    n("n_read_fail", 360, 140, { kind: "motor.stop", label: "Sensor fault: stop", params: { componentIds: [] } }),
    n("n_wait_fail", 360, 280, { kind: "delay", label: "Retry in 200 ms", params: { ms: 200 } }),
    e("n_start", "next", "n_read"),
    e("n_read", "next", "n_check"),
    e("n_read", "error", "n_read_fail"),
    e("n_read_fail", "next", "n_wait_fail"),
    e("n_wait_fail", "next", "n_read"),
    e("n_check", "true", "n_turn"),
    e("n_check", "false", "n_drive"),
    e("n_turn", "next", "n_wait_turn"),
    e("n_wait_turn", "next", "n_read"),
    e("n_drive", "next", "n_wait_drive"),
    e("n_wait_drive", "next", "n_read"),
  ];
  if (estopId) {
    cmds.push(
      n("n_estop", -440, 0, { kind: "event.estop", label: "E-stop pressed", params: { componentId: estopId } }),
      n("n_estop_log", -440, 140, { kind: "log", label: "Log e-stop", params: { message: "E-STOP latched - power cycle to reset" } }),
      e("n_estop", "next", "n_estop_log"),
    );
  }
  return cmds;
}
