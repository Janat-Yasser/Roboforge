// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { BehaviorCanvas } from "@/components/behavior/behavior-canvas";
import { BehaviorPalette, BehaviorProperties } from "@/components/behavior/behavior-panels";

export default function BehaviorPage() {
  return (
    <div className="flex min-h-0 flex-1">
      <BehaviorPalette />
      <div className="min-w-0 flex-1">
        <BehaviorCanvas />
      </div>
      <BehaviorProperties />
    </div>
  );
}
