// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { attachment } from "@/server/rate-limit";
import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { exportProject } from "@/server/services/files";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { filename, data } = await exportProject(await requireUser(), params.id);
  return new Response(Buffer.from(data), {
    headers: { "content-type": "application/zip", "content-disposition": attachment(filename) },
  });
});
