// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { LockedSection } from "@/components/ide/locked-section";

export default function DemoCode() {
  return <LockedSection title="Turn this robot into real code" text="Generate a complete firmware project and ROS 2 packages from the design, then edit it in a full code editor — your edits are preserved when you regenerate." bullets={["ESP32 / Arduino / STM32 firmware with drivers and pin config", "ROS 2 packages: URDF, launch files, behavior node", "Protected user regions that survive regeneration"]} />;
}
