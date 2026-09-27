import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFromTemplate } from "@roboforge/ir";
import { generateProject, mergeGeneration, parseRegions, type GeneratedFile } from "@roboforge/codegen";
import { exportZip } from "@roboforge/codegen/export";
import type { Command } from "@roboforge/spec";
import { catalog, poweredEsp32, SpecBuilder } from "../../ir/test/helpers";

const STUBS = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "arduino-stubs");
const UNITY = process.env.UNITY_SRC ?? "/tmp/unity/src";
const has = (cmd: string) => {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const HAS_GXX = has("g++");
const HAS_UNITY = existsSync(join(UNITY, "unity.c"));
const HAS_PYTEST = (() => {
  try {
    execFileSync("python3", ["-m", "pytest", "--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

function materialize(files: GeneratedFile[]): string {
  const dir = mkdtempSync(join(tmpdir(), "rfgen-"));
  for (const f of files) {
    const p = join(dir, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
  }
  return dir;
}

/** A behavior exercising every node kind: states, timers, sequence, parallel, IMU, servo, user fn. */
function complexSpec() {
  const b = poweredEsp32();
  b.add("drv", "tb6612fng-breakout");
  b.add("left", "dc-gearmotor-12v");
  b.add("right", "dc-gearmotor-12v");
  b.add("tof", "vl53l0x-breakout");
  b.add("imu", "mpu6050-gy521");
  b.add("pan", "servo-sg90");
  b.add("stop_btn", "estop-button-nc");
  for (const n of ["drv", "left", "right", "tof", "imu", "pan", "stop_btn"]) b.autowire(n);
  b.apply([{ type: "targets.update", patch: { ros2Enabled: true } }]);
  const node = (id: string, kind: string, params: object): Command => ({ type: "behavior.node.add", node: { id, kind, params, position: { x: 0, y: 0 } } as never });
  const edge = (s: string, port: string, t: string): Command => ({ type: "behavior.edge.add", edge: { id: `${s}_${port}`, source: s, sourcePort: port, target: t } });
  b.apply([
    { type: "behavior.states.set", states: ["PATROL", "AVOID"] },
    { type: "behavior.variable.upsert", variable: { name: "dist", initial: 0 } },
    { type: "behavior.variable.upsert", variable: { name: "yaw", initial: 0 } },
    { type: "behavior.variable.upsert", variable: { name: "ticks", initial: 0 } },
    node("patrol", "event.state_enter", { state: "PATROL" }),
    node("read", "sensor.read", { componentId: "c_tof", channel: "distance_m", variable: "dist" }),
    node("near", "condition", { left: { kind: "var", name: "dist" }, op: "<", right: { kind: "const", value: 0.4 } }),
    node("go_avoid", "state.set", { state: "AVOID" }),
    node("fwd", "motor.set", { commands: [{ componentId: "c_left", speed: 0.5 }, { componentId: "c_right", speed: 0.5 }] }),
    node("w1", "delay", { ms: 20 }),
    node("avoid", "event.state_enter", { state: "AVOID" }),
    node("seq", "sequence", { steps: 2 }),
    node("stop", "motor.stop", { componentIds: [] }),
    node("par", "parallel", { branches: 2 }),
    node("look", "servo.set", { componentId: "c_pan", angleDeg: 150 }),
    node("spin", "motor.set", { commands: [{ componentId: "c_left", speed: -0.3 }, { componentId: "c_right", speed: 0.3 }] }),
    node("w2", "delay", { ms: 600 }),
    node("imu_read", "sensor.read", { componentId: "c_imu", channel: "yaw_deg", variable: "yaw" }),
    node("custom", "function", { name: "check_battery" }),
    node("back", "state.set", { state: "PATROL" }),
    node("timer", "event.timer", { periodMs: 1000 }),
    node("count", "variable.set", { variable: "ticks", op: "add", value: { kind: "const", value: 1 } }),
    node("log", "log", { message: "heartbeat" }),
    edge("patrol", "next", "read"),
    edge("read", "next", "near"),
    edge("near", "true", "go_avoid"),
    edge("near", "false", "fwd"),
    edge("fwd", "next", "w1"),
    edge("w1", "next", "read"),
    edge("avoid", "next", "seq"),
    edge("seq", "step_1", "stop"),
    edge("seq", "step_2", "par"),
    edge("par", "branch_1", "look"),
    edge("par", "branch_2", "spin"),
    edge("spin", "next", "w2"),
    edge("w2", "next", "imu_read"),
    edge("seq", "done", "custom"),
    edge("custom", "next", "back"),
    edge("timer", "next", "count"),
    edge("count", "next", "log"),
  ]);
  return b.spec;
}

describe("code generation", () => {
  it("is deterministic", () => {
    const spec = createFromTemplate("obstacle-avoider", catalog, "bot", "Bot");
    const a = generateProject(spec, catalog);
    const b = generateProject(spec, catalog);
    expect(a.ok).toBe(true);
    expect(a.files.map((f) => [f.path, f.content])).toEqual(b.files.map((f) => [f.path, f.content]));
    const paths = a.files.map((f) => f.path);
    for (const p of ["robot.yaml", "hardware/bom.json", "hardware/pinout.json", "hardware/wiring.json", "firmware/src/behavior.cpp", "ros2_ws/src/bot_control/bot_control/behavior.py", ".roboforge/manifest.json"]) {
      expect(paths).toContain(p);
    }
  });

  it("refuses to generate while validation has errors (unless forced)", () => {
    const b = poweredEsp32();
    b.add("sonar", "hc-sr04");
    b.wire("sonar.VCC", "buck.VOUT").wire("sonar.GND", "mcu.GND").wire("sonar.TRIG", "mcu.GPIO13").wire("sonar.ECHO", "mcu.GPIO14");
    const r = generateProject(b.spec, catalog);
    expect(r.ok).toBe(false);
    expect(r.blockedBy.map((d) => d.code)).toContain("LOGIC_LEVEL_MISMATCH");
    expect(generateProject(b.spec, catalog, { force: true }).ok).toBe(true);
  });

  it("compiles every node kind without diagnostics", () => {
    const r = generateProject(complexSpec(), catalog);
    expect(r.blockedBy).toEqual([]);
    expect(r.analysis.report.counts.warning).toBe(0);
    const cpp = r.files.find((f) => f.path === "firmware/src/behavior.cpp")!.content;
    expect(cpp).toContain("user::check_battery(r_)");
    expect(cpp).toContain("sample.yawDeg");
    expect(r.files.find((f) => f.path === "firmware/src/user/user_functions.cpp")!.ownership).toBe("mixed");
  });

  it.skipIf(!HAS_GXX || !HAS_UNITY)("generated firmware tests compile with -Werror and pass on the host", () => {
    for (const spec of [createFromTemplate("obstacle-avoider", catalog, "bot", "Bot"), complexSpec()]) {
      const r = generateProject(spec, catalog);
      const dir = materialize(r.files);
      const fw = join(dir, "firmware");
      const unityObj = join(dir, "unity.o");
      execFileSync("gcc", ["-c", "-I", UNITY, join(UNITY, "unity.c"), "-o", unityObj]);
      for (const t of ["test_behavior", "test_custom"]) {
        const exe = join(dir, t);
        const srcs = [join(fw, "src/behavior.cpp"), join(fw, "test", t, "test_main.cpp")];
        if (existsSync(join(fw, "src/user/user_functions.cpp"))) srcs.push(join(fw, "src/user/user_functions.cpp"));
        const inc = ["include", "src", "test/test_behavior"].flatMap((p) => ["-I", join(fw, p)]);
        execFileSync("g++", ["-std=gnu++17", "-Wall", "-Wextra", "-Werror", ...inc, "-I", UNITY, ...srcs, unityObj, "-o", exe]);
        const out = execFileSync(exe).toString();
        expect(out).toMatch(/0 Failures/);
      }
    }
  });

  it.skipIf(!HAS_GXX)("generated drivers and composition root type-check against the Arduino API (AVR)", () => {
    const b = new SpecBuilder();
    b.add("battery", "lipo-2s-2200");
    b.add("uno", "arduino-uno-r3");
    b.add("drv", "tb6612fng-breakout");
    b.add("m", "dc-gearmotor-12v");
    b.add("tof", "vl53l0x-breakout");
    b.add("sonar", "hc-sr04");
    b.add("ir", "sharp-gp2y0a21");
    b.add("imu", "mpu6050-gy521");
    b.add("pan", "servo-mg996r");
    b.add("stop_btn", "estop-button-nc");
    b.wire("uno.VIN", "battery.BAT+").wire("uno.GND", "battery.BAT-");
    for (const n of ["drv", "m", "tof", "sonar", "ir", "imu", "pan", "stop_btn"]) b.autowire(n);
    const r = generateProject(b.spec, catalog, { force: true });
    const dir = materialize(r.files);
    const fw = join(dir, "firmware");
    const srcs = ["src/robot_hw.cpp", "src/main.cpp", "src/behavior.cpp", ...r.files.filter((f) => f.path.startsWith("firmware/lib/drivers/src/") && f.path.endsWith(".cpp")).map((f) => f.path.replace("firmware/", ""))];
    execFileSync("g++", ["-std=gnu++17", "-Wall", "-Wextra", "-Werror", "-I", STUBS, "-I", join(fw, "include"), "-I", join(fw, "src"), "-I", join(fw, "lib/drivers/src"), ...srcs.map((s) => join(fw, s)), join(STUBS, "stubs.cpp"), "-o", join(dir, "fw")]);
  });

  it.skipIf(!HAS_PYTEST)("generated ROS 2 behavior passes its pytest suite", () => {
    for (const spec of [createFromTemplate("obstacle-avoider", catalog, "bot", "Bot"), complexSpec()]) {
      const r = generateProject(spec, catalog);
      const dir = materialize(r.files);
      const pkg = join(dir, "ros2_ws/src", `${spec.robot.name}_control`);
      const out = execFileSync("python3", ["-m", "pytest", "-q", "test"], { cwd: pkg }).toString();
      expect(out).toMatch(/passed/);
    }
  });

  it("exports a zip rooted at the robot name", async () => {
    const r = generateProject(createFromTemplate("obstacle-avoider", catalog, "bot", "Bot"), catalog);
    const zip = await exportZip("bot", r.files);
    expect(zip.byteLength).toBeGreaterThan(1000);
    await expect(exportZip("bot", [{ path: "../evil", content: "" }])).rejects.toThrow(/unsafe/);
  });
});

describe("ownership-aware merge", () => {
  it("preserves user regions, user files and ejected files; removes stale generated files", () => {
    const r1 = generateProject(complexSpec(), catalog);
    const existing = r1.files.map((f) => ({ path: f.path, content: f.content, ownership: f.ownership }));
    const main = existing.find((f) => f.path === "firmware/src/main.cpp")!;
    main.content = main.content.replace("// ROBOFORGE:USER-BEGIN loop\n", "// ROBOFORGE:USER-BEGIN loop\n  heartbeatLed();\n");
    const fn = existing.find((f) => f.path === "firmware/src/user/user_functions.cpp")!;
    fn.content = fn.content.replace("  (void)robot;\n  return true;", "  return robot.log, false;");
    const custom = existing.find((f) => f.path === "firmware/test/test_custom/test_main.cpp")!;
    custom.content += "\n// my scenario\n";
    const ejected = existing.find((f) => f.path === "firmware/include/robot_config.h")!;
    ejected.ownership = "user";
    ejected.content += "\n#define MY_TUNING 1\n";
    existing.push({ path: "firmware/src/legacy_generated.cpp", content: "x", ownership: "generated" });
    existing.push({ path: "notes/todo.md", content: "mine", ownership: "user" });

    const r2 = generateProject(complexSpec(), catalog);
    const m = mergeGeneration(r2.files, existing);
    const get = (p: string) => m.files.find((f) => f.path === p);
    expect(get("firmware/src/main.cpp")!.content).toContain("heartbeatLed();");
    expect(get("firmware/src/user/user_functions.cpp")!.content).toContain("return robot.log, false;");
    expect(get("firmware/test/test_custom/test_main.cpp")!.content).toContain("// my scenario");
    expect(get("firmware/include/robot_config.h")!.content).toContain("MY_TUNING");
    expect(get("firmware/src/legacy_generated.cpp")).toBeUndefined();
    expect(get("notes/todo.md")!.content).toBe("mine");
    const actions = Object.fromEntries(m.changes.map((c) => [c.path, c.action]));
    expect(actions["firmware/src/main.cpp"]).toBe("unchanged"); // template unchanged; user region carried over
    expect(actions["firmware/src/legacy_generated.cpp"]).toBe("removed");
    expect(actions["firmware/include/robot_config.h"]).toBe("preserved");
    expect(actions["firmware/src/behavior.cpp"]).toBe("unchanged");
  });

  it("parses regions and rejects malformed markers", () => {
    expect(parseRegions("a\n# ROBOFORGE:USER-BEGIN x\nbody\n# ROBOFORGE:USER-END x\n")).toEqual([{ id: "x", beginLine: 2, endLine: 4, body: "body" }]);
    expect(() => parseRegions("// ROBOFORGE:USER-BEGIN x\n")).toThrow(/never closed/);
  });
});
