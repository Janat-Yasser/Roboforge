// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Zero-install PostgreSQL for local development: PGlite (Postgres compiled to WebAssembly)
 * served over the Postgres wire protocol, persisted in .data/pglite. Use it when neither Docker
 * nor a native PostgreSQL install is available:
 *
 *   pnpm db:local        (keep it running; then pnpm setup / pnpm dev / pnpm worker)
 *
 * PGlite is single-session; the socket server multiplexes connections and keeps a transaction on
 * the connection that opened it. Fine for one developer — use real PostgreSQL for anything shared.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const dataDir = resolve(root, process.env.PGLITE_DIR ?? ".data/pglite");
const port = Number(process.env.PGLITE_PORT ?? 5432);

mkdirSync(dataDir, { recursive: true });
const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 32 });
await server.start();
console.log(`PGlite (embedded PostgreSQL) listening on 127.0.0.1:${port}, data in ${dataDir}`);
console.log(`DATABASE_URL=postgresql://roboforge:roboforge@localhost:${port}/roboforge  (Ctrl+C to stop)`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
