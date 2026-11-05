// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { ControllerPlatform } from "@roboforge/spec";
import { GENERATED_BANNER_CPP } from "../../util/text";

export type HalKind = "motor" | "distance" | "imu" | "switch" | "servo";

export const HAL_TYPE: Record<HalKind, string> = {
  motor: "IMotor",
  distance: "IDistanceSensor",
  imu: "IImu",
  switch: "ISwitch",
  servo: "IServo",
};

export interface FirmwareDriver {
  key: string;
  className: string;
  hal: HalKind;
  platforms: ControllerPlatform[];
  /** Files under firmware/lib/drivers/src/. */
  files: Record<string, string>;
  libDeps(platform: ControllerPlatform): string[];
}

const B = (what: string) => GENERATED_BANNER_CPP(what);

/* ------------------------------------------------------------------------------------------ */

const HBRIDGE_H = `${B("Driver: H-bridge DC motor channel (TB6612FNG, L298N, …)")}
#pragma once
#include <stdint.h>
#include "hal/motor.h"

namespace rf {

class HBridgeMotor : public IMotor {
 public:
  /**
   * @param in1, in2     direction inputs
   * @param pwm          speed (enable) input
   * @param pwmChannel   LEDC channel (ESP32 core 2.x only; ignored elsewhere)
   * @param invert       reverse the forward direction
   * @param maxDuty      maximum duty in [0, 1] (limits effective motor voltage)
   */
  HBridgeMotor(uint8_t in1, uint8_t in2, uint8_t pwm, uint8_t pwmChannel, uint32_t pwmFrequencyHz, bool invert, float maxDuty);
  bool begin();
  void setSpeed(float speed) override;
  void stop() override;
  float speed() const override { return speed_; }

 private:
  void writeDuty(float duty);
  uint8_t in1_, in2_, pwm_, channel_;
  uint32_t frequency_;
  bool invert_;
  float maxDuty_;
  float speed_ = 0.0f;
};

}  // namespace rf
`;

const HBRIDGE_CPP = `${B("Driver: H-bridge DC motor channel")}
#include "hbridge_motor.h"
#include <Arduino.h>
#if defined(ESP32)
#include <esp_arduino_version.h>
#endif

namespace rf {

namespace {
constexpr uint8_t kPwmBits = 10;
constexpr uint32_t kPwmMax = (1u << kPwmBits) - 1u;
}  // namespace

HBridgeMotor::HBridgeMotor(uint8_t in1, uint8_t in2, uint8_t pwm, uint8_t pwmChannel, uint32_t pwmFrequencyHz, bool invert, float maxDuty)
    : in1_(in1), in2_(in2), pwm_(pwm), channel_(pwmChannel), frequency_(pwmFrequencyHz), invert_(invert), maxDuty_(maxDuty) {}

bool HBridgeMotor::begin() {
  pinMode(in1_, OUTPUT);
  pinMode(in2_, OUTPUT);
#if defined(ESP32)
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  if (!ledcAttach(pwm_, frequency_, kPwmBits)) return false;
#else
  ledcSetup(channel_, frequency_, kPwmBits);
  ledcAttachPin(pwm_, channel_);
#endif
#else
  pinMode(pwm_, OUTPUT);
#endif
  stop();
  return true;
}

void HBridgeMotor::writeDuty(float duty) {
  if (duty < 0.0f) duty = 0.0f;
  if (duty > 1.0f) duty = 1.0f;
#if defined(ESP32)
  const uint32_t value = static_cast<uint32_t>(duty * kPwmMax + 0.5f);
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pwm_, value);
#else
  ledcWrite(channel_, value);
#endif
#else
  analogWrite(pwm_, static_cast<int>(duty * 255.0f + 0.5f));
#endif
}

void HBridgeMotor::setSpeed(float speed) {
  if (speed > 1.0f) speed = 1.0f;
  if (speed < -1.0f) speed = -1.0f;
  speed_ = speed;
  const float directed = invert_ ? -speed : speed;
  if (directed == 0.0f) {
    stop();
    return;
  }
  digitalWrite(in1_, directed > 0.0f ? HIGH : LOW);
  digitalWrite(in2_, directed > 0.0f ? LOW : HIGH);
  writeDuty((directed > 0.0f ? directed : -directed) * maxDuty_);
}

void HBridgeMotor::stop() {
  speed_ = 0.0f;
  digitalWrite(in1_, LOW);
  digitalWrite(in2_, LOW);
  writeDuty(0.0f);
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const VL53_H = `${B("Driver: VL53L0X time-of-flight distance sensor")}
#pragma once
#include <Wire.h>
#include <VL53L0X.h>
#include "hal/sensors.h"

namespace rf {

class Vl53l0xSensor : public IDistanceSensor {
 public:
  Vl53l0xSensor(TwoWire& wire, uint8_t address, uint32_t timingBudgetMs, float maxRangeM);
  bool begin();
  /** Non-blocking: returns the latest sample (at most one timing budget old). */
  bool readDistanceM(float& out) override;

 private:
  TwoWire& wire_;
  VL53L0X dev_;
  uint8_t address_;
  uint32_t budgetMs_;
  float maxRangeM_;
  float last_ = 0.0f;
  uint32_t lastMs_ = 0;
  bool ok_ = false;
  bool hasSample_ = false;
};

}  // namespace rf
`;

const VL53_CPP = `${B("Driver: VL53L0X time-of-flight distance sensor")}
#include "vl53l0x_sensor.h"
#include <Arduino.h>

namespace rf {

namespace {
constexpr uint8_t kDefaultAddress = 0x29;
constexpr uint16_t kNoTargetMm = 8190;  // sensor reports 8190/8191 when nothing is in range
}  // namespace

Vl53l0xSensor::Vl53l0xSensor(TwoWire& wire, uint8_t address, uint32_t timingBudgetMs, float maxRangeM)
    : wire_(wire), address_(address), budgetMs_(timingBudgetMs), maxRangeM_(maxRangeM) {}

bool Vl53l0xSensor::begin() {
  dev_.setBus(&wire_);
  dev_.setTimeout(100);
  if (!dev_.init()) return false;
  if (address_ != kDefaultAddress) dev_.setAddress(address_);
  dev_.setMeasurementTimingBudget(budgetMs_ * 1000u);
  dev_.startContinuous();
  ok_ = true;
  return true;
}

bool Vl53l0xSensor::readDistanceM(float& out) {
  if (!ok_) return false;
  const bool ready = (dev_.readReg(VL53L0X::RESULT_INTERRUPT_STATUS) & 0x07) != 0;
  if (ready) {
    const uint16_t mm = dev_.readRangeContinuousMillimeters();
    if (dev_.timeoutOccurred()) return false;
    last_ = mm >= kNoTargetMm ? maxRangeM_ : mm / 1000.0f;
    lastMs_ = millis();
    hasSample_ = true;
  }
  // Stale data (sensor stopped responding) is reported as a failure.
  if (!hasSample_ || millis() - lastMs_ > budgetMs_ * 4u + 50u) return false;
  out = last_;
  return true;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const HCSR04_H = `${B("Driver: HC-SR04 ultrasonic distance sensor")}
#pragma once
#include <stdint.h>
#include "hal/sensors.h"

namespace rf {

class HcSr04Sensor : public IDistanceSensor {
 public:
  HcSr04Sensor(uint8_t trigPin, uint8_t echoPin, uint32_t timeoutUs, float maxRangeM);
  bool begin();
  /** Blocking for up to timeoutUs (default 25 ms). */
  bool readDistanceM(float& out) override;

 private:
  uint8_t trig_, echo_;
  uint32_t timeoutUs_;
  float maxRangeM_;
};

}  // namespace rf
`;

const HCSR04_CPP = `${B("Driver: HC-SR04 ultrasonic distance sensor")}
#include "hcsr04_sensor.h"
#include <Arduino.h>

namespace rf {

HcSr04Sensor::HcSr04Sensor(uint8_t trigPin, uint8_t echoPin, uint32_t timeoutUs, float maxRangeM)
    : trig_(trigPin), echo_(echoPin), timeoutUs_(timeoutUs), maxRangeM_(maxRangeM) {}

bool HcSr04Sensor::begin() {
  pinMode(trig_, OUTPUT);
  pinMode(echo_, INPUT);
  digitalWrite(trig_, LOW);
  return true;
}

bool HcSr04Sensor::readDistanceM(float& out) {
  digitalWrite(trig_, LOW);
  delayMicroseconds(2);
  digitalWrite(trig_, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig_, LOW);
  const unsigned long us = pulseIn(echo_, HIGH, timeoutUs_);
  if (us == 0) {
    out = maxRangeM_;  // no echo within timeout: nothing in range
    return true;
  }
  out = (us * 0.000343f) / 2.0f;  // speed of sound ~343 m/s
  return true;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const SHARP_H = `${B("Driver: Sharp GP2Y0A21 analog IR distance sensor")}
#pragma once
#include <stdint.h>
#include "hal/sensors.h"

namespace rf {

class SharpIrSensor : public IDistanceSensor {
 public:
  explicit SharpIrSensor(uint8_t analogPin);
  bool begin();
  bool readDistanceM(float& out) override;

 private:
  uint8_t pin_;
};

}  // namespace rf
`;

const SHARP_CPP = `${B("Driver: Sharp GP2Y0A21 analog IR distance sensor")}
#include "sharp_ir_sensor.h"
#include <Arduino.h>
#include <math.h>

namespace rf {

SharpIrSensor::SharpIrSensor(uint8_t analogPin) : pin_(analogPin) {}

bool SharpIrSensor::begin() {
  pinMode(pin_, INPUT);
  return true;
}

bool SharpIrSensor::readDistanceM(float& out) {
#if defined(ESP32)
  const float volts = analogReadMilliVolts(pin_) / 1000.0f;
#elif defined(ARDUINO_ARCH_AVR)
  const float volts = analogRead(pin_) * (5.0f / 1023.0f);
#else
  const float volts = analogRead(pin_) * (3.3f / 1023.0f);
#endif
  if (volts < 0.35f) {
    out = 0.8f;  // beyond the calibrated range
    return true;
  }
  // Empirical fit of the datasheet curve (10–80 cm).
  float cm = 27.86f * powf(volts, -1.15f);
  if (cm < 10.0f) cm = 10.0f;
  if (cm > 80.0f) cm = 80.0f;
  out = cm / 100.0f;
  return true;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const MPU_H = `${B("Driver: MPU-6050 IMU (register-level, no external library)")}
#pragma once
#include <Wire.h>
#include "hal/sensors.h"

namespace rf {

class Mpu6050Imu : public IImu {
 public:
  Mpu6050Imu(TwoWire& wire, uint8_t address);
  /** Wakes the device and estimates the gyro Z bias (keep the robot still for ~0.5 s). */
  bool begin();
  bool read(ImuSample& out) override;

 private:
  bool readRaw(int16_t (&raw)[7]);
  TwoWire& wire_;
  uint8_t address_;
  float gyroBiasZ_ = 0.0f;
  float yawDeg_ = 0.0f;
  uint32_t lastUs_ = 0;
  bool ok_ = false;
};

}  // namespace rf
`;

const MPU_CPP = `${B("Driver: MPU-6050 IMU")}
#include "mpu6050_imu.h"
#include <Arduino.h>

namespace rf {

namespace {
constexpr uint8_t kRegPwrMgmt1 = 0x6B;
constexpr uint8_t kRegGyroConfig = 0x1B;
constexpr uint8_t kRegAccelConfig = 0x1C;
constexpr uint8_t kRegAccelXoutH = 0x3B;
constexpr uint8_t kRegWhoAmI = 0x75;
constexpr float kAccelLsbPerG = 16384.0f;  // ±2 g
constexpr float kGyroLsbPerDps = 131.0f;   // ±250 °/s
constexpr float kGravity = 9.80665f;
}  // namespace

Mpu6050Imu::Mpu6050Imu(TwoWire& wire, uint8_t address) : wire_(wire), address_(address) {}

bool Mpu6050Imu::begin() {
  wire_.beginTransmission(address_);
  wire_.write(kRegWhoAmI);
  if (wire_.endTransmission(false) != 0) return false;
  wire_.requestFrom(address_, static_cast<uint8_t>(1));
  if (!wire_.available()) return false;
  wire_.read();

  const uint8_t init[][2] = {{kRegPwrMgmt1, 0x01}, {kRegGyroConfig, 0x00}, {kRegAccelConfig, 0x00}};
  for (const auto& r : init) {
    wire_.beginTransmission(address_);
    wire_.write(r[0]);
    wire_.write(r[1]);
    if (wire_.endTransmission() != 0) return false;
  }
  delay(50);
  float sum = 0.0f;
  int16_t raw[7];
  int n = 0;
  for (int i = 0; i < 200; ++i) {
    if (readRaw(raw)) {
      sum += raw[6] / kGyroLsbPerDps;
      ++n;
    }
    delay(2);
  }
  gyroBiasZ_ = n ? sum / n : 0.0f;
  lastUs_ = micros();
  ok_ = true;
  return true;
}

bool Mpu6050Imu::readRaw(int16_t (&raw)[7]) {
  wire_.beginTransmission(address_);
  wire_.write(kRegAccelXoutH);
  if (wire_.endTransmission(false) != 0) return false;
  if (wire_.requestFrom(address_, static_cast<uint8_t>(14)) != 14) return false;
  for (int i = 0; i < 7; ++i) {
    const uint8_t hi = wire_.read();
    const uint8_t lo = wire_.read();
    raw[i] = static_cast<int16_t>((hi << 8) | lo);
  }
  // raw: ax, ay, az, temp, gx, gy, gz
  return true;
}

bool Mpu6050Imu::read(ImuSample& out) {
  if (!ok_) return false;
  int16_t raw[7];
  if (!readRaw(raw)) return false;
  const uint32_t now = micros();
  const float dt = (now - lastUs_) * 1e-6f;
  lastUs_ = now;
  const float gz = raw[6] / kGyroLsbPerDps - gyroBiasZ_;
  yawDeg_ += gz * dt;
  if (yawDeg_ > 180.0f) yawDeg_ -= 360.0f;
  if (yawDeg_ < -180.0f) yawDeg_ += 360.0f;
  out.accelX = raw[0] / kAccelLsbPerG * kGravity;
  out.accelY = raw[1] / kAccelLsbPerG * kGravity;
  out.accelZ = raw[2] / kAccelLsbPerG * kGravity;
  out.gyroZDps = gz;
  out.yawDeg = yawDeg_;
  return true;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const BNO_H = `${B("Driver: BNO08x orientation IMU (Adafruit_BNO08x)")}
#pragma once
#include <Wire.h>
#include <Adafruit_BNO08x.h>
#include "hal/sensors.h"

namespace rf {

class Bno08xImu : public IImu {
 public:
  Bno08xImu(TwoWire& wire, uint8_t address);
  bool begin();
  bool read(ImuSample& out) override;

 private:
  bool enableReports();
  TwoWire& wire_;
  uint8_t address_;
  Adafruit_BNO08x dev_;
  ImuSample last_;
  bool ok_ = false;
  bool has_ = false;
};

}  // namespace rf
`;

const BNO_CPP = `${B("Driver: BNO08x orientation IMU")}
#include "bno08x_imu.h"
#include <math.h>

namespace rf {

Bno08xImu::Bno08xImu(TwoWire& wire, uint8_t address) : wire_(wire), address_(address), dev_(-1) {}

bool Bno08xImu::enableReports() { return dev_.enableReport(SH2_GAME_ROTATION_VECTOR, 10000); }

bool Bno08xImu::begin() {
  if (!dev_.begin_I2C(address_, &wire_)) return false;
  ok_ = enableReports();
  return ok_;
}

bool Bno08xImu::read(ImuSample& out) {
  if (!ok_) return false;
  if (dev_.wasReset()) enableReports();
  sh2_SensorValue_t v;
  while (dev_.getSensorEvent(&v)) {
    if (v.sensorId != SH2_GAME_ROTATION_VECTOR) continue;
    const float qr = v.un.gameRotationVector.real, qi = v.un.gameRotationVector.i;
    const float qj = v.un.gameRotationVector.j, qk = v.un.gameRotationVector.k;
    constexpr float kRadToDeg = 57.2957795f;
    last_.yawDeg = atan2f(2.0f * (qi * qj + qk * qr), (qi * qi - qj * qj - qk * qk + qr * qr)) * kRadToDeg;
    last_.pitchDeg = asinf(-2.0f * (qi * qk - qj * qr) / (qi * qi + qj * qj + qk * qk + qr * qr)) * kRadToDeg;
    last_.rollDeg = atan2f(2.0f * (qj * qk + qi * qr), (-qi * qi - qj * qj + qk * qk + qr * qr)) * kRadToDeg;
    has_ = true;
  }
  if (!has_) return false;
  out = last_;
  return true;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const SERVO_H = `${B("Driver: hobby PWM servo")}
#pragma once
#include <stdint.h>
#if defined(ESP32)
#include <ESP32Servo.h>
#else
#include <Servo.h>
#endif
#include "hal/servo.h"

namespace rf {

class HobbyServo : public IServo {
 public:
  HobbyServo(uint8_t pin, uint16_t minUs, uint16_t maxUs, float minDeg, float maxDeg, float trimDeg);
  bool begin();
  void setAngleDeg(float angleDeg) override;

 private:
  Servo servo_;
  uint8_t pin_;
  uint16_t minUs_, maxUs_;
  float minDeg_, maxDeg_, trimDeg_;
};

}  // namespace rf
`;

const SERVO_CPP = `${B("Driver: hobby PWM servo")}
#include "hobby_servo.h"

namespace rf {

HobbyServo::HobbyServo(uint8_t pin, uint16_t minUs, uint16_t maxUs, float minDeg, float maxDeg, float trimDeg)
    : pin_(pin), minUs_(minUs), maxUs_(maxUs), minDeg_(minDeg), maxDeg_(maxDeg), trimDeg_(trimDeg) {}

bool HobbyServo::begin() {
#if defined(ESP32)
  servo_.setPeriodHertz(50);
#endif
  return servo_.attach(pin_, minUs_, maxUs_) != 0;
}

void HobbyServo::setAngleDeg(float angleDeg) {
  float a = angleDeg + trimDeg_;
  if (a < minDeg_) a = minDeg_;
  if (a > maxDeg_) a = maxDeg_;
  const float t = (a - minDeg_) / (maxDeg_ - minDeg_);
  servo_.writeMicroseconds(static_cast<int>(minUs_ + t * (maxUs_ - minUs_) + 0.5f));
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const SWITCH_H = `${B("Driver: debounced switch input (e-stop, bumper, limit switch)")}
#pragma once
#include <stdint.h>
#include "hal/sensors.h"

namespace rf {

class SwitchInput : public ISwitch {
 public:
  SwitchInput(uint8_t pin, bool activeHigh, uint32_t debounceMs);
  bool begin();
  bool isActive() override;

 private:
  uint8_t pin_;
  bool activeHigh_;
  uint32_t debounceMs_;
  bool stable_ = false;
  bool candidate_ = false;
  uint32_t changedAt_ = 0;
};

}  // namespace rf
`;

const SWITCH_CPP = `${B("Driver: debounced switch input")}
#include "switch_input.h"
#include <Arduino.h>

namespace rf {

SwitchInput::SwitchInput(uint8_t pin, bool activeHigh, uint32_t debounceMs)
    : pin_(pin), activeHigh_(activeHigh), debounceMs_(debounceMs) {}

bool SwitchInput::begin() {
  pinMode(pin_, INPUT_PULLUP);
  stable_ = candidate_ = (digitalRead(pin_) == HIGH) == activeHigh_;
  changedAt_ = millis();
  return true;
}

bool SwitchInput::isActive() {
  const bool raw = (digitalRead(pin_) == HIGH) == activeHigh_;
  const uint32_t now = millis();
  if (raw != candidate_) {
    candidate_ = raw;
    changedAt_ = now;
  } else if (candidate_ != stable_ && now - changedAt_ >= debounceMs_) {
    stable_ = candidate_;
  }
  return stable_;
}

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

const CAN_BLDC_H = `${B("Driver: BLDC motor controller over CAN (ODrive CANSimple framing), ESP32 TWAI")}
#pragma once
#include <stdint.h>
#include "hal/motor.h"

namespace rf {

/** Starts the ESP32 TWAI (CAN 2.0) peripheral. Call once before any CanBldcMotor::begin(). */
bool canBusBegin(uint8_t txPin, uint8_t rxPin, uint32_t bitrate);

class CanBldcMotor : public IMotor {
 public:
  CanBldcMotor(uint8_t nodeId, float maxVelocityTurnsPerS, bool invert);
  /** Puts the axis in closed-loop velocity control. */
  bool begin();
  void setSpeed(float speed) override;
  void stop() override;
  float speed() const override { return speed_; }

 private:
  bool send(uint8_t cmd, const uint8_t* data, uint8_t len);
  uint8_t nodeId_;
  float maxVel_;
  bool invert_;
  float speed_ = 0.0f;
};

}  // namespace rf
`;

const CAN_BLDC_CPP = `${B("Driver: BLDC motor controller over CAN")}
#include "can_bldc_motor.h"
#include <Arduino.h>
#include <string.h>
#include "driver/twai.h"

namespace rf {

namespace {
constexpr uint8_t kCmdSetAxisState = 0x07;
constexpr uint8_t kCmdSetControllerMode = 0x0B;
constexpr uint8_t kCmdSetInputVel = 0x0D;
constexpr uint32_t kAxisStateClosedLoop = 8;
constexpr uint32_t kControlModeVelocity = 2;
constexpr uint32_t kInputModePassthrough = 1;
}  // namespace

bool canBusBegin(uint8_t txPin, uint8_t rxPin, uint32_t bitrate) {
  twai_general_config_t g = TWAI_GENERAL_CONFIG_DEFAULT(static_cast<gpio_num_t>(txPin), static_cast<gpio_num_t>(rxPin), TWAI_MODE_NORMAL);
  twai_timing_config_t t;
  switch (bitrate) {
    case 125000: t = TWAI_TIMING_CONFIG_125KBITS(); break;
    case 250000: t = TWAI_TIMING_CONFIG_250KBITS(); break;
    case 1000000: t = TWAI_TIMING_CONFIG_1MBITS(); break;
    default: t = TWAI_TIMING_CONFIG_500KBITS(); break;
  }
  twai_filter_config_t f = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  if (twai_driver_install(&g, &t, &f) != ESP_OK) return false;
  return twai_start() == ESP_OK;
}

CanBldcMotor::CanBldcMotor(uint8_t nodeId, float maxVelocityTurnsPerS, bool invert)
    : nodeId_(nodeId), maxVel_(maxVelocityTurnsPerS), invert_(invert) {}

bool CanBldcMotor::send(uint8_t cmd, const uint8_t* data, uint8_t len) {
  twai_message_t msg = {};
  msg.identifier = (static_cast<uint32_t>(nodeId_) << 5) | cmd;
  msg.data_length_code = len;
  memcpy(msg.data, data, len);
  return twai_transmit(&msg, 0) == ESP_OK;
}

bool CanBldcMotor::begin() {
  uint8_t mode[8];
  memcpy(mode, &kControlModeVelocity, 4);
  memcpy(mode + 4, &kInputModePassthrough, 4);
  uint8_t state[4];
  memcpy(state, &kAxisStateClosedLoop, 4);
  return send(kCmdSetControllerMode, mode, 8) && send(kCmdSetAxisState, state, 4);
}

void CanBldcMotor::setSpeed(float speed) {
  if (speed > 1.0f) speed = 1.0f;
  if (speed < -1.0f) speed = -1.0f;
  speed_ = speed;
  const float vel = (invert_ ? -speed : speed) * maxVel_;
  const float torqueFf = 0.0f;
  uint8_t data[8];
  memcpy(data, &vel, 4);  // little-endian IEEE-754, as expected by CANSimple
  memcpy(data + 4, &torqueFf, 4);
  send(kCmdSetInputVel, data, 8);
}

void CanBldcMotor::stop() { setSpeed(0.0f); }

}  // namespace rf
`;

/* ------------------------------------------------------------------------------------------ */

export const FIRMWARE_DRIVERS: Record<string, FirmwareDriver> = {
  hbridge: {
    key: "hbridge",
    className: "HBridgeMotor",
    hal: "motor",
    platforms: ["esp32", "avr", "stm32"],
    files: { "hbridge_motor.h": HBRIDGE_H, "hbridge_motor.cpp": HBRIDGE_CPP },
    libDeps: () => [],
  },
  can_bldc: {
    key: "can_bldc",
    className: "CanBldcMotor",
    hal: "motor",
    platforms: ["esp32"],
    files: { "can_bldc_motor.h": CAN_BLDC_H, "can_bldc_motor.cpp": CAN_BLDC_CPP },
    libDeps: () => [],
  },
  vl53l0x: {
    key: "vl53l0x",
    className: "Vl53l0xSensor",
    hal: "distance",
    platforms: ["esp32", "avr", "stm32"],
    files: { "vl53l0x_sensor.h": VL53_H, "vl53l0x_sensor.cpp": VL53_CPP },
    libDeps: () => ["pololu/VL53L0X@^1.3.1"],
  },
  hcsr04: {
    key: "hcsr04",
    className: "HcSr04Sensor",
    hal: "distance",
    platforms: ["esp32", "avr", "stm32"],
    files: { "hcsr04_sensor.h": HCSR04_H, "hcsr04_sensor.cpp": HCSR04_CPP },
    libDeps: () => [],
  },
  sharp_ir: {
    key: "sharp_ir",
    className: "SharpIrSensor",
    hal: "distance",
    platforms: ["esp32", "avr", "stm32"],
    files: { "sharp_ir_sensor.h": SHARP_H, "sharp_ir_sensor.cpp": SHARP_CPP },
    libDeps: () => [],
  },
  mpu6050: {
    key: "mpu6050",
    className: "Mpu6050Imu",
    hal: "imu",
    platforms: ["esp32", "avr", "stm32"],
    files: { "mpu6050_imu.h": MPU_H, "mpu6050_imu.cpp": MPU_CPP },
    libDeps: () => [],
  },
  bno08x: {
    key: "bno08x",
    className: "Bno08xImu",
    hal: "imu",
    platforms: ["esp32", "stm32"],
    files: { "bno08x_imu.h": BNO_H, "bno08x_imu.cpp": BNO_CPP },
    libDeps: () => ["adafruit/Adafruit BNO08x@^1.2.5"],
  },
  hobby_servo: {
    key: "hobby_servo",
    className: "HobbyServo",
    hal: "servo",
    platforms: ["esp32", "avr", "stm32"],
    files: { "hobby_servo.h": SERVO_H, "hobby_servo.cpp": SERVO_CPP },
    libDeps: (p) => (p === "esp32" ? ["madhephaestus/ESP32Servo@^3.0.5"] : p === "avr" ? ["arduino-libraries/Servo@^1.2.2"] : []),
  },
  switch_input: {
    key: "switch_input",
    className: "SwitchInput",
    hal: "switch",
    platforms: ["esp32", "avr", "stm32"],
    files: { "switch_input.h": SWITCH_H, "switch_input.cpp": SWITCH_CPP },
    libDeps: () => [],
  },
};
