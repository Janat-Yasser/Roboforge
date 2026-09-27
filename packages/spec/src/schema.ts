import { z } from "zod";
import { BehaviorGraph, Identifier } from "./behavior";

/** The Robot Specification — the single source of truth for a robot project. */

export const SPEC_SCHEMA_VERSION = 1 as const;

export const ConfigValue = z.union([z.number(), z.string(), z.boolean()]);
export type ConfigValue = z.infer<typeof ConfigValue>;

export const ComponentRef = z.object({
  catalogId: z.string(),
  version: z.string(),
});
export type ComponentRef = z.infer<typeof ComponentRef>;

export const Pose = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
  yawDeg: z.number().default(0),
});
export type Pose = z.infer<typeof Pose>;

export const ComponentInstance = z.object({
  /** Stable, never-reused identifier. */
  id: z.string().min(1),
  /** Code identifier used by generators; renameable. */
  name: Identifier,
  ref: ComponentRef,
  config: z.record(ConfigValue).default({}),
  /** Mounting pose on the robot body (metres / degrees), used for URDF/TF. */
  mount: Pose.optional(),
  /** Canvas position in the hardware/wiring editor. */
  layout: z.object({ x: z.number(), y: z.number() }).default({ x: 0, y: 0 }),
  notes: z.string().optional(),
});
export type ComponentInstance = z.infer<typeof ComponentInstance>;

export const PinRef = z.object({ componentId: z.string(), pin: z.string() });
export type PinRef = z.infer<typeof PinRef>;

export const Connection = z.object({
  id: z.string().min(1),
  from: PinRef,
  to: PinRef,
  label: z.string().optional(),
  /** Optional wire metadata for documentation and BOM. */
  wire: z.object({ color: z.string().optional(), gaugeAwg: z.number().optional() }).optional(),
});
export type Connection = z.infer<typeof Connection>;

export const DriveConfig = z.object({
  kind: z.literal("differential"),
  leftMotors: z.array(z.string()).min(1),
  rightMotors: z.array(z.string()).min(1),
  wheelRadiusM: z.number().positive().default(0.035),
  trackWidthM: z.number().positive().default(0.18),
  maxSpeedMps: z.number().positive().default(0.5),
});
export type DriveConfig = z.infer<typeof DriveConfig>;

export const RosDistro = z.enum(["humble", "jazzy", "rolling"]);

export const RobotSpec = z.object({
  schemaVersion: z.literal(SPEC_SCHEMA_VERSION),
  robot: z.object({
    name: Identifier,
    displayName: z.string().min(1),
    description: z.string().default(""),
    version: z.string().default("0.1.0"),
    drive: DriveConfig.optional(),
  }),
  targets: z
    .object({
      /** Component id of the primary controller; inferred when omitted and exactly one exists. */
      controllerId: z.string().optional(),
      firmware: z.object({ enabled: z.boolean().default(true) }).default({}),
      ros2: z
        .object({ enabled: z.boolean().default(false), distro: RosDistro.default("jazzy") })
        .default({}),
    })
    .default({}),
  components: z.array(ComponentInstance).default([]),
  connections: z.array(Connection).default([]),
  behavior: BehaviorGraph.default({}),
});
export type RobotSpec = z.infer<typeof RobotSpec>;
export type RobotSpecInput = z.input<typeof RobotSpec>;

export function pinKey(ref: PinRef): string {
  return `${ref.componentId}:${ref.pin}`;
}

export function createEmptySpec(name: string, displayName: string): RobotSpec {
  return RobotSpec.parse({
    schemaVersion: SPEC_SCHEMA_VERSION,
    robot: { name, displayName },
  });
}

/** Turns an arbitrary display name into a valid identifier. */
export function toIdentifier(input: string, fallback = "robot"): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  if (!s) return fallback;
  return /^[a-z_]/.test(s) ? s : `_${s}`;
}
