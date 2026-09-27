import type { ComponentDefinitionInput } from "./types";

const lipo = (cells: number, capacityMah: number, cRating: number): ComponentDefinitionInput => ({
  id: `lipo-${cells}s-${capacityMah}`,
  version: "1.0.0",
  name: `LiPo ${cells}S ${capacityMah} mAh`,
  manufacturer: "Generic",
  category: "power",
  description: `${cells}-cell lithium-polymer pack, ${(cells * 3.7).toFixed(1)} V nominal / ${(cells * 4.2).toFixed(1)} V full, ${cRating}C.`,
  tags: ["battery", "lipo", `${cells}s`],
  interfaces: ["power"],
  pins: [
    { name: "BAT+", type: "power_out", outputVoltage: +(cells * 3.7).toFixed(2), maxCurrentMa: capacityMah * cRating },
    { name: "BAT-", type: "ground" },
  ],
  power: {
    kind: "battery",
    chemistry: "LiPo",
    nominalV: +(cells * 3.7).toFixed(2),
    fullV: +(cells * 4.2).toFixed(2),
    capacityMah,
    maxDischargeMa: capacityMah * cRating,
  },
  geometry: { box: [0.105, 0.034, 0.012 * cells], massKg: 0.06 * cells * (capacityMah / 2200) },
});

const lm2596: ComponentDefinitionInput = {
  id: "lm2596-buck",
  version: "1.0.0",
  name: "LM2596 Buck Converter Module",
  manufacturer: "Texas Instruments (module)",
  category: "regulator",
  description: "Adjustable step-down converter, 4.5–40 V in, 1.25–37 V out, 2 A continuous (3 A peak). ~1.5 V dropout.",
  tags: ["buck", "dc-dc", "regulator", "step-down"],
  datasheetUrl: "https://www.ti.com/lit/ds/symlink/lm2596.pdf",
  interfaces: ["power"],
  electrical: { typicalCurrentMa: 5 },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 4.5, max: 40 } },
    { name: "GND_IN", label: "GND in", type: "ground" },
    { name: "VOUT", type: "power_out", outputVoltageConfigKey: "outputVoltage", maxCurrentMa: 2000 },
    { name: "GND_OUT", label: "GND out", type: "ground" },
  ],
  power: { kind: "regulator", topology: "buck", efficiency: 0.85, dropoutV: 1.5, inputPin: "VIN", outputPin: "VOUT" },
  config: [{ key: "outputVoltage", label: "Output voltage", type: "number", default: 5, min: 1.25, max: 37, unit: "V" }],
  geometry: { box: [0.043, 0.021, 0.014], massKg: 0.012 },
};

const sn65hvd230: ComponentDefinitionInput = {
  id: "sn65hvd230-can",
  version: "1.0.0",
  name: "SN65HVD230 CAN Transceiver",
  manufacturer: "Texas Instruments (module)",
  category: "communication",
  description: "3.3 V CAN transceiver, up to 1 Mbps. Module includes a 120 Ω termination resistor.",
  tags: ["can", "transceiver", "twai"],
  datasheetUrl: "https://www.ti.com/lit/ds/symlink/sn65hvd230.pdf",
  interfaces: ["can"],
  electrical: { typicalCurrentMa: 10, logicLevelV: 3.3 },
  pins: [
    { name: "3V3", type: "power_in", voltage: { min: 3.0, max: 3.6 } },
    { name: "GND", type: "ground" },
    { name: "CTX", type: "can_txd" },
    { name: "CRX", type: "can_rxd" },
    { name: "CANH", type: "can_h" },
    { name: "CANL", type: "can_l" },
  ],
  config: [{ key: "bitrate", label: "Bitrate", type: "enum", default: 500000, options: [125000, 250000, 500000, 1000000], unit: "bit/s" }],
  geometry: { box: [0.02, 0.015, 0.003], massKg: 0.002 },
};

export const power = [lipo(2, 2200, 20), lipo(3, 2200, 20), lipo(6, 5000, 20), lm2596, sn65hvd230];
