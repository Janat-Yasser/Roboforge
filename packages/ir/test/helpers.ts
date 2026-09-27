import { builtinCatalog } from "@roboforge/catalog";
import { applyCommands, createEmptySpec, type Command, type RobotSpec } from "@roboforge/spec";
import { planAutoWire } from "@roboforge/ir";

export const catalog = builtinCatalog();

/** Fluent builder for test specs that goes through the public command API. */
export class SpecBuilder {
  spec: RobotSpec = createEmptySpec("test_bot", "Test Bot");
  private n = 0;

  add(name: string, catalogId: string, config: Record<string, number | string | boolean> = {}): string {
    const id = `c_${name}`;
    const def = catalog.get(catalogId);
    if (!def) throw new Error(`unknown ${catalogId}`);
    this.apply([{ type: "component.add", component: { id, name, ref: { catalogId, version: def.version }, config, layout: { x: 0, y: 0 } } }]);
    return id;
  }

  wire(a: string, b: string): this {
    const [ca, pa] = a.split(".");
    const [cb, pb] = b.split(".");
    this.apply([{ type: "connection.add", connection: { id: `w_${++this.n}`, from: { componentId: `c_${ca}`, pin: pa! }, to: { componentId: `c_${cb}`, pin: pb! } } }]);
    return this;
  }

  autowire(name: string): this {
    const plan = planAutoWire(this.spec, catalog, `c_${name}`);
    this.apply(plan.commands);
    return this;
  }

  apply(cmds: Command[]): this {
    this.spec = applyCommands(this.spec, cmds, { catalog });
    return this;
  }
}

/** ESP32 + 2S battery + 5 V buck, powered and grounded. */
export function poweredEsp32(): SpecBuilder {
  const b = new SpecBuilder();
  b.add("battery", "lipo-2s-2200");
  b.add("buck", "lm2596-buck", { outputVoltage: 5 });
  b.add("mcu", "esp32-devkitc");
  b.autowire("buck").autowire("mcu");
  return b;
}
