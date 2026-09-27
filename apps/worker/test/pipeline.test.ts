import { describe, expect, it } from "vitest";
import { createFromTemplate } from "@roboforge/ir";
import { generateProject } from "@roboforge/codegen";
import { runBuild, type BuildReporter } from "../src/pipeline";
import type { Sandbox, SandboxRunOptions } from "../src/sandbox";
import { catalog } from "../../../packages/ir/test/helpers";

class FakeSandbox implements Sandbox {
  runs: SandboxRunOptions[] = [];
  constructor(private readonly available: boolean, private readonly exitCode = 0) {}
  unavailableReason() {
    return this.available ? null : "no container runtime";
  }
  async run(o: SandboxRunOptions) {
    this.runs.push(o);
    o.onLine("ok", "stdout");
    return { exitCode: this.exitCode, timedOut: false };
  }
}

function recorder() {
  const steps: Record<string, string> = {};
  const lines: string[] = [];
  const r: BuildReporter = {
    log: (l) => void lines.push(l),
    step: async (name, status) => void (steps[name] = status),
  };
  return { r, steps, lines };
}

const spec = createFromTemplate("obstacle-avoider", catalog, "bot", "Bot");
const files = generateProject(spec, catalog).files.map((f) => ({ path: f.path, content: f.content }));
const deps = (sandbox: Sandbox) => ({ catalog, sandbox, nativeImage: "native", pioImage: "pio", pioNetwork: "none" as const, timeoutMs: 1000 });

describe("build pipeline", () => {
  it("runs tests only inside the sandbox and packages an artifact", async () => {
    const sb = new FakeSandbox(true);
    const { r, steps } = recorder();
    const out = await runBuild({ buildId: "b", spec, files }, deps(sb), r);
    expect(out.ok).toBe(true);
    expect(out.artifact!.byteLength).toBeGreaterThan(0);
    expect(sb.runs.map((x) => x.image)).toEqual(["native", "native", "pio"]);
    expect(sb.runs.every((x) => x.network === "none")).toBe(true);
    expect(steps["firmware: native unit tests"]).toBe("passed");
    expect(steps["ros2: behavior tests"]).toBe("passed");
  });

  it("skips (never runs on the host) when no sandbox is available", async () => {
    const sb = new FakeSandbox(false);
    const { r, steps } = recorder();
    const out = await runBuild({ buildId: "b", spec, files }, deps(sb), r);
    expect(sb.runs).toHaveLength(0);
    expect(steps["firmware: native unit tests"]).toBe("skipped");
    expect(out.ok).toBe(true);
  });

  it("fails on test failures and on unsafe paths", async () => {
    const { r } = recorder();
    expect((await runBuild({ buildId: "b", spec, files }, deps(new FakeSandbox(true, 1)), r)).ok).toBe(false);
    const evil = await runBuild({ buildId: "b", spec, files: [...files, { path: "../../etc/x", content: "" }] }, deps(new FakeSandbox(true)), recorder().r);
    expect(evil.ok).toBe(false);
    expect(evil.error).toMatch(/outside the workspace/);
  });
});
