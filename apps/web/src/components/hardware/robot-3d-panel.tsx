"use client";
import { useMemo } from "react";
import { useTheme } from "next-themes";
import { Move3d } from "lucide-react";
import { RobotPreview } from "@/components/robot3d";
import { useAnalysis, useProject } from "@/lib/store";

/** Live 3D view of the current spec, selection-synced with the 2D canvas and tinted by validation. */
export function Robot3DPanel() {
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const selection = useProject((s) => s.selection);
  const select = useProject((s) => s.select);
  const analysis = useAnalysis();
  const { resolvedTheme } = useTheme();
  const severity = useMemo(() => {
    const out: Record<string, "error" | "warning" | undefined> = {};
    for (const d of analysis?.report.diagnostics ?? []) {
      const ids = [...(d.componentIds ?? []), ...(d.pins ?? []).map((p) => p.split(":")[0]!)];
      for (const id of ids) if (d.severity === "error" || (d.severity === "warning" && !out[id])) out[id] = d.severity;
    }
    return out;
  }, [analysis]);
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-bg-soft to-bg">
      <RobotPreview
        spec={spec}
        catalog={catalog}
        dark={resolvedTheme === "dark"}
        showSensors
        spinWheels
        selectedId={selection?.kind === "component" ? selection.id : null}
        onSelect={(id) => select(id ? { kind: "component", id } : null)}
        severity={severity}
      />
      <div className="glass pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] text-muted">
        <Move3d className="size-3.5" /> Drag to orbit · scroll to zoom · click a part to select
      </div>
    </div>
  );
}
