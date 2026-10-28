// Cross-platform (Windows/macOS/Linux) build of the sandbox images used by the build worker.
//   pnpm sandbox:build            → roboforge/sandbox-native:1
//   WITH_PIO=1 pnpm sandbox:build → also roboforge/sandbox-pio:1 (large: ESP32/AVR/STM32 toolchains)
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const images = [["native.Dockerfile", "roboforge/sandbox-native:1"]];
if (process.env.WITH_PIO === "1") images.push(["pio.Dockerfile", "roboforge/sandbox-pio:1"]);

for (const [file, tag] of images) {
  console.log(`\n▶ docker build -f ${file} -t ${tag}`);
  const r = spawnSync("docker", ["build", "-f", file, "-t", tag, "."], { cwd: dir, stdio: "inherit", shell: process.platform === "win32" });
  if (r.error) {
    console.error(`Could not run docker: ${r.error.message}. Is Docker Desktop installed and running?`);
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status ?? 1);
}
