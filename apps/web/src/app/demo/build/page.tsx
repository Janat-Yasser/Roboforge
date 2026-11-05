// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { LockedSection } from "@/components/ide/locked-section";

export default function DemoBuild() {
  return <LockedSection title="Build and test in a sandbox" text="Compile the generated code and run its unit tests — including the emergency-stop test — in an isolated container, with a live log." bullets={["Validation → compile → unit tests, step by step", "Compiler errors appear as markers in the editor", "Nothing runs on your machine"]} />;
}
