"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Lock } from "lucide-react";
import { CodeIllustration } from "@/components/site/landing/illustrations";

/** What the demo shows on pages that need a saved project (code, builds, docs). */
export function LockedSection({ title, text, bullets }: { title: string; text: string; bullets: string[] }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto p-8">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <span className="eyebrow"><Lock className="size-3.5" /> Needs a free account</span>
          <h1 className="display mt-4 text-[52px]">{title}</h1>
          <p className="mt-3 text-[15px] text-muted">{text}</p>
          <ul className="mt-5 space-y-2">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2.5 text-[14px]"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />{b}</li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/signup" className="btn btn-primary btn-lg">Create free account <ArrowRight className="size-4" /></Link>
            <Link href="/learn/code" className="btn btn-lg">Read the tutorial</Link>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-[32px] bg-gradient-to-br from-accent/20 to-accent-2/20 blur-2xl" />
          <div className="relative"><CodeIllustration /></div>
        </motion.div>
      </div>
    </div>
  );
}
