"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Wrench, X } from "lucide-react";
import type { Command } from "@roboforge/spec";
import { api } from "@/lib/api";
import { flushCommands, useProject } from "@/lib/store";
import { toast } from "@/lib/toast";

interface Proposal {
  baseRevision: number;
  reply: string;
  commands: Command[];
  before: { errors: number; warnings: number };
  after: { errors: number; warnings: number };
  toolCalls: { name: string; ok: boolean; summary: string }[];
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  proposal?: Proposal;
  state?: "open" | "applied" | "discarded";
}

const EXAMPLES = ["Add an IMU to the robot.", "Make the robot stop when the front sensor detects an obstacle closer than 30 cm.", "Add an e-stop and wire it."];

/**
 * The assistant never edits the project directly: it returns a list of typed commands which the
 * engineer reviews and applies (or discards).
 */
export function AssistantPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const dispatch = useProject((s) => s.dispatch);

  useEffect(() => {
    api<{ enabled: boolean }>(`/api/projects/${projectId}/assistant`).then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
  }, [projectId]);

  async function send(text: string) {
    if (!text.trim()) return;
    setBusy(true);
    const history = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((t) => [...t, { role: "user", content: text }]);
    setInput("");
    try {
      await flushCommands();
      const p = await api<Proposal>(`/api/projects/${projectId}/assistant`, { method: "POST", json: { prompt: text, history } });
      setTurns((t) => [...t, { role: "assistant", content: p.reply || "(no summary)", proposal: p, state: p.commands.length ? "open" : undefined }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", content: `Error: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  function apply(i: number) {
    const t = turns[i]!;
    if (!t.proposal) return;
    if (useProject.getState().revision !== t.proposal.baseRevision) {
      toast.error("The project changed since this proposal was made. Ask again to get an up-to-date proposal.");
      return;
    }
    if (dispatch(t.proposal.commands, `Assistant: ${turns[i - 1]?.content.slice(0, 120) ?? "proposal"}`)) {
      setTurns((all) => all.map((x, j) => (j === i ? { ...x, state: "applied" } : x)));
      toast.ok(`Applied ${t.proposal.commands.length} change(s). Regenerate code to update the codebase.`);
    }
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-panel">
      <div className="panel-title">
        <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-sig-i2c" /> Assistant</span>
        <button className="btn btn-ghost px-1" onClick={onClose}><X className="size-3.5" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-auto p-3">
        {enabled === false && (
          <div className="rounded-md border border-warn/40 bg-warn/10 p-2.5 text-[12px] text-warn">
            The assistant is disabled on this server. Set <code className="kbd">ANTHROPIC_API_KEY</code> to enable it.
          </div>
        )}
        {turns.length === 0 && (
          <div className="text-[12px] text-muted">
            <p className="mb-2">Ask for design changes. The assistant edits the Robot Specification through the same commands as the editors and shows you a proposal to review.</p>
            {EXAMPLES.map((e) => (
              <button key={e} className="mb-1.5 block w-full rounded border border-border px-2 py-1.5 text-left hover:bg-raised" onClick={() => send(e)} disabled={!enabled || busy}>
                {e}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "ml-8 rounded-md bg-accent/15 px-2.5 py-2" : "rounded-md border border-border bg-panel-2 px-2.5 py-2"}>
            <div className="whitespace-pre-wrap text-[12.5px] leading-relaxed">{t.content}</div>
            {t.proposal && (
              <div className="mt-2 border-t border-border pt-2 text-[11.5px]">
                {t.proposal.toolCalls.length > 0 && (
                  <details className="mb-2 text-muted">
                    <summary className="cursor-pointer">{t.proposal.toolCalls.length} tool calls</summary>
                    <ul className="mt-1 space-y-0.5">
                      {t.proposal.toolCalls.map((c, j) => (
                        <li key={j} className="flex gap-1 font-mono text-[10.5px]">
                          <Wrench className={`mt-0.5 size-3 shrink-0 ${c.ok ? "text-ok" : "text-err"}`} />
                          <span><b>{c.name}</b> {c.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mb-2 text-muted">
                  {t.proposal.commands.length} spec change(s) · errors {t.proposal.before.errors} → {t.proposal.after.errors} · warnings {t.proposal.before.warnings} → {t.proposal.after.warnings}
                </div>
                {t.state === "open" && (
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => apply(i)}><Check className="size-3.5" /> Apply</button>
                    <button className="btn" onClick={() => setTurns((all) => all.map((x, j) => (j === i ? { ...x, state: "discarded" } : x)))}>Discard</button>
                  </div>
                )}
                {t.state === "applied" && <span className="text-ok">Applied</span>}
                {t.state === "discarded" && <span className="text-faint">Discarded</span>}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="flex items-center gap-2 text-muted"><Loader2 className="size-3.5 animate-spin" /> Working on the specification…</div>}
      </div>
      <form
        className="border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          className="input h-16 resize-none"
          placeholder={enabled ? "Describe a change…" : "Assistant disabled"}
          value={input}
          disabled={!enabled || busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
      </form>
    </aside>
  );
}
