import "server-only";
import { builtinCatalog } from "@roboforge/catalog";
import type { ComponentDefinition } from "@roboforge/spec";
import { getCatalog } from "./catalog";

/** Catalog for public pages: the database library, or the built-in one if the DB is unavailable. */
export async function publicParts(): Promise<ComponentDefinition[]> {
  try {
    return (await getCatalog()).all();
  } catch {
    return builtinCatalog().all();
  }
}
