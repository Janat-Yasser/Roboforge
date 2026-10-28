import { builtinCatalog } from "@roboforge/catalog";
import { createFromTemplate } from "@roboforge/ir";
import type { RobotSpec } from "@roboforge/spec";

let cached: RobotSpec | undefined;

/** The example robot used by the landing page, tutorials and the public demo (no server needed). */
export function demoSpec(): RobotSpec {
  cached ??= createFromTemplate("obstacle-avoider", builtinCatalog(), "scout", "Scout — obstacle-avoiding rover");
  return cached;
}

export { builtinCatalog };
