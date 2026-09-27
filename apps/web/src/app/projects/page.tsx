"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, LogOut, Plus, Trash2 } from "lucide-react";
import { TEMPLATES, type TemplateId } from "@roboforge/ir";
import { api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { Logo } from "@/components/ui/logo";

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  revision: number;
  updatedAt: string;
  componentCount: number;
  robotName: string;
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
    router.push("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-11 items-center gap-2 border-b border-border bg-panel px-4">
        <Logo />
        <span className="font-semibold">RoboForge</span>
        <span className="ml-2 text-muted">Projects</span>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          {user && <span>{user.name} · {user.email}</span>}
          <button className="btn btn-ghost" onClick={logout} title="Sign out"><LogOut className="size-3.5" /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Robot projects</h1>
            <p className="text-muted">Each project is a Robot Specification with its hardware, wiring, behavior and generated codebase.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus className="size-4" /> New project</button>
        </div>

        {creating && (
          <form onSubmit={create} className="mb-6 rounded-lg border border-border bg-panel p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Project name</label>
                <input className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="My Autonomous Warehouse Robot" />
                <label className="label mt-3">Description</label>
                <textarea className="input h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="label">Start from</label>
                <div className="flex flex-col gap-2">
                  {TEMPLATES.map((t) => (
                    <label key={t.id} className={`cursor-pointer rounded-md border p-2.5 ${template === t.id ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"}`}>
                      <input type="radio" className="hidden" name="template" checked={template === t.id} onChange={() => setTemplate(t.id)} />
                      <div className="font-medium">{t.title}</div>
                      <div className="text-[12px] text-muted">{t.description}</div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
            </div>
          </form>
        )}

        {projects === null ? (
          <p className="text-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted">
            <Bot className="mx-auto mb-2 size-8 text-faint" />
            No projects yet. Create one to start designing a robot.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {projects.map((p) => (
              <div key={p.id} className="group relative rounded-lg border border-border bg-panel p-4 hover:border-border-strong">
                <Link href={`/projects/${p.id}/overview`} className="absolute inset-0" aria-label={`Open ${p.name}`} />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="font-mono text-[11px] text-faint">{p.robotName}</div>
                  </div>
                  <button className="btn btn-ghost relative z-10 opacity-0 group-hover:opacity-100" onClick={() => remove(p)} title="Delete project">
                    <Trash2 className="size-3.5 text-err" />
                  </button>
                </div>
                {p.description && <p className="mt-2 line-clamp-2 text-[12px] text-muted">{p.description}</p>}
                <div className="mt-3 flex gap-3 text-[11px] text-faint">
                  <span>{p.componentCount} components</span>
                  <span>rev {p.revision}</span>
                  <span>updated {new Date(p.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
