# RoboForge — Architecture

RoboForge is an engineering IDE for robots. An engineer describes a robot once — hardware, wiring,
behavior — and RoboForge validates it and generates a real, editable, Git-ready codebase
(firmware + ROS 2 + docs + tests).

This document covers the ten architecture areas requested for V1 and records the decisions made
along the way (marked **ADR**).

---

## 1. Product architecture

```
Robot Specification (robot.yaml, source of truth)
  → Hardware model (resolved against the component catalog)
  → Wiring (nets built from pin-to-pin connections)
  → Validation (electrical, power, pins, buses, software, safety)
  → Behavior (node graph → compiled fiber state machine)
  → Code generation (target plugins)
  → Tests + Documentation
```

Every editor (hardware, wiring, behavior, YAML, AI assistant) mutates the spec **only** through typed
*commands*. Nothing writes source code directly except the code generator (for generated files) and the
engineer (for user-owned files and protected regions).

```
                     ┌──────────────┐
                     │ AI Assistant │  proposes command batches, user approves
                     └──────┬───────┘
 ┌───────────┐       ┌──────▼───────┐       ┌─────────────┐
 │ Hardware  │──────▶│  Robot Spec  │◀──────│  Behavior   │
 │ Editor    │ cmds  │ (@roboforge/ │ cmds  │  Editor     │
 └───────────┘       │    spec)     │       └─────────────┘
 ┌───────────┐       └──────┬───────┘
 │ Wiring    │─────cmds─────┤
 │ Editor    │              ▼
 └───────────┘     ┌─────────────────┐
                   │  Robot IR       │  @roboforge/ir  (nets, pin assignments, buses,
                   │                 │                  power tree, actuator bindings,
                   └────────┬────────┘                  compiled behavior)
                            ▼
                   ┌─────────────────┐
                   │ Validation      │  @roboforge/validation (rule registry)
                   └────────┬────────┘
                            ▼
                   ┌─────────────────┐
                   │ Code generators │  @roboforge/codegen (target plugins + merge)
                   └────────┬────────┘
             ┌──────────────┼──────────────┬──────────────┐
             ▼              ▼              ▼              ▼
          ESP32          Arduino         STM32          ROS 2
```

The package boundaries mirror this diagram one-to-one.

## 2. System architecture

```
Browser (Next.js client: React Flow, Monaco, zustand)
   │   runs the SAME spec/ir/validation packages locally for instant feedback
   │   HTTP JSON + SSE
   ▼
Next.js server (route handlers = API)          ──►  PostgreSQL
   services: auth, projects, commands,              (users, orgs, projects, revisions,
   catalog, generation, files, export,               component versions, files, builds,
   builds, assistant                                 build logs, job queue)
                                                      ▲
Build worker (separate process, apps/worker)  ────────┘  claims jobs with FOR UPDATE SKIP LOCKED
   validate → generate → materialize → sandboxed compile/test (Docker, --network=none)
   → artifact zip → ObjectStore (local FS in V1, S3-compatible interface)
```

**ADR-1 Postgres as the job queue.** Builds are low-volume and need transactional coupling with the
Build row; `SELECT … FOR UPDATE SKIP LOCKED` gives an exactly-once claim without adding Redis. Redis is
reserved for fan-out pub/sub when we run multiple web instances.

**ADR-2 SSE instead of WebSockets for V1 live status.** Build logs are server→client only; SSE works
through proxies and needs no extra server. WebSockets arrive with collaborative editing.

**ADR-3 Untrusted execution never runs in the web process.** Compilation of generated/user code
happens only in the worker, and only inside a container with no network, a read-only root FS, dropped
capabilities, PID/memory/CPU limits and a wall-clock timeout. If no container runtime is available the
compile step is *skipped and reported*, never run on the host.

## 3. Repository structure

```
roboforge/
├── packages/
│   ├── spec/         Robot Spec schema (zod), component definition schema, commands, YAML I/O
│   ├── catalog/      Component library data (controllers, drivers, motors, sensors, power…)
│   ├── ir/           Resolve spec → hardware IR (nets, pins, buses, power), behavior compiler,
│   │                 auto-wiring planner
│   ├── validation/   Rule engine + rule sets (electrical, power, pins, comms, software, safety…)
│   ├── codegen/      Pipeline, target registry, generators, ownership/merge, export
│   ├── assistant/    AI agent: tools over the spec command API, produces reviewable proposals
│   └── db/           Drizzle schema, SQL migrations, seed, object storage
├── apps/
│   ├── web/          Next.js IDE + API route handlers
│   └── worker/       Build worker + sandbox runner
├── infra/sandbox/    Toolchain images for sandboxed builds
├── docker-compose.yml
└── ARCHITECTURE.md
```

**ADR-4 Source-first internal packages.** Workspace packages export TypeScript source; Next.js
transpiles them and the worker runs via `tsx`. One type system, no build step between packages.

## 4. Database schema

See `packages/db/src/schema.ts` (Drizzle ORM) and `packages/db/migrations/`. Entities:

| Entity | Purpose |
|---|---|
| User, Session | Email/password auth, opaque session tokens (hashed at rest) |
| Organization, Membership | Tenancy; every user gets a personal org |
| Project | Current spec (JSONB) + current revision number |
| ProjectRevision | Immutable snapshot of the spec + the commands that produced it |
| Component, ComponentVersion | Reusable, versioned component library (global or org-private) |
| ProjectFile | Materialized codebase: path, content, ownership (GENERATED / USER / MIXED) |
| Build, BuildLog | Build jobs (queue) and their streamed logs |

**ADR-7 Drizzle instead of Prisma.** SQL-first, pure TypeScript (no native query/schema engine
binaries to download — builds work in locked-down CI and air-gapped environments), and raw SQL is
first-class, which the job queue (`FOR UPDATE SKIP LOCKED`) needs anyway.

**ADR-5 The spec is stored as a versioned document, not normalized rows.** Components, connections,
pin assignments and behavior nodes live inside the spec document. Reasons: a revision must be atomic
and exactly reproducible; the spec must round-trip to `robot.yaml` in Git; pin assignments and buses
are *derived* (by the IR), so storing them would duplicate truth. Normalized projections can be added
later for cross-project search without changing the source of truth.

Planned (not in V1): `Device`, `Deployment`, `SimulationRun`.

## 5. Robot Specification schema

`packages/spec/src/schema.ts`. Summary:

```yaml
schemaVersion: 1
robot: { name: warehouse_bot, displayName: …, description: …, drive: { kind: differential, … } }
targets: { firmware: { enabled: true }, ros2: { enabled: true, distro: jazzy } }
components:
  - id: c_left_motor            # stable id, never changes
    name: left_motor            # code identifier, renameable
    ref: { catalogId: dc-gearmotor-12v, version: 1.0.0 }
    config: { invert: false }
    layout: { x: 120, y: 300 }
connections:
  - id: w_1
    from: { componentId: c_tof, pin: SDA }
    to:   { componentId: c_mcu, pin: GPIO21 }
behavior:
  states: [RUN]
  variables: [{ name: distance, initial: 0 }]
  nodes: [{ id: n_start, kind: event.start, params: {}, position: {…} }, …]
  edges: [{ id: e_1, source: n_start, sourcePort: next, target: n_read }]
```

Pin assignments, I²C addresses per bus, CAN IDs per network, motor-driver channel bindings and the
power tree are **derived** from `connections` + `config` by the IR — there is exactly one place to change
them.

## 6. API design

REST over Next.js route handlers, JSON bodies validated with zod, errors as
`{ error: { code, message, details? } }`.

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/signup · /login · /logout, GET /api/auth/me | cookie session |
| GET | /api/components?q=&category= | component library |
| GET/POST | /api/projects | list / create (optional template) |
| GET/PATCH | /api/projects/:id | spec + revision |
| POST | /api/projects/:id/commands | `{ baseRevision, commands[] }` → new revision; 409 on stale base |
| GET | /api/projects/:id/revisions, POST …/revisions/:n/restore | history |
| GET | /api/projects/:id/analysis | diagnostics + IR summary |
| POST | /api/projects/:id/generate | regenerate + merge into project files |
| GET/PUT | /api/projects/:id/files[/path] | code editor; PUT refused for GENERATED |
| POST | /api/projects/:id/files/ownership | take ownership of a generated file |
| GET | /api/projects/:id/export | zip of the complete repo |
| GET/POST | /api/projects/:id/builds, GET /api/builds/:id, GET /api/builds/:id/logs (SSE), GET /api/builds/:id/artifact | builds |
| POST | /api/projects/:id/assistant | AI proposal (never auto-applied) |

**ADR-6 Optimistic concurrency on revisions.** Every command batch names the revision it was based on.
The client applies commands locally (same `applyCommands` function) for instant UI and reconciles
with the server's authoritative result.

## 7. Frontend architecture

- `app/(auth)` login/signup, `app/projects` list, `app/projects/[id]/…` IDE routes:
  overview, robot, hardware, wiring, behavior, code, build, docs.
- `components/ide/` shell: top bar, navigation rail, properties panel, validation bar/problems panel.
- `lib/store.ts` (zustand): spec, revision, catalog map, selection, derived analysis (memoized
  IR + validation run client-side), command dispatch with server reconciliation.
- Editors are thin: they translate UI gestures into commands and render the IR.

## 8. Backend architecture

`apps/web/src/server/`: `http.ts` (route wrapper, zod parsing, error mapping), `auth/`, and services
(`projects`, `catalog`, `generation`, `files`, `builds`, `assistant`). Route handlers contain no
business logic. The worker (`apps/worker`) imports the same engine packages and `@roboforge/db`; its pipeline
(`src/pipeline.ts`) is pure orchestration over a `Sandbox` interface (`DockerSandbox` in production,
a fake in tests).

## 9. Code-generation architecture

```
generateProject(spec, catalog)
  ir        = buildRobotIR(spec, catalog)          # hardware + behavior IR
  report    = validate(ir)                         # refuses on errors unless forced
  for target in registry.targetsFor(ir):          # arduino-framework(esp32|avr|stm32), ros2
      files += target.generate(ctx)
  files += common.generate(ctx)                    # robot.yaml, hardware/*.json, docs, docker, CI
merge(files, existingProjectFiles)                # ownership-aware
```

- **Targets are plugins** implementing `TargetGenerator { id, appliesTo(ir), diagnostics(ir), generate(ctx) }`.
  ESP32/AVR/STM32 share the Arduino-framework generator with per-platform board profiles
  (PlatformIO). ROS 2 is its own plugin (ament packages, launch, params, URDF/Xacro).
- **Layering in generated firmware:** `hal/` interfaces (`IMotor`, `IDistanceSensor`, `IServo`, `IImu`,
  `ISwitch`) → `drivers/` implementations → `robot_hw.cpp` wiring instances to pins from
  `robot_config.h` → `behavior.cpp` (depends only on HAL interfaces, so it is unit-testable natively) →
  `main.cpp`.
- **Ownership:** `GENERATED` files are rewritten on every generation and read-only in the editor
  (an engineer can take ownership, after which RoboForge never touches it again). `USER` files are
  created once. `MIXED` files contain `ROBOFORGE:USER-BEGIN <id>` / `USER-END` protected regions that
  survive regeneration.
- **Behavior compiles to fibers:** each event (start, timer, state-enter, e-stop) and each branch of a
  Sequence/Parallel node becomes a cooperative fiber with its own program counter. Delays never
  block; a per-tick step budget prevents runaway loops. The same IR is emitted as C++ and Python.

## 10. Validation engine architecture

```ts
interface ValidationRule {
  id: string; category: 'electrical'|'hardware'|'pin-assignment'|'communication'|'power'
                       |'software'|'safety'|'configuration';
  severity: 'error'|'warning'|'info';   // default severity
  description: string;
  evaluate(ctx: { ir, catalog }): Diagnostic[];
}
interface Diagnostic { severity; code; message; componentIds?; connectionIds?; nodeIds?; pins?; hint? }
```

Rules are small, pure and registered in a `RuleRegistry`; the frontend groups diagnostics by
category and highlights the referenced components, wires and behavior nodes. Behavior-compiler and
target diagnostics use the same `Diagnostic` shape so the problems panel is uniform.

---

## Security model (summary)

- Passwords: scrypt with per-user salt; sessions are random 256-bit tokens stored as SHA-256 hashes.
- All project routes check org membership. Commands are schema-validated before application.
- Builds: see ADR-3. AI assistant output is a *proposal* of typed commands that the user reviews;
  the assistant cannot write files or run code.

## V1 scope vs. later

In V1: auth, projects, spec + revisions, component library, hardware canvas, wiring, pin assignment,
validation, behavior editor, code generation (ESP32/Arduino/STM32 + ROS 2), Monaco editor, export,
basic sandboxed build, AI assistant (proposal mode, requires `ANTHROPIC_API_KEY`).

Later: simulation (the HAL interfaces are the seam — a `SimMotor`/`SimDistanceSensor` backend and a
Gazebo bridge plug in behind them), deployment/OTA to devices, Linux (non-ROS) runtime target,
multi-user real-time editing, org component libraries UI.
