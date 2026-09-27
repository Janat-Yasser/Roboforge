"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Circle, History, RotateCcw, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAnalysis, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { SeverityIcon } from "@/components/ide/validation-bar";

interface Rev { number: number; message: string | null; createdAt: string }

export default function OverviewPage() {
  const project = useProject((s) => s.project)!;
  const spec = useProject((s) => s.spec)!;
  const revision = useProject((s) => s.revision);
  const reload = useProject((s) => s.reload);
  const analysis = useAnalysis();
  const [revs, setRevs] = useState<Rev[]>([]);
  const [lastBuild, setLastBuild] = useState<{ status: string; revision: number } | null>(null);

  useEffect(() => {
    api<{ revisions: Rev[] }>(`/api/projects/${project.id}/revisions`).then((r) => setRevs(r.revisions));
  }, [project.id, revision]);
  useEffect(() => {
    api<{ builds: { status: string; revision: number }[] }>(`/api/projects/${project.id}/builds`).then((r) => setLastBuild(r.builds[0] ?? null));
  }, [project.id]);

  if (!analysis) return null;
  const hw = analysis.ir.hardware;
  const r = analysis.report;
  const cat = r.categories;
  const hasController = !!hw.controller;
  const steps = [
    { label: "Hardware", href: "hardware", done: hasController && spec.components.length > 1, detail: `${spec.components.length} components${hw.controller ? ` · controller ${hw.controller.instance.name}` : " · no controller"}` },
    { label: "Wiring", href: "wiring", done: spec.connections.length > 0 && cat["pin-assignment"] !== "error" && cat.electrical !== "error", detail: `${spec.connections.length} wires · ${hw.pinAssignments.length} controller pins · ${hw.i2cBuses.length} I²C bus(es)` },
    { label: "Validation", href: "wiring", done: r.ok, detail: r.ok ? `valid · ${r.counts.warning} warnings` : `${r.counts.error} errors · ${r.counts.warning} warnings` },
    { label: "Behavior", href: "behavior", done: analysis.ir.behavior.fibers.length > 0 && cat.software !== "error", detail: `${spec.behavior.nodes.length} nodes · ${analysis.ir.behavior.fibers.length} fibers` },
    { label: "Code", href: "code", done: project.generatedRevision === revision, detail: project.generatedRevision ? `generated at rev ${project.generatedRevision}${project.generatedRevision !== revision ? " (stale)" : ""}` : "not generated" },
    { label: "Build & tests", href: "build", done: lastBuild?.status === "succeeded" && lastBuild.revision === revision, detail: lastBuild ? `last: ${lastBuild.status} (rev ${lastBuild.revision})` : "no builds" },
  ];

  async function restore(n: number) {
    if (!confirm(`Restore the specification from revision ${n}? This creates a new revision; nothing is lost.`)) return;
    try {
      await api(`/api/projects/${project.id}/revisions/${n}/restore`, { method: "POST" });
      await reload();
      toast.ok(`Restored revision ${n}.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto grid max-w-6xl grid-cols-3 gap-4">
        <section className="col-span-2 rounded-lg border border-border bg-panel p-4">
          <h1 className="text-lg font-semibold">{spec.robot.displayName}</h1>
          <p className="text-muted">{spec.robot.description || "No description."}</p>
          <div className="mt-4 space-y-1">
            {steps.map((s, i) => (
              <Link key={s.label} href={`/projects/${project.id}/${s.href}`} className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-raised">
                <span className="w-4 text-right font-mono text-[11px] text-faint">{i + 1}</span>
                {s.done ? <CheckCircle2 className="size-4 text-ok" /> : s.label === "Validation" && !r.ok ? <XCircle className="size-4 text-err" /> : <Circle className="size-4 text-faint" />}
                <span className="w-28 font-medium">{s.label}</span>
                <span className="text-[12px] text-muted">{s.detail}</span>
                <ArrowRight className="ml-auto size-3.5 text-faint opacity-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-panel p-4">
          <h2 className="label">Validation</h2>
          <ul className="space-y-1.5">
            {Object.entries(cat).map(([c, s]) => (
              <li key={c} className="flex items-center gap-2 text-[12.5px]">
                <SeverityIcon s={s} /> <span className="capitalize">{c.replace("-", " ")}</span>
                <span className={clsx("ml-auto text-[11px]", s === "pass" ? "text-ok" : s === "error" ? "text-err" : s === "warning" ? "text-warn" : "text-info")}>{s === "pass" ? "ok" : s}</span>
              </li>
            ))}
          </ul>
          <h2 className="label mt-4">Targets</h2>
          <div className="flex flex-wrap gap-1">
            {analysis.targets.map((t) => <span key={t} className="chip bg-raised">{t}</span>)}
          </div>
        </section>

        <section className="col-span-2 rounded-lg border border-border bg-panel p-4">
          <h2 className="label">Problems</h2>
          {r.diagnostics.length === 0 ? (
            <p className="text-muted">None.</p>
          ) : (
            <ul className="space-y-1.5">
              {r.diagnostics.slice(0, 12).map((d, i) => (
                <li key={i} className="flex gap-2 text-[12.5px]"><SeverityIcon s={d.severity} className="mt-0.5" />{d.message}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-panel p-4">
          <h2 className="label flex items-center gap-1"><History className="size-3.5" /> Revisions</h2>
          <ul className="max-h-80 space-y-1 overflow-auto">
            {revs.map((v) => (
              <li key={v.number} className="group flex items-center gap-2 text-[12px]">
                <span className={clsx("w-10 font-mono", v.number === revision ? "text-accent" : "text-faint")}>r{v.number}</span>
                <span className="flex-1 truncate" title={v.message ?? ""}>{v.message}</span>
                {v.number !== revision && (
                  <button className="opacity-0 group-hover:opacity-100" title="Restore" onClick={() => restore(v.number)}><RotateCcw className="size-3.5 text-muted" /></button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
