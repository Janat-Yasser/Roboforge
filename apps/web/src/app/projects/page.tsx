// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowUpRight, BookOpen, LogOut, Plus, Search, Trash2, X } from "lucide-react";
import { TEMPLATES, type TemplateId } from "@roboforge/ir";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Logo, Wordmark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Photo } from "@/components/editorial/photo";
import type { PhotoKey } from "@/lib/photos";

const COVERS: PhotoKey[] = ["roverBench", "trackedRover", "robotCarCase", "legoRobots", "mecanumRover", "wiredBoard", "breadboard", "arduinoUno", "motherboard", "robotHand"];
const TEMPLATE_PHOTO: Record<string, PhotoKey> = { blank: "componentsFlat", "obstacle-avoider": "roverBench" };

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  revision: number;
  updatedAt: string;
  componentCount: number;
  robotName: string;
}

function hue(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<TemplateId>("obstacle-avoider");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const refresh = () => api<{ projects: ProjectSummary[] }>("/api/projects").then((r) => setProjects(r.projects));
  useEffect(() => {
    refresh().catch((e) => toast.error(e.message));
    api<{ user: { name: string; email: string } }>("/api/auth/me").then((r) => setUser(r.user)).catch(() => {});
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ project: { id: string } }>("/api/projects", { method: "POST", json: { name, description, template } });
      router.push(`/projects/${r.project.id}/overview`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }

  async function remove(p: ProjectSummary) {
    if (!confirm(`Delete project "${p.name}" and all its revisions, files and builds?`)) return;
    await api(`/api/projects/${p.id}`, { method: "DELETE" });
    toast.ok("Project deleted");
    refresh();
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const shown = (projects ?? []).filter((p) => !q || `${p.name} ${p.robotName} ${p.description}`.toLowerCase().includes(q.toLowerCase()));
  const first = user?.name.split(" ")[0];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-panel/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2.5"><Logo size={30} /><Wordmark /></Link>
          <nav className="ml-4 hidden items-center gap-1 text-[15px] font-semibold md:flex">
            <span className="rounded-xl bg-accent/10 px-4 py-2 text-accent">My projects</span>
            <Link href="/learn" className="rounded-xl px-4 py-2 text-muted hover:bg-raised hover:text-fg">Learn</Link>
            <Link href="/parts" className="rounded-xl px-4 py-2 text-muted hover:bg-raised hover:text-fg">Parts</Link>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border bg-panel py-1 pl-1 pr-2">
                <span className="grid size-8 place-items-center rounded-lg bg-[#ffc933] text-[14px] font-extrabold text-[#0e1b3d]">{user.name[0]?.toUpperCase()}</span>
                <span className="hidden text-[14px] font-semibold sm:inline">{user.name}</span>
                <button className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-fg" onClick={logout} title="Sign out"><LogOut className="size-4" /></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 pb-24 pt-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[32px] bg-[#1e6bff] p-8 text-white sm:p-12">
          <span className="animate-drift absolute right-[10%] top-[18%] hidden size-16 rounded-full bg-[#ffc933] sm:block" />
          <span className="animate-drift absolute bottom-[14%] right-[24%] hidden size-10 rotate-12 rounded-xl bg-[#ff5a5f] sm:block" style={{ animationDelay: "1.2s" }} />
          <span className="animate-drift absolute right-[4%] bottom-[20%] hidden size-8 rounded-lg bg-[#14b886] sm:block" style={{ animationDelay: "2s" }} />
          <div className="relative max-w-xl">
            <div className="text-[14px] font-bold text-white/75">{today}</div>
            <h1 className="mt-2 text-[38px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">{first ? `Hi ${first}, what are we building today?` : "Your robots"}</h1>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-bold text-[#0e1b3d] shadow-[0_4px_0_#0b4fd6] transition-all hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_1px_0_#0b4fd6]" onClick={() => setCreating(true)}><Plus className="size-4" /> New project</button>
              <Link href="/learn/first-robot" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-5 py-3 text-[15px] font-bold transition-colors hover:border-white"><BookOpen className="size-4" /> Tutorial</Link>
            </div>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <h2 className="display text-[28px]">My projects {projects && projects.length > 0 && <span className="text-muted">· {projects.length}</span>}</h2>
          <label className="relative flex w-full items-center sm:w-72">
            <Search className="absolute left-4 size-4 text-faint" />
            <input className="h-11 w-full rounded-xl border-2 border-border bg-panel pl-11 pr-4 text-[14.5px] font-medium outline-none placeholder:text-faint focus:border-accent focus-visible:outline-none" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        {projects === null ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-80 animate-pulse rounded-3xl bg-raised" />)}
          </div>
        ) : projects.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-pop mt-6 grid overflow-hidden md:grid-cols-2">
            <div className="relative min-h-[280px]"><Photo photo="workshop3d" className="absolute inset-0" sizes="50vw" /></div>
            <div className="flex flex-col justify-center p-8 sm:p-10">
              <span className="eyebrow w-fit">Your first project</span>
              <h2 className="display mt-4 text-[36px]">Let&apos;s build your first robot!</h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">Start from a working obstacle-avoiding rover, or from a blank bench. New to this? The first tutorial takes ten minutes.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button className="btn-ink" onClick={() => setCreating(true)}><Plus className="size-4" /> New project</button>
                <Link href="/learn/first-robot" className="btn-line"><BookOpen className="size-4" /> Read the tutorial</Link>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div layout className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {shown.map((p, i) => (
                <motion.article
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.05, duration: 0.7, ease: [0.2, 0.75, 0.15, 1] }}
                  className="card-pop group relative overflow-hidden"
                >
                  <Link href={`/projects/${p.id}/overview`} className="absolute inset-0 z-[1]" aria-label={`Open ${p.name}`} data-cursor="Open" />
                  <div className="relative overflow-hidden">
                    <Photo photo={COVERS[hue(p.id) % COVERS.length]!} aspect="aspect-[4/3]" sizes="(min-width: 1024px) 30vw, 50vw" imgClassName="transition-transform duration-700 group-hover:scale-[1.05]" />
                    <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#0e1b3d] shadow">{p.componentCount} parts</span>
                    <button className="absolute right-3 top-3 z-[2] grid size-9 place-items-center rounded-xl bg-white text-[#0e1b3d] opacity-0 shadow transition-opacity hover:text-err group-hover:opacity-100" onClick={() => remove(p)} title="Delete project">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-5 pt-5">
                    <h3 className="truncate text-[19px] font-bold transition-colors group-hover:text-accent">{p.name}</h3>
                    <ArrowUpRight className="size-5 shrink-0 text-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[2.8em] px-5 text-[14px] leading-relaxed text-muted">{p.description || "No description yet."}</p>
                  <div className="mt-4 flex gap-4 border-t border-border px-5 py-3.5 text-[12.5px] font-semibold text-faint">
                    <span>{p.robotName}</span>
                                        <span>rev {p.revision}</span>
                    <span className="ml-auto">{ago(p.updatedAt)}</span>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            <motion.button
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setCreating(true)}
              className="group flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border-strong text-muted transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-[0_4px_0_var(--rf-accent-strong)] transition-transform duration-500 group-hover:rotate-90"><Plus className="size-7" /></span>
              <span className="text-[18px] font-bold">New robot</span>
            </motion.button>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {creating && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCreating(false)}>
            <motion.form
              onSubmit={create}
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.6, ease: [0.77, 0, 0.18, 1] }}
              className="flex h-full w-full max-w-[640px] flex-col overflow-y-auto bg-bg shadow-[var(--rf-shadow-lg)]"
            >
              <div className="flex items-center justify-between border-b border-border px-8 py-5">
                <span className="text-[15px] font-bold">New robot project</span>
                <button type="button" className="rounded-full p-1.5 text-muted hover:bg-raised hover:text-fg" onClick={() => setCreating(false)} aria-label="Close"><X className="size-5" /></button>
              </div>
              <div className="flex-1 px-8 py-8">
                <h2 className="display text-[36px]">Name your robot</h2>
                <div className="mt-8 space-y-7">
                  <div>
                    <label className="mb-1.5 block text-[14px] font-bold">Project name</label>
                    <input className="h-12 w-full rounded-xl border-2 border-border bg-panel px-4 text-[16px] font-medium outline-none placeholder:text-faint focus:border-accent focus-visible:outline-none" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Autonomous Warehouse Robot" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[14px] font-bold">Description</label>
                    <textarea className="h-24 w-full resize-none rounded-xl border-2 border-border bg-panel px-4 py-3 text-[15px] font-medium outline-none placeholder:text-faint focus:border-accent focus-visible:outline-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should your robot do?" />
                  </div>
                  <div>
                    <label className="block text-[14px] font-bold">Start from</label>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      {TEMPLATES.map((t) => (
                        <label key={t.id} className="group cursor-pointer">
                          <input type="radio" className="hidden" name="template" checked={template === t.id} onChange={() => setTemplate(t.id)} />
                          <div className={clsx("relative overflow-hidden rounded-2xl outline outline-[3px] outline-offset-2 transition-[outline-color]", template === t.id ? "outline-accent" : "outline-transparent")}>
                            <Photo photo={TEMPLATE_PHOTO[t.id] ?? "componentsFlat"} aspect="aspect-[4/3]" reveal={false} sizes="300px" imgClassName={clsx("transition-[filter,transform] duration-500", template === t.id ? "" : "grayscale-[60%] group-hover:grayscale-0")} />
                            {template === t.id && <motion.span layoutId="tpl-check" className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-[12px] text-white">✓</motion.span>}
                          </div>
                          <div className="mt-3 text-[15px] font-bold">{t.title}</div>
                          <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t.description}</div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-border px-8 py-5">
                <button type="button" className="btn-line" onClick={() => setCreating(false)}>Cancel</button>
                <button className="btn-ink" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
