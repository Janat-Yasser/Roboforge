import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { cancelBuild } from "@/server/services/builds";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  await cancelBuild(await requireUser(), params.id);
  return { ok: true };
});
