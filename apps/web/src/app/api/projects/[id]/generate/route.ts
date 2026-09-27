import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { generateForProject } from "@/server/services/files";

const Input = z.object({ force: z.boolean().default(false) });

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { force } = await body(req, Input);
  return generateForProject(await requireUser(), params.id, force);
});
