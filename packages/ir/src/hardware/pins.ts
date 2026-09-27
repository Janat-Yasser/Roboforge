import type { ControllerFunction, PinDef, PinType } from "@roboforge/spec";
import type { ControllerPinRef, Net, PinAssignment, ResolvedComponent } from "../types";

/** Which controller function a device pin needs from the controller pin it is wired to. */
export const REQUIRED_CONTROLLER_FN: Partial<Record<PinType, ControllerFunction>> = {
  digital_in: "gpio_out",
  digital_out: "gpio_in",
  pwm_in: "pwm",
  analog_out: "adc",
  i2c_sda: "i2c_sda",
  i2c_scl: "i2c_scl",
  spi_sck: "spi_sck",
  spi_mosi: "spi_mosi",
  spi_miso: "spi_miso",
  spi_cs: "gpio_out",
  uart_tx: "uart_rx",
  uart_rx: "uart_tx",
  can_txd: "can_tx",
  can_rxd: "can_rx",
};

/** Functions where several devices may legitimately share one controller pin. */
export const SHAREABLE_FNS = new Set<ControllerFunction>(["i2c_sda", "i2c_scl", "spi_sck", "spi_mosi", "spi_miso"]);

export function pinSupports(pin: PinDef, fn: ControllerFunction): { ok: boolean; bus: string | undefined } {
  const f = pin.functions?.find((x) => x.fn === fn);
  return { ok: !!f, bus: f?.bus };
}

/**
 * Derives the role of each wired controller pin from the device pins on the same net.
 * This is the "pin assignment" table — it is never stored, always derived from wiring.
 */
export function computePinAssignments(controller: ResolvedComponent | undefined, nets: Net[]): PinAssignment[] {
  if (!controller) return [];
  const out: PinAssignment[] = [];
  const cid = controller.instance.id;
  for (const net of nets) {
    if (net.kind !== "logic" && net.kind !== "mixed") continue;
    const ctrlPins = net.pins.filter((p) => p.componentId === cid && p.def?.type === "gpio");
    if (!ctrlPins.length) continue;
    const devices = net.pins
      .filter((p) => p.componentId !== cid && p.def)
      .map((p) => ({ componentId: p.componentId, pin: p.pin, type: p.def!.type }));
    const requested = [...new Set(devices.map((d) => REQUIRED_CONTROLLER_FN[d.type]).filter((x): x is ControllerFunction => !!x))];
    for (const cp of ctrlPins) {
      const fn = requested.length === 1 ? requested[0] : undefined;
      const support = fn ? pinSupports(cp.def!, fn) : { ok: true, bus: undefined };
      out.push({
        pin: cp.pin,
        codeRef: cp.def?.codeRef,
        netId: net.id,
        fn,
        requestedFns: requested,
        supported: support.ok,
        bus: support.bus,
        devices,
      });
    }
  }
  return out.sort((a, b) => naturalCompare(a.pin, b.pin));
}

export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Finds the controller pin wired to a device pin (directly or via a shared net). */
export function controllerPinFor(
  controller: ResolvedComponent | undefined,
  netByPin: Map<string, Net>,
  componentId: string,
  pin: string,
): ControllerPinRef | undefined {
  if (!controller) return undefined;
  const net = netByPin.get(`${componentId}:${pin}`);
  if (!net) return undefined;
  const cp = net.pins.find((p) => p.componentId === controller.instance.id && p.def?.type === "gpio");
  if (!cp) return undefined;
  return { pin: cp.pin, codeRef: cp.def?.codeRef ?? cp.pin };
}
