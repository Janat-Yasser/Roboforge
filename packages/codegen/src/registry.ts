import type { RobotIR } from "@roboforge/ir";
import { commonTarget } from "./targets/common";
import { firmwareTarget } from "./targets/firmware";
import { ros2Target } from "./targets/ros2";
import type { TargetGenerator, TargetInfo } from "./types";

/**
 * Registry of code-generation targets. New targets (Linux runtime, simulation backends…) are added
 * by implementing TargetGenerator and registering it here — nothing else in the pipeline changes.
 */
export class TargetRegistry {
  private readonly targets: TargetGenerator[] = [];

  register(t: TargetGenerator): this {
    if (this.targets.some((x) => x.id === t.id)) throw new Error(`Duplicate target '${t.id}'.`);
    this.targets.push(t);
    return this;
  }

  all(): TargetGenerator[] {
    return [...this.targets];
  }

  applicable(ir: RobotIR): TargetGenerator[] {
    return this.targets.filter((t) => t.appliesTo(ir));
  }

  info(): TargetInfo[] {
    return this.targets.map(({ id, title, description }) => ({ id, title, description }));
  }
}

export function createDefaultTargets(): TargetRegistry {
  return new TargetRegistry().register(commonTarget).register(firmwareTarget).register(ros2Target);
}
