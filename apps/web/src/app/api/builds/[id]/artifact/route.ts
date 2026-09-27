import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getArtifact } from "@/server/services/builds";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { data, filename } = await getArtifact(await requireUser(), params.id);
  return new Response(Buffer.from(data), { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${filename}"` } });
});
