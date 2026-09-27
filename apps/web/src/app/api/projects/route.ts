import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { createProject, listProjects } from "@/server/services/projects";

const Input = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  template: z.enum(["blank", "obstacle-avoider"]).default("blank"),
});

export const GET = route(async () => ({ projects: await listProjects(await requireUser()) }));

export const POST = route(async (req) => {
  const user = await requireUser();
  const p = await createProject(user, await body(req, Input));
  return Response.json({ project: { id: p.id, name: p.name, revision: p.revision } }, { status: 201 });
});
