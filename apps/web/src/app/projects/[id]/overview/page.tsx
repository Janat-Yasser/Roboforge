"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Circle, History, RotateCcw, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAnalysis, useBasePath, useIsDemo, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { SeverityIcon } from "@/components/ide/validation-bar";
import { RobotPreview } from "@/components/robot3d";

interface Rev { number: number; message: string | null; createdAt: string }

const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export default function OverviewPage() {
  const project = useProject((s) => s.project)!;
  const spec = useProject((s) => s.spec)!;
  const catalog = useProject((s) => s.catalog);
  const revision = useProject((s) => s.revision);
  const reload = useProject((s) => s.reload);
  const analysis = useAnalysis();
  const base = useBasePath();
  const demo = useIsDemo();
  const { resolvedTheme } = useTheme();
  const [revs, setRevs] = useState<Rev[]>([]);
  const [lastBuild, setLastBuild] = useState<{ status: string; revision: number } | null>(null);

  useEffect(() => {
    if (demo) return;
    api<{ revisions: Rev[] }>(`/api/projects/${project.id}/revisions`).then((r) => setRevs(r.revisions)).catch(() => {});
  }, [project.id, revision, demo]);
  useEffect(() => {
    if (demo) return;
    api<{ builds: { status: string; revision: number }[] }>(`/api/projects/${project.id}/builds`).then((r) => setLastBuild(r.builds[0] ?? null)).catch(() => {});
  }, [project.id, demo]);

  if (!analysis) return null;
  const hw = analysis.ir.hardware;
  const r = analysis.report;
  const cat = r.categories;
  const hasController = !!hw.controller;
  const steps = [
    { label: "Hardware", href: "hardware", done: hasController && spec.components.length > 1, detail: `${spec.components.length} components${hw.controller ? ` · controller ${hw.controller.instance.name}` : " · no controller"}` },
    { label: "Wiring", href: "wiring", done: spec.connections.length > 0 && cat["pin-assignment"] !== "error" && cat.electrical !== "error", detail: `${spec.connections.length} wires · ${hw.pinAssignments.length} controller pins · ${hw.i2cBuses.length} I²C bus(es)` },
    { label: "Validation", href: "wiring", done: r.ok, detail: r.ok ? `valid · ${r.counts.warning} warnings` : `${r.counts.error} errors · ${r.counts.warning} warnings` },
    { label: "Behavior", href: "behavior", done: analysis.ir.behavior.fibers.length > 0 && cat.software !== "error", detail: `${spec.behavior.nodes.length} blocks · ${analysis.ir.behavior.fibers.length} fibers` },
    { label: "Code", href: "code", done: project.generatedRevision === revision, detail: demo ? "sign up to generate" : project.generatedRevision ? `generated at rev ${project.generatedRevision}${project.generatedRevision !== revision ? " (stale)" : ""}` : "not generated" },
    { label: "Build & tests", href: "build", done: lastBuild?.status === "succeeded" && lastBuild.revision === revision, detail: demo ? "sign up to build" : lastBuild ? `last: ${lastBuild.status} (rev ${lastBuild.revision})` : "no builds" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

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

  const severity: Record<string, "error" | "warning" | undefined> = {};
  for (const d of r.diagnostics) for (const id of d.componentIds ?? []) if (d.severity === "error" || (d.severity === "warning" && !severity[id])) severity[id] = d.severity;

  return (
    <div className="flex-1 overflow-auto p-6">
      <motion.div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3" initial="hidden" animate="show" transition={{ staggerChildren: 0.06 }}>
        <motion.section variants={item} className="card relative overflow-hidden p-6 lg:col-span-2">
          <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <h1 className="display text-[30px]">{spec.robot.displayName}</h1>
              <p className="mt-1 text-muted">{spec.robot.description || "No description yet — add one on the Robot page."}</p>
            </div>
            <div className="relative grid size-16 shrink-0 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--rf-border)" strokeWidth="3" />
                <motion.circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--rf-accent)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: doneCount / steps.length }} transition={{ duration: 1, ease: "easeOut" }} />
              </svg>
              <span className="text-[13px] font-bold">{doneCount}/{steps.length}</span>
            </div>
          </div>
          <div className="relative mt-5 space-y-1">
            {steps.map((s, i) => (
              <Link key={s.label} href={`${base}/${s.href}`} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-raised">
                <span className="w-4 text-right font-mono text-[11px] text-faint">{i + 1}</span>
                {s.done ? <CheckCircle2 className="size-[18px] text-ok" /> : s.label === "Validation" && !r.ok ? <XCircle className="size-[18px] text-err" /> : <Circle className="size-[18px] text-faint" />}
                <span className="w-28 font-medium">{s.label}</span>
                <span className="text-[12.5px] text-muted">{s.detail}</span>
                <ArrowRight className="ml-auto size-4 -translate-x-1 text-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </motion.section>

        <motion.section variants={item} className="card relative min-h-[300px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent-2/10" />
          <RobotPreview spec={spec} catalog={catalog} dark={resolvedTheme === "dark"} autoRotate interactive={false} severity={severity} />
          <Link href={`${base}/hardware?view=3d`} className="glass absolute bottom-3 left-3 rounded-full px-3 py-1 text-[11.5px] font-medium hover:text-accent">Open in 3D →</Link>
        </motion.section>

        <motion.section variants={item} className="card p-5 lg:col-span-2">
          <h2 className="label">Problems</h2>
          {r.diagnostics.length === 0 ? (
            <p className="flex items-center gap-2 text-ok"><CheckCircle2 className="size-4" /> None — hardware, wiring and behavior are consistent.</p>
          ) : (
            <ul className="space-y-2">
              {r.diagnostics.slice(0, 12).map((d, i) => (
                <li key={i} className="flex gap-2 text-[13px]"><SeverityIcon s={d.severity} className="mt-0.5" /><span>{d.message}{d.hint && <span className="text-muted"> — {d.hint}</span>}</span></li>
              ))}
            </ul>
          )}
        </motion.section>

        <motion.section variants={item} className="card p-5">
          <h2 className="label">Design health</h2>
          <ul className="space-y-2">
            {Object.entries(cat).map(([c, s]) => (
              <li key={c} className="flex items-center gap-2 text-[13px]">
                <SeverityIcon s={s} /> <span className="capitalize">{c.replace("-", " ")}</span>
                <span className={clsx("chip ml-auto", s === "pass" ? "bg-ok/12 text-ok" : s === "error" ? "bg-err/12 text-err" : s === "warning" ? "bg-warn/12 text-warn" : "bg-info/12 text-info")}>{s === "pass" ? "ok" : s}</span>
              </li>
            ))}
          </ul>
          <h2 className="label mt-5">Code targets</h2>
          <div className="flex flex-wrap gap-1.5">
            {analysis.targets.map((t) => <span key={t} className="chip bg-accent/12 text-accent">{t}</span>)}
          </div>
          {!demo && (
            <>
              <h2 className="label mt-5 flex items-center gap-1"><History className="size-3.5" /> Revisions</h2>
              <ul className="max-h-60 space-y-1 overflow-auto">
                {revs.map((v) => (
                  <li key={v.number} className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-[12px] hover:bg-raised">
                    <span className={clsx("w-10 font-mono", v.number === revision ? "text-accent" : "text-faint")}>r{v.number}</span>
                    <span className="flex-1 truncate" title={v.message ?? ""}>{v.message}</span>
                    {v.number !== revision && (
                      <button className="opacity-0 group-hover:opacity-100" title="Restore" onClick={() => restore(v.number)}><RotateCcw className="size-3.5 text-muted" /></button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}
