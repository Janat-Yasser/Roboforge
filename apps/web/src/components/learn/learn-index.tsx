"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookOpen, Clock, Play } from "lucide-react";
import { Photo } from "@/components/editorial/photo";
import { Reveal } from "@/components/ui/reveal";
import { PHOTOS } from "@/lib/photos";
import { TUTORIALS } from "@/lib/tutorials";

const LEVEL: Record<string, string> = { Beginner: "#14b886", Intermediate: "#e8a400", Advanced: "#ff5a5f" };
const STEP_COLORS = ["#1e6bff", "#e8a400", "#ff5a5f", "#14b886"];

export function LearnIndex() {
  const [lead, ...rest] = TUTORIALS;
  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[36px] bg-[#7c5cff] px-7 py-14 text-white sm:px-14 sm:py-20">
        <span className="animate-drift absolute right-[8%] top-[16%] hidden size-20 rounded-full bg-[#ffc933] sm:block" />
        <span className="animate-drift absolute bottom-[12%] right-[22%] hidden size-12 rotate-12 rounded-xl bg-[#ff5a5f] sm:block" style={{ animationDelay: "1s" }} />
        <span className="animate-drift absolute right-[34%] top-[10%] hidden size-8 rounded-lg bg-white/40 sm:block" style={{ animationDelay: "2s" }} />
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-bold"><BookOpen className="size-4" /> RoboForge Academy</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="relative mt-5 max-w-2xl text-[44px] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-[60px]">Learn to build robots that work.</motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="relative mt-4 max-w-xl text-[17px] text-white/85">
          {TUTORIALS.length} hands-on tutorials, about {TUTORIALS.reduce((a, t) => a + t.minutes, 0)} minutes in total. Follow along in the demo — no account needed.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="relative mt-8 flex flex-wrap gap-3">
          <Link href={`/learn/${lead!.slug}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-bold text-[#0e1b3d] shadow-[0_4px_0_#5b3fd9] transition-all hover:-translate-y-0.5">Start lesson 1 <ArrowRight className="size-4" /></Link>
          <Link href="/demo/hardware" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-6 py-3 text-[15px] font-bold transition-colors hover:border-white"><Play className="size-4 fill-current" /> Open the demo</Link>
        </motion.div>
      </div>

      {/* Path */}
      <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
        <h2 className="display text-[34px]">Your learning path</h2>
        <span className="text-[14px] font-semibold text-muted">Take them in order, or jump to what you need</span>
      </div>

      <Reveal>
        <Link href={`/learn/${lead!.slug}`} className="card-pop group mt-8 grid overflow-hidden md:grid-cols-2">
          <div className="relative min-h-[280px] overflow-hidden">
            <Photo photo={lead!.photo} className="absolute inset-0" imgClassName="transition-transform duration-700 group-hover:scale-105" sizes="(min-width: 768px) 50vw, 100vw" />
            <span className="absolute left-5 top-5 rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-[#0e1b3d] shadow">Start here</span>
          </div>
          <div className="flex flex-col p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl text-[17px] font-extrabold text-white" style={{ background: STEP_COLORS[0] }}>1</span>
              <span className="text-[13px] font-bold" style={{ color: LEVEL[lead!.level] }}>{lead!.level}</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold text-muted"><Clock className="size-3.5" /> {lead!.minutes} min</span>
            </div>
            <h3 className="display mt-5 text-[34px] transition-colors group-hover:text-accent">{lead!.title}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">{lead!.summary}</p>
            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {lead!.sections.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-[14px] font-semibold"><span className="size-1.5 rounded-full bg-accent" />{s.heading}</li>
              ))}
            </ul>
            <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-[15px] font-bold text-accent">Start the tutorial <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
          </div>
        </Link>
      </Reveal>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {rest.map((t, i) => (
          <Reveal key={t.slug} delay={i * 0.07}>
            <Link href={`/learn/${t.slug}`} className="card-pop group flex h-full flex-col overflow-hidden">
              <div className="relative h-48 overflow-hidden">
                <Photo photo={t.photo} className="absolute inset-0" imgClassName="transition-transform duration-700 group-hover:scale-110" sizes="(min-width: 768px) 33vw, 100vw" />
                <span className="absolute left-4 top-4 grid size-10 place-items-center rounded-xl text-[17px] font-extrabold text-white shadow" style={{ background: STEP_COLORS[i + 1] }}>{i + 2}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-2 text-[13px] font-bold">
                  <span style={{ color: LEVEL[t.level] }}>{t.level}</span>
                  <span className="text-faint">·</span>
                  <span className="flex items-center gap-1 text-muted"><Clock className="size-3.5" /> {t.minutes} min</span>
                </div>
                <h3 className="mt-2 text-[21px] font-bold leading-snug transition-colors group-hover:text-accent">{t.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t.summary}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-[14px] font-bold text-accent">Read <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
                <span className="mt-3 text-[11px] text-faint">Photo: {PHOTOS[t.photo].author} / Unsplash</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
