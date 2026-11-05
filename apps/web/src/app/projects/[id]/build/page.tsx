// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, CircleDashed, Download, Hammer, Loader2, MinusCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { flushCommands, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";

interface Step { name: string; status: "pending" | "running" | "passed" | "failed" | "skipped"; detail?: string }
interface Build { id: string; revision: number; status: string; queuedAt: string; startedAt: string | null; finishedAt: string | null; steps: Step[]; artifactKey: string | null; error: string | null }

const STATUS_CLS: Record<string, string> = { queued: "text-muted", running: "text-info", succeeded: "text-ok", failed: "text-err", canceled: "text-faint" };

function StepIcon({ s }: { s: Step["status"] }) {
  if (s === "passed") return <CheckCircle2 className="size-4 text-ok" />;
  if (s === "failed") return <XCircle className="size-4 text-err" />;
  if (s === "running") return <Loader2 className="size-4 animate-spin text-info" />;
  if (s === "skipped") return <MinusCircle className="size-4 text-faint" />;
  return <CircleDashed className="size-4 text-faint" />;
}

export default function BuildPage() {
  const projectId = useProject((s) => s.project!.id);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<{ id: number; stream: string; line: string }[]>([]);
  const [live, setLive] = useState<Build | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await api<{ builds: Build[] }>(`/api/projects/${projectId}/builds`);
    setBuilds(r.builds);
    setSelected((s) => s ?? r.builds[0]?.id ?? null);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selected) return;
    setLog([]);
    setLive(builds.find((b) => b.id === selected) ?? null);
    const es = new EventSource(`/api/builds/${selected}/logs`);
    es.addEventListener("log", (e) => setLog((l) => [...l, JSON.parse((e as MessageEvent).data)]));
    es.addEventListener("build", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setLive((b) => (b ? { ...b, ...d } : b));
      setBuilds((bs) => bs.map((b) => (b.id === selected ? { ...b, ...d } : b)));
    });
    es.addEventListener("end", () => es.close());
    es.onerror = () => es.close();
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function start() {
    setBusy(true);
    try {
      await flushCommands();
      const r = await api<{ build: Build }>(`/api/projects/${projectId}/builds`, { method: "POST" });
      setBuilds((bs) => [r.build, ...bs]);
      setSelected(r.build.id);
      toast.info("Build queued. A sandboxed worker will pick it up.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const b = live;
  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-panel">
        <div className="panel-title">
          Builds
          <button className="btn btn-primary normal-case" onClick={start} disabled={busy} data-testid="start-build">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Hammer className="size-3.5" />} Run build
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {builds.length === 0 && <p className="p-3 text-muted">No builds yet. A build validates the spec, regenerates, runs the generated unit tests in a sandbox and packages the artifacts.</p>}
          {builds.map((x) => (
            <button key={x.id} onClick={() => setSelected(x.id)} className={clsx("block w-full border-b border-border/60 px-3 py-2 text-left", selected === x.id ? "bg-accent/10" : "hover:bg-raised")}>
              <div className="flex justify-between">
                <span className="font-mono text-[11px]">#{x.id.slice(0, 8)} · rev {x.revision}</span>
                <span className={clsx("text-[11px] font-medium", STATUS_CLS[x.status])}>{x.status}</span>
              </div>
              <div className="text-[11px] text-faint">{new Date(x.queuedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {b ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
              {b.steps.map((s, i) => (
                <div key={s.name} className="flex items-center gap-1.5" title={s.detail}>
                  {i > 0 && <span className="h-px w-4 bg-border" />}
                  <StepIcon s={s.status} />
                  <span className={clsx("text-[12px]", s.status === "skipped" && "text-faint")}>{s.name}</span>
                </div>
              ))}
              {b.artifactKey && (
                <a className="btn ml-auto" href={`/api/builds/${b.id}/artifact`}><Download className="size-3.5" /> Artifacts</a>
              )}
            </div>
            {b.steps.some((s) => s.detail) && (
              <div className="shrink-0 border-b border-border px-3 py-1.5 text-[11.5px] text-muted">
                {b.steps.filter((s) => s.detail).map((s) => <div key={s.name}><b>{s.name}:</b> {s.detail}</div>)}
              </div>
            )}
            {b.error && <div className="shrink-0 border-b border-err/40 bg-err/10 px-3 py-1.5 text-[12px] text-err">{b.error}</div>}
            <div ref={logRef} className="min-h-0 flex-1 overflow-auto bg-bg p-3 font-mono text-[11.5px] leading-[1.55]" data-testid="build-log">
              {b.status === "queued" && log.length === 0 && <p className="text-muted">Waiting for a build worker… (start one with <span className="kbd">pnpm worker</span>)</p>}
              {log.map((l) => (
                <div key={l.id} className={clsx("whitespace-pre-wrap", l.stream === "stderr" ? "text-warn" : l.stream === "system" ? "text-info" : "text-fg/85")}>{l.line}</div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted">Select or start a build.</div>
        )}
      </div>
    </div>
  );
}
