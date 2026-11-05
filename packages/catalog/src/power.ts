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

const liion2s: ComponentDefinitionInput = {
  id: "liion-2s-18650-2600",
  version: "1.0.0",
  name: "Li-ion 2S 18650 Pack 2600 mAh",
  manufacturer: "Generic",
  category: "power",
  description: "Two 18650 cells in series with a protection board: 7.2 V nominal, 8.4 V full, 2600 mAh, 5 A max. Heavier but safer to store than LiPo.",
  tags: ["battery", "li-ion", "18650", "2s"],
  interfaces: ["power"],
  pins: [
    { name: "BAT+", type: "power_out", outputVoltage: 7.2, maxCurrentMa: 5000 },
    { name: "BAT-", type: "ground" },
  ],
  power: { kind: "battery", chemistry: "Li-ion", nominalV: 7.2, fullV: 8.4, capacityMah: 2600, maxDischargeMa: 5000 },
  geometry: { box: [0.07, 0.04, 0.02], massKg: 0.1 },
};

const mp1584: ComponentDefinitionInput = {
  id: "mp1584-buck",
  version: "1.0.0",
  name: "MP1584EN Mini Buck Converter",
  manufacturer: "Monolithic Power Systems (module)",
  category: "regulator",
  description: "Tiny adjustable step-down module, 4.5–28 V in, 0.8–20 V out, 3 A peak (about 2 A continuous without extra cooling). ~1 V dropout.",
  tags: ["buck", "dc-dc", "regulator", "step-down", "mini"],
  datasheetUrl: "https://www.monolithicpower.com/en/documentview/productdocument/index/version/2/document_type/Datasheet/lang/en/sku/MP1584EN",
  interfaces: ["power"],
  electrical: { typicalCurrentMa: 1 },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 4.5, max: 28 } },
    { name: "GND_IN", label: "GND in", type: "ground" },
    { name: "VOUT", type: "power_out", outputVoltageConfigKey: "outputVoltage", maxCurrentMa: 2000 },
    { name: "GND_OUT", label: "GND out", type: "ground" },
  ],
  power: { kind: "regulator", topology: "buck", efficiency: 0.9, dropoutV: 1, inputPin: "VIN", outputPin: "VOUT" },
  config: [{ key: "outputVoltage", label: "Output voltage", type: "number", default: 5, min: 0.8, max: 20, unit: "V" }],
  geometry: { box: [0.022, 0.017, 0.004], massKg: 0.003 },
};

const ams1117: ComponentDefinitionInput = {
  id: "ams1117-3v3",
  version: "1.0.0",
  name: "AMS1117-3.3 LDO Module",
  manufacturer: "Advanced Monolithic Systems (module)",
  category: "regulator",
  description: "Fixed 3.3 V linear regulator, 4.5–12 V in, 800 mA. Wastes the voltage difference as heat, so keep the current low or feed it 5 V.",
  tags: ["ldo", "linear", "regulator", "3.3v"],
  interfaces: ["power"],
  electrical: { typicalCurrentMa: 5 },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 4.5, max: 12 } },
    { name: "GND", type: "ground" },
    { name: "VOUT", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 800 },
  ],
  power: { kind: "regulator", topology: "linear", efficiency: 0.66, dropoutV: 1.1, inputPin: "VIN", outputPin: "VOUT" },
  geometry: { box: [0.025, 0.011, 0.006], massKg: 0.002 },
};

export const power = [lipo(2, 1000, 25), lipo(2, 2200, 20), lipo(3, 2200, 20), lipo(3, 5000, 30), lipo(6, 5000, 20), liion2s, lm2596, mp1584, ams1117, sn65hvd230];
