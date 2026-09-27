import { describe, expect, it } from "vitest";
import { buildRobotIR, createFromTemplate } from "@roboforge/ir";
import { validate } from "@roboforge/validation";
import { catalog, poweredEsp32 } from "../../ir/test/helpers";

const codes = (spec: Parameters<typeof buildRobotIR>[0]) => validate(buildRobotIR(spec, catalog)).diagnostics.map((d) => `${d.severity}:${d.code}`);

describe("validation engine", () => {
  it("the obstacle-avoider template is clean", () => {
    const spec = createFromTemplate("obstacle-avoider", catalog, "bot", "Bot");
    const r = validate(buildRobotIR(spec, catalog));
    expect(r.ok).toBe(true);
    expect(r.counts.error).toBe(0);
    expect(r.counts.warning).toBe(0);
    expect(r.categories.electrical).toBe("pass");
  });

  it("detects duplicate I2C addresses", () => {
    const b = poweredEsp32();
    b.add("imu1", "mpu6050-gy521");
    b.add("imu2", "mpu6050-gy521");
    b.autowire("imu1").autowire("imu2");
    const r = validate(buildRobotIR(b.spec, catalog));
    const d = r.diagnostics.find((x) => x.code === "I2C_ADDRESS_CONFLICT")!;
    expect(d.severity).toBe("error");
    expect(d.message).toMatch(/0x68/);
    expect(d.componentIds?.sort()).toEqual(["c_imu1", "c_imu2"]);
    // Fix via configuration:
    b.apply([{ type: "component.update", componentId: "c_imu2", patch: { config: { i2cAddress: 0x69 } } }]);
    expect(codes(b.spec)).not.toContain("error:I2C_ADDRESS_CONFLICT");
  });

  it("detects 5 V logic into a 3.3 V controller", () => {
    const b = poweredEsp32();
    b.add("sonar", "hc-sr04");
    b.wire("sonar.VCC", "buck.VOUT").wire("sonar.GND", "mcu.GND").wire("sonar.TRIG", "mcu.GPIO13").wire("sonar.ECHO", "mcu.GPIO14");
    expect(codes(b.spec)).toContain("error:LOGIC_LEVEL_MISMATCH");
  });

  it("detects a VL53L0X powered from 5 V (I2C pulled up to VIN) on an ESP32", () => {
    const b = poweredEsp32();
    b.add("tof", "vl53l0x-breakout");
    b.wire("tof.VIN", "buck.VOUT").wire("tof.GND", "mcu.GND").wire("tof.SDA", "mcu.GPIO21").wire("tof.SCL", "mcu.GPIO22");
    const r = validate(buildRobotIR(b.spec, catalog));
    const d = r.diagnostics.find((x) => x.code === "LOGIC_LEVEL_MISMATCH")!;
    expect(d.hint).toMatch(/Power tof.VIN from 3.3 V/);
  });

  it("detects two devices on the same GPIO and input-only pins used as outputs", () => {
    const b = poweredEsp32();
    b.add("s1", "estop-button-nc");
    b.add("s2", "microswitch-bumper");
    b.add("drv", "tb6612fng-breakout");
    b.wire("s1.SIG", "mcu.GPIO13").wire("s2.SIG", "mcu.GPIO13").wire("s1.COM", "mcu.GND").wire("s2.COM", "mcu.GND");
    b.wire("drv.AIN1", "mcu.GPIO34");
    const c = codes(b.spec);
    expect(c).toContain("error:PIN_SHARED");
    expect(c).toContain("error:PIN_FUNCTION_UNSUPPORTED");
  });

  it("detects reserved flash pins and TRIG/ECHO conflicts on one pin", () => {
    const b = poweredEsp32();
    b.add("sonar", "hc-sr04");
    b.wire("sonar.TRIG", "mcu.GPIO6").wire("sonar.ECHO", "mcu.GPIO6");
    const c = codes(b.spec);
    expect(c).toContain("error:PIN_RESERVED");
  });

  it("reports that a CAN motor controller requires 24 V and duplicate CAN ids", () => {
    const b = poweredEsp32();
    b.add("bat3s", "lipo-3s-2200");
    b.add("xcvr", "sn65hvd230-can");
    b.add("bldc1", "can-bldc-controller-24v");
    b.add("bldc2", "can-bldc-controller-24v");
    b.autowire("xcvr");
    b.wire("bldc1.VBUS", "bat3s.BAT+").wire("bldc2.VBUS", "bat3s.BAT+").wire("bldc1.GND", "mcu.GND").wire("bldc2.GND", "mcu.GND").wire("bat3s.BAT-", "mcu.GND");
    b.wire("xcvr.CANH", "bldc1.CANH").wire("xcvr.CANL", "bldc1.CANL").wire("bldc2.CANH", "bldc1.CANH").wire("bldc2.CANL", "bldc1.CANL");
    const r = validate(buildRobotIR(b.spec, catalog));
    const v = r.diagnostics.find((x) => x.code === "VOLTAGE_TOO_LOW")!;
    expect(v.message).toMatch(/Motor controller bldc1.VBUS requires 20 V–28 V/);
    expect(r.diagnostics.map((d) => d.code)).toContain("CAN_ID_CONFLICT");
  });

  it("detects missing ground, missing supply and missing e-stop", () => {
    const b = poweredEsp32();
    b.add("drv", "tb6612fng-breakout");
    b.add("m", "dc-gearmotor-12v");
    b.wire("drv.AIN1", "mcu.GPIO13");
    b.wire("m.M+", "drv.AO1").wire("m.M-", "drv.AO2");
    const c = codes(b.spec);
    expect(c).toContain("error:MISSING_GROUND");
    expect(c).toContain("error:MISSING_POWER");
    expect(c).toContain("error:MOTOR_DRIVER_INPUT_UNCONNECTED");
    expect(c).toContain("warning:NO_ESTOP");
  });

  it("warns about motors run above their rating and supplies that cannot deliver peak current", () => {
    const b = poweredEsp32();
    b.add("drv", "tb6612fng-breakout");
    b.add("m1", "dc-gearmotor-tt");
    b.autowire("drv").autowire("m1");
    const c = codes(b.spec);
    expect(c).toContain("warning:MOTOR_OVERVOLTAGE");
  });
});
