"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Lock, X } from "lucide-react";
import { create } from "zustand";

interface GateState {
  reason: string | null;
  open(reason: string): void;
  close(): void;
}

/** Global "sign in to continue" dialog used by the public demo. */
export const useSignInGate = create<GateState>((set) => ({
  reason: null,
  open: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}));

export function SignInGate() {
  const { reason, close } = useSignInGate();
  return (
    <AnimatePresence>
      {reason && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="card relative w-full max-w-md overflow-hidden p-7 text-center shadow-[var(--rf-shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
            <button className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-raised hover:text-fg" onClick={close} aria-label="Close"><X className="size-4" /></button>
            <div className="relative mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-lg">
              <Lock className="size-6" />
            </div>
            <h2 className="display relative mt-5 text-[34px]">Create a free account to {reason}</h2>
            <p className="relative mt-2 text-[14px] text-muted">
              The demo lets you explore everything in your browser. Saving projects, generating code, running builds and exporting need an account — it takes 20 seconds.
            </p>
            <div className="relative mt-6 flex flex-col gap-2">
              <Link href="/signup" className="btn btn-primary btn-lg w-full">Create free account</Link>
              <Link href="/login" className="btn btn-lg w-full">I already have an account</Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
