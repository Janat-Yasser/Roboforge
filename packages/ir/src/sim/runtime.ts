// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { PC_END, type BehaviorIR, type CompiledNode, type OperandIR } from "../behavior/types";

/**
 * What the behavior runtime needs from the robot. The simulator implements it with a 2D world;
 * tests implement it with plain objects.
 */
export interface RuntimeIO {
  /** Returns the reading, or undefined if the read failed (takes the node's 'error' branch). */
  readSensor(componentId: string, channel: string, sensorKind: string): number | undefined;
  setMotor(componentId: string, speed: number): void;
  setServo(componentId: string, angleDeg: number): void;
  /** True while an e-stop input is tripped. */
  estopTripped(): boolean;
  log(level: "info" | "warn", message: string): void;
  /** User functions have no implementation in the simulator; they succeed by default. */
  callFunction?(name: string): boolean;
}

interface Fiber {
  pc: number;
  active: boolean;
  waiting: boolean;
  aux: number;
  parent: number;
  wakeAt: number;
  startedAt: number;
}

/**
 * A TypeScript port of the generated firmware runtime (codegen/targets/firmware/behavior-cpp.ts).
 * Same fibers, step budget, delay, Sequence/Parallel, state transitions and e-stop latching, so
 * what you see in the simulator is what the robot will do.
 */
export class BehaviorRuntime {
  readonly vars: Record<string, number> = {};
  state: string | undefined;
  estop = false;
  private fibers: Fiber[];
  private pending: string | undefined;
  private byPc = new Map<number, CompiledNode>();
  private motorIds: string[];

  constructor(
    private readonly ir: BehaviorIR,
    private readonly io: RuntimeIO,
    motorIds: string[],
  ) {
    this.motorIds = motorIds;
    for (const n of ir.nodes) this.byPc.set(n.pc, n);
    for (const v of ir.variables) this.vars[v.name] = v.initial;
    this.fibers = ir.fibers.map(() => ({ pc: 0, active: false, waiting: false, aux: 0, parent: -1, wakeAt: 0, startedAt: 0 }));
  }

  /** Node ids where an active fiber currently sits (for highlighting the graph). */
  activeNodeIds(): string[] {
    const out = new Set<string>();
    for (const f of this.fibers) {
      if (!f.active) continue;
      const n = this.byPc.get(f.pc);
      if (n) out.add(n.nodeId);
    }
    return [...out];
  }

  begin(now: number): void {
    this.stopAllMotors();
    for (const f of this.ir.fibers) {
      if (f.trigger.kind === "start") this.start(f.index, now, -1);
      if (f.trigger.kind === "timer") this.fibers[f.index]!.startedAt = now;
    }
    if (this.ir.initialState) this.enterState(this.ir.initialState, now);
  }

  tick(now: number): void {
    if (!this.estop && this.io.estopTripped()) {
      this.estop = true;
      for (let i = 0; i < this.fibers.length; i++) this.cancel(i);
      this.stopAllMotors();
      this.io.log("warn", "E-STOP latched");
      for (const f of this.ir.fibers) if (f.trigger.kind === "estop") this.start(f.index, now, -1);
    }
    if (!this.estop) {
      for (const f of this.ir.fibers) {
        if (f.trigger.kind !== "timer") continue;
        const fb = this.fibers[f.index]!;
        if (!fb.active && now - fb.startedAt >= f.trigger.periodMs) this.start(f.index, now, -1);
      }
    }
    for (let i = 0; i < this.fibers.length; i++) if (this.fibers[i]!.active) this.step(i, now);
    if (this.pending !== undefined) {
      const next = this.pending;
      this.pending = undefined;
      if (!this.estop) this.enterState(next, now);
    }
    if (this.estop) this.stopAllMotors();
  }

  private stopAllMotors() {
    for (const id of this.motorIds) this.io.setMotor(id, 0);
  }

  private start(i: number, now: number, parent: number) {
    const f = this.fibers[i]!;
    f.pc = this.ir.fibers[i]!.entry;
    f.active = f.pc !== PC_END;
    f.waiting = false;
    f.aux = 0;
    f.parent = parent;
    f.startedAt = now;
  }

  private cancel(i: number) {
    this.fibers[i]!.active = false;
    this.fibers[i]!.waiting = false;
    for (let j = 0; j < this.fibers.length; j++) {
      if (this.fibers[j]!.active && this.fibers[j]!.parent === i) this.cancel(j);
    }
  }

  private enterState(next: string, now: number) {
    if (next === this.state) return;
    for (const f of this.ir.fibers) {
      if (f.trigger.kind === "state_enter" && f.trigger.state === this.state) this.cancel(f.index);
    }
    this.state = next;
    for (const f of this.ir.fibers) {
      if (f.trigger.kind === "state_enter" && f.trigger.state === next) this.start(f.index, now, -1);
    }
  }

  private val(o: OperandIR): number {
    return o.kind === "const" ? o.value : (this.vars[o.name] ?? 0);
  }

  private step(i: number, now: number) {
    const f = this.fibers[i]!;
    for (let budget = 0; budget < this.ir.stepBudget && f.active; budget++) {
      const n = this.byPc.get(f.pc);
      if (!n) {
        f.active = false;
        return;
      }
      const op = n.op;
      switch (op.op) {
        case "sensor_read": {
          const v = this.io.readSensor(op.componentId, op.channel, op.sensorKind);
          if (v !== undefined) {
            this.vars[op.variable] = v;
            f.pc = op.next;
            break;
          }
          if (op.error === PC_END) return; // retry next tick
          f.pc = op.error;
          break;
        }
        case "motor_set":
          for (const c of op.commands) this.io.setMotor(c.componentId, c.speed);
          f.pc = op.next;
          break;
        case "motor_stop":
          for (const c of op.components) this.io.setMotor(c.componentId, 0);
          f.pc = op.next;
          break;
        case "servo_set":
          this.io.setServo(op.componentId, op.angleDeg);
          f.pc = op.next;
          break;
        case "delay":
          if (!f.waiting) {
            f.waiting = true;
            f.wakeAt = now + op.ms;
          }
          if (now < f.wakeAt) return;
          f.waiting = false;
          f.pc = op.next;
          break;
        case "condition": {
          const a = this.val(op.left);
          const b = this.val(op.right);
          const r =
            op.cmp === "<" ? a < b : op.cmp === "<=" ? a <= b : op.cmp === ">" ? a > b : op.cmp === ">=" ? a >= b : op.cmp === "==" ? a === b : a !== b;
          f.pc = r ? op.onTrue : op.onFalse;
          break;
        }
        case "var_set": {
          const cur = this.vars[op.variable] ?? 0;
          const v = this.val(op.value);
          this.vars[op.variable] = op.mode === "set" ? v : op.mode === "add" ? cur + v : op.mode === "sub" ? cur - v : cur * v;
          f.pc = op.next;
          break;
        }
        case "state_set":
          this.pending = op.state;
          f.active = false;
          return;
        case "call": {
          const ok = this.io.callFunction ? this.io.callFunction(op.name) : true;
          f.pc = ok ? op.next : op.error === PC_END ? op.next : op.error;
          break;
        }
        case "log":
          this.io.log("info", op.message);
          f.pc = op.next;
          break;
        case "sequence": {
          const kids = op.children;
          if (!f.waiting) {
            f.waiting = true;
            f.aux = 0;
            this.start(kids[0]!, now, i);
          }
          if (this.fibers[kids[f.aux]!]!.active) return;
          if (++f.aux < kids.length) {
            this.start(kids[f.aux]!, now, i);
            return;
          }
          f.waiting = false;
          f.pc = op.next;
          break;
        }
        case "parallel": {
          if (!f.waiting) {
            f.waiting = true;
            for (const c of op.children) this.start(c, now, i);
            return;
          }
          if (op.children.some((c) => this.fibers[c]!.active)) return;
          f.waiting = false;
          f.pc = op.next;
          break;
        }
      }
      if (f.pc === PC_END) {
        f.active = false;
        return;
      }
    }
  }
}
