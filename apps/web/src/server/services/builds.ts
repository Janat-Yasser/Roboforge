// Copyright (c) 2026 Janat Yasser. All rights reserved.
import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { buildLogs, builds, getDb, LocalObjectStore, type BuildStep } from "@roboforge/db";
import type { SessionUser } from "../auth";
import { ApiError, notFound } from "../http";
import { generateForProject } from "./files";
import { getProjectForUser } from "./projects";

/** Steps are declared at enqueue time so the UI can render the pipeline before the worker starts. */
export const BUILD_STEPS: string[] = ["checkout", "validate", "materialize", "firmware: native unit tests", "ros2: behavior tests", "firmware: cross-compile", "package"];

export async function enqueueBuild(user: SessionUser, projectId: string) {
  const p = await getProjectForUser(user, projectId, true);
  if (p.generatedRevision !== p.revision) {
    const g = await generateForProject(user, projectId);
    if (!g.ok) throw new ApiError(409, "VALIDATION_ERRORS", "Fix validation errors before building.", { diagnostics: g.blockedBy });
  }
  const steps: BuildStep[] = BUILD_STEPS.map((name) => ({ name, status: "pending" }));
  const [b] = await getDb().insert(builds).values({ projectId, revision: p.revision, requestedById: user.id, steps }).returning();
  return b!;
}

export async function listBuilds(user: SessionUser, projectId: string) {
  await getProjectForUser(user, projectId);
  return getDb().select().from(builds).where(eq(builds.projectId, projectId)).orderBy(desc(builds.queuedAt)).limit(50);
}

export async function getBuild(user: SessionUser, buildId: string) {
  const [b] = await getDb().select().from(builds).where(eq(builds.id, buildId));
  if (!b) throw notFound("Build");
  await getProjectForUser(user, b.projectId);
  return b;
}

export async function logsAfter(buildId: string, afterId: number) {
  return getDb()
    .select({ id: buildLogs.id, stream: buildLogs.stream, line: buildLogs.line })
    .from(buildLogs)
    .where(and(eq(buildLogs.buildId, buildId), gt(buildLogs.id, afterId)))
    .orderBy(asc(buildLogs.id))
    .limit(500);
}

export async function cancelBuild(user: SessionUser, buildId: string) {
  const b = await getBuild(user, buildId);
  if (b.status !== "queued") throw new ApiError(409, "NOT_CANCELABLE", "Only queued builds can be canceled.");
  await getDb().update(builds).set({ status: "canceled", finishedAt: new Date() }).where(and(eq(builds.id, buildId), eq(builds.status, "queued")));
}

export async function getArtifact(user: SessionUser, buildId: string) {
  const b = await getBuild(user, buildId);
  if (!b.artifactKey) throw notFound("Artifact");
  const data = await new LocalObjectStore().get(b.artifactKey);
  if (!data) throw notFound("Artifact");
  return { data, filename: `build-${b.id.slice(0, 8)}-r${b.revision}.zip` };
}
