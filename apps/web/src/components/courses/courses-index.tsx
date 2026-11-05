// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, Award, BookOpen, CheckCircle2, Clock, GraduationCap, Layers, PlayCircle } from "lucide-react";
import { Photo } from "@/components/editorial/photo";
import { Reveal } from "@/components/ui/reveal";
import { MODULES, lessonKey, totalLessons, totalMinutes } from "@/lib/courses";
import { PHOTOS } from "@/lib/photos";
import { useProgress } from "./progress";

export function CoursesIndex() {
  const { done } = useProgress();
  const [open, setOpen] = useState<string | null>(MODULES[0]!.slug);
  const completed = Object.keys(done).length;
  const next = MODULES.flatMap((m) => m.lessons.map((l) => ({ m, l }))).find(({ m, l }) => !done[lessonKey(m.slug, l.slug)]);
  const pct = Math.round((completed / totalLessons) * 100);

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[36px] bg-[#0e1b3d] text-white">
        <span className="animate-drift absolute right-[7%] top-[14%] hidden size-20 rounded-full bg-[#ffc933] md:block" />
        <span className="animate-drift absolute right-[20%] bottom-[16%] hidden size-12 rotate-12 rounded-xl bg-[#ff5a5f] md:block" style={{ animationDelay: "1s" }} />
        <span className="animate-drift absolute right-[32%] top-[12%] hidden size-9 rounded-lg bg-[#14b886] md:block" style={{ animationDelay: "2s" }} />
        <div className="relative grid gap-10 p-8 sm:p-14 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-[#ffc933]">
              <GraduationCap className="size-4" /> RoboForge Academy · Free course
            </motion.span>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 text-[42px] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-[58px]">
              Robotics &amp; coding,<br /> from zero to rover.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/75">
              Three in-depth modules that take you from “what is a robot?” to writing real C++ that drives one. Every lesson has worked examples, diagrams, common mistakes, a hands-on exercise with a solution, and a quiz.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap gap-3">
              {next ? (
                <Link href={`/courses/${next.m.slug}/${next.l.slug}`} className="btn-ink">
                  {completed ? "Continue" : "Start the course"} <ArrowRight className="size-4" />
                </Link>
              ) : (
                <Link href="/signup" className="btn-ink">You finished! Build your robot <ArrowRight className="size-4" /></Link>
              )}
              <a href="#modules" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-6 py-3 text-[15px] font-bold transition-colors hover:border-white hover:bg-white/10">
                <Layers className="size-4" /> See the syllabus
              </a>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="self-center rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10 backdrop-blur">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                [String(MODULES.length), "modules", Layers],
                [String(totalLessons), "lessons", BookOpen],
                [`${Math.round(totalMinutes / 60 * 10) / 10}h`, "total", Clock],
              ].map(([n, l, Icon]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={l as string} className="rounded-2xl bg-white/[0.06] p-3">
                    <I className="mx-auto size-5 text-[#ffc933]" />
                    <div className="mt-1 text-[26px] font-extrabold">{n as string}</div>
                    <div className="text-[12.5px] font-semibold text-white/60">{l as string}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-[13.5px] font-bold">
                <span>Your progress</span>
                <span className="text-[#ffc933]">{completed} / {totalLessons} lessons</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[#1e6bff] via-[#14b886] to-[#ffc933]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
              <p className="mt-2 text-[12.5px] text-white/50">Progress is saved in this browser.</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modules */}
      <div id="modules" className="scroll-mt-24 pt-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Syllabus</span>
          <h2 className="display mt-4 text-[38px] sm:text-[48px]">Three modules, one robot</h2>
          <p className="mt-3 text-[17px] text-muted">Take them in order — each builds on the last — and finish with a rover you understand wire by wire and line by line.</p>
        </Reveal>

        {/* path connector */}
        <div className="mt-14 space-y-8">
          {MODULES.map((m, mi) => {
            const doneCount = m.lessons.filter((l) => done[lessonKey(m.slug, l.slug)]).length;
            const isOpen = open === m.slug;
            return (
              <Reveal key={m.slug} delay={mi * 0.06}>
                <div className="card-pop overflow-hidden hover:translate-y-0">
                  <div className="grid md:grid-cols-[360px_1fr]">
                    <div className="relative min-h-[240px] overflow-hidden">
                      <Photo photo={m.photo} className="absolute inset-0" sizes="(min-width: 768px) 360px, 100vw" />
                      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${m.color}cc, transparent 70%)` }} />
                      <div className="absolute left-6 top-6 grid size-16 place-items-center rounded-2xl bg-white text-[28px] font-extrabold shadow-lg" style={{ color: m.color }}>{m.n}</div>
                      <span className="absolute bottom-3 left-4 rounded-full bg-black/35 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">Photo: {PHOTOS[m.photo].author} / Unsplash</span>
                    </div>
                    <div className="flex flex-col p-7 sm:p-9">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full px-3 py-1 text-[12.5px] font-bold text-white" style={{ background: m.color }}>Module {m.n}</span>
                        <span className="text-[13px] font-semibold text-muted">{m.lessons.length} lessons · {m.lessons.reduce((a, l) => a + l.minutes, 0)} min</span>
                        {doneCount === m.lessons.length && <span className="flex items-center gap-1 rounded-full bg-green/12 px-3 py-1 text-[12.5px] font-bold text-green"><Award className="size-3.5" /> Completed</span>}
                      </div>
                      <h3 className="display mt-3 text-[32px]">{m.title}</h3>
                      <p className="mt-2 text-[16px] leading-relaxed text-muted">{m.description}</p>
                      <div className="mt-5 h-2 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(doneCount / m.lessons.length) * 100}%`, background: m.color }} />
                      </div>
                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <Link href={`/courses/${m.slug}`} className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-0.5" style={{ background: m.color, boxShadow: `0 4px 0 ${m.dark}` }}>
                          {doneCount ? "Continue module" : "Open module"} <ArrowRight className="size-4" />
                        </Link>
                        <button onClick={() => setOpen(isOpen ? null : m.slug)} className="rounded-xl px-4 py-2.5 text-[14.5px] font-bold text-muted hover:bg-raised hover:text-fg" aria-expanded={isOpen}>
                          {isOpen ? "Hide lessons" : "Show lessons"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                        <ol className="grid gap-3 border-t border-border bg-panel-2 p-5 sm:grid-cols-2 sm:p-7">
                          {m.lessons.map((l, li) => {
                            const isDone = !!done[lessonKey(m.slug, l.slug)];
                            return (
                              <li key={l.slug}>
                                <Link href={`/courses/${m.slug}/${l.slug}`} className="group flex items-center gap-4 rounded-2xl border border-border bg-panel p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--rf-shadow-lg)]">
                                  <span className={clsx("grid size-10 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold", isDone ? "bg-green text-white" : "bg-raised")} style={isDone ? undefined : { color: m.color }}>
                                    {isDone ? <CheckCircle2 className="size-5" /> : `${m.n}.${li + 1}`}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[15.5px] font-bold group-hover:text-accent">{l.title}</div>
                                    <div className="truncate text-[13px] text-muted">{l.summary}</div>
                                  </div>
                                  <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-faint"><Clock className="size-3.5" />{l.minutes}m</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* How it works */}
      <div className="mt-20 grid gap-5 md:grid-cols-3">
        {[
          { icon: BookOpen, c: "#1e6bff", t: "In-depth lessons", d: "15–20 minutes each: explanations, diagrams, worked examples with real numbers, and common mistakes." },
          { icon: CheckCircle2, c: "#14b886", t: "Exercises & quizzes", d: "A practical exercise with a worked solution and a five-question quiz in every lesson." },
          { icon: PlayCircle, c: "#ff5a5f", t: "Hands-on practice", d: "Every lesson links to a live exercise in the RoboForge demo." },
        ].map((f, i) => (
          <Reveal key={f.t} delay={i * 0.06}>
            <div className="card-pop flex h-full gap-4 p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: f.c }}><f.icon className="size-6" /></span>
              <div>
                <h3 className="text-[17px] font-bold">{f.t}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{f.d}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
