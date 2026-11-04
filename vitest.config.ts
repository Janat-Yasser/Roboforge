import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const pkg = (name: string) => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@roboforge/codegen/export": fileURLToPath(new URL("./packages/codegen/src/export.ts", import.meta.url)),
      "@roboforge/spec": pkg("spec"),
      "@roboforge/catalog": pkg("catalog"),
      "@roboforge/ir": pkg("ir"),
      "@roboforge/validation": pkg("validation"),
      "@roboforge/codegen": pkg("codegen"),
      "@roboforge/assistant": pkg("assistant"),
      "@roboforge/db": pkg("db"),
    },
  },
  test: { include: ["packages/*/test/**/*.test.ts", "apps/worker/test/**/*.test.ts", "apps/web/test/**/*.test.ts"], environment: "node" },
});
