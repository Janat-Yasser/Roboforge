// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * Builds the public part of RoboForge as a static site for GitHub Pages:
 * the landing page, parts library, courses, tutorials and the full /demo
 * workspace (robot, wiring, behavior, code, 2D simulator). The demo already
 * runs entirely in the browser, so it needs no server.
 *
 * Works on a throwaway copy of apps/web, so the real app is never modified:
 *   - drops the API, saved projects and auth routes (they need the server),
 *   - swaps the two server helpers public pages use for browser-safe stubs,
 *   - replaces /login and /signup with a page explaining how to run the full app,
 *   - builds with `output: "export"` under the /Roboforge base path.
 *
 *   node apps/web/scripts/build-static.mjs           -> apps/web/out-static/
 *   BASE_PATH="" node apps/web/scripts/build-static.mjs   (serve from the domain root)
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = resolve(web, "../.web-static");
const out = resolve(web, "out-static");
const basePath = process.env.BASE_PATH ?? "/Roboforge";
const repo = "https://github.com/Janat-Yasser/Roboforge";

rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
for (const f of readdirSync(web)) {
  if ([".next", "node_modules", "out-static", "test"].includes(f)) continue;
  cpSync(join(web, f), join(tmp, f), { recursive: true });
}
symlinkSync(join(web, "node_modules"), join(tmp, "node_modules"), "junction");

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const walkAll = (d) => walk(d).filter((f) => /\.(tsx?|ts)$/.test(f));
const app = join(tmp, "src/app");
// The demo pages re-export the project pages, so keep those files but take them out of routing.
cpSync(join(app, "projects/[id]"), join(tmp, "src/project-pages"), { recursive: true });
for (const r of ["api", "projects", "login", "signup"]) rmSync(join(app, r), { recursive: true, force: true });

// Browser-safe stand-ins for the only two server helpers the public pages import.
rmSync(join(tmp, "src/server"), { recursive: true, force: true });
mkdirSync(join(tmp, "src/server/services"), { recursive: true });
writeFileSync(join(tmp, "src/server/auth.ts"), `// Static build: nobody is signed in.\nexport async function currentUser() { return null; }\n`);
writeFileSync(join(tmp, "src/server/services/public-catalog.ts"),
  `import { builtinCatalog } from "@roboforge/catalog";\nexport async function publicParts() { return builtinCatalog().all(); }\n`);

for (const f of walkAll(join(tmp, "src"))) {
  const s = readFileSync(f, "utf8");
  if (s.includes("@/app/projects/[id]/")) writeFileSync(f, s.replaceAll("@/app/projects/[id]/", "@/project-pages/"));
}

// Pages that read cookies are dynamic on the server; here they are rendered once at build time.
for (const f of walk(app).filter((f) => /\.(tsx?|ts)$/.test(f))) {
  const s = readFileSync(f, "utf8");
  if (s.includes('export const dynamic = "force-dynamic";')) writeFileSync(f, s.replace('export const dynamic = "force-dynamic";', ""));
}

// Parts detail pages need their ids listed up front.
const partPage = join(app, "(site)/parts/[id]/page.tsx");
writeFileSync(partPage, readFileSync(partPage, "utf8") +
  `\nexport async function generateStaticParams() {\n  return (await publicParts()).map((p) => ({ id: p.id }));\n}\n`);

// Monaco is served from public/, so its path needs the base path too.
for (const f of walk(join(tmp, "src")).filter((f) => f.endsWith(".tsx"))) {
  const s = readFileSync(f, "utf8");
  if (s.includes('"/monaco/vs"')) writeFileSync(f, s.replaceAll('"/monaco/vs"', `"${basePath}/monaco/vs"`));
}

// /login and /signup: explain that accounts need the full app.
const accountPage = (title) => `import Link from "next/link";
export const metadata = { title: "${title}" };
export default function Page() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Accounts need the full app</h1>
      <p className="text-muted">This is the static preview of RoboForge on GitHub Pages. Saving projects, builds and the AI
        assistant run on a server with a database, so they are not available here.</p>
      <p className="text-muted">Everything else works in the demo: design the robot, wire it, program its behavior,
        generate code and run it in the 2D simulator.</p>
      <div className="flex gap-3">
        <Link href="/demo/simulate" className="btn btn-primary">Open the demo</Link>
        <a href="${repo}#quick-start" className="btn">Run the full app locally</a>
      </div>
    </main>
  );
}
`;
for (const [r, t] of [["login", "Log in"], ["signup", "Sign up"]]) {
  mkdirSync(join(app, r), { recursive: true });
  writeFileSync(join(app, r, "page.tsx"), accountPage(t));
}

writeFileSync(join(tmp, "next.config.ts"), `import path from "node:path";
import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  basePath: ${JSON.stringify(basePath)},
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: ["@roboforge/spec", "@roboforge/catalog", "@roboforge/ir", "@roboforge/validation", "@roboforge/codegen", "@roboforge/assistant"],
  typedRoutes: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};
export default config;
`);

execSync("npx next build", { cwd: tmp, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
rmSync(out, { recursive: true, force: true });
cpSync(join(tmp, "out"), out, { recursive: true });
writeFileSync(join(out, ".nojekyll"), "");   // keep the _next/ folder
rmSync(tmp, { recursive: true, force: true });
console.log(`static site -> ${out}${existsSync(join(out, "demo/simulate/index.html")) ? " (demo/simulate ok)" : ""}`);
