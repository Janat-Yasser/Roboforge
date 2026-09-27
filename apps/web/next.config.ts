import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@roboforge/spec", "@roboforge/catalog", "@roboforge/ir", "@roboforge/validation", "@roboforge/codegen", "@roboforge/assistant", "@roboforge/db"],
  serverExternalPackages: ["pg"],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
};

export default config;
