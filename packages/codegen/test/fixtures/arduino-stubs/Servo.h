#pragma once
#include <stdint.h>
struct Servo {
  uint8_t attach(int, int, int) { return 1; }
  void writeMicroseconds(int) {}
};
