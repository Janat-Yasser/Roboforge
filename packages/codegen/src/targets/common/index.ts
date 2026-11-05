// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { specToYaml } from "@roboforge/spec";
import { summarizeIR, type RobotIR } from "@roboforge/ir";
import type { GeneratedFile, GenerationContext, TargetGenerator } from "../../types";
import { hex2 } from "../../util/text";

const ID = "project";

/** Project-level files: spec, hardware docs/JSON, behavior docs, containers, CI. Always applies. */
export const commonTarget: TargetGenerator = {
  id: ID,
  title: "Project",
  description: "robot.yaml, README, BOM, wiring and pinout, behavior docs, Docker, dev container and CI.",
  appliesTo: () => true,
  diagnostics: () => [],
  generate(ctx) {
    const files: GeneratedFile[] = [];
    const gen = (path: string, content: string, ownership: GeneratedFile["ownership"] = "generated") =>
      files.push({ path, content, ownership, generator: ID });
    const summary = summarizeIR(ctx.ir);
    const hw = ctx.ir.hardware;
    const firmware = ctx.ir.hardware.controller?.def.controller?.platformio && ctx.spec.targets.firmware.enabled;

    gen("robot.yaml", specToYaml(ctx.spec));
    gen("README.md", emitReadme(ctx));
    gen(".gitignore", [".pio/", ".vscode/", "build/", "install/", "log/", "__pycache__/", "*.pyc", ".pytest_cache/", ""].join("\n"));

    gen(
      "hardware/bom.json",
      json({
        robot: ctx.spec.robot.name,
        items: aggregateBom(ctx.ir),
      }),
    );
    gen(
      "hardware/wiring.json",
      json({
        connections: ctx.spec.connections.map((w) => ({
          id: w.id,
          from: `${hw.byId.get(w.from.componentId)?.instance.name ?? w.from.componentId}.${w.from.pin}`,
          to: `${hw.byId.get(w.to.componentId)?.instance.name ?? w.to.componentId}.${w.to.pin}`,
          label: w.label,
        })),
        nets: summary.nets,
        i2cBuses: summary.i2cBuses,
        canNetworks: summary.canNetworks,
        uartLinks: summary.uartLinks,
        power: summary.power,
      }),
    );
    gen("hardware/pinout.json", json({ controller: summary.controller, pins: summary.pinAssignments }));
    gen(
      "hardware/validation.json",
      json({ ok: ctx.report.ok, counts: ctx.report.counts, diagnostics: ctx.report.diagnostics.map(({ severity, code, category, message }) => ({ severity, category, code, message })) }),
    );
    gen("hardware/WIRING.md", emitWiringDoc(ctx));
    gen("behavior/behavior.json", json(ctx.spec.behavior));
    gen("behavior/BEHAVIOR.md", emitBehaviorDoc(ctx.ir));

    if (firmware) gen("docker/firmware.Dockerfile", FIRMWARE_DOCKERFILE);
    if (ctx.spec.targets.ros2.enabled) gen("docker/ros2.Dockerfile", ros2Dockerfile(ctx.spec.targets.ros2.distro, ctx.spec.robot.name));
    gen(".devcontainer/devcontainer.json", json(devcontainer(ctx, !!firmware)));
    gen(".github/workflows/ci.yml", ciWorkflow(ctx, !!firmware));
    return files;
  },
};

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

function aggregateBom(ir: RobotIR) {
  const map = new Map<string, { catalogId: string; version: string; name: string; manufacturer: string; category: string; quantity: number; designators: string[]; datasheet?: string }>();
  for (const rc of ir.hardware.components) {
    const key = `${rc.def.id}@${rc.def.version}`;
    const e = map.get(key) ?? {
      catalogId: rc.def.id,
      version: rc.def.version,
      name: rc.def.name,
      manufacturer: rc.def.manufacturer,
      category: rc.def.category,
      quantity: 0,
      designators: [],
      ...(rc.def.datasheetUrl ? { datasheet: rc.def.datasheetUrl } : {}),
    };
    e.quantity++;
    e.designators.push(rc.instance.name);
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function table(headers: string[], rows: (string | number | undefined)[][]): string {
  const esc = (v: string | number | undefined) => String(v ?? "").replace(/\|/g, "\\|");
  return [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
}

function emitWiringDoc(ctx: GenerationContext): string {
  const s = summarizeIR(ctx.ir);
  const hw = ctx.ir.hardware;
  const nm = (id: string) => hw.byId.get(id)?.instance.name ?? id;
  const lines: string[] = [];
  lines.push(`# Wiring — ${ctx.spec.robot.displayName}`, "", "_Generated from `robot.yaml`. Do not edit; change the wiring in RoboForge._", "");
  lines.push("## Connections", "");
  lines.push(
    table(
      ["From", "To", "Net"],
      ctx.spec.connections.map((w) => {
        const net = hw.netByPin.get(`${w.from.componentId}:${w.from.pin}`);
        return [`${nm(w.from.componentId)}.${w.from.pin}`, `${nm(w.to.componentId)}.${w.to.pin}`, net?.name];
      }),
    ),
    "",
  );
  if (s.controller) {
    lines.push(`## Pinout — ${s.controller.name}`, "");
    lines.push(table(["Pin", "Code ref", "Function", "Bus", "Connected to"], s.pinAssignments.map((p) => [p.pin, p.codeRef, p.fn, p.bus, p.devices.map((d) => `${d.component}.${d.pin}`).join(", ")])), "");
  }
  if (s.i2cBuses.length) {
    lines.push("## I²C buses", "");
    lines.push(table(["Bus", "SDA", "SCL", "Devices"], s.i2cBuses.map((b) => [b.id, b.sda, b.scl, b.devices.map((d) => `${d.component} @ ${d.address}`).join(", ")])), "");
  }
  if (s.canNetworks.length) {
    lines.push("## CAN", "");
    lines.push(table(["Network", "Bitrate", "TX/RX", "Nodes"], s.canNetworks.map((n) => [n.id, n.bitrate, `${n.tx ?? "?"}/${n.rx ?? "?"}`, n.nodes.map((x) => `${x.component}#${x.nodeId}`).join(", ")])), "");
  }
  lines.push("## Power", "");
  lines.push(
    table(
      ["Net", "Voltage", "Source", "Typical load", "Peak load", "Consumers"],
      s.power.map((p) => [p.net, p.voltage !== undefined ? `${p.voltage} V` : "—", p.sources.map((x) => `${x.component}.${x.pin}`).join(", "), `${p.loadTypicalMa} mA`, `${p.loadPeakMa} mA`, p.sinks.map((x) => `${x.component}.${x.pin}`).join(", ")]),
    ),
    "",
  );
  lines.push("## Motors", "", table(["Motor", "Driven by"], s.motors.map((m) => [m.motor, m.binding])), "");
  lines.push("## Diagram", "", "```mermaid", "flowchart LR");
  for (const rc of hw.components) lines.push(`  ${rc.instance.name}["${rc.instance.name}<br/><small>${rc.def.name.replace(/"/g, "'")}</small>"]`);
  const pairs = new Map<string, string[]>();
  for (const w of ctx.spec.connections) {
    const a = nm(w.from.componentId);
    const b = nm(w.to.componentId);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const label = a < b ? `${w.from.pin}→${w.to.pin}` : `${w.to.pin}→${w.from.pin}`;
    pairs.set(key, [...(pairs.get(key) ?? []), label]);
  }
  for (const [key, labels] of pairs) {
    const [a, b] = key.split("|");
    lines.push(`  ${a} ---|"${labels.slice(0, 4).join(", ")}${labels.length > 4 ? ", …" : ""}"| ${b}`);
  }
  lines.push("```", "");
  return lines.join("\n");
}

function emitBehaviorDoc(ir: RobotIR): string {
  const spec = ir.spec;
  const b = spec.behavior;
  const lines = [`# Behavior — ${spec.robot.displayName}`, "", "_Generated from `robot.yaml`._", ""];
  if (b.states.length) lines.push(`States: ${b.states.map((s) => `\`${s}\``).join(", ")} (initial: \`${b.states[0]}\`)`, "");
  if (b.variables.length) lines.push("## Variables", "", table(["Name", "Initial", "Description"], b.variables.map((v) => [v.name, v.initial, v.description])), "");
  lines.push("## Fibers", "", table(["#", "Trigger", "Name"], ir.behavior.fibers.map((f) => [f.index, f.trigger.kind === "timer" ? `every ${f.trigger.periodMs} ms` : f.trigger.kind === "state_enter" ? `enter ${f.trigger.state}` : f.trigger.kind, f.name])), "");
  lines.push("## Graph", "", "```mermaid", "flowchart TD");
  const nm = (id: string) => ir.hardware.byId.get(id)?.instance.name ?? id;
  for (const n of b.nodes) {
    const title = (n.label ?? n.kind).replace(/"/g, "'");
    let detail = "";
    if (n.kind === "sensor.read") detail = `${nm(n.params.componentId)}.${n.params.channel} → ${n.params.variable}`;
    if (n.kind === "delay") detail = `${n.params.ms} ms`;
    const shape = n.kind === "condition" ? [`{"`, `"}`] : n.kind.startsWith("event.") ? [`(["`, `"])`] : [`["`, `"]`];
    lines.push(`  ${n.id}${shape[0]}${title}${detail ? `<br/><small>${detail}</small>` : ""}${shape[1]}`);
  }
  for (const e of b.edges) lines.push(`  ${e.source} -->${e.sourcePort === "next" ? "" : `|${e.sourcePort}|`} ${e.target}`);
  lines.push("```", "");
  return lines.join("\n");
}

function emitReadme(ctx: GenerationContext): string {
  const spec = ctx.spec;
  const hw = ctx.ir.hardware;
  const ctrl = hw.controller;
  const pio = ctrl?.def.controller?.platformio;
  const firmware = !!pio && spec.targets.firmware.enabled;
  const ros = spec.targets.ros2.enabled;
  const r = spec.robot.name;
  const addr = (id: string) => ctx.ir.hardware.i2cBuses.flatMap((b) => b.devices).find((d) => d.componentId === id)?.address;
  return `# ${spec.robot.displayName}

${spec.robot.description || "Robot project generated by RoboForge."}

> **Source of truth:** \`robot.yaml\`. Hardware, wiring, behavior and targets are defined there;
> most code in this repository is derived from it. See *File ownership* below before editing.

## Hardware

| Name | Part | Notes |
| --- | --- | --- |
${hw.components
  .map((c) => `| \`${c.instance.name}\` | ${c.def.name} | ${[c.def.category, addr(c.instance.id) !== undefined ? `I²C ${hex2(addr(c.instance.id)!)}` : ""].filter(Boolean).join(", ")} |`)
  .join("\n")}

Controller: **${ctrl?.def.name ?? "none selected"}**. Full wiring, pinout and power budget: [hardware/WIRING.md](hardware/WIRING.md).
Validation at generation time: ${ctx.report.counts.error} errors, ${ctx.report.counts.warning} warnings, ${ctx.report.counts.info} notes ([hardware/validation.json](hardware/validation.json)).

## Layout

\`\`\`
robot.yaml              Robot Specification (source of truth)
hardware/               BOM, wiring, pinout, power, validation report
behavior/               Behavior graph (JSON) and documentation
${firmware ? "firmware/               PlatformIO project: HAL, drivers, behavior runtime, tests\n" : ""}${ros ? `ros2_ws/src/            ROS 2 packages: ${r}_description, ${r}_bringup, ${r}_control\n` : ""}docker/                 Reproducible toolchain images
.github/workflows/      CI: native firmware tests${ros ? " + colcon build/test" : ""}
\`\`\`
${
  firmware
    ? `
## Firmware (${ctrl!.def.name})

\`\`\`bash
cd firmware
pio run                     # build
pio run -t upload           # flash
pio device monitor          # serial log (115200)
pio test -e native          # behavior unit tests on your machine, no hardware needed
\`\`\`

Layers: \`include/hal/\` interfaces → \`lib/drivers/\` implementations → \`src/robot_hw.cpp\` (pins from
\`include/robot_config.h\`) → \`src/behavior.cpp\` (depends only on HAL) → \`src/main.cpp\`.

**Safety:** if an e-stop input trips, the runtime latches, disables driver enable pins, stops all motors
every tick and cancels all behavior. Only a reset clears the latch.
`
    : ""
}${
  ros
    ? `
## ROS 2 (${spec.targets.ros2.distro})

\`\`\`bash
cd ros2_ws
colcon build --symlink-install
source install/setup.bash
ros2 launch ${r}_bringup bringup.launch.py
\`\`\`

\`${r}_control\` runs the same behavior (Python) against topics: \`motors/<name>/command\`
(std_msgs/Float32), \`sensors/<name>/range|imu|active\`, \`scan\`, \`outputs/enable\`, and publishes
\`behavior/state\`${spec.robot.drive ? " and `cmd_vel`" : ""}. Use it with a simulator or a hardware bridge node;
run **either** the firmware behavior **or** the ROS 2 behavior on a robot, not both.
Tests: \`colcon test --packages-select ${r}_control\` (plain pytest, no ROS needed for the behavior tests).
`
    : ""
}
## File ownership

| Kind | Meaning |
| --- | --- |
| generated | Rewritten on every generation. Change the spec instead, or *take ownership* in RoboForge. |
| mixed | Generated, but code between \`ROBOFORGE:USER-BEGIN <id>\` and \`ROBOFORGE:USER-END <id>\` is yours and is preserved. |
| user | Created once, never overwritten (e.g. \`firmware/test/test_custom/\`). |

The per-file ownership is recorded in \`.roboforge/manifest.json\`.
`;
}

const FIRMWARE_DOCKERFILE = `# Toolchain image for building and testing the firmware (PlatformIO).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git && rm -rf /var/lib/apt/lists/* \\
 && pip install --no-cache-dir platformio==6.1.16
WORKDIR /work/firmware
CMD ["pio", "test", "-e", "native"]
`;

const ros2Dockerfile = (distro: string, robot: string) => `# ROS 2 ${distro} image for building and running the robot packages.
FROM ros:${distro}-ros-base
RUN apt-get update && apt-get install -y --no-install-recommends \\
      ros-${distro}-xacro ros-${distro}-robot-state-publisher ros-${distro}-joint-state-publisher python3-pytest \\
 && rm -rf /var/lib/apt/lists/*
WORKDIR /ros2_ws
COPY ros2_ws/src ./src
RUN . /opt/ros/${distro}/setup.sh && colcon build
CMD ["bash", "-c", ". /opt/ros/${distro}/setup.sh && . install/setup.sh && ros2 launch ${robot}_bringup bringup.launch.py"]
`;

function devcontainer(ctx: GenerationContext, firmware: boolean) {
  const ros = ctx.spec.targets.ros2.enabled;
  return {
    name: `${ctx.spec.robot.displayName} (RoboForge)`,
    image: ros ? `ros:${ctx.spec.targets.ros2.distro}-ros-base` : "mcr.microsoft.com/devcontainers/python:3.12",
    postCreateCommand: [firmware ? "pip install platformio" : "", ros ? "apt-get update && apt-get install -y python3-pytest" : ""].filter(Boolean).join(" && ") || "true",
    customizations: { vscode: { extensions: [firmware ? "platformio.platformio-ide" : "", "ms-python.python", ros ? "ms-iot.vscode-ros" : ""].filter(Boolean) } },
  };
}

function ciWorkflow(ctx: GenerationContext, firmware: boolean): string {
  const ros = ctx.spec.targets.ros2.enabled;
  const distro = ctx.spec.targets.ros2.distro;
  const board = ctx.ir.hardware.controller?.def.controller?.platformio?.board;
  return `# GENERATED by RoboForge
name: ci
on: [push, pull_request]
jobs:
${
  firmware
    ? `  firmware:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install platformio
      - run: pio test -e native
        working-directory: firmware
      - run: pio run -e ${board}
        working-directory: firmware
`
    : ""
}${
  ros
    ? `  ros2:
    runs-on: ubuntu-latest
    container: ros:${distro}-ros-base
    steps:
      - uses: actions/checkout@v4
      - run: apt-get update && apt-get install -y python3-pytest ros-${distro}-xacro
      - shell: bash
        working-directory: ros2_ws
        run: |
          . /opt/ros/${distro}/setup.bash
          colcon build
          colcon test --event-handlers console_direct+
          colcon test-result --verbose
`
    : ""
}${!firmware && !ros ? "  noop:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo 'no targets enabled'\n" : ""}`;
}
