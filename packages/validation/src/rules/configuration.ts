import { rule, type RuleFinding } from "../engine";

/** Identifiers that would collide with C++/Python keywords or generated names. */
const RESERVED = new Set([
  "and", "or", "not", "if", "else", "for", "while", "do", "switch", "case", "default", "break", "continue", "return",
  "class", "struct", "union", "enum", "namespace", "template", "typename", "public", "private", "protected", "virtual",
  "static", "const", "volatile", "extern", "register", "auto", "int", "float", "double", "char", "bool", "void", "long",
  "short", "signed", "unsigned", "new", "delete", "this", "true", "false", "try", "catch", "throw", "operator", "friend",
  "inline", "goto", "sizeof", "typedef", "using", "asm", "def", "lambda", "pass", "import", "from", "as", "global",
  "nonlocal", "with", "yield", "assert", "del", "in", "is", "none", "self", "robot", "hw", "behavior", "setup", "loop",
  "main", "serial", "wire", "millis", "delay",
]);

export const configurationRules = [
  rule({
    id: "config.values",
    category: "configuration",
    severity: "error",
    description: "Component configuration values must match their declared type and range.",
    evaluate: ({ ir }) => {
      const out: RuleFinding[] = [];
      for (const rc of ir.hardware.components) {
        for (const [key, value] of Object.entries(rc.instance.config)) {
          const field = rc.def.config.find((f) => f.key === key);
          if (!field) {
            out.push({ severity: "warning", code: "CONFIG_UNKNOWN_KEY", message: `${rc.instance.name}: unknown configuration key '${key}'.`, componentIds: [rc.instance.id] });
            continue;
          }
          const numeric = ["number", "integer", "hex"].includes(field.type);
          if (numeric && typeof value !== "number") {
            out.push({ code: "CONFIG_TYPE", message: `${rc.instance.name}.${key} must be a number.`, componentIds: [rc.instance.id] });
            continue;
          }
          if (field.type === "boolean" && typeof value !== "boolean") {
            out.push({ code: "CONFIG_TYPE", message: `${rc.instance.name}.${key} must be true or false.`, componentIds: [rc.instance.id] });
            continue;
          }
          if (typeof value === "number") {
            if (field.type === "integer" && !Number.isInteger(value)) out.push({ code: "CONFIG_TYPE", message: `${rc.instance.name}.${key} must be an integer.`, componentIds: [rc.instance.id] });
            if ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max)) {
              out.push({ code: "CONFIG_OUT_OF_RANGE", message: `${rc.instance.name}.${key} = ${value}${field.unit ?? ""} is outside ${field.min ?? "-∞"}–${field.max ?? "∞"}${field.unit ?? ""}.`, componentIds: [rc.instance.id] });
            }
          }
          if (field.type === "enum" && field.options && !field.options.includes(value as string | number)) {
            out.push({ code: "CONFIG_INVALID_OPTION", message: `${rc.instance.name}.${key} must be one of ${field.options.join(", ")}.`, componentIds: [rc.instance.id] });
          }
        }
      }
      return out;
    },
  }),

  rule({
    id: "config.identifiers",
    category: "configuration",
    severity: "error",
    description: "Component, variable and robot names must be usable as code identifiers.",
    evaluate: ({ ir }) => {
      const out: RuleFinding[] = [];
      for (const c of ir.spec.components) {
        if (RESERVED.has(c.name)) out.push({ code: "RESERVED_IDENTIFIER", message: `Component name '${c.name}' is reserved in generated code. Rename it.`, componentIds: [c.id] });
      }
      for (const v of ir.spec.behavior.variables) {
        if (RESERVED.has(v.name)) out.push({ code: "RESERVED_IDENTIFIER", message: `Variable name '${v.name}' is reserved in generated code.` });
        if (ir.spec.components.some((c) => c.name === v.name)) out.push({ code: "NAME_COLLISION", message: `Variable '${v.name}' has the same name as a component.` });
      }
      if (RESERVED.has(ir.spec.robot.name)) out.push({ code: "RESERVED_IDENTIFIER", message: `Robot name '${ir.spec.robot.name}' is reserved.` });
      return out;
    },
  }),

  rule({
    id: "config.targets",
    category: "configuration",
    severity: "warning",
    description: "Enabled targets must make sense for the selected hardware.",
    evaluate: ({ ir }) => {
      const out: RuleFinding[] = [];
      const t = ir.spec.targets;
      const ctrl = ir.hardware.controller;
      if (!t.firmware.enabled && !t.ros2.enabled) out.push({ code: "NO_TARGETS", message: "No code-generation target is enabled." });
      if (t.firmware.enabled && ctrl?.def.controller?.platform === "linux") {
        out.push({
          severity: "info",
          code: "FIRMWARE_ON_LINUX",
          message: `${ctrl.instance.name} runs Linux; firmware generation is skipped. Enable ROS 2 for the host software.`,
          componentIds: [ctrl.instance.id],
        });
      }
      const drive = ir.spec.robot.drive;
      if (drive) {
        for (const id of [...drive.leftMotors, ...drive.rightMotors]) {
          const rc = ir.hardware.byId.get(id);
          if (!rc?.def.motor) out.push({ severity: "error", code: "DRIVE_NOT_A_MOTOR", message: `Drive configuration references '${rc?.instance.name ?? id}', which is not a motor.` });
        }
      } else if (t.ros2.enabled && ir.hardware.components.filter((c) => c.def.motor).length >= 2) {
        out.push({ severity: "info", code: "DRIVE_UNDEFINED", message: "Define left/right motors on the Robot page to generate /cmd_vel handling and wheel joints." });
      }
      return out;
    },
  }),
];
