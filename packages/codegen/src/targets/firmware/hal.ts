import { GENERATED_BANNER_CPP } from "../../util/text";

/**
 * Hardware abstraction layer headers. Behavior code depends ONLY on these interfaces, which is
 * what makes it portable across boards and unit-testable on the host (PlatformIO `native`).
 */
export const HAL_FILES: Record<string, string> = {
  "include/hal/motor.h": `${GENERATED_BANNER_CPP("HAL: motor interface")}
#pragma once

namespace rf {

/** A motor commanded with a normalized speed. */
class IMotor {
 public:
  virtual ~IMotor() = default;
  /** Normalized command in [-1, 1]; positive is the robot's forward direction. */
  virtual void setSpeed(float speed) = 0;
  /** Brings the output to zero (coast). */
  virtual void stop() = 0;
  /** Last commanded speed. */
  virtual float speed() const = 0;
};

/** Hard enable/disable for all motor power stages (driver STBY/EN pins). */
class IOutputEnable {
 public:
  virtual ~IOutputEnable() = default;
  virtual void setEnabled(bool enabled) = 0;
};

}  // namespace rf
`,
  "include/hal/sensors.h": `${GENERATED_BANNER_CPP("HAL: sensor interfaces")}
#pragma once

namespace rf {

class IDistanceSensor {
 public:
  virtual ~IDistanceSensor() = default;
  /** Distance in metres. Returns false if no valid measurement is available. */
  virtual bool readDistanceM(float& out) = 0;
};

struct ImuSample {
  float yawDeg = 0.0f;
  float pitchDeg = 0.0f;
  float rollDeg = 0.0f;
  float gyroZDps = 0.0f;
  float accelX = 0.0f;
  float accelY = 0.0f;
  float accelZ = 0.0f;
};

class IImu {
 public:
  virtual ~IImu() = default;
  virtual bool read(ImuSample& out) = 0;
};

class ISwitch {
 public:
  virtual ~ISwitch() = default;
  /** True while the switch is in its active (pressed / tripped) state. */
  virtual bool isActive() = 0;
};

}  // namespace rf
`,
  "include/hal/servo.h": `${GENERATED_BANNER_CPP("HAL: servo interface")}
#pragma once

namespace rf {

class IServo {
 public:
  virtual ~IServo() = default;
  virtual void setAngleDeg(float angleDeg) = 0;
};

}  // namespace rf
`,
  "include/hal/log.h": `${GENERATED_BANNER_CPP("HAL: logging")}
#pragma once

namespace rf {

class ILogger {
 public:
  virtual ~ILogger() = default;
  virtual void info(const char* message) = 0;
  virtual void warn(const char* message) = 0;
};

}  // namespace rf
`,
};
