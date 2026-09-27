#pragma once
#include <stdint.h>
#include <Wire.h>
class VL53L0X {
 public:
  enum regAddr { RESULT_INTERRUPT_STATUS = 0x13 };
  void setBus(TwoWire*) {}
  void setTimeout(uint16_t) {}
  bool init(bool = true) { return true; }
  void setAddress(uint8_t) {}
  bool setMeasurementTimingBudget(uint32_t) { return true; }
  void startContinuous(uint32_t = 0) {}
  uint8_t readReg(uint8_t) { return 0; }
  uint16_t readRangeContinuousMillimeters() { return 0; }
  bool timeoutOccurred() { return false; }
};
