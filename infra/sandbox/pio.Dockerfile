# Sandbox image for firmware cross-compilation. Toolchains and common libraries are baked in at
# image build time because sandboxed runs have no network by default (SANDBOX_PIO_NETWORK=none).
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir platformio==6.1.16
RUN useradd --uid 10001 --create-home runner
USER 10001
ENV PLATFORMIO_CORE_DIR=/home/runner/.platformio
RUN pio pkg install -g --platform espressif32 --platform atmelavr --platform ststm32 \
 && pio pkg install -g --library "pololu/VL53L0X@^1.3.1" --library "madhephaestus/ESP32Servo@^3.0.5" \
      --library "arduino-libraries/Servo@^1.2.2" --library "adafruit/Adafruit BNO08x@^1.2.5"
ENV HOME=/home/runner
