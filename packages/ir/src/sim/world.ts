import type { RobotIR } from "../types";
import { BehaviorRuntime, type RuntimeIO } from "./runtime";

/**
 * A 2D top-down simulator for differential-drive robots. It runs the compiled behavior with the
 * same semantics as the generated firmware, against simulated sensors:
 *
 * - distance sensors (ToF, ultrasonic, IR) ray-cast from their mount pose, within their range
 * - 2D lidar (closest obstacle, front ±15°)
 * - IMU yaw / yaw rate from the simulated heading
 * - bumper switches that close when that side of the robot touches something
 * - e-stop switches you can press from the UI
 *
 * Units: metres, radians, milliseconds. x right, y up, theta counter-clockwise from +x.
 */

export type Obstacle =
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; x: number; y: number; r: number };

export interface Arena {
  id: string;
  title: string;
  width: number;
  height: number;
  obstacles: Obstacle[];
  start: { x: number; y: number; theta: number };
}

export interface Pose {
  x: number;
  y: number;
  theta: number;
}

export interface SimSensor {
  componentId: string;
  name: string;
  kind: string;
  /** Mount in the robot frame (x forward, y left). */
  mount: Pose;
  range: [number, number];
  /** Last distance reading (distance sensors) or switch state, for drawing. */
  last?: number;
  /** For drawing: the ray end point in world coordinates. */
  hit?: { x: number; y: number };
}

export interface SimLogLine {
  t: number;
  level: "info" | "warn";
  message: string;
}

export const ARENAS: Arena[] = [
  {
    id: "room",
    title: "Room with boxes",
    width: 4,
    height: 3,
    start: { x: 0.6, y: 1.5, theta: 0 },
    obstacles: [
      { kind: "box", x: 1.6, y: 0.9, w: 0.5, h: 0.4 },
      { kind: "box", x: 2.7, y: 1.9, w: 0.4, h: 0.6 },
      { kind: "circle", x: 2.3, y: 0.6, r: 0.18 },
      { kind: "circle", x: 1.2, y: 2.3, r: 0.22 },
      { kind: "box", x: 3.3, y: 0.5, w: 0.3, h: 0.3 },
    ],
  },
  {
    id: "corridor",
    title: "Corridor",
    width: 5,
    height: 2.4,
    start: { x: 0.5, y: 1.2, theta: 0 },
    obstacles: [
      { kind: "box", x: 1.4, y: 0, w: 0.15, h: 1.3 },
      { kind: "box", x: 2.6, y: 1.1, w: 0.15, h: 1.3 },
      { kind: "box", x: 3.8, y: 0, w: 0.15, h: 1.3 },
    ],
  },
  { id: "empty", title: "Empty floor", width: 4, height: 3, start: { x: 2, y: 1.5, theta: 0 }, obstacles: [] },
];

const MOTOR_LAG_MS = 80;
const DT_MS = 10;

export interface SimOptions {
  arena: Arena;
  seed?: number;
  /** Ray noise as a fraction of the reading (default 1%). */
  noise?: number;
}

export class RobotSim {
  readonly arena: Arena;
  pose: Pose;
  t = 0;
  readonly sensors: SimSensor[];
  readonly motorCmd = new Map<string, number>();
  readonly motorSpeed = new Map<string, number>();
  readonly servos = new Map<string, number>();
  readonly log: SimLogLine[] = [];
  readonly trail: { x: number; y: number }[] = [];
  readonly runtime: BehaviorRuntime;
  readonly radius: number;
  readonly drivable: boolean;
  /** Why the robot can't drive, if it can't. */
  readonly problem: string | undefined;
  collisions = 0;
  distance = 0;
  touching = false;
  estopPressed = false;
  private touchAngle = 0;
  private lastContact = -Infinity;
  private left: string[];
  private right: string[];
  private track: number;
  private maxSpeed: number;
  private rng: () => number;
  private noise: number;
  private yawRate = 0;
  private yawAccum = 0;

  constructor(
    readonly ir: RobotIR,
    opts: SimOptions,
  ) {
    this.arena = opts.arena;
    this.pose = { ...opts.arena.start };
    this.noise = opts.noise ?? 0.01;
    this.rng = mulberry32(opts.seed ?? 1);

    const hw = ir.hardware;
    const motors = hw.components.filter((c) => c.def.motor);
    const drive = ir.spec.robot.drive;
    if (drive) {
      this.left = drive.leftMotors;
      this.right = drive.rightMotors;
      this.track = drive.trackWidthM;
      this.maxSpeed = drive.maxSpeedMps;
    } else {
      // No drive configured: guess sides from mount positions (y > 0 is left).
      this.left = motors.filter((m) => (m.instance.mount?.y ?? 0) > 0).map((m) => m.instance.id);
      this.right = motors.filter((m) => (m.instance.mount?.y ?? 0) < 0).map((m) => m.instance.id);
      this.track = 0.18;
      this.maxSpeed = 0.5;
    }
    this.drivable = this.left.length > 0 && this.right.length > 0;
    this.problem = this.drivable
      ? undefined
      : motors.length < 2
        ? "Add two motors and set a differential drive on the Robot page to make it move."
        : "Set the differential drive (left and right motors) on the Robot page to make it move.";
    this.radius = Math.max(0.1, this.track / 2 + 0.03);

    this.sensors = hw.components
      .filter((c) => c.def.sensor)
      .map((c) => {
        const m = c.instance.mount;
        const ch = c.def.sensor!.channels[0];
        return {
          componentId: c.instance.id,
          name: c.instance.name,
          kind: c.def.sensor!.kind,
          mount: { x: m?.x ?? 0, y: m?.y ?? 0, theta: ((m?.yawDeg ?? 0) * Math.PI) / 180 },
          range: (ch?.range as [number, number] | undefined) ?? [0.02, 4],
        };
      });

    const io: RuntimeIO = {
      readSensor: (id, channel, kind) => this.read(id, channel, kind),
      setMotor: (id, s) => this.motorCmd.set(id, Math.max(-1, Math.min(1, s))),
      setServo: (id, a) => this.servos.set(id, a),
      estopTripped: () => this.estopPressed && ir.behavior.estopComponentIds.length > 0,
      log: (level, message) => {
        this.log.push({ t: this.t, level, message });
        if (this.log.length > 200) this.log.shift();
      },
    };
    this.runtime = new BehaviorRuntime(ir.behavior, io, motors.map((m) => m.instance.id));
    this.runtime.begin(0);
    this.trail.push({ x: this.pose.x, y: this.pose.y });
  }

  /** Advances the simulation by ms (in 10 ms steps). */
  advance(ms: number): void {
    const steps = Math.max(1, Math.round(ms / DT_MS));
    for (let i = 0; i < steps; i++) this.step();
  }

  private wheel(ids: string[]): number {
    if (!ids.length) return 0;
    let s = 0;
    for (const id of ids) s += this.motorSpeed.get(id) ?? 0;
    return (s / ids.length) * this.maxSpeed;
  }

  private step(): void {
    this.t += DT_MS;
    this.runtime.tick(this.t);

    // First-order motor response.
    const k = DT_MS / (MOTOR_LAG_MS + DT_MS);
    for (const [id, cmd] of this.motorCmd) {
      const cur = this.motorSpeed.get(id) ?? 0;
      this.motorSpeed.set(id, cur + (cmd - cur) * k);
    }
    if (!this.drivable) return;

    const vl = this.wheel(this.left);
    const vr = this.wheel(this.right);
    const v = (vl + vr) / 2;
    const w = (vr - vl) / this.track;
    const dt = DT_MS / 1000;
    const theta = this.pose.theta + w * dt;
    const nx = this.pose.x + v * Math.cos(theta) * dt;
    const ny = this.pose.y + v * Math.sin(theta) * dt;
    this.yawRate = w;
    this.yawAccum += w * dt;

    const hit = this.collides(nx, ny);
    if (hit === undefined) {
      this.distance += Math.hypot(nx - this.pose.x, ny - this.pose.y);
      this.pose = { x: nx, y: ny, theta };
      if (this.touching) this.touching = false;
    } else {
      // Blocked: the chassis scrapes along the obstacle (keep whichever axis is free) and can
      // still turn on the spot, but never moves into it.
      let x = this.pose.x;
      let y = this.pose.y;
      if (this.collides(nx, this.pose.y) === undefined) x = nx;
      else if (this.collides(this.pose.x, ny) === undefined) y = ny;
      this.distance += Math.hypot(x - this.pose.x, y - this.pose.y);
      this.pose = { x, y, theta };
      if (this.t - this.lastContact > 500) this.collisions++;
      this.lastContact = this.t;
      this.touching = true;
      this.touchAngle = hit;
    }
    const last = this.trail[this.trail.length - 1]!;
    if (Math.hypot(last.x - this.pose.x, last.y - this.pose.y) > 0.02) {
      this.trail.push({ x: this.pose.x, y: this.pose.y });
      if (this.trail.length > 3000) this.trail.shift();
    }
    for (const s of this.sensors) {
      // Keep the readings shown in the UI current even when the behavior doesn't poll them.
      if (s.kind === "distance" || s.kind === "switch") this.read(s.componentId, s.kind === "distance" ? "distance_m" : "active", s.kind, false);
    }
  }

  /** Returns the world angle of the contact if (x, y) overlaps something. */
  private collides(x: number, y: number): number | undefined {
    const r = this.radius;
    const A = this.arena;
    if (x - r < 0) return Math.PI;
    if (x + r > A.width) return 0;
    if (y - r < 0) return -Math.PI / 2;
    if (y + r > A.height) return Math.PI / 2;
    for (const o of A.obstacles) {
      if (o.kind === "circle") {
        if (Math.hypot(x - o.x, y - o.y) < r + o.r) return Math.atan2(o.y - y, o.x - x);
      } else {
        const cx = Math.max(o.x, Math.min(x, o.x + o.w));
        const cy = Math.max(o.y, Math.min(y, o.y + o.h));
        if (Math.hypot(x - cx, y - cy) < r) return Math.atan2(cy - y, cx - x);
      }
    }
    return undefined;
  }

  /** World pose of a sensor mount. */
  sensorPose(s: SimSensor): Pose {
    const c = Math.cos(this.pose.theta);
    const sn = Math.sin(this.pose.theta);
    return {
      x: this.pose.x + s.mount.x * c - s.mount.y * sn,
      y: this.pose.y + s.mount.x * sn + s.mount.y * c,
      theta: this.pose.theta + s.mount.theta,
    };
  }

  private read(id: string, channel: string, kind: string, noisy = true): number | undefined {
    const s = this.sensors.find((x) => x.componentId === id);
    if (!s) return undefined;
    const n = () => (noisy ? 1 + (this.rng() * 2 - 1) * this.noise : 1);
    if (kind === "distance") {
      const p = this.sensorPose(s);
      const d = this.ray(p.x, p.y, p.theta, s.range[1]);
      s.hit = { x: p.x + Math.cos(p.theta) * d, y: p.y + Math.sin(p.theta) * d };
      const v = Math.max(s.range[0], Math.min(s.range[1], d * n()));
      s.last = v;
      return v;
    }
    if (kind === "lidar") {
      const p = this.sensorPose(s);
      const span = channel === "front_distance_m" ? (15 * Math.PI) / 180 : Math.PI;
      let best = s.range[1];
      for (let a = -span; a <= span + 1e-9; a += Math.PI / 90) best = Math.min(best, this.ray(p.x, p.y, p.theta + a, s.range[1]));
      const v = Math.max(s.range[0], best * n());
      s.last = v;
      return v;
    }
    if (kind === "imu") {
      switch (channel) {
        case "yaw_deg":
          return wrapDeg((this.yawAccum * 180) / Math.PI);
        case "gyro_z_dps":
          return (this.yawRate * 180) / Math.PI;
        case "accel_z":
          return 9.81;
        default:
          return 0;
      }
    }
    if (kind === "switch") {
      const isEstop = this.ir.behavior.estopComponentIds.includes(id);
      let on = false;
      if (isEstop) on = this.estopPressed;
      else if (this.touching) {
        // A bumper closes when the contact is within ±70° of the direction it faces.
        // Facing = where it sits on the chassis (or its yaw, if it's mounted at the centre).
        const atCentre = Math.hypot(s.mount.x, s.mount.y) < 1e-3;
        const facing = this.pose.theta + (atCentre ? s.mount.theta : Math.atan2(s.mount.y, s.mount.x));
        on = Math.abs(wrapRad(this.touchAngle - facing)) < (70 * Math.PI) / 180;
      }
      s.last = on ? 1 : 0;
      return s.last;
    }
    return undefined;
  }

  /** Distance from (x, y) along angle a to the first wall or obstacle, capped at max. */
  ray(x: number, y: number, a: number, max: number): number {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = max;
    const A = this.arena;
    best = Math.min(best, rayBox(x, y, dx, dy, 0, 0, A.width, A.height, true));
    for (const o of A.obstacles) {
      const d = o.kind === "box" ? rayBox(x, y, dx, dy, o.x, o.y, o.x + o.w, o.y + o.h, false) : rayCircle(x, y, dx, dy, o.x, o.y, o.r);
      if (d < best) best = d;
    }
    return best;
  }
}

function rayBox(x: number, y: number, dx: number, dy: number, x0: number, y0: number, x1: number, y1: number, inside: boolean): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (const [o, d, lo, hi] of [
    [x, dx, x0, x1],
    [y, dy, y0, y1],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    let t1 = (lo - o) / d;
    let t2 = (hi - o) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
  }
  if (tmax < tmin) return Infinity;
  if (inside) return tmax >= 0 ? tmax : Infinity; // ray leaving the arena
  if (tmin >= 0) return tmin;
  return tmax >= 0 ? 0 : Infinity; // starting inside the box
}

function rayCircle(x: number, y: number, dx: number, dy: number, cx: number, cy: number, r: number): number {
  const fx = x - cx;
  const fy = y - cy;
  const b = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  if (t >= 0) return t;
  return c <= 0 ? 0 : Infinity;
}

function wrapRad(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function wrapDeg(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
