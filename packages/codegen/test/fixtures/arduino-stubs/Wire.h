#pragma once
#include <stddef.h>
#include <stdint.h>
struct TwoWire {
  TwoWire() {}
  TwoWire(uint32_t, uint32_t) {}
  void begin() {}
  void begin(int, int) {}
  void setSDA(uint32_t) {}
  void setSCL(uint32_t) {}
  void setClock(uint32_t) {}
  void beginTransmission(uint8_t) {}
  size_t write(uint8_t) { return 1; }
  uint8_t endTransmission(bool = true) { return 0; }
  uint8_t requestFrom(uint8_t, uint8_t) { return 0; }
  int available() { return 0; }
  int read() { return 0; }
};
extern TwoWire Wire;
