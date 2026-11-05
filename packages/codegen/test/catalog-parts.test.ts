import { describe, expect, it } from "vitest";
import { analyzeProject, generateProject } from "@roboforge/codegen";
import { catalog, SpecBuilder } from "../../ir/test/helpers";

/**
 * Every new board, motor and sensor should wire up automatically and produce firmware with no
 * errors, the same way the template robot does.
 */
function robot(mcu: string, motor: string, sensor: string, battery = "lipo-2s-1000", reg = "mp1584-buck") {
  const b = new SpecBuilder();
  b.add("battery", battery);
  b.add("buck", reg, { outputVoltage: 5 });
  b.add("mcu", mcu);
  b.add("driver", "l298n-module");
  b.add("left", motor);
  b.add("right", motor);
  b.add("range", sensor);
  b.add("start", "ttp223-touch");
  for (const k of ["buck", "mcu", "driver", "left", "right", "range", "start"]) b.autowire(k);
  b.apply([{ type: "robot.setDrive", drive: { kind: "differential", leftMotors: ["c_left"], rightMotors: ["c_right"], wheelRadiusM: 0.03, trackWidthM: 0.15, maxSpeedMps: 0.4 } }]);
  return b.spec;
}

describe("added catalog parts", () => {
  const cases: [string, string, string, string?][] = [
    ["arduino-nano", "n20-micro-gearmotor-6v", "us-100"],
    ["arduino-mega-2560", "jga25-370-12v", "jsn-sr04t"],
    ["esp32-devkitc", "n20-micro-gearmotor-6v", "us-100", "liion-2s-18650-2600"],
  ];
  for (const [mcu, motor, sensor, battery] of cases) {
    it(`${mcu} + ${motor} + ${sensor} validates and generates firmware`, () => {
      const spec = robot(mcu, motor, sensor, battery);
      const a = analyzeProject(spec, catalog);
      const errors = a.report.diagnostics.filter((d) => d.severity === "error");
      expect(errors.map((e) => e.message)).toEqual([]);
      const files = generateProject(spec, catalog).files.map((f) => f.path);
      expect(files.some((p) => p.endsWith("platformio.ini"))).toBe(true);
    });
  }

  it("AMS1117 feeds a 3.3 V sensor from 5 V", () => {
    const b = new SpecBuilder();
    b.add("battery", "lipo-2s-2200");
    b.add("buck", "lm2596-buck", { outputVoltage: 5 });
    b.add("ldo", "ams1117-3v3");
    b.add("mcu", "esp32-devkitc");
    b.add("tof", "vl53l0x-breakout");
    for (const k of ["buck", "ldo", "mcu", "tof"]) b.autowire(k);
    const errors = analyzeProject(b.spec, catalog).report.diagnostics.filter((d) => d.severity === "error");
    expect(errors.map((e) => e.message)).toEqual([]);
  });
});
