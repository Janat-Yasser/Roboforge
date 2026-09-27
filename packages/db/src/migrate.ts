import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
import { getDb, getPool } from "./index";

const folder = fileURLToPath(new URL("../migrations", import.meta.url));

migrate(getDb(), { migrationsFolder: folder })
  .then(() => console.log("migrations applied"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPool().end());
