import type { ComponentDefinitionInput } from "./types";

const I2C_7BIT_RANGE = Array.from({ length: 0x78 - 0x08 }, (_, i) => i + 0x08);

const vl53l0x: ComponentDefinitionInput = {
  id: "vl53l0x-breakout",
  version: "1.0.0",
  name: "VL53L0X Time-of-Flight Distance Sensor",
  manufacturer: "STMicroelectronics (carrier)",
  category: "sensor",
  description:
    "Laser ToF ranging, 30–2000 mm. Carrier with regulator and level shifting — I²C high level follows VIN. Address is software-configurable (default 0x29).",
  tags: ["distance", "tof", "lidar", "i2c"],
  datasheetUrl: "https://www.st.com/resource/en/datasheet/vl53l0x.pdf",
  interfaces: ["i2c"],
  electrical: { typicalCurrentMa: 19, peakCurrentMa: 40, logicFollowsSupplyPin: "VIN" },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 2.6, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "SDA", type: "i2c_sda" },
    { name: "SCL", type: "i2c_scl" },
    { name: "XSHUT", type: "digital_in", optional: true, notes: "Optional. Needed to assign distinct addresses to several sensors." },
    { name: "GPIO1", type: "digital_out", optional: true, notes: "Optional interrupt output." },
  ],
  sensor: {
    kind: "distance",
    channels: [{ id: "distance_m", label: "Distance", unit: "m", range: [0.03, 2.0] }],
    rosMessage: "sensor_msgs/msg/Range",
  },
  i2c: { defaultAddress: 0x29, allowedAddresses: I2C_7BIT_RANGE },
  config: [
    { key: "i2cAddress", label: "I²C address", type: "hex", default: 0x29 },
    { key: "timingBudgetMs", label: "Timing budget", type: "integer", default: 33, min: 20, max: 200, unit: "ms" },
  ],
  driver: "vl53l0x",
  geometry: { box: [0.013, 0.018, 0.002], massKg: 0.0005 },
};

const hcsr04: ComponentDefinitionInput = {
  id: "hc-sr04",
  version: "1.0.0",
  name: "HC-SR04 Ultrasonic Sensor",
  manufacturer: "Generic",
  category: "sensor",
  description: "40 kHz ultrasonic ranging, 2–400 cm. 5 V supply; ECHO outputs 5 V logic.",
  tags: ["distance", "ultrasonic", "sonar"],
  interfaces: ["gpio"],
  electrical: { typicalCurrentMa: 15, logicLevelV: 5 },
  pins: [
    { name: "VCC", type: "power_in", voltage: { min: 4.5, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "TRIG", type: "digital_in" },
    { name: "ECHO", type: "digital_out" },
  ],
  sensor: {
    kind: "distance",
    channels: [{ id: "distance_m", label: "Distance", unit: "m", range: [0.02, 4.0] }],
    rosMessage: "sensor_msgs/msg/Range",
  },
  config: [{ key: "timeoutUs", label: "Echo timeout", type: "integer", default: 25000, min: 1000, max: 60000, unit: "µs" }],
  driver: "hcsr04",
  geometry: { box: [0.045, 0.02, 0.015], massKg: 0.009 },
};

const sharpIr: ComponentDefinitionInput = {
  id: "sharp-gp2y0a21",
  version: "1.0.0",
  name: "Sharp GP2Y0A21YK0F IR Distance",
  manufacturer: "Sharp",
  category: "sensor",
  description: "Analog IR triangulation sensor, 10–80 cm, output ≈0.4–3.1 V.",
  tags: ["distance", "infrared", "analog"],
  interfaces: ["analog"],
  electrical: { typicalCurrentMa: 30, logicLevelV: 3.1 },
  pins: [
    { name: "VCC", type: "power_in", voltage: { min: 4.5, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "VO", type: "analog_out" },
  ],
  sensor: {
    kind: "distance",
    channels: [{ id: "distance_m", label: "Distance", unit: "m", range: [0.1, 0.8] }],
    rosMessage: "sensor_msgs/msg/Range",
  },
  driver: "sharp_ir",
  geometry: { box: [0.045, 0.014, 0.013], massKg: 0.004 },
};

const mpu6050: ComponentDefinitionInput = {
  id: "mpu6050-gy521",
  version: "1.0.0",
  name: "MPU-6050 6-DoF IMU (GY-521)",
  manufacturer: "TDK InvenSense (module)",
  category: "sensor",
  description: "3-axis accelerometer + gyroscope. Module has a 3.3 V LDO and 3.3 V I²C pull-ups. Address 0x68 (AD0 low) or 0x69.",
  tags: ["imu", "accelerometer", "gyroscope", "i2c"],
  interfaces: ["i2c"],
  electrical: { typicalCurrentMa: 4, logicLevelV: 3.3 },
  pins: [
    { name: "VCC", type: "power_in", voltage: { min: 3.0, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "SCL", type: "i2c_scl" },
    { name: "SDA", type: "i2c_sda" },
    { name: "INT", type: "digital_out", optional: true },
  ],
  sensor: {
    kind: "imu",
    channels: [
      { id: "yaw_deg", label: "Yaw (gyro-integrated)", unit: "deg" },
      { id: "gyro_z_dps", label: "Yaw rate", unit: "deg/s" },
      { id: "accel_x", label: "Accel X", unit: "m/s²" },
      { id: "accel_y", label: "Accel Y", unit: "m/s²" },
      { id: "accel_z", label: "Accel Z", unit: "m/s²" },
    ],
    rosMessage: "sensor_msgs/msg/Imu",
  },
  i2c: { defaultAddress: 0x68, allowedAddresses: [0x68, 0x69] },
  config: [{ key: "i2cAddress", label: "I²C address", type: "enum", default: 0x68, options: [0x68, 0x69], description: "Set by the AD0 pin." }],
  driver: "mpu6050",
  geometry: { box: [0.021, 0.016, 0.003], massKg: 0.002 },
};

const bno085: ComponentDefinitionInput = {
  id: "bno085-breakout",
  version: "1.0.0",
  name: "BNO085 9-DoF Orientation IMU",
  manufacturer: "CEVA / Bosch (breakout)",
  category: "sensor",
  description: "Sensor-fusion IMU with on-chip orientation output. Breakout with 3.3 V regulator. Address 0x4A or 0x4B.",
  tags: ["imu", "orientation", "fusion", "i2c"],
  interfaces: ["i2c", "spi", "uart"],
  electrical: { typicalCurrentMa: 12, logicLevelV: 3.3 },
  pins: [
    { name: "VIN", type: "power_in", voltage: { min: 3.0, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "SDA", type: "i2c_sda" },
    { name: "SCL", type: "i2c_scl" },
    { name: "INT", type: "digital_out", optional: true },
    { name: "RST", type: "digital_in", optional: true },
  ],
  sensor: {
    kind: "imu",
    channels: [
      { id: "yaw_deg", label: "Yaw", unit: "deg" },
      { id: "pitch_deg", label: "Pitch", unit: "deg" },
      { id: "roll_deg", label: "Roll", unit: "deg" },
    ],
    rosMessage: "sensor_msgs/msg/Imu",
  },
  i2c: { defaultAddress: 0x4a, allowedAddresses: [0x4a, 0x4b] },
  config: [{ key: "i2cAddress", label: "I²C address", type: "enum", default: 0x4a, options: [0x4a, 0x4b] }],
  driver: "bno08x",
  geometry: { box: [0.025, 0.018, 0.003], massKg: 0.003 },
};

const rplidarA1: ComponentDefinitionInput = {
  id: "rplidar-a1",
  version: "1.0.0",
  name: "RPLIDAR A1 360° Laser Scanner",
  manufacturer: "Slamtec",
  category: "sensor",
  description: "2D 360° LiDAR, 0.15–12 m, 5.5 Hz, UART 115200 baud. Usually connected to the ROS 2 host.",
  tags: ["lidar", "laser scanner", "uart", "ros2"],
  interfaces: ["uart", "usb"],
  electrical: { typicalCurrentMa: 300, peakCurrentMa: 500, logicLevelV: 3.3 },
  pins: [
    { name: "5V", type: "power_in", voltage: { min: 4.9, max: 5.5 } },
    { name: "GND", type: "ground" },
    { name: "TX", type: "uart_tx" },
    { name: "RX", type: "uart_rx" },
    { name: "MOTOCTL", type: "pwm_in", optional: true, notes: "Motor enable/speed. Tie to 5 V for full speed." },
  ],
  sensor: {
    kind: "lidar",
    channels: [
      { id: "min_distance_m", label: "Closest obstacle", unit: "m", range: [0.15, 12] },
      { id: "front_distance_m", label: "Front distance (±15°)", unit: "m", range: [0.15, 12] },
    ],
    rosMessage: "sensor_msgs/msg/LaserScan",
  },
  driver: "rplidar",
  geometry: { box: [0.1, 0.07, 0.06], massKg: 0.17 },
};

const estop: ComponentDefinitionInput = {
  id: "estop-button-nc",
  version: "1.0.0",
  name: "Emergency Stop Button (NC, latching)",
  manufacturer: "Generic",
  category: "switch",
  description:
    "Mushroom-head latching e-stop, normally-closed contact. Wire SIG to a controller input with pull-up and COM to GND: pressed ⇒ contact opens ⇒ input reads HIGH.",
  tags: ["safety", "estop", "switch"],
  interfaces: ["gpio"],
  pins: [
    { name: "SIG", type: "digital_out" },
    { name: "COM", type: "ground" },
  ],
  sensor: { kind: "switch", channels: [{ id: "active", label: "Pressed", unit: "bool" }] },
  config: [{ key: "activeHigh", label: "Active when input is HIGH", type: "boolean", default: true }],
  driver: "switch_input",
  geometry: { box: [0.04, 0.04, 0.05], massKg: 0.08 },
};

const bumper: ComponentDefinitionInput = {
  id: "microswitch-bumper",
  version: "1.0.0",
  name: "Microswitch Bumper (NO)",
  manufacturer: "Generic",
  category: "switch",
  description: "Lever microswitch, normally-open. SIG to input with pull-up, COM to GND: pressed ⇒ LOW.",
  tags: ["bumper", "limit switch", "contact"],
  interfaces: ["gpio"],
  pins: [
    { name: "SIG", type: "digital_out" },
    { name: "COM", type: "ground" },
  ],
  sensor: { kind: "switch", channels: [{ id: "active", label: "Pressed", unit: "bool" }] },
  config: [{ key: "activeHigh", label: "Active when input is HIGH", type: "boolean", default: false }],
  driver: "switch_input",
  geometry: { box: [0.02, 0.01, 0.006], massKg: 0.002 },
};

export const sensors = [vl53l0x, hcsr04, sharpIr, mpu6050, bno085, rplidarA1, estop, bumper];
