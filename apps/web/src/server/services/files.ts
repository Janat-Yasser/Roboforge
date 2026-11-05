// Copyright (c) 2026 Janat Yasser. All rights reserved.
import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { generateProject, mergeGeneration, type FileChange, type Ownership } from "@roboforge/codegen";
import { exportZip } from "@roboforge/codegen/export";
import { RobotSpec, type Diagnostic } from "@roboforge/spec";
import { getDb, projectFiles, projects } from "@roboforge/db";
import type { SessionUser } from "../auth";
import { ApiError, notFound } from "../http";
import { getCatalog } from "./catalog";
import { getProjectForUser } from "./projects";

export interface GenerateOutcome {
  ok: boolean;
  revision: number;
  changes: FileChange[];
  blockedBy: Diagnostic[];
}

/**
 * Regenerates the codebase from the current spec and merges it into the stored project files
 * with ownership rules (user files and user regions are never lost).
 */
export async function generateForProject(user: SessionUser, projectId: string, force = false): Promise<GenerateOutcome> {
  const p = await getProjectForUser(user, projectId, true);
  const catalog = await getCatalog();
  const result = generateProject(RobotSpec.parse(p.spec), catalog, { force });
  if (!result.ok) return { ok: false, revision: p.revision, changes: [], blockedBy: result.blockedBy };

  const db = getDb();
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(projectFiles).where(eq(projectFiles.projectId, projectId));
    const merged = mergeGeneration(result.files, existing.map((f) => ({ path: f.path, content: f.content, ownership: f.ownership })));
    const generatorOf = new Map(result.files.map((f) => [f.path, f.generator]));
    const byPath = new Map(existing.map((f) => [f.path, f]));

    const removed = merged.changes.filter((c) => c.action === "removed").map((c) => c.path);
    if (removed.length) await tx.delete(projectFiles).where(and(eq(projectFiles.projectId, projectId), inArray(projectFiles.path, removed)));

    for (const f of merged.files) {
      const old = byPath.get(f.path);
      if (old && old.content === f.content && old.ownership === f.ownership) continue;
      await tx
        .insert(projectFiles)
        .values({ projectId, path: f.path, content: f.content, ownership: f.ownership, generator: generatorOf.get(f.path) ?? null, specRevision: p.revision })
        .onConflictDoUpdate({
          target: [projectFiles.projectId, projectFiles.path],
          set: { content: f.content, ownership: f.ownership, generator: generatorOf.get(f.path) ?? null, specRevision: p.revision, updatedAt: new Date() },
        });
    }
    await tx.update(projects).set({ generatedRevision: p.revision }).where(eq(projects.id, projectId));
    return { ok: true, revision: p.revision, changes: merged.changes, blockedBy: [] };
  });
}

export async function listFiles(user: SessionUser, projectId: string) {
  const p = await getProjectForUser(user, projectId);
  const rows = await getDb()
    .select({ path: projectFiles.path, ownership: projectFiles.ownership, generator: projectFiles.generator, specRevision: projectFiles.specRevision, updatedAt: projectFiles.updatedAt, content: projectFiles.content })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, projectId));
  return {
    generatedRevision: p.generatedRevision,
    revision: p.revision,
    files: rows
      .map(({ content, ...r }) => ({ ...r, size: content.length }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export async function getFile(user: SessionUser, projectId: string, path: string) {
  await getProjectForUser(user, projectId);
  const [f] = await getDb()
    .select()
    .from(projectFiles)
    .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, path)));
  if (!f) throw notFound("File");
  return { path: f.path, content: f.content, ownership: f.ownership, generator: f.generator, specRevision: f.specRevision, updatedAt: f.updatedAt };
}

const SAFE_PATH = /^(?!\/)(?!.*\.\.)[A-Za-z0-9_\-./ ]+$/;

/** Saves engineer edits. GENERATED files are read-only (take ownership first). */
export async function saveFile(user: SessionUser, projectId: string, path: string, content: string) {
  await getProjectForUser(user, projectId, true);
  if (!SAFE_PATH.test(path)) throw new ApiError(400, "INVALID_PATH", "Invalid file path.");
  const db = getDb();
  const [f] = await db.select().from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, path)));
  if (f?.ownership === "generated") {
    throw new ApiError(409, "FILE_IS_GENERATED", "This file is generated. Change the Robot Specification, or take ownership of the file to edit it.");
  }
  const ownership: Ownership = f?.ownership ?? "user";
  await db
    .insert(projectFiles)
    .values({ projectId, path, content, ownership })
    .onConflictDoUpdate({ target: [projectFiles.projectId, projectFiles.path], set: { content, updatedAt: new Date() } });
  return { path, ownership };
}

export async function setOwnership(user: SessionUser, projectId: string, path: string, ownership: "user") {
  await getProjectForUser(user, projectId, true);
  const res = await getDb()
    .update(projectFiles)
    .set({ ownership, updatedAt: new Date() })
    .where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, path)))
    .returning({ path: projectFiles.path });
  if (!res.length) throw notFound("File");
  return { path, ownership };
}

export async function exportProject(user: SessionUser, projectId: string): Promise<{ filename: string; data: Uint8Array }> {
  const p = await getProjectForUser(user, projectId);
  if (p.generatedRevision !== p.revision) {
    const g = await generateForProject(user, projectId);
    if (!g.ok) throw new ApiError(409, "VALIDATION_ERRORS", "Fix validation errors before exporting.", { diagnostics: g.blockedBy });
  }
  const rows = await getDb().select({ path: projectFiles.path, content: projectFiles.content }).from(projectFiles).where(eq(projectFiles.projectId, projectId));
  if (!rows.length) throw new ApiError(409, "NOTHING_TO_EXPORT", "Generate the code first (validation errors may be blocking generation).");
  const spec = RobotSpec.parse(p.spec);
  const data = await exportZip(spec.robot.name, rows);
  return { filename: `${spec.robot.name}-r${p.revision}.zip`, data };
}
