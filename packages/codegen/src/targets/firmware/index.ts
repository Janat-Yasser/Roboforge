// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { RobotIR } from "@roboforge/ir";
import type { GeneratedFile, GenerationContext, TargetGenerator } from "../../types";
import { region } from "../../util/regions";
import { CodeWriter, GENERATED_BANNER_CPP, cppString, upper } from "../../util/text";
import { emitBehaviorHeader, emitBehaviorSource } from "./behavior-cpp";
import { HAL_FILES } from "./hal";
import { planFirmware, type FirmwarePlan } from "./devices";

const ID = "firmware";
const ROOT = "firmware";

/**
 * Arduino-framework firmware for ESP32, AVR and STM32 (PlatformIO). One generator, per-platform
 * board profiles taken from the controller's catalog definition.
 */
export const firmwareTarget: TargetGenerator = {
  id: ID,
  title: "Firmware (PlatformIO / Arduino framework)",
  description: "ESP32, Arduino (AVR) and STM32 firmware with HAL, drivers, compiled behavior and native unit tests.",
  appliesTo: (ir) => ir.spec.targets.firmware.enabled && !!planFirmware(ir),
  diagnostics: (ir) => (ir.spec.targets.firmware.enabled ? planFirmware(ir)?.diagnostics ?? [] : []),
  generate(ctx) {
    const plan = planFirmware(ctx.ir);
    if (!plan) return [];
    const files: GeneratedFile[] = [];
    const gen = (path: string, content: string, ownership: GeneratedFile["ownership"] = "generated") =>
      files.push({ path: `${ROOT}/${path}`, content, ownership, generator: ID });

    for (const [path, content] of Object.entries(HAL_FILES)) gen(path, content);

    const drivers = [...new Map(plan.devices.map((d) => [d.driver.key, d.driver])).values()];
    for (const d of drivers) for (const [name, content] of Object.entries(d.files)) gen(`lib/drivers/src/${name}`, content);
    gen("lib/drivers/library.json", JSON.stringify({ name: "roboforge-drivers", version: "0.1.0", description: "Generated device drivers", frameworks: "arduino" }, null, 2) + "\n");

    gen("include/robot_config.h", emitConfig(ctx, plan));
    gen("include/robot.h", emitRobotStruct(plan));
    gen("src/robot_hw.h", emitHwHeader(plan));
    gen("src/robot_hw.cpp", emitHwSource(plan));
    gen("src/behavior.h", emitBehaviorHeader(ctx.ir.behavior));
    gen(
      "src/behavior.cpp",
      emitBehaviorSource(ctx.ir.behavior, {
        motors: plan.devices.filter((d) => d.hal === "motor").map((d) => d.name),
        estops: ctx.ir.behavior.estopComponentIds.map((id) => ctx.ir.hardware.byId.get(id)!.instance.name).filter((n) => plan.devices.some((d) => d.name === n)),
        userFunctions: ctx.ir.behavior.userFunctions,
      }),
    );
    if (ctx.ir.behavior.userFunctions.length) {
      gen("include/user_functions.h", emitUserFunctionsHeader(ctx.ir));
      gen("src/user/user_functions.cpp", emitUserFunctionsSource(ctx.ir), "mixed");
    }
    gen("src/main.cpp", emitMain(plan), "mixed");
    gen("platformio.ini", emitPlatformIo(ctx, plan));
    gen("test/test_behavior/fakes.h", emitFakes(plan));
    gen("test/test_behavior/test_main.cpp", emitTests(ctx, plan));
    gen("test/test_custom/test_main.cpp", emitCustomTest(plan), "user");
    return files;
  },
};

/* ---------------------------------------------------------------------------------------- */

function emitConfig(ctx: GenerationContext, plan: FirmwarePlan): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Pin map and hardware constants (derived from wiring in robot.yaml)"));
  w.line("#pragma once");
  w.line();
  w.line(`#define RF_ROBOT_NAME ${cppString(ctx.spec.robot.name)}`);
  w.line(`#define RF_CONTROLLER ${cppString(plan.controller.def.name)}`);
  w.line("#define RF_TICK_PERIOD_MS 5");
  w.line("#define RF_SERIAL_BAUD 115200");
  if (plan.i2c.length) {
    w.line();
    w.line("// I2C buses");
    for (const b of plan.i2c) {
      w.line(`#define ${b.sdaMacro} ${b.sda}`);
      w.line(`#define ${b.sclMacro} ${b.scl}`);
    }
  }
  if (plan.can) {
    w.line();
    w.line("// CAN (TWAI)");
    w.line(`#define ${plan.can.txMacro} ${plan.can.tx}`);
    w.line(`#define ${plan.can.rxMacro} ${plan.can.rx}`);
    w.line(`#define RF_${upper(plan.can.id)}_BITRATE ${plan.can.bitrate}`);
  }
  if (plan.enablePins.length) {
    w.line();
    w.line("// Motor driver enable pins (driven HIGH to enable, LOW on e-stop)");
    for (const e of plan.enablePins) w.line(`#define ${e.macro} ${e.codeRef}  // ${e.label}`);
  }
  for (const d of plan.devices) {
    w.line();
    w.line(`// ${d.name} — ${d.rc.def.name}`);
    for (const [k, v, c] of d.macros) w.line(`#define ${k} ${v}${c ? `  // ${c}` : ""}`);
  }
  return w.toString();
}

function emitRobotStruct(plan: FirmwarePlan): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Robot API — the HAL view of this robot used by behavior code"));
  w.line("#pragma once");
  w.line('#include "hal/log.h"');
  w.line('#include "hal/motor.h"');
  w.line('#include "hal/sensors.h"');
  w.line('#include "hal/servo.h"');
  w.line();
  w.namespace("rf", () => {
    w.line();
    w.line("/** References to every device, typed by interface only (no drivers, no Arduino). */");
    w.block("struct Robot {", () => {
      for (const d of plan.devices) w.line(`${d.halType}& ${d.name};`);
      w.line("IOutputEnable& outputs;");
      w.line("ILogger& log;");
    }, "};");
    w.line();
  });
  return w.toString();
}

function emitHwHeader(plan: FirmwarePlan): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Hardware composition root: driver instances bound to pins"));
  w.line("#pragma once");
  w.line('#include "robot.h"');
  w.line('#include "robot_config.h"');
  for (const d of [...new Set(plan.devices.map((x) => Object.keys(x.driver.files).find((f) => f.endsWith(".h"))!))]) w.line(`#include "${d}"`);
  w.line();
  w.namespace("rf", () => {
    w.line();
    w.block("class SerialLogger : public ILogger {", () => {
      w.line(" public:");
      w.line("void info(const char* message) override;");
      w.line("void warn(const char* message) override;");
    }, "};");
    w.line();
    w.block("class DriverEnable : public IOutputEnable {", () => {
      w.line(" public:");
      w.line("void begin();");
      w.line("void setEnabled(bool enabled) override;");
    }, "};");
    w.line();
    w.block("class RobotHardware {", () => {
      w.line(" public:");
      w.line("RobotHardware();");
      w.line("/** Initialises buses and devices. Returns false if any device failed (details are logged). */");
      w.line("bool begin();");
      w.line("Robot& robot() { return robot_; }");
      w.line();
      w.line(" private:");
      w.line("SerialLogger log_;");
      w.line("DriverEnable outputs_;");
      for (const d of plan.devices) w.line(`${d.driver.className} ${d.member};`);
      w.line("Robot robot_;");
    }, "};");
    w.line();
  });
  return w.toString();
}

function emitHwSource(plan: FirmwarePlan): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Hardware composition root"));
  w.line('#include "robot_hw.h"');
  w.line("#include <Arduino.h>");
  if (plan.i2c.length) w.line("#include <Wire.h>");
  w.line();
  const extraWires = plan.i2c.filter((b) => b.wire.startsWith("rfWire"));
  if (extraWires.length) {
    for (const b of extraWires) w.line(`static TwoWire ${b.wire}(${b.sdaMacro}, ${b.sclMacro});`);
    w.line();
  }
  w.namespace("rf", () => {
    w.line();
    w.line('void SerialLogger::info(const char* message) { Serial.print("[info] "); Serial.println(message); }');
    w.line('void SerialLogger::warn(const char* message) { Serial.print("[warn] "); Serial.println(message); }');
    w.line();
    const pins = plan.enablePins.map((e) => e.macro);
    w.block("void DriverEnable::begin() {", () => {
      if (!pins.length) w.line("// No firmware-controlled enable pins in this design.");
      for (const p of pins) w.line(`pinMode(${p}, OUTPUT);`);
    });
    w.block("void DriverEnable::setEnabled(bool enabled) {", () => {
      if (!pins.length) w.line("(void)enabled;");
      for (const p of pins) w.line(`digitalWrite(${p}, enabled ? HIGH : LOW);`);
    });
    w.line();
    const inits = plan.devices.map((d) => `${d.member}(${d.ctorArgs.join(", ")})`);
    const robotInit = `robot_{${[...plan.devices.map((d) => d.member), "outputs_", "log_"].join(", ")}}`;
    w.line("RobotHardware::RobotHardware()");
    w.indent(() => {
      const all = [...inits, robotInit];
      all.forEach((x, i) => w.line(`${i === 0 ? ":" : ","} ${x}`));
    });
    w.line("{}");
    w.line();
    w.block("bool RobotHardware::begin() {", () => {
      w.line("bool ok = true;");
      w.line("outputs_.begin();");
      w.line("outputs_.setEnabled(false);  // keep power stages off until the behavior starts");
      for (const b of plan.i2c) {
        if (plan.platform === "esp32") w.line(`${b.wire}.begin(${b.sdaMacro}, ${b.sclMacro});`);
        else if (plan.platform === "stm32" && b.wire === "Wire") {
          w.line(`Wire.setSDA(${b.sdaMacro});`);
          w.line(`Wire.setSCL(${b.sclMacro});`);
          w.line("Wire.begin();");
        } else w.line(`${b.wire}.begin();`);
        w.line(`${b.wire}.setClock(400000);`);
      }
      if (plan.can) {
        w.block(`if (!canBusBegin(${plan.can.txMacro}, ${plan.can.rxMacro}, RF_${upper(plan.can.id)}_BITRATE)) {`, () => {
          w.line('log_.warn("CAN bus init failed");');
          w.line("ok = false;");
        });
      }
      for (const d of plan.devices) {
        w.block(`if (!${d.member}.begin()) {`, () => {
          w.line(`log_.warn(${cppString(`${d.name} (${d.rc.def.name}) init failed`)});`);
          w.line("ok = false;");
        });
      }
      w.line("return ok;");
    });
    w.line();
  });
  return w.toString();
}

function emitMain(plan: FirmwarePlan): string {
  return `${GENERATED_BANNER_CPP("Firmware entry point")}
// Code between ROBOFORGE:USER-BEGIN/END markers is yours and survives regeneration.
#include <Arduino.h>
#include "behavior.h"
#include "robot_hw.h"
${region("includes", "//")}

static rf::RobotHardware hw;
static rf::Behavior behavior(hw.robot());
${region("globals", "//")}

void setup() {
  Serial.begin(RF_SERIAL_BAUD);
${region("setup_before_hardware", "//", "  ")}
  if (!hw.begin()) {
    Serial.println("[roboforge] one or more devices failed to initialise on ${plan.controller.def.name}");
  }
  behavior.begin(millis());
${region("setup_after_behavior", "//", "  ")}
}

void loop() {
  static uint32_t lastTick = 0;
  const uint32_t now = millis();
  if (now - lastTick >= RF_TICK_PERIOD_MS) {
    lastTick = now;
    behavior.tick(now);
  }
${region("loop", "//", "  ")}
}
`;
}

function emitUserFunctionsHeader(ir: RobotIR): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Declarations for 'Call Function' behavior nodes"));
  w.line("#pragma once");
  w.line('#include "robot.h"');
  w.line();
  w.namespace("rf", () => {
    w.namespace("user", () => {
      for (const f of ir.behavior.userFunctions) {
        w.line(`/** Called by 'Call Function: ${f}'. Return false to take the node's error branch. Must not block. */`);
        w.line(`bool ${f}(Robot& robot);`);
      }
    });
  });
  return w.toString();
}

function emitUserFunctionsSource(ir: RobotIR): string {
  const bodies = ir.behavior.userFunctions
    .map((f) => `bool ${f}(Robot& robot) {\n${region(`fn_${f}`, "//", "  ", "  (void)robot;\n  return true;")}\n}`)
    .join("\n\n");
  return `// User functions called from the behavior graph.
// RoboForge adds a stub when you add a 'Call Function' node; everything inside the
// ROBOFORGE:USER-BEGIN/END markers is yours and is preserved on regeneration.
// Keep this file free of Arduino-only APIs (or guard them with #ifdef ARDUINO) so native tests build.
#include "user_functions.h"
${region("includes", "//")}

namespace rf {
namespace user {

${bodies}

}  // namespace user
}  // namespace rf
`;
}

function emitPlatformIo(ctx: GenerationContext, plan: FirmwarePlan): string {
  const pio = plan.controller.def.controller!.platformio!;
  const deps = [...new Set(plan.devices.flatMap((d) => d.driver.libDeps(plan.platform)))].sort();
  return `; ${ctx.spec.robot.displayName} — PlatformIO project
; GENERATED by RoboForge. Put local changes in a [env:custom] section or take ownership of this file.

[platformio]
default_envs = ${pio.board}

[env]
build_flags = -I include -Wall
test_framework = unity

[env:${pio.board}]
platform = ${pio.platform}
board = ${pio.board}
framework = ${pio.framework}
monitor_speed = 115200
${deps.length ? `lib_deps =\n${deps.map((d) => `    ${d}`).join("\n")}\n` : ""}test_ignore = *

; Host-side unit tests for the behavior (no hardware needed): pio test -e native
[env:native]
platform = native
build_src_filter = -<*> +<behavior.cpp> +<user/>
test_build_src = yes
lib_ignore = roboforge-drivers
build_flags = -I include -std=gnu++17 -Wall -Wextra
`;
}

function emitFakes(plan: FirmwarePlan): string {
  return `${GENERATED_BANNER_CPP("Test doubles for the HAL")}
#pragma once
#include "robot.h"

namespace rf {
namespace test {

struct FakeMotor : IMotor {
  float value = 0.0f;
  int stops = 0;
  void setSpeed(float s) override { value = s; }
  void stop() override { value = 0.0f; ++stops; }
  float speed() const override { return value; }
};

struct FakeDistance : IDistanceSensor {
  float metres = 1.0f;
  bool ok = true;
  bool readDistanceM(float& out) override { if (ok) out = metres; return ok; }
};

struct FakeImu : IImu {
  ImuSample sample;
  bool ok = true;
  bool read(ImuSample& out) override { if (ok) out = sample; return ok; }
};

struct FakeSwitch : ISwitch {
  bool active = false;
  bool isActive() override { return active; }
};

struct FakeServo : IServo {
  float angle = 0.0f;
  void setAngleDeg(float a) override { angle = a; }
};

struct FakeOutputs : IOutputEnable {
  bool enabled = false;
  void setEnabled(bool e) override { enabled = e; }
};

struct FakeLogger : ILogger {
  int infos = 0;
  int warns = 0;
  void info(const char*) override { ++infos; }
  void warn(const char*) override { ++warns; }
};

/** All fakes for this robot, wired into a Robot view. */
struct FakeRobot {
${plan.devices.map((d) => `  ${fakeType(d.hal)} ${d.name};`).join("\n")}
  FakeOutputs outputs;
  FakeLogger log;
  Robot robot{${[...plan.devices.map((d) => d.name), "outputs", "log"].join(", ")}};
};

}  // namespace test
}  // namespace rf
`;
}

const fakeType = (hal: string) =>
  ({ motor: "FakeMotor", distance: "FakeDistance", imu: "FakeImu", switch: "FakeSwitch", servo: "FakeServo" })[hal] ?? "FakeMotor";

function emitTests(ctx: GenerationContext, plan: FirmwarePlan): string {
  const motors = plan.devices.filter((d) => d.hal === "motor").map((d) => d.name);
  const estops = ctx.ir.behavior.estopComponentIds
    .map((id) => ctx.ir.hardware.byId.get(id)!.instance.name)
    .filter((n) => plan.devices.some((d) => d.name === n));
  const sensors = plan.devices.filter((d) => d.hal === "distance" || d.hal === "imu").map((d) => d.name);
  const run = (ms: number) => `for (uint32_t t = 0; t <= ${ms}; t += 5) behavior.tick(t);`;
  return `${GENERATED_BANNER_CPP("Generated behavior tests (run on the host: pio test -e native)")}
#include <unity.h>
#include "behavior.h"
#include "fakes.h"

using rf::Behavior;
using rf::test::FakeRobot;

void setUp() {}
void tearDown() {}

static void test_runs_for_ten_seconds_without_estop() {
  FakeRobot fake;
  Behavior behavior(fake.robot);
  behavior.begin(0);
  TEST_ASSERT_TRUE(fake.outputs.enabled);
  ${run(10000)}
  TEST_ASSERT_FALSE(behavior.estopLatched());
}

static void test_sensor_failures_are_tolerated() {
  FakeRobot fake;
${sensors.map((s) => `  fake.${s}.ok = false;`).join("\n") || "  // (no sensors with failure modes)"}
  Behavior behavior(fake.robot);
  behavior.begin(0);
  ${run(2000)}
  TEST_ASSERT_FALSE(behavior.estopLatched());
}
${
  estops.length
    ? `
static void test_estop_latches_and_holds_motors_at_zero() {
  FakeRobot fake;
  Behavior behavior(fake.robot);
  behavior.begin(0);
  ${run(500)}
${motors.map((m) => `  fake.${m}.setSpeed(0.8f);`).join("\n")}
  fake.${estops[0]}.active = true;
  behavior.tick(505);
  TEST_ASSERT_TRUE(behavior.estopLatched());
  TEST_ASSERT_FALSE(fake.outputs.enabled);
${motors.map((m) => `  TEST_ASSERT_EQUAL_FLOAT(0.0f, fake.${m}.speed());`).join("\n")}
  // Releasing the button does not un-latch: a power cycle / reset is required.
  fake.${estops[0]}.active = false;
  for (uint32_t t = 510; t <= 3000; t += 5) behavior.tick(t);
  TEST_ASSERT_TRUE(behavior.estopLatched());
${motors.map((m) => `  TEST_ASSERT_EQUAL_FLOAT(0.0f, fake.${m}.speed());`).join("\n")}
}
`
    : ""
}
int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_runs_for_ten_seconds_without_estop);
  RUN_TEST(test_sensor_failures_are_tolerated);
${estops.length ? "  RUN_TEST(test_estop_latches_and_holds_motors_at_zero);\n" : ""}  return UNITY_END();
}
`;
}

function emitCustomTest(plan: FirmwarePlan): string {
  const firstDistance = plan.devices.find((d) => d.hal === "distance")?.name;
  const firstMotor = plan.devices.find((d) => d.hal === "motor")?.name;
  return `// Your scenario tests. This file is user-owned: RoboForge created it once and never overwrites it.
// Run with: pio test -e native -f test_custom
#include <unity.h>
#include "behavior.h"
#include "../test_behavior/fakes.h"

using rf::Behavior;
using rf::test::FakeRobot;

void setUp() {}
void tearDown() {}

static void test_example_scenario() {
  FakeRobot fake;
  Behavior behavior(fake.robot);
  behavior.begin(0);
${firstDistance ? `  fake.${firstDistance}.metres = 0.2f;  // obstacle close in front\n` : ""}  for (uint32_t t = 0; t <= 1000; t += 5) behavior.tick(t);
${firstMotor ? `  // Example assertion — adapt to your behavior:\n  // TEST_ASSERT_EQUAL_FLOAT(0.0f, fake.${firstMotor}.speed());\n` : ""}  TEST_ASSERT_FALSE(behavior.estopLatched());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_example_scenario);
  return UNITY_END();
}
`;
}
