// Self-host Monaco's AMD build under /public/monaco so the editor never depends on a CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
try {
  const root = dirname(require.resolve("monaco-editor/package.json"));
  const src = join(root, "min", "vs");
  const dst = join(process.cwd(), "public", "monaco", "vs");
  if (existsSync(src)) {
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    console.log("monaco copied to public/monaco/vs");
  }
} catch (e) {
  console.warn("monaco copy skipped:", e.message);
}
