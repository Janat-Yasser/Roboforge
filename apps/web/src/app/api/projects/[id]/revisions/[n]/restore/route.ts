import { requireUser } from "@/server/auth";
import { ApiError, route } from "@/server/http";
import { restoreRevision } from "@/server/services/projects";

export const POST = route<{ id: string; n: string }>(async (_req, { params }) => {
  const n = Number(params.n);
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, "INVALID_REVISION", "Invalid revision number.");
  return restoreRevision(await requireUser(), params.id, n);
});
