import type { Diagnostic, RobotSpec } from "@roboforge/spec";
import type { RobotIR } from "@roboforge/ir";
import type { ValidationReport } from "@roboforge/validation";

/**
 * GENERATED: rewritten on every generation; read-only in the editor.
 * USER:      created once, never touched again by the generator.
 * MIXED:     generated, but contains ROBOFORGE:USER-BEGIN/END regions that survive regeneration.
 */
export type Ownership = "generated" | "user" | "mixed";

export interface GeneratedFile {
  path: string;
  content: string;
  ownership: Ownership;
  /** Id of the target generator that produced the file. */
  generator: string;
}

export interface GenerationContext {
  spec: RobotSpec;
  ir: RobotIR;
  report: ValidationReport;
  /** Version of the RoboForge generator, recorded in the manifest. */
  generatorVersion: string;
}

export interface TargetInfo {
  id: string;
  title: string;
  description: string;
}

export interface TargetGenerator extends TargetInfo {
  /** Whether this target produces output for the given robot. */
  appliesTo(ir: RobotIR): boolean;
  /** Target-specific problems (unsupported drivers etc.), merged into validation. */
  diagnostics(ir: RobotIR): Diagnostic[];
  generate(ctx: GenerationContext): GeneratedFile[];
}

export const GENERATOR_VERSION = "0.1.0";
