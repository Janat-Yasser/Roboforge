/** Tutorial content for the public /learn pages. Plain data so it can be rendered anywhere. */

import type { PhotoKey } from "./photos";

export type Visual = "robot3d" | "wiring" | "behavior" | "code" | "pins" | "ownership";

export interface TutorialSection {
  id: string;
  heading: string;
  body: string[];
  steps?: string[];
  tip?: string;
  warning?: string;
  visual?: Visual;
}

export interface Tutorial {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  level: "Beginner" | "Intermediate" | "Advanced";
  color: string;
  /** Cover photograph. */
  photo: PhotoKey;
  sections: TutorialSection[];
}

export const TUTORIALS: Tutorial[] = [
  {
    slug: "first-robot",
    photo: "robotCarCase",
    title: "Build your first robot",
    summary: "Create a project, meet the workspace, add parts and see your robot in 3D — in about ten minutes.",
    minutes: 10,
    level: "Beginner",
    color: "var(--rf-accent)",
    sections: [
      {
        id: "idea",
        heading: "The big idea",
        body: [
          "Every RoboForge project is built around one file: the **Robot Specification** (`robot.yaml`). It records which parts your robot has, how they are wired, and what the robot should do.",
          "Everything you do — dragging parts, drawing wires, connecting behavior blocks — edits that specification. RoboForge then checks it and generates the code. You never lose control: the generated code is normal code you can open, edit and keep.",
        ],
        visual: "robot3d",
      },
      {
        id: "create",
        heading: "Create a project",
        body: ["You can explore the demo without an account. To save your own robot, create a free account."],
        steps: [
          "Click **Start building** and create an account (name, email, password).",
          "On **My projects**, click **New project** and give it a name, e.g. *My Warehouse Scout*.",
          "Pick a starting point: **Blank robot** for an empty design, or **Differential-drive obstacle avoider** to start from a working robot you can modify.",
          "Click **Create project** — the workspace opens on the Overview page.",
        ],
        tip: "Starting from the obstacle-avoider template is the fastest way to learn: everything is already wired and valid, so you can change one thing at a time and watch what happens.",
      },
      {
        id: "tour",
        heading: "A tour of the workspace",
        body: [
          "The left sidebar is the path your robot takes from idea to code: **Overview → Robot → Hardware → Wiring → Behavior → Code → Build & Tests → Docs**.",
          "The bar at the very bottom is the **design health bar**. It always shows whether the design is valid, with one light per area: hardware, electrical, power, pins, buses, software, safety and configuration. Click it to open the list of problems — clicking a problem jumps straight to the part or wire it is about.",
          "The top bar has **Generate** (turn the design into code), **Build** (run the generated tests), and **Export** (download everything as a ready-to-use project).",
        ],
      },
      {
        id: "parts",
        heading: "Add parts and see them in 3D",
        body: ["Open **Hardware**. On the left is the parts library; in the middle the design canvas; on the right the properties of whatever you select."],
        steps: [
          "Search the library (try *ESP32*) and click **+**, or drag the part onto the canvas.",
          "Add two **DC Gearmotors**, a **TB6612FNG motor driver**, a **VL53L0X distance sensor** and a **LiPo 2S battery**.",
          "Switch the view to **3D** (top right of the canvas) — the robot's chassis, wheels and parts appear. Drag to orbit, scroll to zoom, click a part to select it.",
          "Select a sensor and set its **mount pose** (x forward, y left, z up, in metres) to move it on the 3D robot. The same pose is used for the ROS 2 robot description.",
        ],
        tip: "Every part has real technical data: supply voltage range, current draw, pin functions, I²C addresses. That's what makes the automatic checks possible.",
      },
      {
        id: "next",
        heading: "What's next",
        body: ["Your parts aren't connected yet, so the health bar will show errors — that's expected. Continue with **Wiring & validation** to connect them."],
      },
    ],
  },
  {
    slug: "wiring",
    photo: "breadboard",
    title: "Wiring & validation",
    summary: "Connect pins, let auto-wire do the boring part, and learn to read — and fix — every kind of design problem.",
    minutes: 12,
    level: "Beginner",
    color: "var(--rf-sig-i2c)",
    sections: [
      {
        id: "draw",
        heading: "Drawing wires",
        body: [
          "Every pin is a small dot on the side of a part. Drag from one pin to another to create a wire. Select a wire and press **Delete** to remove it.",
          "Pins and wires are colour-coded so you can read a design at a glance.",
        ],
        visual: "pins",
      },
      {
        id: "autowire",
        heading: "Auto-wire",
        body: [
          "Select a part and click **Auto-wire** in the properties panel. RoboForge connects ground, picks a power source whose voltage fits the part, puts I²C devices on the existing bus, and chooses free controller pins that can do the job.",
          "It deliberately avoids pins that cause trouble: flash pins, boot-mode (strapping) pins and the USB serial pins.",
        ],
        steps: [
          "Wire the power first: connect the buck converter's **VIN** to the battery's **BAT+**, and its **GND** to **BAT-**.",
          "Auto-wire in this order: **buck converter → controller → motor driver → motors → sensors**.",
          "Open **Wiring** to see the result as a table: every controller pin, its role (PWM, I²C SDA, GPIO out…) and what it's connected to, plus the I²C buses and the power budget.",
        ],
      },
      {
        id: "problems",
        heading: "Reading problems",
        body: [
          "RoboForge runs about 45 checks after every change. Red means the robot will not work or could be damaged; amber means it will work but you should know about it; blue is information such as estimated battery life.",
        ],
        visual: "wiring",
      },
      {
        id: "common",
        heading: "Common problems and fixes",
        body: [
          "**5 V into a 3.3 V pin** — e.g. an HC-SR04 echo pin on an ESP32. Fix: use a level shifter or a resistor divider, or pick a 3.3 V sensor.",
          "**I²C address conflict** — two sensors answer at the same address (two MPU-6050s at 0x68). Fix: change one address in its configuration (0x69).",
          "**Missing ground / no common ground** — parts that talk to each other must share ground. Fix: wire the GND pins together.",
          "**Voltage out of range** — e.g. a 24 V motor controller on an 11.1 V battery. Fix: choose a matching battery or regulator.",
          "**Power overload** — the source can't deliver the current. Fix: a bigger regulator, or a separate supply for motors.",
        ],
        warning: "Code generation is blocked while there are red errors. That's on purpose: generating code for hardware that can't work only hides the problem.",
      },
    ],
  },
  {
    slug: "behavior",
    photo: "robotHand",
    title: "Programming behavior with nodes",
    summary: "Make your robot think: events, sensors, conditions, motors, waits, states and safety — without writing code first.",
    minutes: 15,
    level: "Intermediate",
    color: "var(--rf-accent-3)",
    sections: [
      {
        id: "flow",
        heading: "How a behavior flows",
        body: [
          "A behavior is a graph of blocks. It starts at an **event** (such as *Robot Started*) and follows the arrows. Each block does one thing and then continues through one of its outputs.",
          "Blocks with two outputs branch: **Condition** has *true* and *false*, **Read Sensor** has *next* and *error* (if the reading fails).",
        ],
        visual: "behavior",
      },
      {
        id: "obstacle",
        heading: "Build an obstacle avoider",
        steps: [
          "Open **Behavior**. Double-click **Robot Started**, **Read Sensor**, **Condition**, two **Set Motors** and two **Wait** nodes in the palette.",
          "Select **Read Sensor** and choose your distance sensor, channel *Distance*, store in variable *distance*.",
          "Select **Condition** and set it to `distance < 0.5`.",
          "Connect: Robot Started → Read Sensor → Condition. Condition *true* → Set Motors (left −0.35, right 0.35, so it turns on the spot) → Wait (400 ms) → back to Read Sensor.",
          "Condition *false* → Set Motors (both motors 0.4) → Wait (50 ms) → back to Read Sensor.",
          "Watch the health bar: when everything is connected it says **Design valid**.",
          "Open **Simulate** and press **Run**. The robot drives around the room and turns away from boxes. Drag the boxes to test it.",
        ],
        body: [],
        tip: "Loops need a Wait. Waits never freeze the robot — other parts of the behavior keep running. If you forget one, RoboForge warns you about a busy loop.",
      },
      {
        id: "states",
        heading: "States, sequences and parallel",
        body: [
          "**States** give your robot modes such as PATROL and AVOID. *Go To State* switches mode; *On State Enter* starts the blocks for that mode, and everything from the old mode stops automatically.",
          "**Sequence** runs each branch to completion, one after another. **Parallel** runs branches at the same time and continues when all are done.",
          "**Variables** (in the side panel when nothing is selected) hold numbers such as distances or counters.",
        ],
      },
      {
        id: "safety",
        heading: "Safety first: the emergency stop",
        body: [
          "Add an **E-stop button** in Hardware and wire it. The generated code checks it on every tick: when it's pressed, all motors stop immediately, the motor driver is disabled, and the robot stays stopped until it is reset — no matter what your behavior is doing.",
          "Add an **Emergency Stop** event block if you want to do something extra when it trips, such as logging a message.",
        ],
      },
      {
        id: "functions",
        heading: "When blocks aren't enough",
        body: [
          "The **Call Function** block calls a function you write yourself. RoboForge creates an empty function in `user_functions.cpp` (and `.py` for ROS 2) inside a protected region that is never overwritten. Return `true` to continue, `false` to take the error branch.",
        ],
      },
    ],
  },
  {
    slug: "code",
    photo: "arduinoUno",
    title: "Code, builds & export",
    summary: "Generate real firmware and ROS 2 packages, edit them safely, run the tests and take your project anywhere.",
    minutes: 10,
    level: "Intermediate",
    color: "var(--rf-accent-2)",
    sections: [
      {
        id: "generate",
        heading: "Generate",
        body: [
          "Click **Generate** in the top bar. RoboForge writes a complete project: PlatformIO firmware for your controller (ESP32, Arduino or STM32), ROS 2 packages if enabled on the Robot page, a bill of materials, wiring tables, documentation, Dockerfiles and a CI workflow.",
          "The firmware is layered: hardware interfaces → drivers → pin configuration → your behavior → main loop. The behavior code only talks to interfaces, which is why it can be unit-tested on your computer without the robot.",
        ],
        visual: "code",
      },
      {
        id: "ownership",
        heading: "Who owns which file",
        body: ["Every file has an owner badge in the Code explorer:"],
        visual: "ownership",
        steps: [
          "**G — Generated**: rewritten every time you generate. Read-only in the editor; change the design instead.",
          "**M — Mixed**: generated, but code between `ROBOFORGE:USER-BEGIN` and `USER-END` markers is yours and survives regeneration (highlighted in green).",
          "**U — User**: yours alone; RoboForge never touches it again. Click **Take ownership** on any generated file to make it a user file.",
        ],
      },
      {
        id: "build",
        heading: "Build & test",
        body: [
          "Open **Build & Tests** and click **Run build**. RoboForge validates the design, then compiles and runs the generated unit tests — including an e-stop test — inside an isolated sandbox. The live log and each step's result appear as it runs.",
          "Compiler errors from a build show up as red markers directly in the code editor.",
        ],
        tip: "Sandboxed steps need Docker on the server. Without it, those steps are reported as skipped — untrusted code is never run directly on the machine.",
      },
      {
        id: "export",
        heading: "Export and run it for real",
        body: ["Click **Export** to download a zip of the whole project. It is a normal Git-ready repository:"],
        steps: [
          "Firmware: `cd firmware`, then `pio run -t upload` to flash your board and `pio test -e native` to run the tests on your PC.",
          "ROS 2: `cd ros2_ws`, `colcon build`, then `ros2 launch <robot>_bringup bringup.launch.py`.",
          "Keep `robot.yaml` in the repository — it is the source of truth you can bring back into RoboForge.",
        ],
      },
    ],
  },
];

export function tutorialBySlug(slug: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.slug === slug);
}
