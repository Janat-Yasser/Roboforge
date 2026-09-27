import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export type Database = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __roboforgePool?: pg.Pool; __roboforgeDb?: Database };

export function getPool(): pg.Pool {
  g.__roboforgePool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://roboforge:roboforge@localhost:5432/roboforge",
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  });
  return g.__roboforgePool;
}

/** Shared database handle (one pool per process; survives Next.js dev hot reloads). */
export function getDb(): Database {
  g.__roboforgeDb ??= drizzle(getPool(), { schema });
  return g.__roboforgeDb;
}
export { LocalObjectStore, type ObjectStore } from "./storage";
