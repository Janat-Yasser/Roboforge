"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, XCircle } from "lucide-react";
import type { Diagnostic } from "@roboforge/spec";
import { useAnalysis, useProject } from "@/lib/store";

const CATEGORY_LABEL: Record<string, string> = {
  hardware: "Hardware",
  electrical: "Electrical",
  power: "Power",
  "pin-assignment": "Pins",
  communication: "Buses",
  software: "Software",
  safety: "Safety",
  configuration: "Config",
};

export function SeverityIcon({ s, className }: { s: Diagnostic["severity"] | "pass"; className?: string }) {
  const cls = clsx("size-3.5 shrink-0", className);
  if (s === "error") return <XCircle className={clsx(cls, "text-err")} />;
  if (s === "warning") return <AlertTriangle className={clsx(cls, "text-warn")} />;
  if (s === "info") return <Info className={clsx(cls, "text-info")} />;
  return <CheckCircle2 className={clsx(cls, "text-ok")} />;
}

/** Status bar (category health) + expandable Problems panel. Clicking a problem selects what it refers to. */
export function ValidationBar({ projectId }: { projectId: string }) {
  const analysis = useAnalysis();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const select = useProject((s) => s.select);
  if (!analysis) return <footer className="h-7 shrink-0 border-t border-border bg-panel" />;
  const r = analysis.report;

  function reveal(d: Diagnostic) {
    if (d.nodeIds?.length) {
      select({ kind: "node", id: d.nodeIds[0]! });
      router.push(`/projects/${projectId}/behavior`);
    } else if (d.connectionIds?.length) {
      select({ kind: "connection", id: d.connectionIds[0]! });
      router.push(`/projects/${projectId}/wiring`);
    } else if (d.componentIds?.length || d.pins?.length) {
      const id = d.componentIds?.[0] ?? d.pins![0]!.split(":")[0]!;
      select({ kind: "component", id });
      router.push(`/projects/${projectId}/wiring`);
    }
  }

  return (
    <>
      {open && (
        <div className="h-56 shrink-0 overflow-auto border-t border-border bg-panel">
          {r.diagnostics.length === 0 ? (
            <p className="p-3 text-muted">No problems. Hardware, wiring and behavior are consistent.</p>
          ) : (
            <table className="w-full text-[12px]">
              <tbody>
                {r.diagnostics.map((d, i) => (
                  <tr key={i} className="cursor-pointer border-b border-border/60 hover:bg-raised" onClick={() => reveal(d)}>
                    <td className="w-6 py-1 pl-3"><SeverityIcon s={d.severity} /></td>
                    <td className="w-28 py-1 text-muted">{CATEGORY_LABEL[d.category] ?? d.category}</td>
                    <td className="w-56 py-1 font-mono text-[11px] text-faint">{d.code}</td>
                    <td className="py-1 pr-3">
                      {d.message}
                      {d.hint && <span className="ml-2 text-muted">— {d.hint}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <footer className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-panel px-3 text-[11.5px]">
        <button className="flex items-center gap-1.5 hover:text-fg" onClick={() => setOpen((v) => !v)} data-testid="problems-toggle">
          {r.ok ? <CheckCircle2 className="size-3.5 text-ok" /> : <XCircle className="size-3.5 text-err" />}
          <span className={r.ok ? "text-ok" : "text-err"}>{r.ok ? "Design valid" : `${r.counts.error} error${r.counts.error === 1 ? "" : "s"}`}</span>
          {r.counts.warning > 0 && <span className="text-warn">{r.counts.warning} warning{r.counts.warning === 1 ? "" : "s"}</span>}
          {open ? <ChevronDown className="size-3.5 text-muted" /> : <ChevronUp className="size-3.5 text-muted" />}
        </button>
        <div className="h-4 w-px bg-border" />
        {Object.entries(r.categories).map(([c, s]) => (
          <span key={c} className="flex items-center gap-1 text-muted" title={`${CATEGORY_LABEL[c]}: ${s}`}>
            <SeverityIcon s={s} className="size-3" /> {CATEGORY_LABEL[c]}
          </span>
        ))}
        <span className="ml-auto text-faint">targets: {analysis.targets.join(", ")}</span>
      </footer>
    </>
  );
}
