"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { marked } from "marked";
import { api } from "@/lib/api";
import { useProject } from "@/lib/store";

const DOCS = [
  { path: "README.md", title: "README" },
  { path: "hardware/WIRING.md", title: "Wiring & power" },
  { path: "behavior/BEHAVIOR.md", title: "Behavior" },
];

/** Renders the generated documentation (Markdown + Mermaid diagrams). */
export default function DocsPage() {
  const projectId = useProject((s) => s.project!.id);
  const [doc, setDoc] = useState(DOCS[0]!.path);
  const [html, setHtml] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHtml(null);
    api<{ file: { content: string } }>(`/api/projects/${projectId}/files/${doc.split("/").map(encodeURIComponent).join("/")}`)
      .then((r) => {
        const renderer = new marked.Renderer();
        // Raw HTML in Markdown is escaped (files can be user-edited), never injected.
        renderer.html = ({ text }) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
        renderer.code = ({ text, lang }) => (lang === "mermaid" ? `<pre class="mermaid">${text.replace(/</g, "&lt;")}</pre>` : `<pre><code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`);
        setHtml(marked.parse(r.file.content, { renderer, async: false }) as string);
      })
      .catch(() => setHtml(""));
  }, [doc, projectId]);

  useEffect(() => {
    if (!html || !ref.current) return;
    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
      mermaid.run({ nodes: ref.current!.querySelectorAll("pre.mermaid") }).catch(() => {});
    });
  }, [html]);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="w-56 shrink-0 border-r border-border bg-panel">
        <div className="panel-title">Generated docs</div>
        {DOCS.map((d) => (
          <button key={d.path} onClick={() => setDoc(d.path)} className={clsx("block w-full px-3 py-1.5 text-left", doc === d.path ? "bg-accent/15" : "text-muted hover:bg-raised")}>
            {d.title}
            <div className="font-mono text-[10.5px] text-faint">{d.path}</div>
          </button>
        ))}
      </aside>
      <div className="flex-1 overflow-auto p-6">
        {html === null ? (
          <p className="text-muted">Loading…</p>
        ) : html === "" ? (
          <p className="text-muted">Not generated yet — click <b>Generate</b> to produce the documentation.</p>
        ) : (
          // Markdown rendered with raw HTML escaped (see renderer.html above).
          <div ref={ref} className="prose-doc mx-auto max-w-4xl" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  );
}
