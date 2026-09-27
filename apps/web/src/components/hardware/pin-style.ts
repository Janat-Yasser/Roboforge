import type { ComponentCategory, PinDef, PinType } from "@roboforge/spec";

export type SignalClass = "power" | "ground" | "i2c" | "uart" | "can" | "motor" | "pwm" | "spi" | "logic" | "other";

export function signalClass(type: PinType | undefined, fn?: string): SignalClass {
  if (fn) {
    if (fn.startsWith("i2c")) return "i2c";
    if (fn.startsWith("uart")) return "uart";
    if (fn.startsWith("can")) return "can";
    if (fn.startsWith("spi")) return "spi";
    if (fn === "pwm") return "pwm";
    return "logic";
  }
  switch (type) {
    case "power_in":
    case "power_out":
      return "power";
    case "ground":
      return "ground";
    case "i2c_sda":
    case "i2c_scl":
      return "i2c";
    case "uart_tx":
    case "uart_rx":
      return "uart";
    case "can_h":
    case "can_l":
    case "can_txd":
    case "can_rxd":
      return "can";
    case "motor_out":
    case "motor_terminal":
      return "motor";
    case "pwm_in":
      return "pwm";
    case "spi_sck":
    case "spi_mosi":
    case "spi_miso":
    case "spi_cs":
      return "spi";
    case "gpio":
    case "digital_in":
    case "digital_out":
    case "analog_out":
      return "logic";
    default:
      return "other";
  }
}

export const SIGNAL_COLOR: Record<SignalClass, string> = {
  power: "var(--color-sig-power)",
  ground: "var(--color-sig-ground)",
  i2c: "var(--color-sig-i2c)",
  uart: "var(--color-sig-uart)",
  can: "var(--color-sig-can)",
  motor: "var(--color-sig-motor)",
  pwm: "var(--color-sig-pwm)",
  spi: "var(--color-sig-logic)",
  logic: "var(--color-sig-logic)",
  other: "var(--color-faint)",
};

export const CATEGORY_COLOR: Record<ComponentCategory, string> = {
  controller: "#4f9cf9",
  sbc: "#4f9cf9",
  motor: "#e879c6",
  motor_driver: "#c084fc",
  servo: "#e879c6",
  sensor: "#3cc6b8",
  power: "#ef5b57",
  regulator: "#f2a541",
  communication: "#f2a541",
  switch: "#e3a92b",
  connector: "#8a98ab",
};

const RIGHT_TYPES = new Set<PinType>(["power_out", "digital_out", "analog_out", "uart_tx", "motor_out", "can_h", "can_l", "can_rxd", "ethernet", "usb"]);

/** Splits pins into left/right columns for the canvas node. */
export function pinColumns(pins: PinDef[], isController: boolean): [PinDef[], PinDef[]] {
  if (isController) {
    const half = Math.ceil(pins.length / 2);
    return [pins.slice(0, half), pins.slice(half)];
  }
  const left = pins.filter((p) => !RIGHT_TYPES.has(p.type));
  const right = pins.filter((p) => RIGHT_TYPES.has(p.type));
  return [left, right];
}
