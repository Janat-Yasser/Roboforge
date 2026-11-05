// Copyright (c) 2026 Janat Yasser. All rights reserved.
import "server-only";
import { MapCatalog, type ComponentDefinition } from "@roboforge/spec";
import { componentVersions, getDb } from "@roboforge/db";

/**
 * Catalog backed by the component_versions table. Definitions are immutable once published, so
 * the in-process cache only needs to pick up newly published versions (short TTL).
 */
let cache: { at: number; catalog: MapCatalog } | undefined;
const TTL_MS = 30_000;

export async function getCatalog(): Promise<MapCatalog> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.catalog;
  const rows = await getDb().select({ definition: componentVersions.definition }).from(componentVersions);
  const catalog = new MapCatalog(rows.map((r) => r.definition as ComponentDefinition));
  cache = { at: Date.now(), catalog };
  return catalog;
}

export async function searchComponents(q: string | null, category: string | null): Promise<ComponentDefinition[]> {
  const cat = await getCatalog();
  const terms = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return cat
    .all()
    .filter((d) => !category || d.category === category)
    .filter((d) => {
      if (!terms.length) return true;
      const hay = [d.id, d.name, d.manufacturer, d.category, d.description, ...d.tags, ...d.interfaces].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    .slice(0, 100);
}
