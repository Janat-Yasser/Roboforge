// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { PinDef } from "@roboforge/spec";
import type { HardwareIR, Net, ResolvedComponent } from "@roboforge/ir";

export const nameOf = (hw: HardwareIR, id: string) => hw.byId.get(id)?.instance.name ?? id;

export const fmtV = (v: number | undefined) => (v === undefined ? "?" : `${Number(v.toFixed(2))} V`);

export const fmtMa = (ma: number) => (ma >= 1000 ? `${(ma / 1000).toFixed(2)} A` : `${Math.round(ma)} mA`);

export function netOf(hw: HardwareIR, componentId: string, pin: string): Net | undefined {
  return hw.netByPin.get(`${componentId}:${pin}`);
}

export function isConnected(hw: HardwareIR, componentId: string, pin: string): boolean {
  return hw.netByPin.has(`${componentId}:${pin}`);
}

export function pinsOfType(rc: ResolvedComponent, ...types: PinDef["type"][]): PinDef[] {
  return rc.def.pins.filter((p) => types.includes(p.type));
}

/** Voltage present on a power net (first source), if any. */
export function netVoltage(hw: HardwareIR, net: Net | undefined): number | undefined {
  if (!net) return undefined;
  return hw.power.find((p) => p.netId === net.id)?.voltage;
}

export function netConnectionIds(hw: HardwareIR, componentId: string, pin: string): string[] {
  return netOf(hw, componentId, pin)?.connectionIds ?? [];
}
