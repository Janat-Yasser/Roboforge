// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { deleteProject, getProjectForUser } from "@/server/services/projects";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const p = await getProjectForUser(await requireUser(), params.id);
  return { project: { id: p.id, name: p.name, description: p.description, revision: p.revision, generatedRevision: p.generatedRevision, updatedAt: p.updatedAt }, spec: p.spec };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await deleteProject(await requireUser(), params.id);
  return { ok: true };
});
