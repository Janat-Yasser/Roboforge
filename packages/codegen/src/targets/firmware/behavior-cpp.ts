// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { PC_END, type BehaviorIR, type CompiledNode, type OperandIR } from "@roboforge/ir";
import { CodeWriter, GENERATED_BANNER_CPP, cppFloat, cppString } from "../../util/text";

export const IMU_FIELDS: Record<string, string> = {
  yaw_deg: "yawDeg",
  pitch_deg: "pitchDeg",
  roll_deg: "rollDeg",
  gyro_z_dps: "gyroZDps",
  accel_x: "accelX",
  accel_y: "accelY",
  accel_z: "accelZ",
};

const operand = (o: OperandIR) => (o.kind === "const" ? cppFloat(o.value) : `v_.${o.name}`);

function stateEnum(ir: BehaviorIR): string[] {
  return ["NONE", ...ir.states];
}

export function emitBehaviorHeader(ir: BehaviorIR): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Behavior state machine (compiled from behavior/behavior.json)"));
  w.line("#pragma once");
  w.line("#include <stdint.h>");
  w.line('#include "robot.h"');
  w.line();
  w.namespace("rf", () => {
    w.line();
    w.line(`enum class State : uint8_t { ${stateEnum(ir).join(", ")} };`);
    w.line();
    w.line("const char* stateName(State s);");
    w.line();
    w.block("struct Variables {", () => {
      for (const v of ir.variables) w.line(`float ${v.name} = ${cppFloat(v.initial)};`);
    }, "};");
    w.line();
    w.line("/**");
    w.line(" * Cooperative, non-blocking runtime for the robot behavior.");
    w.line(" * Call begin() once and tick(nowMs) from the main loop. Never blocks except inside drivers.");
    w.line(" */");
    w.block("class Behavior {", () => {
      w.line(" public:");
      w.line("explicit Behavior(Robot& robot);");
      w.line("void begin(uint32_t nowMs);");
      w.line("void tick(uint32_t nowMs);");
      w.line("bool estopLatched() const { return estop_; }");
      w.line("State state() const { return state_; }");
      w.line("const Variables& vars() const { return v_; }");
      w.line("Variables& vars() { return v_; }");
      w.line();
      w.line(" private:");
      w.block("struct Fiber {", () => {
        w.line("uint16_t pc = 0;");
        w.line("bool active = false;");
        w.line("bool waiting = false;");
        w.line("uint8_t aux = 0;");
        w.line("int8_t parent = -1;");
        w.line("uint32_t wakeAt = 0;");
        w.line("uint32_t startedAt = 0;");
      }, "};");
      w.line(`static constexpr uint8_t kFiberCount = ${Math.max(ir.fibers.length, 1)};`);
      w.line(`static constexpr uint8_t kStepBudget = ${ir.stepBudget};`);
      w.line();
      w.line("void start(uint8_t fiber, uint32_t now, int8_t parent);");
      w.line("void cancel(uint8_t fiber);");
      w.line("void step(uint8_t fiber, uint32_t now);");
      w.line("void enterState(State next, uint32_t now);");
      w.line("void stopAllMotors();");
      w.line("bool estopTripped();");
      w.line();
      w.line("Robot& r_;");
      w.line("Variables v_;");
      w.line("Fiber fibers_[kFiberCount];");
      w.line("State state_ = State::NONE;");
      w.line("State pendingState_ = State::NONE;");
      w.line("bool estop_ = false;");
    }, "};");
    w.line();
  });
  return w.toString();
}

export function emitBehaviorSource(ir: BehaviorIR, opts: { motors: string[]; estops: string[]; userFunctions: string[] }): string {
  const w = new CodeWriter();
  w.raw(GENERATED_BANNER_CPP("Behavior state machine (compiled from behavior/behavior.json)"));
  w.line('#include "behavior.h"');
  if (opts.userFunctions.length) w.line('#include "user_functions.h"');
  w.line();
  w.namespace("rf", () => {
    w.line();
    w.block("const char* stateName(State s) {", () => {
      w.block("switch (s) {", () => {
        for (const s of stateEnum(ir)) w.line(`case State::${s}: return ${cppString(s)};`);
      });
      w.line('return "?";');
    });
    w.line();
    w.line("Behavior::Behavior(Robot& robot) : r_(robot) {}");
    w.line();

    // stopAllMotors / estop
    w.block("void Behavior::stopAllMotors() {", () => {
      if (!opts.motors.length) w.line("// (no motors)");
      for (const m of opts.motors) w.line(`r_.${m}.stop();`);
    });
    w.line();
    w.block("bool Behavior::estopTripped() {", () => {
      if (!opts.estops.length) {
        w.line("return false;  // no e-stop input in this design");
      } else {
        w.line("bool tripped = false;");
        for (const e of opts.estops) w.line(`tripped = r_.${e}.isActive() || tripped;  // poll every input so debouncing advances`);
        w.line("return tripped;");
      }
    });
    w.line();

    // start / cancel
    w.block("void Behavior::start(uint8_t fiber, uint32_t now, int8_t parent) {", () => {
      w.line("static const uint16_t kEntry[kFiberCount] = {" + (ir.fibers.length ? ir.fibers.map((f) => f.entry).join(", ") : "0") + "};");
      w.line("Fiber& f = fibers_[fiber];");
      w.line("f.pc = kEntry[fiber];");
      w.line("f.active = f.pc != 0;");
      w.line("f.waiting = false;");
      w.line("f.aux = 0;");
      w.line("f.parent = parent;");
      w.line("f.startedAt = now;");
    });
    w.line();
    w.block("void Behavior::cancel(uint8_t fiber) {", () => {
      w.line("fibers_[fiber].active = false;");
      w.line("fibers_[fiber].waiting = false;");
      w.block("for (uint8_t i = 0; i < kFiberCount; ++i) {", () => {
        w.line("if (fibers_[i].active && fibers_[i].parent == static_cast<int8_t>(fiber)) cancel(i);");
      });
    });
    w.line();

    // enterState
    w.block("void Behavior::enterState(State next, uint32_t now) {", () => {
      w.line("if (next == state_) return;");
      const owned = ir.fibers.filter((f) => f.trigger.kind === "state_enter");
      if (owned.length) {
        w.line("// Leave the current state: cancel fibers it owns (and their children).");
        w.block("switch (state_) {", () => {
          for (const s of ir.states) {
            const fs = owned.filter((f) => f.trigger.kind === "state_enter" && f.trigger.state === s);
            if (!fs.length) continue;
            w.line(`case State::${s}: ${fs.map((f) => `cancel(${f.index});`).join(" ")} break;`);
          }
          w.line("default: break;");
        });
      }
      w.line("state_ = next;");
      if (owned.length) {
        w.block("switch (state_) {", () => {
          for (const s of ir.states) {
            const fs = owned.filter((f) => f.trigger.kind === "state_enter" && f.trigger.state === s);
            if (!fs.length) continue;
            w.line(`case State::${s}: ${fs.map((f) => `start(${f.index}, now, -1);`).join(" ")} break;`);
          }
          w.line("default: break;");
        });
      } else {
        w.line("(void)now;");
      }
    });
    w.line();

    // begin
    w.block("void Behavior::begin(uint32_t nowMs) {", () => {
      w.line("stopAllMotors();");
      w.line("r_.outputs.setEnabled(true);");
      const boot = ir.fibers.filter((x) => x.trigger.kind === "start");
      const timers = ir.fibers.filter((x) => x.trigger.kind === "timer");
      for (const f of boot) w.line(`start(${f.index}, nowMs, -1);  // ${f.name}`);
      for (const f of timers) w.line(`fibers_[${f.index}].startedAt = nowMs;  // ${f.name}: first run after one period`);
      if (ir.initialState) w.line(`enterState(State::${ir.initialState}, nowMs);`);
      else if (!boot.length && !timers.length) w.line("(void)nowMs;");
    });
    w.line();

    // tick
    w.block("void Behavior::tick(uint32_t nowMs) {", () => {
      w.line("// Safety first: an e-stop latches, cancels all behavior and holds every motor at zero.");
      w.block("if (!estop_ && estopTripped()) {", () => {
        w.line("estop_ = true;");
        w.line("for (uint8_t i = 0; i < kFiberCount; ++i) cancel(i);");
        w.line("stopAllMotors();");
        w.line("r_.outputs.setEnabled(false);");
        w.line('r_.log.warn("E-STOP latched");');
        for (const f of ir.fibers.filter((x) => x.trigger.kind === "estop")) w.line(`start(${f.index}, nowMs, -1);  // ${f.name}`);
      });
      const timers = ir.fibers.filter((x) => x.trigger.kind === "timer");
      if (timers.length) {
        w.block("if (!estop_) {", () => {
          for (const f of timers) {
            const period = f.trigger.kind === "timer" ? f.trigger.periodMs : 0;
            w.line(`if (!fibers_[${f.index}].active && nowMs - fibers_[${f.index}].startedAt >= ${period}u) start(${f.index}, nowMs, -1);  // ${f.name}`);
          }
        });
      }
      w.block("for (uint8_t i = 0; i < kFiberCount; ++i) {", () => {
        w.line("if (fibers_[i].active) step(i, nowMs);");
      });
      w.block("if (pendingState_ != State::NONE) {", () => {
        w.line("const State next = pendingState_;");
        w.line("pendingState_ = State::NONE;");
        w.line("if (!estop_) enterState(next, nowMs);");
      });
      w.line("if (estop_) stopAllMotors();");
    });
    w.line();

    // step
    w.block("void Behavior::step(uint8_t fiber, uint32_t now) {", () => {
      w.line("Fiber& f = fibers_[fiber];");
      w.line("(void)now;  // unused when the graph has no timed or spawning nodes");
      w.block("for (uint8_t budget = 0; budget < kStepBudget && f.active; ++budget) {", () => {
        w.block("switch (f.pc) {", () => {
          w.line(`case ${PC_END}:`);
          w.indent(() => w.line("f.active = false;").line("return;"));
          for (const n of ir.nodes) emitNode(w, n);
          w.line("default:");
          w.indent(() => w.line("f.active = false;").line("return;"));
        });
      });
    });
    w.line();
  });
  return w.toString();
}

function emitNode(w: CodeWriter, n: CompiledNode): void {
  const op = n.op;
  w.line(`case ${n.pc}: {  // ${n.title.replace(/\*\//g, "")} [${n.nodeId}]`);
  w.indent(() => {
    switch (op.op) {
      case "sensor_read": {
        w.line("float value = 0.0f;");
        if (op.sensorKind === "distance") w.line(`const bool ok = r_.${op.component}.readDistanceM(value);`);
        else if (op.sensorKind === "imu") {
          w.line("ImuSample sample;");
          w.line(`const bool ok = r_.${op.component}.read(sample);`);
          w.line(`if (ok) value = sample.${IMU_FIELDS[op.channel] ?? "yawDeg"};`);
        } else if (op.sensorKind === "switch") {
          w.line(`value = r_.${op.component}.isActive() ? 1.0f : 0.0f;`);
          w.line("const bool ok = true;");
        } else {
          w.line(`const bool ok = false;  // sensor kind '${op.sensorKind}' has no firmware HAL`);
        }
        w.line(`if (ok) { v_.${op.variable} = value; f.pc = ${op.next}; break; }`);
        if (op.error === PC_END) w.line("return;  // no 'error' branch: retry on the next tick");
        else w.line(`f.pc = ${op.error};`);
        w.line("break;");
        break;
      }
      case "motor_set":
        for (const c of op.commands) w.line(`r_.${c.component}.setSpeed(${cppFloat(c.speed)});`);
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "motor_stop":
        for (const c of op.components) w.line(`r_.${c.component}.stop();`);
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "servo_set":
        w.line(`r_.${op.component}.setAngleDeg(${cppFloat(op.angleDeg)});`);
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "delay":
        w.line(`if (!f.waiting) { f.waiting = true; f.wakeAt = now + ${op.ms}u; }`);
        w.line("if (static_cast<int32_t>(now - f.wakeAt) < 0) return;");
        w.line("f.waiting = false;");
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "condition":
        w.line(`f.pc = (${operand(op.left)} ${op.cmp} ${operand(op.right)}) ? ${op.onTrue} : ${op.onFalse};`);
        w.line("break;");
        break;
      case "var_set": {
        const target = `v_.${op.variable}`;
        const val = operand(op.value);
        const expr = op.mode === "set" ? val : op.mode === "add" ? `${target} + ${val}` : op.mode === "sub" ? `${target} - ${val}` : `${target} * ${val}`;
        w.line(`${target} = ${expr};`);
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      }
      case "state_set":
        w.line(`pendingState_ = State::${op.state};`);
        w.line("f.active = false;").line("return;");
        break;
      case "call":
        w.line(`const bool ok = user::${op.name}(r_);`);
        w.line(`f.pc = ok ? ${op.next} : ${op.error === PC_END ? op.next : op.error};`);
        w.line("break;");
        break;
      case "log":
        w.line(`r_.log.info(${cppString(op.message)});`);
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "sequence":
        w.line(`static const uint8_t kChildren[] = {${op.children.join(", ")}};`);
        w.line(`if (!f.waiting) { f.waiting = true; f.aux = 0; start(kChildren[0], now, static_cast<int8_t>(fiber)); }`);
        w.line("if (fibers_[kChildren[f.aux]].active) return;");
        w.line(`if (++f.aux < ${op.children.length}) { start(kChildren[f.aux], now, static_cast<int8_t>(fiber)); return; }`);
        w.line("f.waiting = false;");
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
      case "parallel":
        w.line(`static const uint8_t kChildren[] = {${op.children.join(", ")}};`);
        w.block("if (!f.waiting) {", () => {
          w.line("f.waiting = true;");
          w.line("for (uint8_t c : kChildren) start(c, now, static_cast<int8_t>(fiber));");
          w.line("return;");
        });
        w.line("for (uint8_t c : kChildren) if (fibers_[c].active) return;");
        w.line("f.waiting = false;");
        w.line(`f.pc = ${op.next};`).line("break;");
        break;
    }
  });
  w.line("}");
}
