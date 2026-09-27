import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { setOwnership } from "@/server/services/files";

const Input = z.object({ path: z.string().min(1), ownership: z.literal("user") });

/** "Take ownership": a generated file becomes user-owned and is never regenerated again. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { path, ownership } = await body(req, Input);
  return setOwnership(await requireUser(), params.id, path, ownership);
});
