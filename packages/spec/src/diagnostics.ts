/**
 * Uniform diagnostic shape shared by the validation engine, the behavior compiler and code
 * generators, so the UI can render all problems in one panel and highlight what they reference.
 */

export type Severity = "error" | "warning" | "info";

export type DiagnosticCategory =
  | "electrical"
  | "hardware"
  | "pin-assignment"
  | "communication"
  | "power"
  | "software"
  | "safety"
  | "configuration";

export interface Diagnostic {
  severity: Severity;
  code: string;
  category: DiagnosticCategory;
  message: string;
  componentIds?: string[];
  connectionIds?: string[];
  nodeIds?: string[];
  /** "componentId:pin" references. */
  pins?: string[];
  hint?: string;
  /** Rule / source that produced the diagnostic. */
  source?: string;
}

export function countBySeverity(diags: Diagnostic[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const d of diags) out[d.severity]++;
  return out;
}

export function hasErrors(diags: Diagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}
