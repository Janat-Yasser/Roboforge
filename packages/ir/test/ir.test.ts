import { describe, expect, it } from "vitest";
import { buildRobotIR, createFromTemplate, planAutoWire, resolveHardware } from "@roboforge/ir";
import { catalog, poweredEsp32, SpecBuilder } from "./helpers";

describe("hardware IR", () => {
  it("merges all ground pins of a component into one net", () => {
    const b = poweredEsp32();
    const hw = resolveHardware(b.spec, catalog);
    const grounds = hw.nets.filter((n) => n.kind === "ground");
    expect(grounds).toHaveLength(1);
    expect(grounds[0]!.name).toBe("GND");
  });

  it("derives pin functions and I2C buses from wiring", () => {
    const b = poweredEsp32();
    b.add("imu", "mpu6050-gy521");
    b.add("tof", "vl53l0x-breakout");
    b.autowire("imu").autowire("tof");
    const hw = resolveHardware(b.spec, catalog);
    const sda = hw.pinAssignments.find((a) => a.pin === "GPIO21")!;
    expect(sda.fn).toBe("i2c_sda");
    expect(sda.devices.map((d) => d.componentId).sort()).toEqual(["c_imu", "c_tof"]);
    expect(hw.i2cBuses).toHaveLength(1);
    expect(hw.i2cBuses[0]!.id).toBe("i2c0");
    expect(hw.i2cBuses[0]!.devices.map((d) => d.address!).sort((a, b) => a - b)).toEqual([0x29, 0x68]);
  });

  it("binds motors to driver channels and detects reversed wiring", () => {
    const b = poweredEsp32();
    b.add("drv", "tb6612fng-breakout");
    b.add("m", "dc-gearmotor-12v");
    b.autowire("drv");
    b.wire("m.M+", "drv.AO2").wire("m.M-", "drv.AO1");
    const hw = resolveHardware(b.spec, catalog);
    const m = hw.motors[0]!;
    expect(m.kind).toBe("hbridge");
    if (m.kind === "hbridge") {
      expect(m.channel).toBe("A");
      expect(m.reversedWiring).toBe(true);
      expect(m.in1 && m.in2 && m.pwm).toBeTruthy();
      expect(m.enable[0]!.drive).not.toBe(undefined);
    }
  });

  it("computes power loads through regulators", () => {
    const b = poweredEsp32();
    const hw = resolveHardware(b.spec, catalog);
    const batt = hw.power.find((p) => p.name === "battery.BAT+")!;
    const five = hw.power.find((p) => p.name === "buck.VOUT")!;
    expect(five.voltage).toBe(5);
    expect(five.loadTypicalMa).toBeGreaterThanOrEqual(80);
    // P_in = P_out / eff: 5 V * I / 0.85 / 7.4 V  (+ regulator quiescent)
    expect(batt.loadTypicalMa).toBeCloseTo((5 * five.loadTypicalMa) / 0.85 / 7.4 + 5, 0);
  });

  it("auto-wiring avoids reserved and strapping pins and reuses the I2C bus", () => {
    const b = poweredEsp32();
    b.add("drv", "tb6612fng-breakout");
    const plan = planAutoWire(b.spec, catalog, "c_drv");
    const esp = catalog.get("esp32-devkitc")!;
    for (const cmd of plan.commands) {
      if (cmd.type !== "connection.add" || cmd.connection.to.componentId !== "c_mcu") continue;
      const pin = esp.pins.find((p) => p.name === cmd.connection.to.pin)!;
      expect(pin.flags ?? []).not.toContain("reserved");
      expect(pin.flags ?? []).not.toContain("strapping");
    }
    expect(plan.skipped).toEqual([]);
  });
});

describe("behavior compiler", () => {
  it("compiles the obstacle avoidance template into fibers", () => {
    const spec = createFromTemplate("obstacle-avoider", catalog, "bot", "Bot");
    const ir = buildRobotIR(spec, catalog);
    expect(ir.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    expect(ir.behavior.fibers.map((f) => f.trigger.kind)).toEqual(["start", "estop"]);
    expect(ir.behavior.nodes.length).toBe(9);
    expect(ir.behavior.estopComponentIds).toHaveLength(1);
  });

  it("reports busy loops, unreachable nodes, unknown refs and creates child fibers", () => {
    const b = new SpecBuilder();
    b.apply([
      { type: "behavior.states.set", states: ["IDLE"] },
      { type: "behavior.node.add", node: { id: "s", kind: "event.start", position: { x: 0, y: 0 }, params: {} } },
      { type: "behavior.node.add", node: { id: "p", kind: "parallel", position: { x: 0, y: 0 }, params: { branches: 2 } } },
      { type: "behavior.node.add", node: { id: "l1", kind: "log", position: { x: 0, y: 0 }, params: { message: "a" } } },
      { type: "behavior.node.add", node: { id: "l2", kind: "log", position: { x: 0, y: 0 }, params: { message: "b" } } },
      { type: "behavior.node.add", node: { id: "orphan", kind: "delay", position: { x: 0, y: 0 }, params: { ms: 5 } } },
      { type: "behavior.node.add", node: { id: "bad", kind: "state.set", position: { x: 0, y: 0 }, params: { state: "MISSING" } } },
      { type: "behavior.edge.add", edge: { id: "e1", source: "s", sourcePort: "next", target: "p" } },
      { type: "behavior.edge.add", edge: { id: "e2", source: "p", sourcePort: "branch_1", target: "l1" } },
      { type: "behavior.edge.add", edge: { id: "e3", source: "p", sourcePort: "branch_2", target: "l2" } },
      { type: "behavior.edge.add", edge: { id: "e4", source: "l2", sourcePort: "next", target: "l2" } },
    ]);
    const ir = buildRobotIR(b.spec, catalog);
    const codes = ir.diagnostics.map((d) => d.code);
    expect(codes).toContain("BEHAVIOR_BUSY_LOOP");
    expect(codes).toContain("BEHAVIOR_UNREACHABLE");
    expect(codes).toContain("BEHAVIOR_UNKNOWN_STATE");
    expect(ir.behavior.fibers.filter((f) => f.trigger.kind === "child")).toHaveLength(2);
  });
});
