import type { Catalog, RobotSpec } from "@roboforge/spec";
import { compileBehavior } from "./behavior/compile";
import { resolveHardware } from "./hardware/resolve";
import type { RobotIR } from "./types";

export * from "./types";
export * from "./behavior/types";
export { compileBehavior } from "./behavior/compile";
export { resolveHardware, selectController, isControllerLike } from "./hardware/resolve";
export { REQUIRED_CONTROLLER_FN, SHAREABLE_FNS, pinSupports, controllerPinFor, naturalCompare } from "./hardware/pins";
export { pinClass } from "./hardware/nets";
export { i2cAddressOf, canNodeIdOf } from "./hardware/buses";
export { sourceVoltage } from "./hardware/power";
export { planAutoWire, type AutoWirePlan } from "./autowire";
export { summarizeIR, type IRSummary } from "./summary";

/** Builds the full Robot IR: resolved hardware + compiled behavior. */
export function buildRobotIR(spec: RobotSpec, catalog: Catalog): RobotIR {
  const hardware = resolveHardware(spec, catalog);
  const behavior = compileBehavior(spec.behavior, hardware);
  return { spec, catalog, hardware, behavior: behavior.ir, diagnostics: behavior.diagnostics };
}
export { createFromTemplate, obstacleAvoidance, TEMPLATES, type TemplateId } from "./templates";
