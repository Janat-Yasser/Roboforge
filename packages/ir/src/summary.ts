import type { RobotIR } from "./types";

/** JSON-serializable view of the IR for APIs, the UI and generated hardware docs. */
export interface IRSummary {
  controller: { id: string; name: string; catalogId: string; platform: string | undefined } | null;
  pinAssignments: {
    pin: string;
    codeRef: string | undefined;
    fn: string | undefined;
    bus: string | undefined;
    supported: boolean;
    devices: { component: string; componentId: string; pin: string }[];
  }[];
  i2cBuses: { id: string; sda?: string; scl?: string; devices: { component: string; componentId: string; address?: string }[] }[];
  canNetworks: { id: string; bitrate?: number; tx?: string; rx?: string; nodes: { component: string; componentId: string; nodeId: number }[] }[];
  uartLinks: { bus?: string; component: string; tx?: string; rx?: string }[];
  power: {
    net: string;
    netId: string;
    voltage?: number;
    maxVoltage?: number;
    loadTypicalMa: number;
    loadPeakMa: number;
    sources: { component: string; pin: string; maxCurrentMa?: number }[];
    sinks: { component: string; pin: string; typicalMa: number; peakMa: number }[];
  }[];
  motors: { motor: string; motorId: string; binding: string }[];
  nets: { id: string; name: string; kind: string; pins: string[] }[];
  behavior: { fibers: number; nodes: number; states: string[] };
}

const hex = (n: number | undefined) => (n === undefined ? undefined : `0x${n.toString(16).padStart(2, "0").toUpperCase()}`);

export function summarizeIR(ir: RobotIR): IRSummary {
  const hw = ir.hardware;
  const nm = (id: string) => hw.byId.get(id)?.instance.name ?? id;
  return {
    controller: hw.controller
      ? {
          id: hw.controller.instance.id,
          name: hw.controller.instance.name,
          catalogId: hw.controller.def.id,
          platform: hw.controller.def.controller?.platform,
        }
      : null,
    pinAssignments: hw.pinAssignments.map((a) => ({
      pin: a.pin,
      codeRef: a.codeRef,
      fn: a.fn,
      bus: a.bus,
      supported: a.supported,
      devices: a.devices.map((d) => ({ component: nm(d.componentId), componentId: d.componentId, pin: d.pin })),
    })),
    i2cBuses: hw.i2cBuses.map((b) => ({
      id: b.id,
      sda: b.sda?.pin,
      scl: b.scl?.pin,
      devices: b.devices.map((d) => ({ component: nm(d.componentId), componentId: d.componentId, address: hex(d.address) })),
    })),
    canNetworks: hw.canNetworks.map((n) => ({
      id: n.id,
      bitrate: n.bitrate,
      tx: n.controllerTx?.pin,
      rx: n.controllerRx?.pin,
      nodes: n.nodes.map((x) => ({ component: nm(x.componentId), componentId: x.componentId, nodeId: x.nodeId })),
    })),
    uartLinks: hw.uartLinks.map((u) => ({ bus: u.bus, component: nm(u.componentId), tx: u.controllerTx?.pin, rx: u.controllerRx?.pin })),
    power: hw.power.map((p) => ({
      net: p.name,
      netId: p.netId,
      voltage: p.voltage,
      maxVoltage: p.maxVoltage,
      loadTypicalMa: p.loadTypicalMa,
      loadPeakMa: p.loadPeakMa,
      sources: p.sources.map((s) => ({ component: nm(s.componentId), pin: s.pin, maxCurrentMa: s.maxCurrentMa })),
      sinks: p.sinks.map((s) => ({ component: nm(s.componentId), pin: s.pin, typicalMa: s.typicalMa, peakMa: s.peakMa })),
    })),
    motors: hw.motors.map((m) => ({
      motor: nm(m.motorId),
      motorId: m.motorId,
      binding:
        m.kind === "hbridge"
          ? `${nm(m.driverId)} channel ${m.channel}`
          : m.kind === "can"
            ? `${nm(m.driverId)} CAN node ${m.nodeId}`
            : `unbound: ${m.reason}`,
    })),
    nets: hw.nets.map((n) => ({ id: n.id, name: n.name, kind: n.kind, pins: n.pins.map((p) => `${nm(p.componentId)}.${p.pin}`) })),
    behavior: { fibers: ir.behavior.fibers.length, nodes: ir.behavior.nodes.length, states: ir.behavior.states },
  };
}
