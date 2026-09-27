import { rule, type RuleFinding } from "../engine";
import { fmtMa, fmtV, isConnected, nameOf, netOf, netVoltage } from "../util";

export const powerRules = [
  rule({
    id: "power.sources",
    category: "power",
    severity: "error",
    description: "Each power net needs exactly one source.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const p of hw.power) {
        const net = hw.nets.find((n) => n.id === p.netId)!;
        if (p.sources.length === 0 && p.sinks.length > 0) {
          out.push({
            code: "POWER_NO_SOURCE",
            message: `Power net ${p.name} has consumers (${p.sinks.map((s) => `${nameOf(hw, s.componentId)}.${s.pin}`).join(", ")}) but no supply.`,
            componentIds: p.sinks.map((s) => s.componentId),
            connectionIds: net.connectionIds,
          });
        }
        if (p.sources.length > 1) {
          out.push({
            code: "POWER_MULTIPLE_SOURCES",
            message: `Power net ${p.name} is driven by several sources (${p.sources.map((s) => `${nameOf(hw, s.componentId)}.${s.pin}`).join(", ")}). Supplies must not be paralleled.`,
            componentIds: p.sources.map((s) => s.componentId),
            connectionIds: net.connectionIds,
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "power.voltage-range",
    category: "power",
    severity: "error",
    description: "Supply voltage must be within every consumer's rated input range.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const p of hw.power) {
        if (p.voltage === undefined) continue;
        const vmax = p.maxVoltage ?? p.voltage;
        for (const s of p.sinks) {
          if (!s.range) continue;
          const rc = hw.byId.get(s.componentId)!;
          const what = rc.def.category === "motor_driver" ? "Motor controller" : rc.def.category === "controller" ? "Controller" : "Device";
          if (p.voltage < s.range.min) {
            out.push({
              code: "VOLTAGE_TOO_LOW",
              message: `${what} ${rc.instance.name}.${s.pin} requires ${fmtV(s.range.min)}–${fmtV(s.range.max)}; ${p.name} supplies ${fmtV(p.voltage)}.`,
              componentIds: [s.componentId, ...p.sources.map((x) => x.componentId)],
              pins: [`${s.componentId}:${s.pin}`],
              connectionIds: netOf(hw, s.componentId, s.pin)?.connectionIds,
            });
          } else if (vmax > s.range.max) {
            out.push({
              code: "VOLTAGE_TOO_HIGH",
              message: `${what} ${rc.instance.name}.${s.pin} tolerates at most ${fmtV(s.range.max)}; ${p.name} reaches ${fmtV(vmax)}${vmax !== p.voltage ? " when fully charged" : ""}.`,
              componentIds: [s.componentId, ...p.sources.map((x) => x.componentId)],
              pins: [`${s.componentId}:${s.pin}`],
              connectionIds: netOf(hw, s.componentId, s.pin)?.connectionIds,
            });
          }
        }
      }
      return out;
    },
  }),

  rule({
    id: "power.missing-supply",
    category: "power",
    severity: "error",
    description: "Every required power input must be connected.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const rc of hw.components) {
        const ins = rc.def.pins.filter((p) => p.type === "power_in" && !p.optional);
        if (!ins.length) continue;
        const anyConnected = rc.def.pins.some((p) => isConnected(hw, rc.instance.id, p.name));
        if (!anyConnected) continue;
        const board = rc.def.category === "controller" || rc.def.category === "sbc";
        for (const pin of ins) {
          if (isConnected(hw, rc.instance.id, pin.name)) continue;
          if (board) {
            if (pin === ins[0]) {
              out.push({
                severity: "info",
                code: "POWERED_BY_USB",
                message: `${rc.instance.name}.${pin.name} is not connected — the board is assumed to be powered over USB.`,
                componentIds: [rc.instance.id],
              });
            }
            continue;
          }
          out.push({
            code: "MISSING_POWER",
            message: `${rc.instance.name}.${pin.name} (${fmtV(pin.voltage?.min)}–${fmtV(pin.voltage?.max)}) is not connected to a supply.`,
            componentIds: [rc.instance.id],
            pins: [`${rc.instance.id}:${pin.name}`],
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "power.budget",
    category: "power",
    severity: "error",
    description: "Loads must not exceed what their source can deliver.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const p of hw.power) {
        const src = p.sources.length === 1 ? p.sources[0]! : undefined;
        if (!src?.maxCurrentMa) continue;
        const srcName = `${nameOf(hw, src.componentId)}.${src.pin}`;
        if (p.loadTypicalMa > src.maxCurrentMa) {
          out.push({
            code: "POWER_OVERLOAD",
            message: `${srcName} can deliver ${fmtMa(src.maxCurrentMa)} but the typical load is ${fmtMa(p.loadTypicalMa)}.`,
            componentIds: [src.componentId, ...p.sinks.map((s) => s.componentId)],
          });
        } else if (p.loadPeakMa > src.maxCurrentMa) {
          out.push({
            severity: "warning",
            code: "POWER_PEAK_OVERLOAD",
            message: `${srcName} can deliver ${fmtMa(src.maxCurrentMa)}; worst-case peak load is ${fmtMa(p.loadPeakMa)} (e.g. motors stalled).`,
            componentIds: [src.componentId],
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "power.regulator-headroom",
    category: "power",
    severity: "error",
    description: "Step-down/linear regulators need input voltage above output plus dropout.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const rc of hw.components) {
        const pw = rc.def.power;
        if (pw?.kind !== "regulator" || pw.topology === "boost") continue;
        const vin = netVoltage(hw, netOf(hw, rc.instance.id, pw.inputPin));
        const outPin = rc.def.pins.find((p) => p.name === pw.outputPin);
        const vout = typeof rc.instance.config[outPin?.outputVoltageConfigKey ?? ""] === "number"
          ? (rc.instance.config[outPin!.outputVoltageConfigKey!] as number)
          : (rc.def.config.find((f) => f.key === outPin?.outputVoltageConfigKey)?.default as number | undefined) ?? outPin?.outputVoltage;
        if (vin === undefined || vout === undefined) continue;
        if (vin < vout + pw.dropoutV) {
          out.push({
            code: "REGULATOR_DROPOUT",
            message: `${rc.instance.name} needs at least ${fmtV(vout + pw.dropoutV)} input to regulate ${fmtV(vout)}; it gets ${fmtV(vin)}.`,
            componentIds: [rc.instance.id],
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "power.battery-runtime",
    category: "power",
    severity: "info",
    description: "Estimated battery runtime at typical load.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const rc of hw.components) {
        if (rc.def.power?.kind !== "battery") continue;
        const plusPin = rc.def.pins.find((p) => p.type === "power_out");
        const p = plusPin && hw.power.find((x) => x.netId === netOf(hw, rc.instance.id, plusPin.name)?.id);
        if (!p || p.loadTypicalMa <= 0) continue;
        const hours = rc.def.power.capacityMah / p.loadTypicalMa;
        out.push({
          code: "BATTERY_RUNTIME",
          message: `${rc.instance.name}: ~${hours >= 1 ? `${hours.toFixed(1)} h` : `${Math.round(hours * 60)} min`} at typical load (${fmtMa(p.loadTypicalMa)}); worst case ${Math.round((rc.def.power.capacityMah / Math.max(p.loadPeakMa, 1)) * 60)} min.`,
          componentIds: [rc.instance.id],
        });
      }
      return out;
    },
  }),
];
