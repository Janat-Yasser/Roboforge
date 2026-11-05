// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { CanNetwork, ControllerPinRef, I2cBus, Net, PinAssignment, ResolvedComponent, UartLink } from "../types";
import { controllerPinFor } from "./pins";

function numberConfig(rc: ResolvedComponent, key: string): number | undefined {
  const v = rc.instance.config[key];
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = v.trim().toLowerCase().startsWith("0x") ? parseInt(v, 16) : Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function i2cAddressOf(rc: ResolvedComponent): number | undefined {
  return numberConfig(rc, "i2cAddress") ?? rc.def.i2c?.defaultAddress;
}

export function canNodeIdOf(rc: ResolvedComponent): number | undefined {
  return numberConfig(rc, "canId") ?? rc.def.can?.defaultNodeId;
}

/**
 * Groups I²C devices into buses keyed by the controller SDA/SCL pin pair and allocates hardware
 * peripheral instances (fixed-bus pins keep their bus; matrix-routable pins get a free one).
 */
export function computeI2cBuses(
  components: ResolvedComponent[],
  controller: ResolvedComponent | undefined,
  netByPin: Map<string, Net>,
  assignments: PinAssignment[],
): I2cBus[] {
  const groups = new Map<string, { sda?: ControllerPinRef; scl?: ControllerPinRef; devices: I2cBus["devices"] }>();
  for (const rc of components) {
    const sdaPin = rc.def.pins.find((p) => p.type === "i2c_sda");
    const sclPin = rc.def.pins.find((p) => p.type === "i2c_scl");
    if (!sdaPin || !sclPin || rc === controller) continue;
    const sda = controllerPinFor(controller, netByPin, rc.instance.id, sdaPin.name);
    const scl = controllerPinFor(controller, netByPin, rc.instance.id, sclPin.name);
    if (!sda && !scl) continue;
    const key = `${sda?.pin ?? "?"}|${scl?.pin ?? "?"}`;
    const g = groups.get(key) ?? { sda, scl, devices: [] };
    g.devices.push({ componentId: rc.instance.id, address: i2cAddressOf(rc), complete: !!sda && !!scl });
    groups.set(key, g);
  }

  const ctrl = controller?.def.controller;
  const defaults = ctrl?.defaultBuses.i2c ?? [];
  const available = [...(ctrl?.peripherals.i2c ?? [])];
  const used = new Set<string>();
  const buses: I2cBus[] = [];
  const fixedBus = (pin: ControllerPinRef | undefined) => {
    const b = assignments.find((a) => a.pin === pin?.pin)?.bus;
    return b && b !== "*" ? b : undefined;
  };

  // Deterministic order: default bus pairs first, then by pin name.
  const entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  const pending: typeof entries = [];
  for (const entry of entries) {
    const [, g] = entry;
    const fixed = fixedBus(g.sda) ?? fixedBus(g.scl);
    const preferred = defaults.find((d) => d.sda === g.sda?.pin && d.scl === g.scl?.pin)?.bus;
    const id = fixed ?? preferred;
    if (id && !used.has(id)) {
      used.add(id);
      buses.push({ id, sda: g.sda, scl: g.scl, devices: g.devices });
    } else pending.push(entry);
  }
  for (const [, g] of pending) {
    const id = available.find((b) => !used.has(b)) ?? `i2c_extra${buses.length}`;
    used.add(id);
    buses.push({ id, sda: g.sda, scl: g.scl, devices: g.devices });
  }
  return buses.sort((a, b) => a.id.localeCompare(b.id));
}

/** CAN networks are the CANH nets; nodes are components with a CAN node id on that net. */
export function computeCanNetworks(
  controller: ResolvedComponent | undefined,
  nets: Net[],
  netByPin: Map<string, Net>,
  byId: Map<string, ResolvedComponent>,
): CanNetwork[] {
  const out: CanNetwork[] = [];
  let index = 0;
  for (const net of nets) {
    if (net.kind !== "can_h") continue;
    const members = [...new Set(net.pins.map((p) => p.componentId))].map((id) => byId.get(id)).filter((x): x is ResolvedComponent => !!x);
    const transceiver = members.find((m) => m.def.pins.some((p) => p.type === "can_txd"));
    let controllerTx: ControllerPinRef | undefined;
    let controllerRx: ControllerPinRef | undefined;
    if (transceiver) {
      const txd = transceiver.def.pins.find((p) => p.type === "can_txd")!;
      const rxd = transceiver.def.pins.find((p) => p.type === "can_rxd");
      controllerTx = controllerPinFor(controller, netByPin, transceiver.instance.id, txd.name);
      controllerRx = rxd ? controllerPinFor(controller, netByPin, transceiver.instance.id, rxd.name) : undefined;
    }
    const canLNet = members
      .flatMap((m) => m.def.pins.filter((p) => p.type === "can_l").map((p) => netByPin.get(`${m.instance.id}:${p.name}`)))
      .find((n) => n);
    const bitrateRaw = transceiver?.instance.config["bitrate"];
    out.push({
      id: controller?.def.controller?.peripherals.can[index] ?? `can${index}`,
      netIds: [net.id, ...(canLNet ? [canLNet.id] : [])],
      transceiverId: transceiver?.instance.id,
      controllerTx,
      controllerRx,
      bitrate: typeof bitrateRaw === "number" ? bitrateRaw : 500000,
      nodes: members
        .filter((m) => m.def.can)
        .map((m) => ({ componentId: m.instance.id, nodeId: canNodeIdOf(m) ?? 0 })),
    });
    index++;
  }
  return out;
}

export function computeUartLinks(
  components: ResolvedComponent[],
  controller: ResolvedComponent | undefined,
  netByPin: Map<string, Net>,
  assignments: PinAssignment[],
): UartLink[] {
  const out: UartLink[] = [];
  for (const rc of components) {
    if (rc === controller) continue;
    const tx = rc.def.pins.find((p) => p.type === "uart_tx");
    const rx = rc.def.pins.find((p) => p.type === "uart_rx");
    if (!tx && !rx) continue;
    // Device TX → controller RX and vice versa.
    const controllerRx = tx ? controllerPinFor(controller, netByPin, rc.instance.id, tx.name) : undefined;
    const controllerTx = rx ? controllerPinFor(controller, netByPin, rc.instance.id, rx.name) : undefined;
    if (!controllerRx && !controllerTx) continue;
    const bus = [controllerRx, controllerTx]
      .map((p) => assignments.find((a) => a.pin === p?.pin)?.bus)
      .find((b) => b && b !== "*");
    out.push({ bus, componentId: rc.instance.id, controllerTx, controllerRx });
  }
  // Allocate matrix-routable UARTs.
  const free = [...(controller?.def.controller?.peripherals.uart ?? [])].filter((u) => !out.some((l) => l.bus === u));
  for (const link of out) if (!link.bus) link.bus = free.shift();
  return out;
}
