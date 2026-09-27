"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  Boxes,
  Bot,
  Cable,
  Code2,
  FileText,
  Gauge,
  Hammer,
  Loader2,
  Package,
  PlayCircle,
  Rocket,
  Sparkles,
  Workflow,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { flushCommands, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { Logo } from "../ui/logo";
import { AssistantPanel } from "./assistant-panel";
import { ValidationBar } from "./validation-bar";

const NAV = [
  { href: "overview", label: "Overview", icon: Gauge },
  { href: "robot", label: "Robot", icon: Bot },
  { href: "hardware", label: "Hardware", icon: Boxes },
  { href: "wiring", label: "Wiring", icon: Cable },
  { href: "behavior", label: "Behavior", icon: Workflow },
  { href: "code", label: "Code", icon: Code2 },
  { href: "build", label: "Build & Tests", icon: Hammer },
  { href: "docs", label: "Docs", icon: FileText },
];

export function IdeShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { project, spec, load, loadError, pending, revision } = useProject();
  const setGenerated = useProject((s) => s.setGeneratedRevision);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (useProject.getState().project?.id !== projectId) load(projectId);
  }, [projectId, load]);

  async function generate() {
    setGenerating(true);
    try {
      await flushCommands();
      const r = await api<{ ok: boolean; revision: number; changes: { action: string }[]; blockedBy: { message: string }[] }>(`/api/projects/${projectId}/generate`, { method: "POST", json: {} });
      if (!r.ok) {
        toast.error(`Generation blocked by ${r.blockedBy.length} validation error(s): ${r.blockedBy[0]?.message ?? ""}`);
        return;
      }
      setGenerated(r.revision);
      const count = (a: string) => r.changes.filter((c) => c.action === a).length;
      toast.ok(`Generated rev ${r.revision}: ${count("added")} added, ${count("updated")} updated, ${count("merged")} merged, ${count("preserved")} preserved, ${count("removed")} removed.`);
      if (!pathname.endsWith("/code")) router.push(`/projects/${projectId}/code`);
      else window.dispatchEvent(new Event("roboforge:files-changed"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportZip() {
    await flushCommands();
    const res = await fetch(`/api/projects/${projectId}/export`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j?.error?.message ?? "Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? "robot.zip";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.ok("Exported project (Git-ready zip).");
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Could not open project: {loadError}. <Link href="/projects" className="ml-2 text-accent">Back to projects</Link>
      </div>
    );
  }

  const stale = project && project.generatedRevision !== revision;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
        <Link href="/projects" className="flex items-center gap-2" title="All projects">
          <Logo />
          <span className="font-semibold">RoboForge</span>
        </Link>
        <span className="text-faint">/</span>
        <span className="font-medium">{project?.name ?? "…"}</span>
        {spec && <span className="font-mono text-[11px] text-faint">{spec.robot.name}</span>}
        <span className="chip bg-raised text-muted" title="Specification revision">rev {revision || "…"}</span>
        {pending > 0 ? (
          <span className="flex items-center gap-1 text-[11px] text-muted"><Loader2 className="size-3 animate-spin" /> saving</span>
        ) : (
          project && <span className="text-[11px] text-faint">saved</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button className="btn" onClick={() => setAssistantOpen((v) => !v)} title="AI assistant (proposes spec changes for review)">
            <Sparkles className="size-3.5 text-sig-i2c" /> Assistant
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <button className="btn" onClick={generate} disabled={generating || !spec} title="Generate code from the Robot Specification">
            {generating ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />} Generate
            {stale && <span className="size-1.5 rounded-full bg-warn" title="Spec changed since last generation" />}
          </button>
          <Link className="btn" href={`/projects/${projectId}/build`}><Hammer className="size-3.5" /> Build</Link>
          <button className="btn" disabled title="Simulation backends (Gazebo, Webots, browser) are planned; the HAL is the integration seam.">
            <PlayCircle className="size-3.5" /> Simulate
          </button>
          <button className="btn" disabled title="Device deployment / OTA is planned for a later release.">
            <Rocket className="size-3.5" /> Deploy
          </button>
          <button className="btn btn-primary" onClick={exportZip} disabled={!spec}><Package className="size-3.5" /> Export</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 border-r border-border bg-panel p-2">
          <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Project</div>
          {NAV.map((n) => {
            const active = pathname.endsWith(`/${n.href}`);
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={`/projects/${projectId}/${n.href}`}
                className={clsx("flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px]", active ? "bg-accent/15 text-fg" : "text-muted hover:bg-raised hover:text-fg")}
              >
                <Icon className={clsx("size-4", active ? "text-accent" : "")} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <main className="relative flex min-w-0 flex-1 flex-col">{spec ? children : <div className="flex flex-1 items-center justify-center text-muted"><Loader2 className="mr-2 size-4 animate-spin" /> Loading project…</div>}</main>
        {assistantOpen && spec && <AssistantPanel projectId={projectId} onClose={() => setAssistantOpen(false)} />}
      </div>
      <ValidationBar projectId={projectId} />
    </div>
  );
}
