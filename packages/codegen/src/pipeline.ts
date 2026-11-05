// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { Catalog, Diagnostic, RobotSpec } from "@roboforge/spec";
import { buildRobotIR, type RobotIR } from "@roboforge/ir";
import { validate, type ValidationReport } from "@roboforge/validation";
import { createDefaultTargets, type TargetRegistry } from "./registry";
import { GENERATOR_VERSION, type GeneratedFile } from "./types";
import { contentHash } from "./util/text";

export interface Analysis {
  ir: RobotIR;
  report: ValidationReport;
  targets: string[];
}

const defaultTargets = createDefaultTargets();

/**
 * Spec → IR → validation (including behavior-compiler and target diagnostics).
 * Cheap enough to run on every edit, in the browser and on the server.
 */
export function analyzeProject(spec: RobotSpec, catalog: Catalog, targets: TargetRegistry = defaultTargets): Analysis {
  const ir = buildRobotIR(spec, catalog);
  const applicable = targets.applicable(ir);
  const targetDiags: Diagnostic[] = applicable.flatMap((t) => t.diagnostics(ir));
  const report = validate(ir, targetDiags);
  return { ir, report, targets: applicable.map((t) => t.id) };
}

export interface GenerationResult {
  ok: boolean;
  analysis: Analysis;
  files: GeneratedFile[];
  /** Why generation was refused (validation errors), if it was. */
  blockedBy: Diagnostic[];
}

export interface GenerateOptions {
  /** Generate even if validation reports errors (files are marked accordingly in the README). */
  force?: boolean;
  targets?: TargetRegistry;
}

/** Hardware validation happens before code generation: errors block generation unless forced. */
export function generateProject(spec: RobotSpec, catalog: Catalog, opts: GenerateOptions = {}): GenerationResult {
  const targets = opts.targets ?? defaultTargets;
  const analysis = analyzeProject(spec, catalog, targets);
  const blockedBy = analysis.report.diagnostics.filter((d) => d.severity === "error");
  if (blockedBy.length && !opts.force) return { ok: false, analysis, files: [], blockedBy };

  const ctx = { spec, ir: analysis.ir, report: analysis.report, generatorVersion: GENERATOR_VERSION };
  const files: GeneratedFile[] = [];
  const seen = new Set<string>();
  for (const t of targets.applicable(analysis.ir)) {
    for (const f of t.generate(ctx)) {
      if (seen.has(f.path)) throw new Error(`Targets produced the same file twice: ${f.path}`);
      seen.add(f.path);
      files.push(f);
    }
  }
  files.push(manifest(spec, files, analysis.targets));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { ok: true, analysis, files, blockedBy: [] };
}

function manifest(spec: RobotSpec, files: GeneratedFile[], targets: string[]): GeneratedFile {
  return {
    path: ".roboforge/manifest.json",
    ownership: "generated",
    generator: "project",
    content:
      JSON.stringify(
        {
          generator: "roboforge",
          generatorVersion: GENERATOR_VERSION,
          specSchemaVersion: spec.schemaVersion,
          robot: spec.robot.name,
          targets,
          files: files
            .map((f) => ({ path: f.path, ownership: f.ownership, generator: f.generator, hash: contentHash(f.content) }))
            .sort((a, b) => a.path.localeCompare(b.path)),
        },
        null,
        2,
      ) + "\n",
  };
}
