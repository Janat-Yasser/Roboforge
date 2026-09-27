import type { Catalog, ComponentInstance, RobotSpec } from "@roboforge/spec";
import type { HardwareIR, ResolvedComponent } from "../types";
import { computeMotorBindings, computeSensorBindings, computeServoBindings } from "./bindings";
import { computeCanNetworks, computeI2cBuses, computeUartLinks } from "./buses";
import { buildNets } from "./nets";
import { computePinAssignments } from "./pins";
import { computePower } from "./power";

export function isControllerLike(rc: ResolvedComponent): boolean {
  return rc.def.category === "controller" || rc.def.category === "sbc";
}

export function selectController(spec: RobotSpec, components: ResolvedComponent[]): ResolvedComponent | undefined {
  if (spec.targets.controllerId) {
    const explicit = components.find((c) => c.instance.id === spec.targets.controllerId);
    if (explicit && isControllerLike(explicit)) return explicit;
  }
  const mcus = components.filter((c) => c.def.category === "controller");
  if (mcus.length === 1) return mcus[0];
  if (mcus.length === 0) {
    const sbcs = components.filter((c) => c.def.category === "sbc");
    if (sbcs.length === 1) return sbcs[0];
  }
  return undefined;
}

/** Resolves the hardware half of the Robot IR. Pure and deterministic. */
export function resolveHardware(spec: RobotSpec, catalog: Catalog): HardwareIR {
  const components: ResolvedComponent[] = [];
  const unresolved: ComponentInstance[] = [];
  for (const instance of spec.components) {
    const def = catalog.get(instance.ref.catalogId, instance.ref.version);
    if (def) components.push({ instance, def });
    else unresolved.push(instance);
  }
  const byId = new Map(components.map((c) => [c.instance.id, c]));
  const controllerCandidates = components.filter(isControllerLike);
  const controller = selectController(spec, components);

  const { nets, netByPin } = buildNets(spec, byId);
  const pinAssignments = computePinAssignments(controller, nets);
  const i2cBuses = computeI2cBuses(components, controller, netByPin, pinAssignments);
  const canNetworks = computeCanNetworks(controller, nets, netByPin, byId);
  const uartLinks = computeUartLinks(components, controller, netByPin, pinAssignments);

  const bindingCtx = { components, byId, controller, netByPin, i2cBuses, canNetworks, uartLinks };
  const motors = computeMotorBindings(bindingCtx);
  const servos = computeServoBindings(bindingCtx);
  const sensors = computeSensorBindings(bindingCtx);
  const power = computePower(nets, { byId, netByPin, motors });

  return {
    components,
    byId,
    unresolved,
    controller,
    controllerCandidates,
    nets,
    netByPin,
    pinAssignments,
    i2cBuses,
    canNetworks,
    uartLinks,
    power,
    motors,
    servos,
    sensors,
  };
}
