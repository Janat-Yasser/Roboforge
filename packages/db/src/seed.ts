// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Seeds the global component library from the built-in catalog. Idempotent; published
 * (componentId, version) pairs are immutable and never overwritten.
 */
import { loadBuiltinDefinitions } from "@roboforge/catalog";
import { compareSemver } from "@roboforge/spec";
import { eq } from "drizzle-orm";
import { componentVersions, components, getDb, getPool } from "./index";

async function main() {
  const db = getDb();
  const defs = loadBuiltinDefinitions();
  let created = 0;
  for (const def of defs) {
    const [existing] = await db.select().from(components).where(eq(components.id, def.id));
    const latest = existing && compareSemver(existing.latestVersion, def.version) > 0 ? existing.latestVersion : def.version;
    const row = { name: def.name, manufacturer: def.manufacturer, category: def.category, tags: def.tags, latestVersion: latest };
    await db.insert(components).values({ id: def.id, ...row }).onConflictDoUpdate({ target: components.id, set: { ...row, updatedAt: new Date() } });
    const inserted = await db
      .insert(componentVersions)
      .values({ componentId: def.id, version: def.version, definition: def })
      .onConflictDoNothing()
      .returning({ id: componentVersions.id });
    created += inserted.length;
  }
  console.log(`component library: ${defs.length} components, ${created} new versions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
