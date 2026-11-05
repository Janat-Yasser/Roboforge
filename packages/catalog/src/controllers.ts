import type { ComponentDefinitionInput, PinDefInputLike } from "./types";

/* ------------------------------------------------------------------------------------------ */
/* ESP32-DevKitC V4                                                                           */
/* ------------------------------------------------------------------------------------------ */

const ESP32_ADC1 = new Set([32, 33, 34, 35, 36, 39]);
const ESP32_ADC2 = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27]);
const ESP32_STRAPPING = new Set([0, 2, 5, 12, 15]);
const ESP32_INPUT_ONLY = new Set([34, 35, 36, 39]);
const ESP32_FLASH = new Set([6, 7, 8, 9, 10, 11]);
const ESP32_CONSOLE = new Set([1, 3]);

function esp32Gpio(n: number, label?: string): PinDefInputLike {
  const flags: string[] = [];
  if (ESP32_STRAPPING.has(n)) flags.push("strapping");
  if (ESP32_INPUT_ONLY.has(n)) flags.push("input_only");
  if (ESP32_FLASH.has(n)) flags.push("reserved");
  if (ESP32_ADC2.has(n)) flags.push("adc2");
  if (ESP32_CONSOLE.has(n)) flags.push("console");

  const functions: { fn: string; bus?: string }[] = [{ fn: "gpio_in" }];
  if (!ESP32_INPUT_ONLY.has(n)) {
    functions.push(
      { fn: "gpio_out" },
      { fn: "pwm" },
      { fn: "i2c_sda", bus: "*" },
      { fn: "i2c_scl", bus: "*" },
      { fn: "uart_tx", bus: "*" },
      { fn: "can_tx", bus: "twai0" },
      { fn: "spi_sck", bus: "*" },
      { fn: "spi_mosi", bus: "*" },
    );
  }
  functions.push({ fn: "uart_rx", bus: "*" }, { fn: "can_rx", bus: "twai0" }, { fn: "spi_miso", bus: "*" });
  if (ESP32_ADC1.has(n) || ESP32_ADC2.has(n)) functions.push({ fn: "adc" });

  return {
    name: `GPIO${n}`,
    label: label ?? `GPIO${n}`,
    type: "gpio",
    codeRef: String(n),
    functions,
    flags,
    ...(ESP32_FLASH.has(n) ? { notes: "Connected to the on-module SPI flash. Do not use." } : {}),
  };
}

const esp32DevkitC: ComponentDefinitionInput = {
  id: "esp32-devkitc",
  version: "1.0.0",
  name: "ESP32-DevKitC V4",
  manufacturer: "Espressif",
  category: "controller",
  description:
    "Dual-core 240 MHz Xtensa MCU board with Wi-Fi/BLE, TWAI (CAN 2.0) controller, 2× I²C, 3× UART, LEDC PWM. 3.3 V I/O, not 5 V tolerant.",
  tags: ["esp32", "wifi", "ble", "can", "twai", "mcu"],
  datasheetUrl: "https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf",
  interfaces: ["gpio", "pwm", "adc", "i2c", "spi", "uart", "can"],
  electrical: { typicalCurrentMa: 80, peakCurrentMa: 500, logicLevelV: 3.3 },
  controller: {
    platform: "esp32",
    logicLevelV: 3.3,
    platformio: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
    defaultBuses: {
      i2c: [
        { bus: "i2c0", sda: "GPIO21", scl: "GPIO22" },
        { bus: "i2c1", sda: "GPIO32", scl: "GPIO33" },
      ],
      can: [{ bus: "twai0", tx: "GPIO5", rx: "GPIO4" }],
      uart: [
        { bus: "uart2", tx: "GPIO17", rx: "GPIO16" },
        { bus: "uart1", tx: "GPIO19", rx: "GPIO18" },
      ],
    },
    peripherals: { i2c: ["i2c0", "i2c1"], uart: ["uart1", "uart2"], can: ["twai0"], spi: ["hspi", "vspi"] },
    maxPinCurrentMa: 40,
  },
  pins: [
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 500, notes: "On-board AMS1117 regulator; budget includes ESP32 headroom." },
    { name: "5V", type: "power_in", voltage: { min: 4.5, max: 5.5 }, notes: "Feeds the on-board 3.3 V regulator. Leave unconnected when powered over USB." },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    { name: "EN", type: "digital_in", optional: true, notes: "Reset (active low)." },
    ...[36, 39, 34, 35, 32, 33, 25, 26, 27, 14, 12, 13, 15, 2, 0, 4, 16, 17, 5, 18, 19, 21, 3, 1, 22, 23, 6, 7, 8, 9, 10, 11].map(
      (n) => esp32Gpio(n, n === 36 ? "VP" : n === 39 ? "VN" : n === 1 ? "TX0" : n === 3 ? "RX0" : undefined),
    ),
  ],
  config: [],
  geometry: { box: [0.055, 0.028, 0.012], massKg: 0.01 },
};

/* ------------------------------------------------------------------------------------------ */
/* Arduino Uno R3                                                                             */
/* ------------------------------------------------------------------------------------------ */

const UNO_PWM = new Set([3, 5, 6, 9, 10, 11]);

function unoDigital(n: number): PinDefInputLike {
  const functions: { fn: string; bus?: string }[] = [{ fn: "gpio_in" }, { fn: "gpio_out" }];
  if (UNO_PWM.has(n)) functions.push({ fn: "pwm" });
  if (n === 0) functions.push({ fn: "uart_rx", bus: "uart0" });
  if (n === 1) functions.push({ fn: "uart_tx", bus: "uart0" });
  if (n === 13) functions.push({ fn: "spi_sck", bus: "spi0" });
  if (n === 11) functions.push({ fn: "spi_mosi", bus: "spi0" });
  if (n === 12) functions.push({ fn: "spi_miso", bus: "spi0" });
  return {
    name: `D${n}`,
    type: "gpio",
    codeRef: String(n),
    functions,
    flags: n <= 1 ? ["console"] : [],
    fiveVoltTolerant: true,
  };
}

function unoAnalog(n: number): PinDefInputLike {
  const functions: { fn: string; bus?: string }[] = [{ fn: "gpio_in" }, { fn: "gpio_out" }, { fn: "adc" }];
  if (n === 4) functions.push({ fn: "i2c_sda", bus: "i2c0" });
  if (n === 5) functions.push({ fn: "i2c_scl", bus: "i2c0" });
  return { name: `A${n}`, type: "gpio", codeRef: `A${n}`, functions, fiveVoltTolerant: true };
}

const arduinoUno: ComponentDefinitionInput = {
  id: "arduino-uno-r3",
  version: "1.0.0",
  name: "Arduino Uno R3",
  manufacturer: "Arduino",
  category: "controller",
  description: "ATmega328P 16 MHz board. 5 V I/O, 6 PWM, 6 ADC, one I²C (A4/A5), one UART (shared with USB).",
  tags: ["arduino", "avr", "atmega328p", "mcu"],
  datasheetUrl: "https://docs.arduino.cc/hardware/uno-rev3",
  interfaces: ["gpio", "pwm", "adc", "i2c", "spi", "uart"],
  electrical: { typicalCurrentMa: 50, peakCurrentMa: 200, logicLevelV: 5 },
  controller: {
    platform: "avr",
    logicLevelV: 5,
    platformio: { platform: "atmelavr", board: "uno", framework: "arduino" },
    defaultBuses: { i2c: [{ bus: "i2c0", sda: "A4", scl: "A5" }] },
    peripherals: { i2c: ["i2c0"], uart: ["uart0"], can: [], spi: ["spi0"] },
    maxPinCurrentMa: 20,
  },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 7, max: 12 }, notes: "Barrel/VIN input. Leave unconnected when powered over USB." },
    { name: "5V", type: "power_out", outputVoltage: 5, maxCurrentMa: 400 },
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 50 },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    ...Array.from({ length: 14 }, (_, i) => unoDigital(i)),
    ...Array.from({ length: 6 }, (_, i) => unoAnalog(i)),
  ],
  geometry: { box: [0.0686, 0.0534, 0.015], massKg: 0.025 },
};

/* ------------------------------------------------------------------------------------------ */
/* STM32 Nucleo-F446RE (Arduino headers)                                                      */
/* ------------------------------------------------------------------------------------------ */

const NUCLEO_HEADER: [string, string, string[]][] = [
  ["D0", "PA3", ["uart_rx:uart2"]],
  ["D1", "PA2", ["uart_tx:uart2"]],
  ["D2", "PA10", ["uart_rx:uart1"]],
  ["D3", "PB3", ["pwm"]],
  ["D4", "PB5", []],
  ["D5", "PB4", ["pwm"]],
  ["D6", "PB10", ["pwm", "i2c_scl:i2c2"]],
  ["D7", "PA8", ["pwm"]],
  ["D8", "PA9", ["pwm", "uart_tx:uart1"]],
  ["D9", "PC7", ["pwm"]],
  ["D10", "PB6", ["pwm"]],
  ["D11", "PA7", ["pwm", "spi_mosi:spi1"]],
  ["D12", "PA6", ["spi_miso:spi1"]],
  ["D13", "PA5", ["spi_sck:spi1"]],
  ["D14", "PB9", ["i2c_sda:i2c1"]],
  ["D15", "PB8", ["i2c_scl:i2c1"]],
  ["A0", "PA0", ["adc", "pwm"]],
  ["A1", "PA1", ["adc", "pwm"]],
  ["A2", "PA4", ["adc"]],
  ["A3", "PB0", ["adc", "pwm"]],
  ["A4", "PC1", ["adc"]],
  ["A5", "PC0", ["adc"]],
];

const nucleoF446: ComponentDefinitionInput = {
  id: "stm32-nucleo-f446re",
  version: "1.0.0",
  name: "STM32 Nucleo-F446RE",
  manufacturer: "STMicroelectronics",
  category: "controller",
  description:
    "Cortex-M4F 180 MHz board with Arduino Uno V3 headers. 3.3 V I/O. 5 V tolerance is modeled conservatively (treated as not tolerant).",
  tags: ["stm32", "cortex-m4", "nucleo", "mcu"],
  datasheetUrl: "https://www.st.com/en/evaluation-tools/nucleo-f446re.html",
  interfaces: ["gpio", "pwm", "adc", "i2c", "spi", "uart"],
  electrical: { typicalCurrentMa: 100, peakCurrentMa: 300, logicLevelV: 3.3 },
  controller: {
    platform: "stm32",
    logicLevelV: 3.3,
    platformio: { platform: "ststm32", board: "nucleo_f446re", framework: "arduino" },
    defaultBuses: { i2c: [{ bus: "i2c1", sda: "D14", scl: "D15" }] },
    peripherals: { i2c: ["i2c1", "i2c2"], uart: ["uart1", "uart2"], can: [], spi: ["spi1"] },
    maxPinCurrentMa: 25,
  },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 7, max: 12 }, notes: "Leave unconnected when powered over USB (ST-LINK)." },
    { name: "5V", type: "power_out", outputVoltage: 5, maxCurrentMa: 300 },
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 300 },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    ...NUCLEO_HEADER.map(([name, port, extra]): PinDefInputLike => ({
      name,
      label: `${name}/${port}`,
      type: "gpio",
      codeRef: port,
      functions: [
        { fn: "gpio_in" },
        { fn: "gpio_out" },
        ...extra.map((e) => {
          const [fn, bus] = e.split(":");
          return bus ? { fn: fn!, bus } : { fn: fn! };
        }),
      ],
      flags: name === "D0" || name === "D1" ? ["console"] : [],
    })),
  ],
  geometry: { box: [0.07, 0.082, 0.015], massKg: 0.03 },
};

/* ------------------------------------------------------------------------------------------ */
/* Raspberry Pi 4 Model B                                                                     */
/* ------------------------------------------------------------------------------------------ */

const rpiGpio = (n: number, extra: string[] = []): PinDefInputLike => ({
  name: `GPIO${n}`,
  type: "gpio",
  codeRef: String(n),
  functions: [
    { fn: "gpio_in" },
    { fn: "gpio_out" },
    ...extra.map((e) => {
      const [fn, bus] = e.split(":");
      return bus ? { fn: fn!, bus } : { fn: fn! };
    }),
  ],
});

const rpi4: ComponentDefinitionInput = {
  id: "raspberry-pi-4b",
  version: "1.0.0",
  name: "Raspberry Pi 4 Model B",
  manufacturer: "Raspberry Pi Ltd",
  category: "sbc",
  description: "Quad-core Cortex-A72 Linux SBC. Typical ROS 2 host. 3.3 V GPIO, not 5 V tolerant.",
  tags: ["linux", "ros2", "sbc", "raspberry pi"],
  datasheetUrl: "https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-datasheet.pdf",
  interfaces: ["gpio", "pwm", "i2c", "spi", "uart", "ethernet", "usb"],
  electrical: { typicalCurrentMa: 700, peakCurrentMa: 3000, logicLevelV: 3.3 },
  controller: {
    platform: "linux",
    logicLevelV: 3.3,
    defaultBuses: { i2c: [{ bus: "i2c1", sda: "GPIO2", scl: "GPIO3" }], uart: [{ bus: "uart0", tx: "GPIO14", rx: "GPIO15" }] },
    peripherals: { i2c: ["i2c1"], uart: ["uart0"], can: [], spi: ["spi0"] },
  },
  pins: [
    { name: "5V", type: "power_in", voltage: { min: 4.75, max: 5.25 } },
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 500 },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    rpiGpio(2, ["i2c_sda:i2c1"]),
    rpiGpio(3, ["i2c_scl:i2c1"]),
    rpiGpio(14, ["uart_tx:uart0"]),
    rpiGpio(15, ["uart_rx:uart0"]),
    rpiGpio(12, ["pwm"]),
    rpiGpio(13, ["pwm"]),
    ...[4, 5, 6, 16, 17, 22, 23, 24, 25, 26, 27].map((n) => rpiGpio(n)),
    { name: "ETH", type: "ethernet" },
    { name: "USB", type: "usb" },
  ],
  geometry: { box: [0.085, 0.056, 0.017], massKg: 0.046 },
};

/* ------------------------------------------------------------------------------------------ */
/* Arduino Nano (ATmega328P)                                                                  */
/* ------------------------------------------------------------------------------------------ */

const arduinoNano: ComponentDefinitionInput = {
  id: "arduino-nano",
  version: "1.0.0",
  name: "Arduino Nano",
  manufacturer: "Arduino",
  category: "controller",
  description:
    "The Uno's ATmega328P on a breadboard-sized board. 5 V I/O, 6 PWM, one I²C (A4/A5). A6 and A7 are analog inputs only.",
  tags: ["arduino", "avr", "atmega328p", "mcu", "nano"],
  datasheetUrl: "https://docs.arduino.cc/hardware/nano",
  interfaces: ["gpio", "pwm", "adc", "i2c", "spi", "uart"],
  electrical: { typicalCurrentMa: 25, peakCurrentMa: 200, logicLevelV: 5 },
  controller: {
    platform: "avr",
    logicLevelV: 5,
    platformio: { platform: "atmelavr", board: "nanoatmega328new", framework: "arduino" },
    defaultBuses: { i2c: [{ bus: "i2c0", sda: "A4", scl: "A5" }] },
    peripherals: { i2c: ["i2c0"], uart: ["uart0"], can: [], spi: ["spi0"] },
    maxPinCurrentMa: 20,
  },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 7, max: 12 }, notes: "Leave unconnected when powered over USB." },
    { name: "5V", type: "power_out", outputVoltage: 5, maxCurrentMa: 400 },
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 50 },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    ...Array.from({ length: 14 }, (_, i) => unoDigital(i)),
    ...Array.from({ length: 6 }, (_, i) => unoAnalog(i)),
    ...[6, 7].map((n): PinDefInputLike => ({ name: `A${n}`, type: "gpio", codeRef: `A${n}`, functions: [{ fn: "adc" }], flags: ["input_only"], fiveVoltTolerant: true })),
  ],
  geometry: { box: [0.045, 0.018, 0.012], massKg: 0.007 },
};

/* ------------------------------------------------------------------------------------------ */
/* Arduino Mega 2560 Rev3                                                                     */
/* ------------------------------------------------------------------------------------------ */

const MEGA_PWM = new Set([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46]);
const MEGA_UART: Record<number, [string, string]> = {
  0: ["uart_rx", "uart0"], 1: ["uart_tx", "uart0"],
  19: ["uart_rx", "uart1"], 18: ["uart_tx", "uart1"],
  17: ["uart_rx", "uart2"], 16: ["uart_tx", "uart2"],
  15: ["uart_rx", "uart3"], 14: ["uart_tx", "uart3"],
};

function megaDigital(n: number): PinDefInputLike {
  const functions: { fn: string; bus?: string }[] = [{ fn: "gpio_in" }, { fn: "gpio_out" }];
  if (MEGA_PWM.has(n)) functions.push({ fn: "pwm" });
  const u = MEGA_UART[n];
  if (u) functions.push({ fn: u[0], bus: u[1] });
  if (n === 20) functions.push({ fn: "i2c_sda", bus: "i2c0" });
  if (n === 21) functions.push({ fn: "i2c_scl", bus: "i2c0" });
  if (n === 50) functions.push({ fn: "spi_miso", bus: "spi0" });
  if (n === 51) functions.push({ fn: "spi_mosi", bus: "spi0" });
  if (n === 52) functions.push({ fn: "spi_sck", bus: "spi0" });
  return { name: `D${n}`, type: "gpio", codeRef: String(n), functions, flags: n <= 1 ? ["console"] : [], fiveVoltTolerant: true };
}

const arduinoMega: ComponentDefinitionInput = {
  id: "arduino-mega-2560",
  version: "1.0.0",
  name: "Arduino Mega 2560 Rev3",
  manufacturer: "Arduino",
  category: "controller",
  description:
    "ATmega2560 16 MHz board for robots with many parts: 54 digital pins (15 PWM), 16 analog inputs, 4 UARTs, I²C on D20/D21. 5 V I/O.",
  tags: ["arduino", "avr", "atmega2560", "mcu", "mega"],
  datasheetUrl: "https://docs.arduino.cc/hardware/mega-2560",
  interfaces: ["gpio", "pwm", "adc", "i2c", "spi", "uart"],
  electrical: { typicalCurrentMa: 70, peakCurrentMa: 400, logicLevelV: 5 },
  controller: {
    platform: "avr",
    logicLevelV: 5,
    platformio: { platform: "atmelavr", board: "megaatmega2560", framework: "arduino" },
    defaultBuses: {
      i2c: [{ bus: "i2c0", sda: "D20", scl: "D21" }],
      uart: [{ bus: "uart1", tx: "D18", rx: "D19" }, { bus: "uart2", tx: "D16", rx: "D17" }],
    },
    peripherals: { i2c: ["i2c0"], uart: ["uart0", "uart1", "uart2", "uart3"], can: [], spi: ["spi0"] },
    maxPinCurrentMa: 20,
  },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 7, max: 12 }, notes: "Barrel/VIN input. Leave unconnected when powered over USB." },
    { name: "5V", type: "power_out", outputVoltage: 5, maxCurrentMa: 800 },
    { name: "3V3", type: "power_out", outputVoltage: 3.3, maxCurrentMa: 50 },
    { name: "GND", type: "ground" },
    { name: "GND_2", label: "GND", type: "ground" },
    ...Array.from({ length: 54 }, (_, i) => megaDigital(i)),
    ...Array.from({ length: 16 }, (_, i): PinDefInputLike => ({ name: `A${i}`, type: "gpio", codeRef: `A${i}`, functions: [{ fn: "gpio_in" }, { fn: "gpio_out" }, { fn: "adc" }], fiveVoltTolerant: true })),
  ],
  geometry: { box: [0.1016, 0.0533, 0.015], massKg: 0.037 },
};

export const controllers = [esp32DevkitC, arduinoUno, arduinoNano, arduinoMega, nucleoF446, rpi4];
