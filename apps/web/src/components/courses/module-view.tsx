"use client";
import Link from "next/link";
import { motion } from "motion/react";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Target } from "lucide-react";
import { Photo } from "@/components/editorial/photo";
import { MODULES, lessonKey, type Module } from "@/lib/courses";
import { PHOTOS } from "@/lib/photos";
import { useProgress } from "./progress";

export function ModuleView({ m }: { m: Module }) {
  const { done } = useProgress();
  const doneCount = m.lessons.filter((l) => done[lessonKey(m.slug, l.slug)]).length;
  const next = m.lessons.find((l) => !done[lessonKey(m.slug, l.slug)]) ?? m.lessons[0]!;
  const nextModule = MODULES[m.n];
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      <Link href="/courses" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[14px] font-semibold text-muted hover:bg-raised hover:text-fg"><ArrowLeft className="size-4" /> All modules</Link>
      <div className="mt-4 grid overflow-hidden rounded-[36px] text-white md:grid-cols-[1.2fr_1fr]" style={{ background: m.color }}>
        <div className="p-8 sm:p-12">
          <span className="inline-flex rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold">Module {m.n} of {MODULES.length}</span>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-5 text-[42px] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-[54px]">{m.title}</motion.h1>
          <p className="mt-2 text-[18px] font-semibold text-white/85">{m.tagline}</p>
          <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-white/80">{m.description}</p>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-2.5 w-48 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${(doneCount / m.lessons.length) * 100}%` }} /></div>
            <span className="text-[13.5px] font-bold">{doneCount}/{m.lessons.length} done</span>
          </div>
          <Link href={`/courses/${m.slug}/${next.slug}`} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-bold text-[#0e1b3d] transition-transform hover:-translate-y-0.5" style={{ boxShadow: `0 4px 0 ${m.dark}` }}>
            {doneCount === 0 ? "Start lesson 1" : doneCount === m.lessons.length ? "Review lessons" : `Continue: ${next.title}`} <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="relative min-h-[260px]">
          <Photo photo={m.photo} className="absolute inset-0" priority sizes="(min-width: 768px) 45vw, 100vw" />
          <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">Photo: {PHOTOS[m.photo].author} / Unsplash</span>
        </div>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_340px]">
        <div>
          <h2 className="display text-[28px]">Lessons</h2>
          <ol className="relative mt-6 space-y-4 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-0.5 before:bg-border">
            {m.lessons.map((l, i) => {
              const isDone = !!done[lessonKey(m.slug, l.slug)];
              return (
                <motion.li key={l.slug} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }} className="relative">
                  <Link href={`/courses/${m.slug}/${l.slug}`} className="group flex items-start gap-5">
                    <span className={clsx("relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl border-4 border-bg text-[17px] font-extrabold transition-transform group-hover:scale-105", isDone ? "text-white" : "bg-panel shadow-[var(--rf-shadow)]")} style={isDone ? { background: "var(--rf-green)" } : { color: m.color }}>
                      {isDone ? <CheckCircle2 className="size-6" /> : `${m.n}.${i + 1}`}
                    </span>
                    <div className="card-pop flex-1 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-[18px] font-bold group-hover:text-accent">{l.title}</h3>
                        <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-faint"><Clock className="size-3.5" />{l.minutes} min</span>
                      </div>
                      <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{l.summary}</p>
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ol>
        </div>
        <aside className="space-y-5">
          <div className="rounded-3xl border border-border bg-panel p-6 shadow-[var(--rf-shadow)]">
            <div className="flex items-center gap-2 text-[16px] font-bold"><Target className="size-5" style={{ color: m.color }} /> You will learn to</div>
            <ul className="mt-4 space-y-3">
              {m.outcomes.map((o) => (
                <li key={o} className="flex gap-3 text-[14.5px]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: m.color }} />{o}</li>
              ))}
            </ul>
          </div>
          {nextModule && (
            <Link href={`/courses/${nextModule.slug}`} className="card-pop block p-6">
              <div className="text-[13px] font-bold text-muted">Up next</div>
              <div className="mt-1 text-[18px] font-bold" style={{ color: nextModule.color }}>Module {nextModule.n}: {nextModule.title}</div>
              <div className="mt-1 text-[14px] text-muted">{nextModule.tagline}</div>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
