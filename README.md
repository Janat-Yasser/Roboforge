# RoboForge

[![CI](https://github.com/Janat-Yasser/Roboforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Janat-Yasser/Roboforge/actions/workflows/ci.yml)

An engineering IDE for robots. Describe a robot once — hardware, wiring, behavior — and RoboForge
validates it and generates a real, editable, Git-ready codebase: PlatformIO firmware (ESP32 / Arduino /
STM32) with a HAL, drivers and native unit tests, ROS 2 packages (URDF/Xacro, launch, params, behavior
node, pytest), hardware docs (BOM, wiring, pinout, power budget), containers and CI.

```
Robot Specification (robot.yaml)  →  Robot IR  →  Validation  →  Code generators  →  Tests / Docs / Export
        ▲         ▲         ▲                                         ESP32 · AVR · STM32 · ROS 2
 Hardware · Wiring · Behavior editors · YAML · AI assistant   (all through the same typed commands)
```

Read **[ARCHITECTURE.md](ARCHITECTURE.md)** for the design (product/system architecture, repo layout,
DB schema, spec schema, API, frontend/backend, code generation, validation engine, ADRs).

## What works in V1

The full vertical slice, exercised by `e2e/v1-flow.mjs` through the real UI:

1. Create a project (blank or from the *differential-drive obstacle avoider* template).
2. Add an ESP32, two DC motors, a TB6612FNG driver, a VL53L0X distance sensor, battery, buck, e-stop.
3. Wire pins on the canvas (drag pin → pin) or use **Auto-wire** (compatible supply, free capable pins,
   shared I²C bus, free driver channel; avoids flash/strapping/console pins).
4. Live validation: 40+ checks across electrical, power, pins, buses, hardware, software, safety and
   configuration — e.g. *"range_sensor.SDA drives 5 V into mcu.GPIO21, which tolerates 3.6 V"*, duplicate
   I²C addresses / CAN ids, pin conflicts, missing ground, regulator dropout, power budget,
   *"Motor controller … requires 20 V–28 V"*.
5. Build behavior in the node editor (events, sensors, actuators, condition, wait, sequence, parallel,
   variables, states, user functions, e-stop). It compiles to a non-blocking fiber state machine.
6. **Generate** → inspect in Monaco (generated files read-only, `ROBOFORGE:USER` regions preserved,
   *take ownership* to eject a file). Project-wide search, build errors as editor markers.
7. **Build** → a worker validates, materializes and runs the generated firmware unit tests and ROS 2
   behavior tests inside a network-less, read-only, unprivileged container; artifacts are downloadable.
8. **Export** → a zip of the complete repository.

Every spec change is a numbered revision (history + restore). The AI assistant (optional,
`ANTHROPIC_API_KEY`) edits the spec only through typed tools and returns a proposal you apply or discard.

## Quick start

Requirements: Node 22+ and pnpm 10. Optional: Docker (sandboxed builds, or Postgres in a container)
or a native PostgreSQL 16.

**1. A database** — pick one:

| Option | Command | Notes |
|---|---|---|
| Embedded (no install) | `pnpm db:local` — leave it running | PGlite: real Postgres compiled to WebAssembly, data in `.data/pglite`. Single developer. |
| Docker | `pnpm db:up` | Postgres 16 container |
| Native PostgreSQL | create role/db `roboforge` / `roboforge` | e.g. `psql -U postgres -c "CREATE USER roboforge WITH PASSWORD 'roboforge' CREATEDB;"` then `psql -U postgres -c "CREATE DATABASE roboforge OWNER roboforge;"` |

All options listen on `localhost:5432`, which is the default `DATABASE_URL`
(`postgresql://roboforge:roboforge@localhost:5432/roboforge`).

**2. Run** (in another terminal):

```bash
pnpm install
pnpm db:setup         # migrations + component library (run once, and after pulling new migrations)
pnpm dev              # http://localhost:3000
pnpm worker           # optional, third terminal: build worker
pnpm sandbox:build    # optional, needs Docker: sandbox image so builds run the generated tests
```

Without Docker the worker still validates, generates and packages builds; test/compile steps are
reported as *skipped* (they never run on the host).

**Windows / PowerShell:** Windows PowerShell 5 does not accept `&&` — run commands one per line
(all `pnpm` scripts are cross-platform). Set variables with `$env:DATABASE_URL = "..."`,
`$env:ANTHROPIC_API_KEY = "..."`.

Or run everything with `docker compose up` (Postgres + web + worker; see notes in `docker-compose.yml`).

## Tests

```bash
pnpm test        # 38 unit/integration tests: commands, IR, validation rules, code generation,
                 # merge/ownership, assistant tool loop, build pipeline.
                 # When g++ (and Unity via UNITY_SRC) / pytest are present, generated firmware is
                 # compiled with -Wall -Wextra -Werror and its tests run; generated Python tests run too.
pnpm typecheck
pnpm e2e         # full UI flow against a running server (Playwright)
```

## Repository

| Path | What |
|---|---|
| `packages/spec` | Robot Specification + component-definition schemas (zod), commands, YAML |
| `packages/catalog` | Built-in component library (25 parts) |
| `packages/ir` | Spec → IR: nets, pin assignments, buses, power tree, motor bindings; behavior compiler; auto-wiring; templates |
| `packages/validation` | Rule registry and rule sets |
| `packages/codegen` | Target plugins (project, firmware, ROS 2), ownership-aware merge, export |
| `packages/assistant` | AI agent over spec commands (proposal mode) |
| `packages/db` | Drizzle schema, migrations, seed, object storage |
| `apps/web` | Next.js IDE + API |
| `apps/worker` | Build worker + Docker sandbox |
| `infra/sandbox` | Sandbox images |
| `e2e` | End-to-end UI flow |

## Security notes

- Passwords: scrypt. Sessions: random tokens, stored hashed, httpOnly cookies.
- Every project, file and build route is scoped to the signed-in user.
- Rate limits (in-memory, per instance): sign-in 10 / 15 min per IP and 5 per email, sign-up 5 / hour per IP, AI assistant 30 / hour per user (`ASSISTANT_HOURLY_LIMIT`).
- Builds run in a container with no network, a read-only root, all capabilities dropped, a non-root user, and CPU, memory, PID and time limits.

## Known limits (V1)

- Firmware cross-compilation needs the `roboforge/sandbox-pio` image (toolchains baked in); without it
  that step is reported as *skipped*, never run on the host.
- Firmware drivers: H-bridge DC motors, CAN BLDC (ESP32 TWAI, ODrive CANSimple framing), VL53L0X,
  HC-SR04, Sharp IR, MPU-6050, BNO08x, hobby servos, switches. LiDAR is handled by the ROS 2 target.
- The ROS 2 target runs the behavior against topics; a micro-ROS firmware bridge is planned.
- Simulation and device deployment are designed-for (HAL seam) but not implemented.
