import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { applyCommands, RobotSpec, toIdentifier } from "@roboforge/spec";
import { createFromTemplate, type TemplateId } from "@roboforge/ir";
import { getDb, memberships, projectRevisions, projects } from "@roboforge/db";
import type { SessionUser } from "../auth";
import { ApiError, forbidden, notFound } from "../http";
import { getCatalog } from "./catalog";

export type ProjectRow = typeof projects.$inferSelect;

/** Loads a project and verifies the user belongs to its organization. */
export async function getProjectForUser(user: SessionUser, projectId: string, write = false): Promise<ProjectRow> {
  const db = getDb();
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!p) throw notFound("Project");
  const [m] = await db.select().from(memberships).where(and(eq(memberships.userId, user.id), eq(memberships.orgId, p.orgId)));
  if (!m) throw notFound("Project"); // don't reveal existence
  if (write && m.role === "viewer") throw forbidden();
  return p;
}

export async function listProjects(user: SessionUser) {
  return getDb()
    .select({ id: projects.id, name: projects.name, description: projects.description, revision: projects.revision, updatedAt: projects.updatedAt, spec: projects.spec })
    .from(projects)
    .innerJoin(memberships, and(eq(memberships.orgId, projects.orgId), eq(memberships.userId, user.id)))
    .orderBy(desc(projects.updatedAt))
    .then((rows) =>
      rows.map(({ spec, ...r }) => ({
        ...r,
        componentCount: spec.components.length,
        robotName: spec.robot.name,
      })),
    );
}

export async function createProject(user: SessionUser, input: { name: string; description?: string; template: TemplateId }) {
  const catalog = await getCatalog();
  const ident = toIdentifier(input.name);
  const spec = createFromTemplate(input.template, catalog, ident, input.name);
  if (input.description) spec.robot.description = input.description;
  const db = getDb();
  return db.transaction(async (tx) => {
    const base = ident.replace(/_/g, "-");
    const [{ n }] = (await tx.execute(sql`select count(*)::int as n from projects where org_id = ${user.orgId} and slug like ${base + "%"}`)).rows as [{ n: number }];
    const slug = n ? `${base}-${n + 1}` : base;
    const [p] = await tx
      .insert(projects)
      .values({ orgId: user.orgId, name: input.name, slug, description: input.description ?? "", spec, revision: 1, createdById: user.id })
      .returning();
    await tx.insert(projectRevisions).values({ projectId: p!.id, number: 1, spec, commands: [], message: `Created from template '${input.template}'`, authorId: user.id });
    return p!;
  });
}

/**
 * Applies a command batch atomically with optimistic concurrency: the batch must be based on the
 * current revision. The project row is locked for the duration of the transaction.
 */
export async function applyProjectCommands(user: SessionUser, projectId: string, baseRevision: number, commands: unknown[], message?: string) {
  await getProjectForUser(user, projectId, true);
  const catalog = await getCatalog();
  return getDb().transaction(async (tx) => {
    const locked = await tx.execute(sql`select revision, spec from projects where id = ${projectId} for update`);
    const row = locked.rows[0] as { revision: number; spec: RobotSpec } | undefined;
    if (!row) throw notFound("Project");
    if (row.revision !== baseRevision) {
      throw new ApiError(409, "REVISION_CONFLICT", `The project changed (now at revision ${row.revision}). Reload and retry.`, { currentRevision: row.revision });
    }
    const spec = applyCommands(RobotSpec.parse(row.spec), commands, { catalog });
    const revision = row.revision + 1;
    await tx.update(projects).set({ spec, revision, updatedAt: new Date(), name: spec.robot.displayName }).where(eq(projects.id, projectId));
    await tx.insert(projectRevisions).values({ projectId, number: revision, spec, commands, message: message ?? summarize(commands), authorId: user.id });
    return { revision, spec };
  });
}

function summarize(commands: unknown[]): string {
  const types = commands.map((c) => (c as { type?: string }).type ?? "?");
  const uniq = [...new Set(types)];
  return uniq.length === 1 ? `${types.length}× ${uniq[0]}` : uniq.slice(0, 4).join(", ") + (uniq.length > 4 ? ", …" : "");
}

export async function listRevisions(user: SessionUser, projectId: string) {
  await getProjectForUser(user, projectId);
  return getDb()
    .select({ number: projectRevisions.number, message: projectRevisions.message, createdAt: projectRevisions.createdAt, authorId: projectRevisions.authorId })
    .from(projectRevisions)
    .where(eq(projectRevisions.projectId, projectId))
    .orderBy(desc(projectRevisions.number))
    .limit(200);
}

export async function restoreRevision(user: SessionUser, projectId: string, number: number) {
  const p = await getProjectForUser(user, projectId, true);
  const [rev] = await getDb()
    .select()
    .from(projectRevisions)
    .where(and(eq(projectRevisions.projectId, projectId), eq(projectRevisions.number, number)));
  if (!rev) throw notFound("Revision");
  return applyProjectCommands(user, projectId, p.revision, [{ type: "spec.replace", spec: rev.spec }], `Restored revision ${number}`);
}

export async function deleteProject(user: SessionUser, projectId: string) {
  await getProjectForUser(user, projectId, true);
  await getDb().delete(projects).where(eq(projects.id, projectId));
}
