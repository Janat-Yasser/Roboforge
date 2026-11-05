// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Protected regions: blocks in generated files whose content belongs to the engineer.
 *
 *   // ROBOFORGE:USER-BEGIN setup
 *   ...engineer code...
 *   // ROBOFORGE:USER-END setup
 *
 * Works with `//` and `#` comment styles.
 */

const BEGIN = /^[ \t]*(?:\/\/|#)[ \t]*ROBOFORGE:USER-BEGIN[ \t]+([A-Za-z0-9_.-]+)[ \t]*$/;
const END = /^[ \t]*(?:\/\/|#)[ \t]*ROBOFORGE:USER-END[ \t]+([A-Za-z0-9_.-]+)[ \t]*$/;

export interface Region {
  id: string;
  /** 1-based line numbers of the marker lines. */
  beginLine: number;
  endLine: number;
  body: string;
}

export class RegionParseError extends Error {}

export function parseRegions(text: string): Region[] {
  const lines = text.split("\n");
  const regions: Region[] = [];
  let open: { id: string; line: number; body: string[] } | null = null;
  lines.forEach((l, i) => {
    const b = BEGIN.exec(l);
    const e = END.exec(l);
    if (b) {
      if (open) throw new RegionParseError(`Nested USER-BEGIN '${b[1]}' inside '${open.id}' at line ${i + 1}.`);
      open = { id: b[1]!, line: i + 1, body: [] };
    } else if (e) {
      if (!open || open.id !== e[1]) throw new RegionParseError(`Unmatched USER-END '${e[1]}' at line ${i + 1}.`);
      regions.push({ id: open.id, beginLine: open.line, endLine: i + 1, body: open.body.join("\n") });
      open = null;
    } else if (open) {
      (open as { body: string[] }).body.push(l);
    }
  });
  if (open) throw new RegionParseError(`USER-BEGIN '${(open as { id: string }).id}' is never closed.`);
  return regions;
}

/** Replaces region bodies in `template` with bodies from `previous` (by id). */
export function transplantRegions(template: string, previous: string): { content: string; orphaned: string[] } {
  const prev = new Map(parseRegions(previous).map((r) => [r.id, r.body]));
  const used = new Set<string>();
  const out: string[] = [];
  let skipping: string | null = null;
  for (const line of template.split("\n")) {
    const b = BEGIN.exec(line);
    const e = END.exec(line);
    if (b) {
      out.push(line);
      const body = prev.get(b[1]!);
      if (body !== undefined) {
        if (body.length) out.push(body);
        used.add(b[1]!);
        skipping = b[1]!;
      }
      continue;
    }
    if (e) {
      skipping = null;
      out.push(line);
      continue;
    }
    if (!skipping) out.push(line);
  }
  const orphaned = [...prev.keys()].filter((k) => !used.has(k) && prev.get(k)!.trim().length > 0);
  return { content: out.join("\n"), orphaned };
}

/** Emits an empty (or default-filled) region. */
export function region(id: string, comment: "//" | "#", indent = "", body = ""): string {
  return [`${indent}${comment} ROBOFORGE:USER-BEGIN ${id}`, ...(body ? [body] : []), `${indent}${comment} ROBOFORGE:USER-END ${id}`].join("\n");
}
