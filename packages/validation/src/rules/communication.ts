import { rule, type RuleFinding } from "../engine";
import { isConnected, nameOf } from "../util";

const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, "0")}`;

export const communicationRules = [
  rule({
    id: "comm.i2c",
    category: "communication",
    severity: "error",
    description: "I²C devices need both lines on one bus with unique, valid addresses.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      const ctrl = hw.controller;
      const peripherals = ctrl?.def.controller?.peripherals.i2c ?? [];
      for (const bus of hw.i2cBuses) {
        const incomplete = bus.devices.filter((d) => !d.complete);
        for (const d of incomplete) {
          out.push({
            code: "I2C_INCOMPLETE",
            message: `${nameOf(hw, d.componentId)} has only ${bus.sda ? "SDA" : "SCL"} connected to the controller.`,
            componentIds: [d.componentId],
          });
        }
        if (bus.sda && bus.scl && ctrl) {
          const sdaBus = hw.pinAssignments.find((a) => a.pin === bus.sda!.pin)?.bus;
          const sclBus = hw.pinAssignments.find((a) => a.pin === bus.scl!.pin)?.bus;
          if (sdaBus && sclBus && sdaBus !== "*" && sclBus !== "*" && sdaBus !== sclBus) {
            out.push({
              code: "I2C_BUS_MISMATCH",
              message: `SDA on ${bus.sda.pin} (${sdaBus}) and SCL on ${bus.scl.pin} (${sclBus}) belong to different I²C peripherals.`,
              componentIds: [ctrl.instance.id, ...bus.devices.map((d) => d.componentId)],
            });
          }
        }
        if (!peripherals.includes(bus.id) && ctrl) {
          out.push({
            code: "I2C_BUS_EXHAUSTED",
            message: `${ctrl.instance.name} has ${peripherals.length} I²C peripheral(s); this design needs ${hw.i2cBuses.length} buses.`,
            componentIds: bus.devices.map((d) => d.componentId),
            hint: "Put devices with different addresses on the same SDA/SCL pair.",
          });
        }
        const byAddr = new Map<number, string[]>();
        for (const d of bus.devices) {
          if (d.address === undefined) continue;
          const rc = hw.byId.get(d.componentId)!;
          const allowed = rc.def.i2c?.allowedAddresses;
          if (allowed && !allowed.includes(d.address)) {
            out.push({
              code: "I2C_ADDRESS_INVALID",
              message: `${rc.instance.name} cannot use address ${hex(d.address)} (allowed: ${allowed.length > 6 ? `${hex(allowed[0]!)}–${hex(allowed[allowed.length - 1]!)}` : allowed.map(hex).join(", ")}).`,
              componentIds: [d.componentId],
            });
          }
          byAddr.set(d.address, [...(byAddr.get(d.address) ?? []), d.componentId]);
        }
        for (const [addr, ids] of byAddr) {
          if (ids.length < 2) continue;
          out.push({
            code: "I2C_ADDRESS_CONFLICT",
            message: `${ids.map((id) => nameOf(hw, id)).join(" and ")} both use I²C address ${hex(addr)} on ${bus.id}.`,
            componentIds: ids,
            hint: "Change the address (config or address pin) or move one device to another bus.",
          });
        }
      }
      return out;
    },
  }),

  rule({
    id: "comm.can",
    category: "communication",
    severity: "error",
    description: "CAN networks need a transceiver on a CAN-capable controller and unique node ids.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      const ctrl = hw.controller;
      for (const net of hw.canNetworks) {
        const nodeIds = net.nodes.map((n) => n.componentId);
        if (net.netIds.length < 2) {
          out.push({ code: "CAN_BUS_INCOMPLETE", message: `CAN network ${net.id} has CANH wired but no CANL.`, componentIds: nodeIds });
        }
        if (!net.transceiverId) {
          out.push({ code: "CAN_NO_TRANSCEIVER", message: `CAN network ${net.id} is not connected to the controller through a transceiver.`, componentIds: nodeIds });
        } else if (!net.controllerTx || !net.controllerRx) {
          out.push({
            code: "CAN_TRANSCEIVER_UNWIRED",
            message: `${nameOf(hw, net.transceiverId)} CTX/CRX must connect to the controller's CAN TX/RX pins.`,
            componentIds: [net.transceiverId],
          });
        }
        if (ctrl && !(ctrl.def.controller?.peripherals.can.length)) {
          out.push({ code: "CAN_UNSUPPORTED_CONTROLLER", message: `${ctrl.instance.name} has no CAN controller.`, componentIds: [ctrl.instance.id] });
        }
        const byId = new Map<number, string[]>();
        for (const n of net.nodes) byId.set(n.nodeId, [...(byId.get(n.nodeId) ?? []), n.componentId]);
        for (const [id, comps] of byId) {
          if (comps.length > 1) {
            out.push({
              code: "CAN_ID_CONFLICT",
              message: `${comps.map((c) => nameOf(hw, c)).join(" and ")} both use CAN node id ${id}.`,
              componentIds: comps,
            });
          }
        }
        for (const n of net.nodes) {
          const max = hw.byId.get(n.componentId)?.def.can?.maxNodeId;
          if (max !== undefined && (n.nodeId < 0 || n.nodeId > max)) {
            out.push({ code: "CAN_ID_OUT_OF_RANGE", message: `${nameOf(hw, n.componentId)} node id ${n.nodeId} is outside 0–${max}.`, componentIds: [n.componentId] });
          }
        }
      }
      for (const rc of hw.components) {
        if (!rc.def.can) continue;
        const canh = rc.def.pins.find((p) => p.type === "can_h");
        if (canh && !isConnected(hw, rc.instance.id, canh.name) && rc.def.pins.some((p) => isConnected(hw, rc.instance.id, p.name))) {
          out.push({ severity: "warning", code: "CAN_NODE_UNCONNECTED", message: `${rc.instance.name} is not on a CAN network.`, componentIds: [rc.instance.id] });
        }
      }
      return out;
    },
  }),

  rule({
    id: "comm.uart",
    category: "communication",
    severity: "error",
    description: "UART devices need a free UART peripheral.",
    evaluate: ({ ir }) => {
      const hw = ir.hardware;
      const out: RuleFinding[] = [];
      for (const link of hw.uartLinks) {
        if (!link.bus) {
          out.push({ code: "UART_EXHAUSTED", message: `No free UART peripheral for ${nameOf(hw, link.componentId)}.`, componentIds: [link.componentId] });
        }
        if (!link.controllerRx || !link.controllerTx) {
          out.push({
            severity: "warning",
            code: "UART_ONE_WAY",
            message: `${nameOf(hw, link.componentId)} UART is wired in one direction only (${link.controllerRx ? "RX" : "TX"}).`,
            componentIds: [link.componentId],
          });
        }
      }
      return out;
    },
  }),
];
