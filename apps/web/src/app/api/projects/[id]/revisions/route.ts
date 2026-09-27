import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { listRevisions } from "@/server/services/projects";

export const GET = route<{ id: string }>(async (_req, { params }) => ({ revisions: await listRevisions(await requireUser(), params.id) }));
