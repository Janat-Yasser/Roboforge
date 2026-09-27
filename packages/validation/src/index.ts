import type { Diagnostic } from "@roboforge/spec";
import type { RobotIR } from "@roboforge/ir";
import { RuleRegistry, type ValidationReport } from "./engine";
import { communicationRules } from "./rules/communication";
import { configurationRules } from "./rules/configuration";
import { electricalRules } from "./rules/electrical";
import { hardwareRules } from "./rules/hardware";
import { pinRules } from "./rules/pins";
import { powerRules } from "./rules/power";
import { safetyRules } from "./rules/safety";
import { softwareRules } from "./rules/software";

export * from "./engine";

export function createDefaultRegistry(): RuleRegistry {
  return new RuleRegistry().register(
    ...hardwareRules,
    ...electricalRules,
    ...powerRules,
    ...pinRules,
    ...communicationRules,
    ...safetyRules,
    ...configurationRules,
    ...softwareRules,
  );
}

const defaultRegistry = createDefaultRegistry();

/**
 * Validates a Robot IR. Behavior-compiler diagnostics (carried on the IR) and any extra
 * diagnostics (e.g. from code-generation targets) are merged into one report.
 */
export function validate(ir: RobotIR, extra: Diagnostic[] = []): ValidationReport {
  return defaultRegistry.run(ir, [...ir.diagnostics, ...extra]);
}
