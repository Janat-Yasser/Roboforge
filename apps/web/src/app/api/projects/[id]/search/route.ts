// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { and, eq, ilike } from "drizzle-orm";
import { getDb, projectFiles } from "@roboforge/db";
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getProjectForUser } from "@/server/services/projects";

/** Project-wide text search over the codebase: GET ?q=text → [{ path, line, text }]. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  await getProjectForUser(await requireUser(), params.id);
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return { matches: [] };
  const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
  const rows = await getDb()
    .select({ path: projectFiles.path, content: projectFiles.content })
    .from(projectFiles)
    .where(and(eq(projectFiles.projectId, params.id), ilike(projectFiles.content, `%${escaped}%`)));
  const needle = q.toLowerCase();
  const matches: { path: string; line: number; text: string }[] = [];
  for (const r of rows) {
    r.content.split("\n").forEach((text, i) => {
      if (matches.length < 300 && text.toLowerCase().includes(needle)) matches.push({ path: r.path, line: i + 1, text: text.trim().slice(0, 200) });
    });
  }
  return { matches };
});
