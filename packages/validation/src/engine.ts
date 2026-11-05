// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { Diagnostic, DiagnosticCategory, Severity } from "@roboforge/spec";
import type { RobotIR } from "@roboforge/ir";

export interface RuleContext {
  ir: RobotIR;
}

/** Diagnostic emitted by a rule; category/source are filled in by the engine. */
export type RuleFinding = Omit<Diagnostic, "category" | "source" | "severity"> & { severity?: Severity };

export interface ValidationRule {
  id: string;
  category: DiagnosticCategory;
  /** Default severity for findings that do not set one. */
  severity: Severity;
  description: string;
  evaluate(ctx: RuleContext): RuleFinding[];
}

export interface ValidationReport {
  ok: boolean;
  diagnostics: Diagnostic[];
  counts: Record<Severity, number>;
  /** Categories with their worst severity ("pass" when clean) — drives the status bar. */
  categories: Record<DiagnosticCategory, Severity | "pass">;
}

export const ALL_CATEGORIES: DiagnosticCategory[] = [
  "hardware",
  "electrical",
  "power",
  "pin-assignment",
  "communication",
  "software",
  "safety",
  "configuration",
];

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export class RuleRegistry {
  private readonly rules = new Map<string, ValidationRule>();

  register(...rules: ValidationRule[]): this {
    for (const r of rules) {
      if (this.rules.has(r.id)) throw new Error(`Duplicate validation rule id '${r.id}'.`);
      this.rules.set(r.id, r);
    }
    return this;
  }

  list(): ValidationRule[] {
    return [...this.rules.values()];
  }

  run(ir: RobotIR, extra: Diagnostic[] = []): ValidationReport {
    const diagnostics: Diagnostic[] = [];
    for (const rule of this.rules.values()) {
      let findings: RuleFinding[];
      try {
        findings = rule.evaluate({ ir });
      } catch (e) {
        diagnostics.push({
          severity: "warning",
          category: rule.category,
          code: "RULE_FAILED",
          message: `Validation rule '${rule.id}' failed: ${(e as Error).message}`,
          source: rule.id,
        });
        continue;
      }
      for (const f of findings) {
        diagnostics.push({ ...f, severity: f.severity ?? rule.severity, category: rule.category, source: rule.id });
      }
    }
    diagnostics.push(...extra);
    diagnostics.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.category.localeCompare(b.category) || a.code.localeCompare(b.code));

    const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
    const categories = Object.fromEntries(ALL_CATEGORIES.map((c) => [c, "pass"])) as ValidationReport["categories"];
    for (const d of diagnostics) {
      counts[d.severity]++;
      const cur = categories[d.category];
      if (cur === "pass" || SEVERITY_RANK[d.severity] < SEVERITY_RANK[cur]) categories[d.category] = d.severity;
    }
    return { ok: counts.error === 0, diagnostics, counts, categories };
  }
}

/** Helper for concise rule definitions. */
export function rule(def: ValidationRule): ValidationRule {
  return def;
}
