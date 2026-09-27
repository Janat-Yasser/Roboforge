import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { enqueueBuild, listBuilds } from "@/server/services/builds";

export const GET = route<{ id: string }>(async (_req, { params }) => ({ builds: await listBuilds(await requireUser(), params.id) }));

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const build = await enqueueBuild(await requireUser(), params.id);
  return Response.json({ build }, { status: 202 });
});
