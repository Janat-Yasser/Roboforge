import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Monorepo root (avoids picking up stray lockfiles in parent folders, e.g. the user home).
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@roboforge/spec", "@roboforge/catalog", "@roboforge/ir", "@roboforge/validation", "@roboforge/codegen", "@roboforge/assistant", "@roboforge/db"],
  serverExternalPackages: ["pg"],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
};

export default config;
