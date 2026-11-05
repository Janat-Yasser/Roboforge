// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { create } from "zustand";
import { CheckCircle2, Info, XCircle } from "lucide-react";

interface Toast {
  id: number;
  kind: "ok" | "error" | "info";
  text: string;
}

const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));
let n = 0;

function push(kind: Toast["kind"], text: string) {
  const id = ++n;
  useToasts.setState((s) => ({ items: [...s.items.slice(-3), { id, kind, text }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), kind === "error" ? 7000 : 3500);
}

export const toast = {
  ok: (t: string) => push("ok", t),
  error: (t: string) => push("error", t),
  info: (t: string) => push("info", t),
};

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-50 flex w-96 flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-start gap-2 rounded-md border border-border bg-panel-2 px-3 py-2 text-[12px] shadow-xl">
          {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : t.kind === "error" ? <XCircle className="mt-0.5 size-4 shrink-0 text-err" /> : <Info className="mt-0.5 size-4 shrink-0 text-info" />}
          <span className="leading-snug">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
