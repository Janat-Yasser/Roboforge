"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Logo } from "./logo";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: mode === "signup" ? { email, name, password } : { email, password } });
      router.push(params.get("next") ?? "/projects");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <Logo size={28} />
          <div>
            <div className="text-[15px] font-semibold">RoboForge</div>
            <div className="text-[12px] text-muted">{mode === "login" ? "Sign in to your workspace" : "Create your engineering workspace"}</div>
          </div>
        </div>
        {mode === "signup" && (
          <div className="mb-3">
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          </div>
        )}
        <div className="mb-3">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>
        <div className="mb-4">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : 1} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          {mode === "signup" && <p className="mt-1 text-[11px] text-faint">At least 8 characters.</p>}
        </div>
        {error && <p className="mb-3 rounded border border-err/40 bg-err/10 px-2 py-1.5 text-[12px] text-err">{error}</p>}
        <button className="btn btn-primary w-full justify-center py-1.5" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
        <p className="mt-4 text-center text-[12px] text-muted">
          {mode === "login" ? (
            <>No account? <Link className="text-accent" href="/signup">Create one</Link></>
          ) : (
            <>Already registered? <Link className="text-accent" href="/login">Sign in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
