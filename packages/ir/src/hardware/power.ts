// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { PinDef } from "@roboforge/spec";
import type { MotorBinding, Net, PowerNet, PowerSink, PowerSource, ResolvedComponent } from "../types";

interface Ctx {
  byId: Map<string, ResolvedComponent>;
  netByPin: Map<string, Net>;
  motors: MotorBinding[];
}

export function sourceVoltage(rc: ResolvedComponent, pin: PinDef): { voltage?: number; maxVoltage?: number } {
  if (rc.def.power?.kind === "battery") return { voltage: rc.def.power.nominalV, maxVoltage: rc.def.power.fullV };
  if (pin.outputVoltageConfigKey) {
    const raw = rc.instance.config[pin.outputVoltageConfigKey];
    const field = rc.def.config.find((f) => f.key === pin.outputVoltageConfigKey);
    const v = typeof raw === "number" ? raw : typeof field?.default === "number" ? field.default : undefined;
    return { voltage: v, maxVoltage: v };
  }
  return { voltage: pin.outputVoltage, maxVoltage: pin.outputVoltage };
}

function sourceKind(rc: ResolvedComponent): PowerSource["kind"] {
  if (rc.def.power?.kind === "battery") return "battery";
  if (rc.def.power?.kind === "regulator") return "regulator";
  if (rc.def.category === "controller" || rc.def.category === "sbc") return "board";
  return "other";
}

/**
 * Computes the power tree: per power net, its sources, the resulting voltage and the current
 * demanded by every sink. Regulators and boards propagate their downstream load to their inputs.
 */
export function computePower(nets: Net[], ctx: Ctx): PowerNet[] {
  const memo = new Map<string, { typ: number; peak: number }>();
  const inProgress = new Set<string>();

  const netVoltage = (net: Net | undefined): number | undefined => {
    if (!net) return undefined;
    for (const p of net.pins) {
      if (p.def?.type !== "power_out") continue;
      const rc = ctx.byId.get(p.componentId);
      if (rc) return sourceVoltage(rc, p.def).voltage;
    }
    return undefined;
  };

  const netLoad = (net: Net): { typ: number; peak: number } => {
    const cached = memo.get(net.id);
    if (cached) return cached;
    if (inProgress.has(net.id)) return { typ: 0, peak: 0 }; // cycle guard
    inProgress.add(net.id);
    let typ = 0;
    let peak = 0;
    for (const p of net.pins) {
      if (p.def?.type !== "power_in") continue;
      const d = sinkDemand(p.componentId, p.def);
      typ += d.typ;
      peak += d.peak;
    }
    inProgress.delete(net.id);
    const r = { typ, peak };
    memo.set(net.id, r);
    return r;
  };

  const outputsLoad = (rc: ResolvedComponent): { typ: number; peak: number; watts: number; wattsPeak: number } => {
    let typ = 0;
    let peak = 0;
    let watts = 0;
    let wattsPeak = 0;
    for (const pin of rc.def.pins.filter((x) => x.type === "power_out")) {
      const net = ctx.netByPin.get(`${rc.instance.id}:${pin.name}`);
      if (!net) continue;
      const l = netLoad(net);
      const v = sourceVoltage(rc, pin).voltage ?? 0;
      typ += l.typ;
      peak += l.peak;
      watts += (l.typ / 1000) * v;
      wattsPeak += (l.peak / 1000) * v;
    }
    return { typ, peak, watts, wattsPeak };
  };

  const sinkDemand = (componentId: string, pin: PinDef): { typ: number; peak: number } => {
    const rc = ctx.byId.get(componentId);
    if (!rc) return { typ: 0, peak: 0 };
    const def = rc.def;

    // Switching regulator input: P_in = P_out / efficiency.
    if (def.power?.kind === "regulator" && def.power.inputPin === pin.name) {
      const out = outputsLoad(rc);
      const vin = netVoltage(ctx.netByPin.get(`${componentId}:${pin.name}`));
      const eff = def.power.efficiency;
      const own = def.electrical.typicalCurrentMa;
      if (!vin) return { typ: out.typ + own, peak: out.peak + own };
      if (def.power.topology === "linear") return { typ: out.typ + own, peak: out.peak + own };
      return {
        typ: (out.watts / eff / vin) * 1000 + own,
        peak: (out.wattsPeak / eff / vin) * 1000 + own,
      };
    }

    // Motor supply pin of a driver: sum of motors bound to channels powered by this pin.
    const channels = def.driverChannels?.filter((c) => c.motorSupplyPin === pin.name) ?? [];
    if (channels.length) {
      let typ = 0;
      let peak = 0;
      for (const m of ctx.motors) {
        if (m.kind !== "hbridge" || m.driverId !== componentId) continue;
        if (!channels.some((c) => c.id === m.channel)) continue;
        const motor = ctx.byId.get(m.motorId)?.def.motor;
        typ += motor?.noLoadCurrentMa ?? 0;
        peak += motor?.stallCurrentMa ?? 0;
      }
      return { typ, peak };
    }

    const powerIns = def.pins.filter((p) => p.type === "power_in");
    const isPrimary = powerIns[0]?.name === pin.name;

    // Boards with on-board regulators: their power input also carries the load of their outputs.
    if ((def.category === "controller" || def.category === "sbc") && isPrimary) {
      const out = outputsLoad(rc);
      return {
        typ: def.electrical.typicalCurrentMa + out.typ,
        peak: (def.electrical.peakCurrentMa ?? def.electrical.typicalCurrentMa) + out.peak,
      };
    }

    if (pin.currentMa !== undefined) {
      return { typ: pin.currentMa, peak: pin.currentMa };
    }
    if (!isPrimary) return { typ: 0, peak: 0 };
    const typ = def.electrical.typicalCurrentMa;
    const peak = def.servo?.stallCurrentMa ?? def.electrical.peakCurrentMa ?? typ;
    return { typ, peak };
  };

  const out: PowerNet[] = [];
  for (const net of nets) {
    if (net.kind !== "power" && net.kind !== "mixed") continue;
    const sources: PowerSource[] = [];
    const sinks: PowerSink[] = [];
    for (const p of net.pins) {
      const rc = ctx.byId.get(p.componentId);
      if (!rc || !p.def) continue;
      if (p.def.type === "power_out") {
        const v = sourceVoltage(rc, p.def);
        sources.push({
          componentId: p.componentId,
          pin: p.pin,
          kind: sourceKind(rc),
          voltage: v.voltage,
          maxVoltage: v.maxVoltage,
          maxCurrentMa: p.def.maxCurrentMa ?? (rc.def.power?.kind === "battery" ? rc.def.power.maxDischargeMa : undefined),
        });
      } else if (p.def.type === "power_in") {
        const d = sinkDemand(p.componentId, p.def);
        sinks.push({ componentId: p.componentId, pin: p.pin, typicalMa: round(d.typ), peakMa: round(d.peak), range: p.def.voltage });
      }
    }
    const load = netLoad(net);
    out.push({
      netId: net.id,
      name: net.name,
      sources,
      sinks,
      voltage: sources[0]?.voltage,
      maxVoltage: sources.reduce<number | undefined>((m, s) => (s.maxVoltage !== undefined ? Math.max(m ?? 0, s.maxVoltage) : m), undefined),
      loadTypicalMa: round(load.typ),
      loadPeakMa: round(load.peak),
    });
  }
  return out;
}

const round = (x: number) => Math.round(x * 10) / 10;
