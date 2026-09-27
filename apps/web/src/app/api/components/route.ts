import { requireUser } from "@/server/auth";
import { route } from "@/server/http";
import { getCatalog, searchComponents } from "@/server/services/catalog";

/**
 * GET /api/components?q=&category=      search (full definitions, max 100)
 * GET /api/components?refs=id@ver,...   resolve exact versions (used for project specs)
 */
export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const refs = url.searchParams.get("refs");
  if (refs) {
    const cat = await getCatalog();
    const defs = refs
      .split(",")
      .filter(Boolean)
      .map((r) => {
        const [id, version] = r.split("@");
        return cat.get(id!, version);
      })
      .filter(Boolean);
    return { components: defs };
  }
  return { components: await searchComponents(url.searchParams.get("q"), url.searchParams.get("category")) };
});
