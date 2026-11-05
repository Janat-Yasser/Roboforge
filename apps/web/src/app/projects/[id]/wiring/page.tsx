// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { HardwareCanvas } from "@/components/hardware/hardware-canvas";
import { PinoutPanel } from "@/components/hardware/pinout-panel";
import { HardwarePropertiesPanel } from "@/components/hardware/properties-panel";

export default function WiringPage() {
  return (
    <div className="flex min-h-0 flex-1">
      <PinoutPanel />
      <div className="min-w-0 flex-1">
        <HardwareCanvas />
      </div>
      <HardwarePropertiesPanel
        empty={
          <div className="space-y-2 p-3 text-[12px] text-muted">
            <p>Drag from one pin to another to create a wire. Select a wire and press <span className="kbd">Del</span> to remove it.</p>
            <p>Pin roles, I²C buses, CAN ids and the power budget on the left are derived from the wiring and validated live.</p>
          </div>
        }
      />
    </div>
  );
}
