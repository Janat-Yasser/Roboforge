// Copyright (c) 2026 Janat Yasser. All rights reserved.
import YAML from "yaml";
import { RobotSpec } from "./schema";

export const SPEC_YAML_HEADER =
  "# Robot Specification — source of truth for this project.\n" +
  "# Edit in RoboForge or by hand; code under generated paths is derived from this file.\n";

export function specToYaml(spec: RobotSpec): string {
  return SPEC_YAML_HEADER + YAML.stringify(spec, { lineWidth: 0, aliasDuplicateObjects: false });
}

export type ParseResult =
  | { ok: true; spec: RobotSpec }
  | { ok: false; errors: { path: string; message: string }[] };

export function parseSpecYaml(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = YAML.parse(text);
  } catch (e) {
    return { ok: false, errors: [{ path: "", message: (e as Error).message }] };
  }
  const parsed = RobotSpec.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  return { ok: true, spec: parsed.data };
}
