// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { z } from "zod";
import { requireUser } from "@/server/auth";
import { body, route } from "@/server/http";
import { applyProjectCommands } from "@/server/services/projects";

const Input = z.object({
  baseRevision: z.number().int().positive(),
  commands: z.array(z.unknown()).min(1).max(500),
  message: z.string().max(200).optional(),
});

/** The single write path for the Robot Specification. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const { baseRevision, commands, message } = await body(req, Input);
  return applyProjectCommands(await requireUser(), params.id, baseRevision, commands, message);
});
