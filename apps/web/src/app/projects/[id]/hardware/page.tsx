"use client";
import { HardwareCanvas } from "@/components/hardware/hardware-canvas";
import { LibraryPanel } from "@/components/hardware/library-panel";
import { HardwarePropertiesPanel } from "@/components/hardware/properties-panel";
import { BomTable } from "@/components/hardware/bom-table";

export default function HardwarePage() {
  return (
    <div className="flex min-h-0 flex-1">
      <LibraryPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1"><HardwareCanvas /></div>
        <BomTable />
      </div>
      <HardwarePropertiesPanel />
    </div>
  );
}
