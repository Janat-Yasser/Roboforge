import { describe, expect, it } from "vitest";
import { applyCommands } from "@roboforge/spec";
import { ARENAS, type BehaviorIR, BehaviorRuntime, buildRobotIR, createFromTemplate, RobotSim, type Arena, type RuntimeIO } from "@roboforge/ir";
import { catalog } from "./helpers";

const scout = () => buildRobotIR(createFromTemplate("obstacle-avoider", catalog, "scout", "Scout"), catalog);

function fakeIO(readings: Record<string, number | undefined> = {}) {
  const motors: Record<string, number> = {};
  const logs: string[] = [];
  let estop = false;
  const io: RuntimeIO = {
    readSensor: (id) => readings[id],
    setMotor: (id, s) => (motors[id] = s),
    setServo: () => {},
    estopTripped: () => estop,
    log: (_l, m) => logs.push(m),
  };
  return { io, motors, logs, trip: () => (estop = true) };
}

describe("behavior runtime", () => {
  it("drives forward when the path is clear and turns when it isn't", () => {
    const ir = scout();
    const tof = ir.hardware.components.find((c) => c.instance.name === "front_tof")!.instance.id;
    const left = ir.hardware.components.find((c) => c.instance.name === "left_motor")!.instance.id;
    const right = ir.hardware.components.find((c) => c.instance.name === "right_motor")!.instance.id;
    const readings: Record<string, number> = { [tof]: 1.5 };
    const f = fakeIO(readings);
    const rt = new BehaviorRuntime(ir.behavior, f.io, [left, right]);
    rt.begin(0);
    rt.tick(1);
    expect(f.motors[left]).toBeCloseTo(0.4);
    expect(f.motors[right]).toBeCloseTo(0.4);

    readings[tof] = 0.2;
    rt.tick(100); // the 50 ms wait has elapsed, so it reads again
    expect(rt.vars.distance).toBeCloseTo(0.2);
    expect(f.motors[left]).toBeLessThan(0);
    expect(f.motors[right]).toBeGreaterThan(0);
    expect(rt.activeNodeIds()).toContain("n_wait_turn");
  });

  it("latches the e-stop, stops the motors and runs the e-stop event", () => {
    const ir = scout();
    const tof = ir.hardware.components.find((c) => c.instance.name === "front_tof")!.instance.id;
    const f = fakeIO({ [tof]: 2 });
    const motorIds = ir.hardware.components.filter((c) => c.def.motor).map((c) => c.instance.id);
    const rt = new BehaviorRuntime(ir.behavior, f.io, motorIds);
    rt.begin(0);
    rt.tick(1);
    f.trip();
    rt.tick(2);
    rt.tick(500);
    expect(rt.estop).toBe(true);
    for (const id of motorIds) expect(f.motors[id]).toBe(0);
    expect(f.logs).toContain("E-STOP latched - power cycle to reset");
  });

  it("runs timers, sequences and state transitions like the firmware", () => {
    const ir: BehaviorIR = {
      states: ["IDLE", "RUN"],
      initialState: "IDLE",
      variables: [{ name: "n", initial: 0 }],
      nodes: [
        { pc: 1, nodeId: "inc", title: "n += 1", op: { op: "var_set", variable: "n", mode: "add", value: { kind: "const", value: 1 }, next: 2 } },
        { pc: 2, nodeId: "check", title: "n >= 3", op: { op: "condition", left: { kind: "var", name: "n" }, cmp: ">=", right: { kind: "const", value: 3 }, onTrue: 3, onFalse: 0 } },
        { pc: 3, nodeId: "go", title: "RUN", op: { op: "state_set", state: "RUN" } },
        { pc: 4, nodeId: "hello", title: "log", op: { op: "log", message: "running", next: 0 } },
      ],
      fibers: [
        { index: 0, name: "tick", trigger: { kind: "timer", periodMs: 100 }, entry: 1, eventNodeId: "t" },
        { index: 1, name: "enter RUN", trigger: { kind: "state_enter", state: "RUN" }, entry: 4, eventNodeId: "e" },
      ],
      estopComponentIds: [],
      userFunctions: [],
      usedComponentIds: [],
      stepBudget: 32,
    };
    const f = fakeIO();
    const rt = new BehaviorRuntime(ir, f.io, []);
    rt.begin(0);
    expect(rt.state).toBe("IDLE");
    for (let t = 10; t <= 400; t += 10) rt.tick(t);
    expect(rt.vars.n).toBeGreaterThanOrEqual(3);
    expect(rt.state).toBe("RUN");
    expect(f.logs).toEqual(["running"]);
  });
});

describe("2D simulator", () => {
  it("drives the template robot around the room without getting stuck", () => {
    const sim = new RobotSim(scout(), { arena: ARENAS[0]! });
    expect(sim.drivable).toBe(true);
    sim.advance(60_000);
    expect(sim.distance).toBeGreaterThan(5);
    // It should avoid most contacts: the ToF sees obstacles ahead and it turns away.
    expect(sim.collisions).toBeLessThan(6);
  });

  it("measures distance to a wall from the sensor's mount", () => {
    const arena: Arena = { id: "t", title: "t", width: 3, height: 2, obstacles: [], start: { x: 1, y: 1, theta: 0 } };
    const sim = new RobotSim(scout(), { arena, noise: 0 });
    const tof = sim.sensors.find((s) => s.name === "front_tof")!;
    expect(tof.mount.x).toBeCloseTo(0.12);
    // Wall at x = 3, sensor at x = 1.12 → 1.88 m, inside the VL53L0X range (2 m).
    expect(sim.ray(1.12, 1, 0, 4)).toBeCloseTo(1.88);
  });

  it("reports why a robot without a drive can't move", () => {
    let spec = createFromTemplate("obstacle-avoider", catalog, "scout", "Scout");
    spec = applyCommands(spec, [{ type: "robot.setDrive", drive: null }], { catalog });
    const motors = spec.components.filter((c) => catalog.get(c.ref.catalogId)?.motor);
    spec = { ...spec, components: spec.components.map((c) => (motors.includes(c) ? { ...c, mount: undefined } : c)) };
    const sim = new RobotSim(buildRobotIR(spec, catalog), { arena: ARENAS[2]! });
    expect(sim.drivable).toBe(false);
    expect(sim.problem).toMatch(/differential drive/);
  });
});
