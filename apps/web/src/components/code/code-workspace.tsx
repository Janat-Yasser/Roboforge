"use client";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, FileCode2, FolderClosed, Lock, Save, Search, Unlock, Wand2, X } from "lucide-react";
import { parseRegions } from "@roboforge/codegen";
import { api } from "@/lib/api";
import { useProject } from "@/lib/store";
import { toast } from "@/lib/toast";

loader.config({ paths: { vs: "/monaco/vs" } });

type Ownership = "generated" | "user" | "mixed";
interface FileMeta { path: string; ownership: Ownership; generator: string | null; size: number; specRevision: number | null }
interface OpenFile { path: string; ownership: Ownership; saved: string; content: string }
type Monaco = Parameters<OnMount>[1];
type Ed = Parameters<OnMount>[0];

const OWN_BADGE: Record<Ownership, { label: string; cls: string; title: string }> = {
  generated: { label: "G", cls: "bg-accent/20 text-accent", title: "Generated — rewritten on every generation (read-only)" },
  mixed: { label: "M", cls: "bg-warn/20 text-warn", title: "Mixed — generated, with USER regions you own" },
  user: { label: "U", cls: "bg-ok/20 text-ok", title: "User-owned — never overwritten" },
};

function language(path: string): string {
  if (/\.(cpp|cc|h|hpp|ino)$/.test(path)) return "cpp";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".json")) return "json";
  if (/\.ya?ml$/.test(path)) return "yaml";
  if (path.endsWith(".md")) return "markdown";
  if (/\.(xml|xacro|urdf)$/.test(path)) return "xml";
  if (path.endsWith(".ini")) return "ini";
  if (path.endsWith("Dockerfile")) return "dockerfile";
  if (path.endsWith("CMakeLists.txt")) return "cmake";
  return "plaintext";
}

interface TreeNode { name: string; path: string; children: Map<string, TreeNode>; file?: FileMeta }

function buildTree(files: FileMeta[]): TreeNode {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = root;
    parts.forEach((p, i) => {
      const path = parts.slice(0, i + 1).join("/");
      if (!cur.children.has(p)) cur.children.set(p, { name: p, path, children: new Map() });
      cur = cur.children.get(p)!;
      if (i === parts.length - 1) cur.file = f;
    });
  }
  return root;
}

function Tree({ node, depth, open, toggle, onOpen, active }: { node: TreeNode; depth: number; open: Set<string>; toggle: (p: string) => void; onOpen: (f: FileMeta) => void; active?: string }) {
  const entries = [...node.children.values()].sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
  return (
    <>
      {entries.map((e) =>
        e.file ? (
          <button
            key={e.path}
            onClick={() => onOpen(e.file!)}
            className={clsx("flex w-full items-center gap-1.5 py-[3px] pr-2 text-left text-[12px]", active === e.path ? "bg-accent/15 text-fg" : "text-muted hover:bg-raised hover:text-fg")}
            style={{ paddingLeft: 8 + depth * 12 }}
            title={`${e.path}\n${OWN_BADGE[e.file.ownership].title}`}
          >
            <FileCode2 className="size-3.5 shrink-0" />
            <span className="truncate">{e.name}</span>
            <span className={clsx("ml-auto rounded px-1 font-mono text-[9px]", OWN_BADGE[e.file.ownership].cls)}>{OWN_BADGE[e.file.ownership].label}</span>
          </button>
        ) : (
          <div key={e.path}>
            <button className="flex w-full items-center gap-1 py-[3px] text-left text-[12px] text-fg hover:bg-raised" style={{ paddingLeft: 4 + depth * 12 }} onClick={() => toggle(e.path)}>
              {open.has(e.path) ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              <FolderClosed className="size-3.5 text-faint" />
              {e.name}
            </button>
            {open.has(e.path) && <Tree node={e} depth={depth + 1} open={open} toggle={toggle} onOpen={onOpen} active={active} />}
          </div>
        ),
      )}
    </>
  );
}

/** Text outside ROBOFORGE:USER regions — edits there are lost on regeneration. */
function outsideRegions(text: string): string {
  try {
    const lines = text.split("\n");
    const regions = parseRegions(text);
    return lines.filter((_, i) => !regions.some((r) => i + 1 > r.beginLine && i + 1 < r.endLine)).join("\n");
  } catch {
    return text;
  }
}

export function CodeWorkspace() {
  const { resolvedTheme } = useTheme();
  const projectId = useProject((s) => s.project!.id);
  const revision = useProject((s) => s.revision);
  const generatedRevision = useProject((s) => s.project!.generatedRevision);
  const [files, setFiles] = useState<FileMeta[] | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set(["firmware", "firmware/src", "hardware"]));
  const [tabs, setTabs] = useState<OpenFile[]>([]);
  const [active, setActive] = useState<string | undefined>();
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<{ path: string; line: number; text: string }[]>([]);
  const [buildMarkers, setBuildMarkers] = useState<{ path: string; line: number; col: number; severity: "error" | "warning"; message: string }[]>([]);
  const editorRef = useRef<Ed | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorations = useRef<string[]>([]);
  const pendingReveal = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const r = await api<{ files: FileMeta[] }>(`/api/projects/${projectId}/files`);
    setFiles(r.files);
    // Refresh open, unmodified tabs with the new content.
    const fresh = await Promise.all(
      tabsRef.current.map(async (t) => {
        if (t.content !== t.saved) return t;
        try {
          const f = await api<{ file: { content: string; ownership: Ownership } }>(`/api/projects/${projectId}/files/${t.path.split("/").map(encodeURIComponent).join("/")}`);
          return { ...t, saved: f.file.content, content: f.file.content, ownership: f.file.ownership };
        } catch {
          return null;
        }
      }),
    );
    setTabs(fresh.filter((t): t is OpenFile => !!t));
  }, [projectId]);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("roboforge:files-changed", h);
    return () => window.removeEventListener("roboforge:files-changed", h);
  }, [refresh]);

  // Compiler errors from the latest build become editor markers.
  useEffect(() => {
    (async () => {
      const { builds } = await api<{ builds: { id: string; status: string }[] }>(`/api/projects/${projectId}/builds`);
      const last = builds.find((b) => b.status === "failed" || b.status === "succeeded");
      if (!last) return;
      const { lines } = await api<{ lines: { line: string }[] }>(`/api/builds/${last.id}/log`);
      const re = /(?:\/work\/)?((?:firmware|ros2_ws)\/[^:\s]+):(\d+):(\d+):\s+(error|warning):\s+(.*)$/;
      setBuildMarkers(lines.flatMap(({ line }) => {
        const m = re.exec(line);
        return m ? [{ path: m[1]!, line: Number(m[2]), col: Number(m[3]), severity: m[4] as "error" | "warning", message: m[5]! }] : [];
      }));
    })().catch(() => {});
  }, [projectId]);

  const tab = tabs.find((t) => t.path === active);

  async function openFile(f: { path: string }, line?: number) {
    pendingReveal.current = line ?? null;
    if (tabs.some((t) => t.path === f.path)) {
      setActive(f.path);
      return;
    }
    const r = await api<{ file: { content: string; ownership: Ownership } }>(`/api/projects/${projectId}/files/${f.path.split("/").map(encodeURIComponent).join("/")}`);
    setTabs((ts) => [...ts, { path: f.path, ownership: r.file.ownership, saved: r.file.content, content: r.file.content }]);
    setActive(f.path);
  }

  function closeTab(path: string) {
    const t = tabs.find((x) => x.path === path);
    if (t && t.content !== t.saved && !confirm(`Discard unsaved changes to ${path}?`)) return;
    const rest = tabs.filter((x) => x.path !== path);
    setTabs(rest);
    if (active === path) setActive(rest.at(-1)?.path);
  }

  const save = useCallback(async () => {
    const t = tabsRef.current.find((x) => x.path === active);
    if (!t || t.ownership === "generated" || t.content === t.saved) return;
    try {
      await api(`/api/projects/${projectId}/files/${t.path.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", json: { content: t.content } });
      setTabs((ts) => ts.map((x) => (x.path === t.path ? { ...x, saved: t.content } : x)));
      toast.ok(`Saved ${t.path}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [active, projectId]);
  const saveRef = useRef(save);
  saveRef.current = save;

  async function takeOwnership() {
    if (!tab) return;
    if (!confirm(`Take ownership of ${tab.path}?\n\nRoboForge will stop regenerating this file. Changes to the Robot Specification will no longer be reflected in it.`)) return;
    await api(`/api/projects/${projectId}/ownership`, { method: "POST", json: { path: tab.path, ownership: "user" } });
    setTabs((ts) => ts.map((x) => (x.path === tab.path ? { ...x, ownership: "user" } : x)));
    setFiles((fs) => fs?.map((f) => (f.path === tab.path ? { ...f, ownership: "user" } : f)) ?? fs);
    toast.ok("You now own this file.");
  }

  // Decorations for USER regions + build markers whenever the active file changes.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco || !tab) return;
    const model = ed.getModel();
    if (!model) return;
    let regions: ReturnType<typeof parseRegions> = [];
    try {
      regions = tab.ownership === "mixed" ? parseRegions(tab.content) : [];
    } catch {
      regions = [];
    }
    decorations.current = ed.deltaDecorations(
      decorations.current,
      regions.map((r) => ({
        range: new monaco.Range(r.beginLine, 1, r.endLine, 1),
        options: { isWholeLine: true, className: "rf-user-region", linesDecorationsClassName: "rf-user-region-gutter" },
      })),
    );
    monaco.editor.setModelMarkers(
      model,
      "build",
      buildMarkers
        .filter((m) => m.path === tab.path)
        .map((m) => ({ startLineNumber: m.line, startColumn: m.col, endLineNumber: m.line, endColumn: m.col + 1, message: m.message, severity: m.severity === "error" ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning })),
    );
    if (pendingReveal.current) {
      ed.revealLineInCenter(pendingReveal.current);
      ed.setPosition({ lineNumber: pendingReveal.current, column: 1 });
      pendingReveal.current = null;
    }
  }, [tab, buildMarkers]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (q.trim().length < 2) return setMatches([]);
      api<{ matches: typeof matches }>(`/api/projects/${projectId}/search?q=${encodeURIComponent(q)}`).then((r) => setMatches(r.matches));
    }, 250);
    return () => clearTimeout(t);
  }, [q, projectId]);

  const tree = useMemo(() => (files ? buildTree(files) : null), [files]);
  const editedOutside = tab?.ownership === "mixed" && outsideRegions(tab.content) !== outsideRegions(tab.saved);
  const markerCount = buildMarkers.length;

  if (files && files.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
        <Wand2 className="size-8 text-faint" />
        <p>No code yet. Click <b>Generate</b> in the top bar to generate the codebase from the Robot Specification.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-panel">
        <div className="panel-title">
          Explorer
          {generatedRevision !== revision && <span className="normal-case text-warn" title="The spec changed since the last generation">stale · rev {generatedRevision ?? "–"}/{revision}</span>}
        </div>
        <div className="relative border-b border-border p-2">
          <Search className="absolute left-4 top-3.5 size-3.5 text-faint" />
          <input className="input pl-7" placeholder="Search in files…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex-1 overflow-auto py-1">
          {q.trim().length >= 2 ? (
            <div>
              <div className="px-3 pb-1 text-[11px] text-faint">{matches.length} matches</div>
              {matches.map((m, i) => (
                <button key={i} className="block w-full px-3 py-1 text-left hover:bg-raised" onClick={() => openFile({ path: m.path }, m.line)}>
                  <div className="truncate font-mono text-[10.5px] text-faint">{m.path}:{m.line}</div>
                  <div className="truncate font-mono text-[11.5px]">{m.text}</div>
                </button>
              ))}
            </div>
          ) : (
            tree && <Tree node={tree} depth={0} open={open} toggle={(p) => setOpen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; })} onOpen={(f) => openFile(f)} active={active} />
          )}
        </div>
        <div className="flex gap-3 border-t border-border p-2 text-[10.5px] text-faint">
          {(Object.keys(OWN_BADGE) as Ownership[]).map((o) => (
            <span key={o} className="flex items-center gap-1" title={OWN_BADGE[o].title}><span className={clsx("rounded px-1 font-mono", OWN_BADGE[o].cls)}>{OWN_BADGE[o].label}</span>{o}</span>
          ))}
          {markerCount > 0 && <span className="ml-auto text-err">{markerCount} build diag.</span>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-8 shrink-0 items-stretch overflow-x-auto border-b border-border bg-panel">
          {tabs.map((t) => (
            <div key={t.path} className={clsx("group flex items-center gap-1.5 border-r border-border px-3 text-[12px]", t.path === active ? "bg-bg text-fg" : "text-muted hover:text-fg")}>
              <button onClick={() => setActive(t.path)} className="flex items-center gap-1.5">
                {t.ownership === "generated" && <Lock className="size-3 text-accent" />}
                {t.path.split("/").pop()}
                {t.content !== t.saved && <span className="size-1.5 rounded-full bg-fg" />}
              </button>
              <button onClick={() => closeTab(t.path)} className="opacity-0 group-hover:opacity-100"><X className="size-3" /></button>
            </div>
          ))}
        </div>
        {tab ? (
          <>
            <div className={clsx("flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-[11.5px]", tab.ownership === "generated" ? "bg-accent/8" : tab.ownership === "mixed" ? "bg-warn/8" : "bg-ok/8")}>
              <span className="font-mono text-faint">{tab.path}</span>
              {tab.ownership === "generated" && (
                <>
                  <span className="text-muted">· Generated from robot.yaml — read-only.</span>
                  <button className="btn ml-auto py-0.5" onClick={takeOwnership}><Unlock className="size-3" /> Take ownership</button>
                </>
              )}
              {tab.ownership === "mixed" && (
                <span className={editedOutside ? "text-warn" : "text-muted"}>
                  · {editedOutside ? "You edited outside a USER region — those lines will be replaced on the next generation." : "Edit inside the highlighted ROBOFORGE:USER regions; they survive regeneration."}
                </span>
              )}
              {tab.ownership === "user" && <span className="text-muted">· Yours. RoboForge never overwrites this file.</span>}
              {tab.ownership !== "generated" && (
                <button className="btn btn-primary ml-auto py-0.5" onClick={save} disabled={tab.content === tab.saved}><Save className="size-3" /> Save <span className="kbd">⌘S</span></button>
              )}
            </div>
            <div className="min-h-0 flex-1">
              <Editor
                theme={resolvedTheme === "light" ? "vs" : "vs-dark"}
                path={tab.path}
                language={language(tab.path)}
                value={tab.content}
                onChange={(v) => setTabs((ts) => ts.map((x) => (x.path === tab.path ? { ...x, content: v ?? "" } : x)))}
                onMount={(ed, monaco) => {
                  editorRef.current = ed;
                  monacoRef.current = monaco;
                  ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => saveRef.current());
                  setTabs((ts) => [...ts]); // trigger decoration effect
                }}
                options={{
                  readOnly: tab.ownership === "generated",
                  readOnlyMessage: { value: "Generated file. Change the Robot Specification or take ownership to edit." },
                  fontSize: 12.5,
                  fontFamily: "JetBrains Mono, Menlo, Consolas, monospace",
                  minimap: { enabled: true, scale: 1 },
                  scrollBeyondLastLine: false,
                  renderWhitespace: "selection",
                  tabSize: 2,
                  formatOnPaste: true,
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted">Open a file from the explorer.</div>
        )}
      </div>
    </div>
  );
}
