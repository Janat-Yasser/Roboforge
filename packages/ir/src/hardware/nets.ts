import { pinKey, type PinType, type RobotSpec } from "@roboforge/spec";
import type { Net, NetKind, NetPin, ResolvedComponent } from "../types";

export function pinClass(type: PinType | undefined): NetKind {
  switch (type) {
    case "power_in":
    case "power_out":
      return "power";
    case "ground":
      return "ground";
    case "motor_out":
    case "motor_terminal":
      return "motor";
    case "can_h":
      return "can_h";
    case "can_l":
      return "can_l";
    case "ethernet":
      return "ethernet";
    case "usb":
      return "usb";
    case "nc":
      return "nc";
    default:
      return "logic";
  }
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (p === undefined) {
      this.parent.set(x, x);
      return x;
    }
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root); // path compression
    return root;
  }
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb);
  }
}

const NAME_PRIORITY: Partial<Record<PinType, number>> = {
  power_out: 0,
  gpio: 1,
  ground: 2,
};

/**
 * Builds electrical nets from point-to-point connections. Every connected pin belongs to exactly
 * one net; pins with no connections are not part of any net.
 */
export function buildNets(spec: RobotSpec, byId: Map<string, ResolvedComponent>): { nets: Net[]; netByPin: Map<string, Net> } {
  const uf = new UnionFind();
  const connsByRoot = new Map<string, string[]>();
  for (const w of spec.connections) uf.union(pinKey(w.from), pinKey(w.to));
  // All ground pins of one component are internally common: merge their nets.
  const groundByComponent = new Map<string, string>();
  for (const w of spec.connections) {
    for (const end of [w.from, w.to]) {
      const def = byId.get(end.componentId)?.def.pins.find((p) => p.name === end.pin);
      if (def?.type !== "ground") continue;
      const first = groundByComponent.get(end.componentId);
      if (first) uf.union(first, pinKey(end));
      else groundByComponent.set(end.componentId, pinKey(end));
    }
  }

  const groups = new Map<string, NetPin[]>();
  const seen = new Set<string>();
  const addPin = (componentId: string, pin: string) => {
    const key = `${componentId}:${pin}`;
    if (seen.has(key)) return;
    seen.add(key);
    const root = uf.find(key);
    const def = byId.get(componentId)?.def.pins.find((p) => p.name === pin);
    const list = groups.get(root) ?? [];
    list.push({ componentId, pin, def });
    groups.set(root, list);
  };
  for (const w of spec.connections) {
    addPin(w.from.componentId, w.from.pin);
    addPin(w.to.componentId, w.to.pin);
    const root = uf.find(pinKey(w.from));
    const list = connsByRoot.get(root) ?? [];
    list.push(w.id);
    connsByRoot.set(root, list);
  }

  const nets: Net[] = [];
  const netByPin = new Map<string, Net>();
  for (const [root, pins] of groups) {
    pins.sort((a, b) => `${a.componentId}:${a.pin}`.localeCompare(`${b.componentId}:${b.pin}`));
    const kinds = new Set(pins.map((p) => pinClass(p.def?.type)));
    const kind: NetKind = kinds.size === 1 ? [...kinds][0]! : "mixed";
    const named = [...pins].sort(
      (a, b) => (NAME_PRIORITY[a.def?.type ?? "nc"] ?? 9) - (NAME_PRIORITY[b.def?.type ?? "nc"] ?? 9),
    )[0]!;
    const compName = byId.get(named.componentId)?.instance.name ?? named.componentId;
    const net: Net = {
      id: `net_${root.replace(/[^A-Za-z0-9_]/g, "_")}`,
      name: kind === "ground" ? "GND" : `${compName}.${named.pin}`,
      kind,
      pins,
      connectionIds: connsByRoot.get(root) ?? [],
    };
    nets.push(net);
    for (const p of pins) netByPin.set(`${p.componentId}:${p.pin}`, net);
  }
  nets.sort((a, b) => a.name.localeCompare(b.name));
  return { nets, netByPin };
}
