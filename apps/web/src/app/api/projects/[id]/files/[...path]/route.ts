// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { getFile, saveFile } from "@/server/services/files";

const Input = z.object({ content: z.string().max(2_000_000) });

export const GET = route<{ id: string; path: string[] }>(async (_req, { params }) => ({
  file: await getFile(await requireUser(), params.id, params.path.map(decodeURIComponent).join("/")),
}));

export const PUT = route<{ id: string; path: string[] }>(async (req, { params }) => {
  const { content } = await body(req, Input);
  return saveFile(await requireUser(), params.id, params.path.map(decodeURIComponent).join("/"), content);
});
