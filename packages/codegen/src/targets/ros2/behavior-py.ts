import { PC_END, type BehaviorIR, type CompiledNode, type OperandIR, type RobotIR } from "@roboforge/ir";
import { CodeWriter, GENERATED_BANNER_PY, pyFloat } from "../../util/text";

export type PyHal = "motor" | "distance" | "imu" | "switch" | "servo" | "lidar";

export interface PyDevice {
  name: string;
  hal: PyHal;
  componentId: string;
}

const PY_HAL_TYPE: Record<PyHal, string> = {
  motor: "Motor",
  distance: "DistanceSensor",
  imu: "Imu",
  switch: "Switch",
  servo: "Servo",
  lidar: "Lidar",
};

export function pyDevices(ir: RobotIR): PyDevice[] {
  const out: PyDevice[] = [];
  for (const rc of ir.hardware.components) {
    const d = rc.def;
    let hal: PyHal | undefined;
    if (d.motor) hal = "motor";
    else if (d.servo) hal = "servo";
    else if (d.sensor?.kind === "distance") hal = "distance";
    else if (d.sensor?.kind === "imu") hal = "imu";
    else if (d.sensor?.kind === "switch") hal = "switch";
    else if (d.sensor?.kind === "lidar") hal = "lidar";
    if (hal) out.push({ name: rc.instance.name, hal, componentId: rc.instance.id });
  }
  return out;
}

const IMU_ATTR: Record<string, string> = {
  yaw_deg: "yaw_deg",
  pitch_deg: "pitch_deg",
  roll_deg: "roll_deg",
  gyro_z_dps: "gyro_z_dps",
  accel_x: "accel_x",
  accel_y: "accel_y",
  accel_z: "accel_z",
};

const operand = (o: OperandIR) => (o.kind === "const" ? pyFloat(o.value) : `v.${o.name}`);

/**
 * Pure-Python behavior runtime — same semantics as the C++ firmware runtime, no ROS imports,
 * so it is unit-testable with plain pytest.
 */
export function emitBehaviorPy(ir: RobotIR, devices: PyDevice[]): string {
  const b: BehaviorIR = ir.behavior;
  const w = new CodeWriter("    ");
  w.raw(GENERATED_BANNER_PY("Behavior runtime (compiled from behavior/behavior.json)"));
  w.line('"""Cooperative behavior state machine. Same semantics as firmware/src/behavior.cpp."""');
  w.line("from __future__ import annotations");
  w.line();
  w.line("from dataclasses import dataclass, field");
  w.line("from enum import Enum");
  w.line("from types import ModuleType");
  w.line("from typing import Optional, Protocol");
  w.line();
  w.line();
  w.block("class Motor(Protocol):", () => {
    w.line("def set_speed(self, speed: float) -> None: ...");
    w.line("def stop(self) -> None: ...");
    w.line("def speed(self) -> float: ...");
  }, "");
  w.line();
  w.block("class DistanceSensor(Protocol):", () => w.line("def read_distance_m(self) -> Optional[float]: ..."), "");
  w.line();
  w.block("@dataclass\nclass ImuSample:", () => {
    for (const a of Object.values(IMU_ATTR)) w.line(`${a}: float = 0.0`);
  }, "");
  w.line();
  w.block("class Imu(Protocol):", () => w.line("def read(self) -> Optional[ImuSample]: ..."), "");
  w.line();
  w.block("class Lidar(Protocol):", () => w.line("def read_channel(self, channel: str) -> Optional[float]: ..."), "");
  w.line();
  w.block("class Switch(Protocol):", () => w.line("def is_active(self) -> bool: ..."), "");
  w.line();
  w.block("class Servo(Protocol):", () => w.line("def set_angle_deg(self, angle_deg: float) -> None: ..."), "");
  w.line();
  w.block("class OutputEnable(Protocol):", () => w.line("def set_enabled(self, enabled: bool) -> None: ..."), "");
  w.line();
  w.block("class Logger(Protocol):", () => {
    w.line("def info(self, message: str) -> None: ...");
    w.line("def warn(self, message: str) -> None: ...");
  }, "");
  w.line();
  w.line();
  w.block("@dataclass\nclass Robot:", () => {
    w.line('"""Every device of this robot, typed by interface."""');
    for (const d of devices) w.line(`${d.name}: ${PY_HAL_TYPE[d.hal]}`);
    w.line("outputs: OutputEnable");
    w.line("log: Logger");
  }, "");
  w.line();
  w.line();
  w.block("class State(Enum):", () => {
    w.line('NONE = "NONE"');
    for (const s of b.states) w.line(`${s} = "${s}"`);
  }, "");
  w.line();
  w.line();
  w.block("@dataclass\nclass Variables:", () => {
    if (!b.variables.length) w.line("pass");
    for (const v of b.variables) w.line(`${v.name}: float = ${pyFloat(v.initial)}`);
  }, "");
  w.line();
  w.line();
  w.block("@dataclass\nclass _Fiber:", () => {
    w.line("pc: int = 0");
    w.line("active: bool = False");
    w.line("waiting: bool = False");
    w.line("aux: int = 0");
    w.line("parent: int = -1");
    w.line("wake_at: int = 0");
    w.line("started_at: int = 0");
  }, "");
  w.line();
  w.line();
  const motors = devices.filter((d) => d.hal === "motor").map((d) => d.name);
  const estops = b.estopComponentIds.map((id) => ir.hardware.byId.get(id)!.instance.name).filter((n) => devices.some((d) => d.name === n));
  w.block("class Behavior:", () => {
    w.line(`STEP_BUDGET = ${b.stepBudget}`);
    w.line(`ENTRY = (${b.fibers.map((f) => f.entry).join(", ")}${b.fibers.length === 1 ? "," : ""})`);
    w.line(`FIBER_NAMES = (${b.fibers.map((f) => JSON.stringify(f.name)).join(", ")}${b.fibers.length === 1 ? "," : ""})`);
    w.line();
    w.block("def __init__(self, robot: Robot, user: Optional[ModuleType] = None) -> None:", () => {
      w.line("self.r = robot");
      w.line("self.user = user");
      w.line("self.v = Variables()");
      w.line("self.state = State.NONE");
      w.line("self._pending_state: Optional[State] = None");
      w.line("self._estop = False");
      w.line("self._fibers = [_Fiber() for _ in self.ENTRY]");
    }, "");
    w.line();
    w.line("@property");
    w.block("def estop_latched(self) -> bool:", () => w.line("return self._estop"), "");
    w.line();
    w.block("def stop_all_motors(self) -> None:", () => {
      if (!motors.length) w.line("pass");
      for (const m of motors) w.line(`self.r.${m}.stop()`);
    }, "");
    w.line();
    w.block("def _estop_tripped(self) -> bool:", () => {
      if (!estops.length) w.line("return False");
      else w.line(`return any([${estops.map((e) => `self.r.${e}.is_active()`).join(", ")}])`);
    }, "");
    w.line();
    w.block("def _start(self, i: int, now: int, parent: int) -> None:", () => {
      w.line("f = self._fibers[i]");
      w.line("f.pc = self.ENTRY[i]");
      w.line("f.active = f.pc != 0");
      w.line("f.waiting = False");
      w.line("f.aux = 0");
      w.line("f.parent = parent");
      w.line("f.started_at = now");
    }, "");
    w.line();
    w.block("def _cancel(self, i: int) -> None:", () => {
      w.line("self._fibers[i].active = False");
      w.line("self._fibers[i].waiting = False");
      w.block("for j, f in enumerate(self._fibers):", () => {
        w.block("if f.active and f.parent == i:", () => w.line("self._cancel(j)"), "");
      }, "");
    }, "");
    w.line();
    w.block("def _enter_state(self, nxt: State, now: int) -> None:", () => {
      w.block("if nxt == self.state:", () => w.line("return"), "");
      for (const s of b.states) {
        const fs = b.fibers.filter((f) => f.trigger.kind === "state_enter" && f.trigger.state === s);
        if (!fs.length) continue;
        w.block(`if self.state == State.${s}:`, () => fs.forEach((f) => w.line(`self._cancel(${f.index})`)), "");
      }
      w.line("self.state = nxt");
      for (const s of b.states) {
        const fs = b.fibers.filter((f) => f.trigger.kind === "state_enter" && f.trigger.state === s);
        if (!fs.length) continue;
        w.block(`if nxt == State.${s}:`, () => fs.forEach((f) => w.line(`self._start(${f.index}, now, -1)`)), "");
      }
    }, "");
    w.line();
    w.block("def begin(self, now_ms: int) -> None:", () => {
      w.line("self.stop_all_motors()");
      w.line("self.r.outputs.set_enabled(True)");
      for (const f of b.fibers.filter((x) => x.trigger.kind === "start")) w.line(`self._start(${f.index}, now_ms, -1)  # ${f.name}`);
      for (const f of b.fibers.filter((x) => x.trigger.kind === "timer")) w.line(`self._fibers[${f.index}].started_at = now_ms  # ${f.name}`);
      if (b.initialState) w.line(`self._enter_state(State.${b.initialState}, now_ms)`);
    }, "");
    w.line();
    w.block("def tick(self, now_ms: int) -> None:", () => {
      w.block("if not self._estop and self._estop_tripped():", () => {
        w.line("self._estop = True");
        w.line("for i in range(len(self._fibers)):");
        w.line("    self._cancel(i)");
        w.line("self.stop_all_motors()");
        w.line("self.r.outputs.set_enabled(False)");
        w.line('self.r.log.warn("E-STOP latched")');
        for (const f of b.fibers.filter((x) => x.trigger.kind === "estop")) w.line(`self._start(${f.index}, now_ms, -1)  # ${f.name}`);
      }, "");
      const timers = b.fibers.filter((x) => x.trigger.kind === "timer");
      if (timers.length) {
        w.block("if not self._estop:", () => {
          for (const f of timers) {
            const p = f.trigger.kind === "timer" ? f.trigger.periodMs : 0;
            w.line(`if not self._fibers[${f.index}].active and now_ms - self._fibers[${f.index}].started_at >= ${p}:`);
            w.line(`    self._start(${f.index}, now_ms, -1)  # ${f.name}`);
          }
        }, "");
      }
      w.block("for i, f in enumerate(self._fibers):", () => {
        w.block("if f.active:", () => w.line("self._step(i, now_ms)"), "");
      }, "");
      w.block("if self._pending_state is not None:", () => {
        w.line("nxt, self._pending_state = self._pending_state, None");
        w.block("if not self._estop:", () => w.line("self._enter_state(nxt, now_ms)"), "");
      }, "");
      w.block("if self._estop:", () => w.line("self.stop_all_motors()"), "");
    }, "");
    w.line();
    w.block("def _call_user(self, name: str) -> bool:", () => {
      w.line("fn = getattr(self.user, name, None) if self.user is not None else None");
      w.block("if fn is None:", () => {
        w.line('self.r.log.warn(f"user function {name!r} is not defined")');
        w.line("return False");
      }, "");
      w.line("return bool(fn(self.r))");
    }, "");
    w.line();
    w.block("def _step(self, i: int, now: int) -> None:  # noqa: C901 - generated dispatch", () => {
      w.line("f = self._fibers[i]");
      w.line("v = self.v");
      w.line("r = self.r");
      w.block("for _ in range(self.STEP_BUDGET):", () => {
        w.block("if not f.active:", () => w.line("return"), "");
        w.line("pc = f.pc");
        w.block(`if pc == ${PC_END}:`, () => {
          w.line("f.active = False");
          w.line("return");
        }, "");
        for (const n of b.nodes) emitPyNode(w, n);
        w.block("else:", () => {
          w.line("f.active = False");
          w.line("return");
        }, "");
      }, "");
    }, "");
  }, "");
  return w.toString();
}

function emitPyNode(w: CodeWriter, n: CompiledNode): void {
  const op = n.op;
  w.block(`elif pc == ${n.pc}:  # ${n.title} [${n.nodeId}]`, () => {
    switch (op.op) {
      case "sensor_read": {
        if (op.sensorKind === "distance") w.line(`value = r.${op.component}.read_distance_m()`);
        else if (op.sensorKind === "imu") {
          w.line(`sample = r.${op.component}.read()`);
          w.line(`value = None if sample is None else sample.${IMU_ATTR[op.channel] ?? "yaw_deg"}`);
        } else if (op.sensorKind === "switch") w.line(`value = 1.0 if r.${op.component}.is_active() else 0.0`);
        else if (op.sensorKind === "lidar") w.line(`value = r.${op.component}.read_channel(${JSON.stringify(op.channel)})`);
        else w.line("value = None");
        w.block("if value is not None:", () => {
          w.line(`v.${op.variable} = float(value)`);
          w.line(`f.pc = ${op.next}`);
        }, "");
        w.block("else:", () => {
          if (op.error === PC_END) w.line("return  # no 'error' branch: retry next tick");
          else w.line(`f.pc = ${op.error}`);
        }, "");
        break;
      }
      case "motor_set":
        for (const c of op.commands) w.line(`r.${c.component}.set_speed(${pyFloat(c.speed)})`);
        w.line(`f.pc = ${op.next}`);
        break;
      case "motor_stop":
        for (const c of op.components) w.line(`r.${c.component}.stop()`);
        if (!op.components.length) w.line("pass");
        w.line(`f.pc = ${op.next}`);
        break;
      case "servo_set":
        w.line(`r.${op.component}.set_angle_deg(${pyFloat(op.angleDeg)})`);
        w.line(`f.pc = ${op.next}`);
        break;
      case "delay":
        w.block("if not f.waiting:", () => {
          w.line("f.waiting = True");
          w.line(`f.wake_at = now + ${op.ms}`);
        }, "");
        w.block("if now < f.wake_at:", () => w.line("return"), "");
        w.line("f.waiting = False");
        w.line(`f.pc = ${op.next}`);
        break;
      case "condition":
        w.line(`f.pc = ${op.onTrue} if ${operand(op.left)} ${op.cmp} ${operand(op.right)} else ${op.onFalse}`);
        break;
      case "var_set": {
        const t = `v.${op.variable}`;
        const val = operand(op.value);
        w.line(`${t} = ${op.mode === "set" ? val : op.mode === "add" ? `${t} + ${val}` : op.mode === "sub" ? `${t} - ${val}` : `${t} * ${val}`}`);
        w.line(`f.pc = ${op.next}`);
        break;
      }
      case "state_set":
        w.line(`self._pending_state = State.${op.state}`);
        w.line("f.active = False");
        w.line("return");
        break;
      case "call":
        w.line(`f.pc = ${op.next} if self._call_user(${JSON.stringify(op.name)}) else ${op.error === PC_END ? op.next : op.error}`);
        break;
      case "log":
        w.line(`r.log.info(${JSON.stringify(op.message)})`);
        w.line(`f.pc = ${op.next}`);
        break;
      case "sequence":
        w.line(`children = (${op.children.join(", ")}${op.children.length === 1 ? "," : ""})`);
        w.block("if not f.waiting:", () => {
          w.line("f.waiting = True");
          w.line("f.aux = 0");
          w.line("self._start(children[0], now, i)");
        }, "");
        w.block("if self._fibers[children[f.aux]].active:", () => w.line("return"), "");
        w.line("f.aux += 1");
        w.block("if f.aux < len(children):", () => {
          w.line("self._start(children[f.aux], now, i)");
          w.line("return");
        }, "");
        w.line("f.waiting = False");
        w.line(`f.pc = ${op.next}`);
        break;
      case "parallel":
        w.line(`children = (${op.children.join(", ")})`);
        w.block("if not f.waiting:", () => {
          w.line("f.waiting = True");
          w.line("for c in children:");
          w.line("    self._start(c, now, i)");
          w.line("return");
        }, "");
        w.block("if any(self._fibers[c].active for c in children):", () => w.line("return"), "");
        w.line("f.waiting = False");
        w.line(`f.pc = ${op.next}`);
        break;
    }
  }, "");
}
