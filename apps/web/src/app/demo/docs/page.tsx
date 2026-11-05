// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { LockedSection } from "@/components/ide/locked-section";

export default function DemoDocs() {
  return <LockedSection title="Documentation, written for you" text="Every generated project includes a README, wiring tables, a bill of materials, the power budget and behavior diagrams." bullets={["Wiring table for every controller pin", "BOM with quantities and datasheet links", "Mermaid diagrams of your behavior graph"]} />;
}
