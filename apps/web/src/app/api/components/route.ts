// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { builtinCatalog } from "@roboforge/catalog";
import type { ComponentDefinition } from "@roboforge/spec";
import { route } from "@/server/http";
import { getCatalog, searchComponents } from "@/server/services/catalog";

/**
 * Public (the parts library and the demo project use it without an account).
 * GET /api/components?q=&category=      search (full definitions, max 100)
 * GET /api/components?refs=id@ver,...   resolve exact versions (used for project specs)
 * Falls back to the built-in library if the database is unavailable.
 */
export const GET = route(async (req) => {
  const url = new URL(req.url);
  const refs = url.searchParams.get("refs");
  if (refs) {
    const cat = await getCatalog().catch(() => builtinCatalog());
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
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  try {
    return { components: await searchComponents(q, category) };
  } catch {
    const terms = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const components: ComponentDefinition[] = builtinCatalog()
      .all()
      .filter((d) => (!category || d.category === category) && terms.every((t) => [d.name, d.manufacturer, d.description, ...d.tags].join(" ").toLowerCase().includes(t)))
      .slice(0, 100);
    return { components };
  }
});
