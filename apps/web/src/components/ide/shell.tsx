"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { Boxes, Bot, Cable, Code2, FileText, Gauge, GraduationCap, Hammer, Loader2, Package, Sparkles, Workflow, Wand2 } from "lucide-react";
import { api } from "@/lib/api";
import { flushCommands, useBasePath, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";
import { Logo } from "../ui/logo";
import { ThemeToggle } from "../theme/theme-toggle";
import { AssistantPanel } from "./assistant-panel";
import { SignInGate, useSignInGate } from "./sign-in-gate";
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

/** Workspace chrome for a saved project (`projectId`) or the public demo (`demo`). */
export function IdeShell({ projectId, demo, children }: { projectId?: string; demo?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { project, spec, load, loadDemo, loadError, pending, revision, mode } = useProject();
  const setGenerated = useProject((s) => s.setGeneratedRevision);
  const base = useBasePath();
  const gate = useSignInGate((s) => s.open);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const st = useProject.getState();
    if (demo) {
      if (st.mode !== "demo" || !st.spec) loadDemo();
    } else if (projectId && (st.mode !== "project" || st.project?.id !== projectId)) load(projectId);
  }, [projectId, demo, load, loadDemo]);

  const ready = !!spec && (demo ? mode === "demo" : mode === "project" && project?.id === projectId);

  async function generate() {
    if (demo) return gate("generate code");
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
      if (!pathname.endsWith("/code")) router.push(`${base}/code`);
      else window.dispatchEvent(new Event("roboforge:files-changed"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function exportZip() {
    if (demo) return gate("export your project");
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

  if (loadError && !demo) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
        <p>Could not open project: {loadError}.</p>
        <Link href="/projects" className="btn">Back to projects</Link>
      </div>
    );
  }

  const stale = !demo && project && project.generatedRevision !== revision;
  const section = pathname.split("/").pop();

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-panel/80 px-3 backdrop-blur-xl">
        <Link href={demo ? "/" : "/projects"} className="group flex items-center gap-2" title={demo ? "Home" : "All projects"}>
          <motion.span whileHover={{ rotate: -8, scale: 1.08 }}><Logo size={28} /></motion.span>
        </Link>
        <span className="text-faint">/</span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[15px] font-bold">{project?.name ?? "…"}</span>
          {spec && <span className="font-mono text-[10.5px] text-faint">{spec.robot.name} · rev {revision}</span>}
        </div>
        {demo ? (
          <span className="chip ml-1 bg-accent-3/15 font-semibold text-accent-3" title="Changes stay in this browser tab">Demo · not saved</span>
        ) : pending > 0 ? (
          <span className="flex items-center gap-1 text-[11px] text-muted"><Loader2 className="size-3 animate-spin" /> saving</span>
        ) : (
          project && <span className="flex items-center gap-1 text-[11px] text-faint"><span className="size-1.5 rounded-full bg-ok" /> saved</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Link href="/learn" className="btn btn-ghost hidden md:inline-flex" title="Tutorials"><GraduationCap className="size-4" /> Learn</Link>
          <button className="btn btn-ghost" onClick={() => (demo ? gate("use the AI assistant") : setAssistantOpen((v) => !v))} title="AI assistant (proposes spec changes for review)">
            <Sparkles className="size-4 text-accent-2" /> <span className="hidden sm:inline">Assistant</span>
          </button>
          <ThemeToggle />
          <div className="mx-1 h-6 w-px bg-border" />
          <button className="btn" onClick={generate} disabled={generating || !spec} title="Generate code from the Robot Specification">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Generate
            {stale && <span className="size-1.5 rounded-full bg-warn" title="Spec changed since last generation" />}
          </button>
          <button className="btn hidden sm:inline-flex" onClick={() => (demo ? gate("run builds and tests") : router.push(`${base}/build`))}><Hammer className="size-4" /> Build</button>
          {demo ? (
            <Link href="/signup" className="btn btn-primary">Save — sign up free</Link>
          ) : (
            <button className="btn btn-primary" onClick={exportZip} disabled={!spec}><Package className="size-4" /> Export</button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[172px] shrink-0 flex-col gap-0.5 border-r border-border bg-panel p-2.5">
          <div className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">Workspace</div>
          {NAV.map((n, i) => {
            const active = section === n.href;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={`${base}/${n.href}`}
                className={clsx("relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors", active ? "font-medium text-fg" : "text-muted hover:bg-raised hover:text-fg")}
              >
                {active && <motion.span layoutId="ide-nav" className="absolute inset-0 rounded-lg bg-accent/12 ring-1 ring-accent/25" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <Icon className={clsx("relative size-4", active && "text-accent")} />
                <span className="relative">{n.label}</span>
                <span className="relative ml-auto font-mono text-[10px] text-faint">{i + 1}</span>
              </Link>
            );
          })}
          <div className="mt-auto rounded-xl border border-border bg-bg-soft p-3 text-[11.5px] text-muted">
            {demo ? (
              <>
                <div className="font-semibold text-fg">You're in the demo</div>
                <p className="mt-1">Edit anything — nothing is saved.</p>
                <Link href="/signup" className="mt-2 inline-block font-medium text-accent hover:underline">Create your own →</Link>
              </>
            ) : (
              <>
                <div className="font-semibold text-fg">New here?</div>
                <Link href="/learn/first-robot" className="mt-1 inline-block font-medium text-accent hover:underline">Build your first robot →</Link>
              </>
            )}
          </div>
        </nav>
        <main className="relative flex min-w-0 flex-1 flex-col">
          {ready ? (
            // Enter-only transition: exit animations don't work with App Router page swaps.
            <motion.div key={section} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: "easeOut" }}>
              {children}
            </motion.div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
              <motion.div animate={{ rotate: [0, -8, 8, 0], y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}><Logo size={44} /></motion.div>
              <span className="text-[13px]">Loading {demo ? "demo robot" : "project"}…</span>
            </div>
          )}
        </main>
        <AnimatePresence>
          {assistantOpen && spec && projectId && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="flex overflow-hidden">
              <AssistantPanel projectId={projectId} onClose={() => setAssistantOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ValidationBar />
      <SignInGate />
    </div>
  );
}
