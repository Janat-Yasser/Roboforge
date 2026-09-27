# Sandbox image for native firmware unit tests (g++ + Unity) and ROS 2 behavior tests (pytest).
# Runs with --network=none, read-only root, tmpfs /tmp, no capabilities, uid 10001.
FROM gcc:13-bookworm
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pytest \
 && rm -rf /var/lib/apt/lists/*
ARG UNITY_VERSION=2.6.0
ADD https://github.com/ThrowTheSwitch/Unity/archive/refs/tags/v${UNITY_VERSION}.tar.gz /tmp/unity.tgz
RUN mkdir -p /opt/unity && tar -xzf /tmp/unity.tgz -C /opt/unity --strip-components=1 && rm /tmp/unity.tgz
RUN useradd --uid 10001 --home-dir /tmp --no-create-home runner
USER 10001
ENV UNITY_SRC=/opt/unity/src
