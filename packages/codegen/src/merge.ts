// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { GeneratedFile, Ownership } from "./types";
import { RegionParseError, transplantRegions } from "./util/regions";

export interface ExistingFile {
  path: string;
  content: string;
  ownership: Ownership;
}

export type ChangeAction =
  | "added" // new generated file
  | "updated" // generated file content changed
  | "unchanged"
  | "preserved" // user-owned file left untouched
  | "merged" // mixed file regenerated with user regions transplanted
  | "removed" // previously generated file no longer produced
  | "conflict"; // mixed file whose regions could not be parsed — kept as is

export interface FileChange {
  path: string;
  action: ChangeAction;
  ownership: Ownership;
  detail?: string;
}

export interface MergeResult {
  /** Final file set (what the project should contain after generation). */
  files: ExistingFile[];
  changes: FileChange[];
}

/**
 * Ownership-aware merge of a fresh generation into the project's current files.
 *
 * - USER files (including generated files the engineer took ownership of) are never modified.
 * - MIXED files are regenerated; bodies of ROBOFORGE:USER regions are carried over by id.
 * - GENERATED files are replaced; generated files no longer produced are removed.
 * - Files that exist only as USER files are kept even if the generator no longer mentions them.
 */
export function mergeGeneration(generated: GeneratedFile[], existing: ExistingFile[]): MergeResult {
  const prev = new Map(existing.map((f) => [f.path, f]));
  const out = new Map<string, ExistingFile>();
  const changes: FileChange[] = [];

  for (const g of generated) {
    const old = prev.get(g.path);
    if (!old) {
      out.set(g.path, { path: g.path, content: g.content, ownership: g.ownership });
      changes.push({ path: g.path, action: "added", ownership: g.ownership });
      continue;
    }
    if (old.ownership === "user") {
      out.set(g.path, old);
      changes.push({ path: g.path, action: "preserved", ownership: "user", detail: g.ownership === "user" ? undefined : "owned by you; generator output ignored" });
      continue;
    }
    if (g.ownership === "mixed" || old.ownership === "mixed") {
      try {
        const { content, orphaned } = transplantRegions(g.content, old.content);
        out.set(g.path, { path: g.path, content, ownership: "mixed" });
        changes.push({
          path: g.path,
          action: content === old.content ? "unchanged" : "merged",
          ownership: "mixed",
          ...(orphaned.length ? { detail: `user regions no longer present in the template: ${orphaned.join(", ")} (their code was dropped; see revision history)` } : {}),
        });
      } catch (e) {
        if (!(e instanceof RegionParseError)) throw e;
        out.set(g.path, old);
        changes.push({ path: g.path, action: "conflict", ownership: "mixed", detail: e.message });
      }
      continue;
    }
    out.set(g.path, { path: g.path, content: g.content, ownership: g.ownership });
    changes.push({ path: g.path, action: old.content === g.content ? "unchanged" : "updated", ownership: g.ownership });
  }

  for (const old of existing) {
    if (out.has(old.path)) continue;
    if (old.ownership === "user") {
      out.set(old.path, old);
      changes.push({ path: old.path, action: "preserved", ownership: "user" });
    } else {
      changes.push({ path: old.path, action: "removed", ownership: old.ownership });
    }
  }

  const files = [...out.values()].sort((a, b) => a.path.localeCompare(b.path));
  changes.sort((a, b) => a.path.localeCompare(b.path));
  return { files, changes };
}
