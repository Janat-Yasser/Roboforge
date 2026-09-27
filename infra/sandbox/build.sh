#!/usr/bin/env bash
# Builds the sandbox images used by the build worker.
set -euo pipefail
cd "$(dirname "$0")"
docker build -f native.Dockerfile -t roboforge/sandbox-native:1 .
if [[ "${WITH_PIO:-0}" == "1" ]]; then
  docker build -f pio.Dockerfile -t roboforge/sandbox-pio:1 .
fi
