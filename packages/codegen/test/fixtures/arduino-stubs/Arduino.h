// Minimal Arduino API surface used ONLY to syntax/type-check generated firmware in tests.
#pragma once
#include <stddef.h>
#include <stdint.h>
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define ARDUINO_ARCH_AVR 1
#define A0 14
#define A1 15
#define A2 16
#define A3 17
#define A4 18
#define A5 19
inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return 0; }
inline void analogWrite(uint8_t, int) {}
inline int analogRead(uint8_t) { return 0; }
inline unsigned long millis() { return 0; }
inline unsigned long micros() { return 0; }
inline void delay(unsigned long) {}
inline void delayMicroseconds(unsigned int) {}
inline unsigned long pulseIn(uint8_t, uint8_t, unsigned long) { return 0; }
struct SerialT {
  void begin(unsigned long) {}
  void print(const char*) {}
  void println(const char*) {}
};
extern SerialT Serial;
