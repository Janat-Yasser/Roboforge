import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { listFiles } from "@/server/services/files";

export const GET = route<{ id: string }>(async (_req, { params }) => listFiles(await requireUser(), params.id));
