// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { analyzeProject } from "@roboforge/codegen";
import { exportZip } from "@roboforge/codegen/export";
import type { BuildStep } from "@roboforge/db";
import type { Catalog, RobotSpec } from "@roboforge/spec";
import type { Sandbox } from "./sandbox";

export interface BuildInput {
  buildId: string;
  spec: RobotSpec;
  files: { path: string; content: string }[];
}

export interface BuildReporter {
  log(line: string, stream?: "stdout" | "stderr" | "system"): void;
  step(name: string, status: BuildStep["status"], detail?: string): Promise<void>;
}

export interface BuildDeps {
  catalog: Catalog;
  sandbox: Sandbox;
  nativeImage: string;
  pioImage: string;
  pioNetwork: "none" | "bridge";
  timeoutMs: number;
}

export interface BuildOutcome {
  ok: boolean;
  artifact: Uint8Array | null;
  error?: string;
}

/** Script run inside the native sandbox image: compiles and runs every generated firmware test suite. */
export const NATIVE_TEST_SCRIPT = `set -eu
UNITY=\${UNITY_SRC:-/opt/unity/src}
mkdir -p /tmp/b
gcc -c -I "$UNITY" "$UNITY/unity.c" -o /tmp/b/unity.o
USER_SRC=""
if [ -d firmware/src/user ]; then USER_SRC=$(ls firmware/src/user/*.cpp 2>/dev/null || true); fi
status=0
for dir in firmware/test/test_*/; do
  name=$(basename "$dir")
  echo "== $name"
  if g++ -std=gnu++17 -Wall -Wextra -I firmware/include -I firmware/src -I firmware/test/test_behavior -I "$UNITY" \\
      firmware/src/behavior.cpp $USER_SRC "$dir/test_main.cpp" /tmp/b/unity.o -o "/tmp/b/$name"; then
    "/tmp/b/$name" || status=1
  else
    status=1
  fi
done
exit $status
`;

export const pytestScript = (pkgDir: string) => `set -eu
cd "${pkgDir}"
python3 -m pytest -q -p no:cacheprovider test
`;

export const PIO_SCRIPT = `set -eu
cp -r /work/firmware /tmp/fw
cd /tmp/fw
pio run
`;

function safeJoin(root: string, rel: string): string {
  const p = resolve(root, rel);
  if (!p.startsWith(root + sep)) throw new Error(`Refusing to write outside the workspace: ${rel}`);
  return p;
}

/**
 * The build pipeline. Pure orchestration: data in, artifact out; all side effects go through the
 * reporter (logs/steps) and the sandbox (untrusted execution).
 */
export async function runBuild(input: BuildInput, deps: BuildDeps, r: BuildReporter): Promise<BuildOutcome> {
  let ws: string | null = null;
  const fail = async (step: string, error: string): Promise<BuildOutcome> => {
    await r.step(step, "failed", error);
    r.log(error, "stderr");
    return { ok: false, artifact: null, error };
  };
  try {
    await r.step("checkout", "running");
    r.log(`robot ${input.spec.robot.name}: ${input.files.length} files`, "system");
    await r.step("checkout", "passed");

    await r.step("validate", "running");
    const analysis = analyzeProject(input.spec, deps.catalog);
    for (const d of analysis.report.diagnostics) if (d.severity !== "info") r.log(`${d.severity.toUpperCase()} ${d.code}: ${d.message}`, d.severity === "error" ? "stderr" : "stdout");
    if (!analysis.report.ok) return fail("validate", `${analysis.report.counts.error} validation error(s)`);
    await r.step("validate", "passed", `${analysis.report.counts.warning} warning(s)`);

    await r.step("materialize", "running");
    ws = await mkdtemp(join(tmpdir(), "rf-build-"));
    // The sandbox runs as an unprivileged uid and mounts the workspace read-only: make it readable.
    await chmod(ws, 0o755);
    for (const f of input.files) {
      const p = safeJoin(ws, f.path);
      await mkdir(dirname(p), { recursive: true, mode: 0o755 });
      await writeFile(p, f.content, { mode: 0o644 });
    }
    await r.step("materialize", "passed");

    const has = (prefix: string) => input.files.some((f) => f.path.startsWith(prefix));
    const runStep = async (step: string, image: string, script: string, applies: boolean, why: string, network: "none" | "bridge" = "none") => {
      if (!applies) {
        await r.step(step, "skipped", why);
        return true;
      }
      const reason = deps.sandbox.unavailableReason(image);
      if (reason) {
        // Never fall back to running untrusted code on the host.
        await r.step(step, "skipped", reason);
        r.log(`${step}: skipped — ${reason}`, "system");
        return true;
      }
      await r.step(step, "running");
      r.log(`$ [sandbox ${image}, network=${network}] ${step}`, "system");
      const res = await deps.sandbox.run({ image, workspace: ws!, script, timeoutMs: deps.timeoutMs, network, onLine: (l, s) => r.log(l, s) });
      if (res.timedOut) {
        await r.step(step, "failed", `timed out after ${Math.round(deps.timeoutMs / 1000)} s`);
        return false;
      }
      await r.step(step, res.exitCode === 0 ? "passed" : "failed", res.exitCode === 0 ? undefined : `exit code ${res.exitCode}`);
      return res.exitCode === 0;
    };

    const controlPkg = `ros2_ws/src/${input.spec.robot.name}_control`;
    const okNative = await runStep("firmware: native unit tests", deps.nativeImage, NATIVE_TEST_SCRIPT, has("firmware/test/"), "no firmware target");
    const okRos = await runStep("ros2: behavior tests", deps.nativeImage, pytestScript(controlPkg), has(`${controlPkg}/test/`), "ROS 2 target disabled");
    const okPio = await runStep("firmware: cross-compile", deps.pioImage, PIO_SCRIPT, has("firmware/platformio.ini"), "no firmware target", deps.pioNetwork);

    await r.step("package", "running");
    const artifact = await exportZip(input.spec.robot.name, input.files);
    await r.step("package", "passed", `${(artifact.byteLength / 1024).toFixed(1)} KiB`);

    const ok = okNative && okRos && okPio;
    return ok ? { ok, artifact } : { ok, artifact, error: "One or more test/compile steps failed." };
  } catch (e) {
    return fail("package", `internal error: ${(e as Error).message}`);
  } finally {
    if (ws) await rm(ws, { recursive: true, force: true });
  }
}
