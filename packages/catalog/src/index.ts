import { ComponentDefinition, MapCatalog } from "@roboforge/spec";
import { actuators } from "./actuators";
import { controllers } from "./controllers";
import { power } from "./power";
import { sensors } from "./sensors";

const RAW = [...controllers, ...actuators, ...sensors, ...power];

/** Parses every built-in definition through the schema. Throws with the offending id on error. */
export function loadBuiltinDefinitions(): ComponentDefinition[] {
  return RAW.map((raw) => {
    const parsed = ComponentDefinition.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid catalog definition '${raw.id}': ${issues}`);
    }
    return parsed.data;
  });
}

let cached: MapCatalog | undefined;

/** The built-in component library as an in-memory catalog (used by tests, seed and offline tools). */
export function builtinCatalog(): MapCatalog {
  cached ??= new MapCatalog(loadBuiltinDefinitions());
  return cached;
}

export type { ComponentDefinitionInput } from "./types";
