// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getBuild, logsAfter } from "@/server/services/builds";

/** Full log as JSON (the code editor turns compiler errors into markers). */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  await getBuild(await requireUser(), params.id);
  const lines: { id: number; stream: string; line: string }[] = [];
  let after = 0;
  for (let i = 0; i < 20; i++) {
    const chunk = await logsAfter(params.id, after);
    if (!chunk.length) break;
    lines.push(...chunk);
    after = chunk[chunk.length - 1]!.id;
  }
  return { lines };
});
