"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useScroll, useSpring } from "motion/react";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Lightbulb } from "lucide-react";
import { RobotPreview } from "@/components/robot3d";
import { BehaviorIllustration, CodeIllustration, WiringIllustration } from "@/components/site/landing/illustrations";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/editorial/photo";
import { PHOTOS } from "@/lib/photos";
import { builtinCatalog, demoSpec } from "@/lib/demo";
import { TUTORIALS, type Tutorial, type Visual } from "@/lib/tutorials";

/** Renders **bold** and `code` inside tutorial text. */
export function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i} className="font-semibold text-fg">{p.slice(2, -2)}</strong>
        : p.startsWith("`") ? <code key={i} className="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[12.5px] text-accent">{p.slice(1, -1)}</code>
        : p.startsWith("*") && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em>
        : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function Robot3dVisual() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const spec = useMemo(() => (mounted ? demoSpec() : null), [mounted]);
  return (
    <div className="aspect-[16/9] overflow-hidden rounded-3xl border border-border bg-panel shadow-[var(--rf-shadow)]">
      {spec && <RobotPreview spec={spec} catalog={builtinCatalog()} dark={resolvedTheme === "dark"} autoRotate spinWheels cameraDistance={0.5} />}
    </div>
  );
}

const PIN_LEGEND = [
  ["Power", "var(--rf-sig-power)"],
  ["Ground", "var(--rf-sig-ground)"],
  ["Logic / GPIO", "var(--rf-sig-logic)"],
  ["I²C", "var(--rf-sig-i2c)"],
  ["UART", "var(--rf-sig-uart)"],
  ["CAN", "var(--rf-sig-can)"],
  ["Motor", "var(--rf-sig-motor)"],
  ["PWM", "var(--rf-sig-pwm)"],
];

function VisualBlock({ v }: { v: Visual }) {
  switch (v) {
    case "robot3d":
      return <Robot3dVisual />;
    case "wiring":
      return <WiringIllustration />;
    case "behavior":
      return <BehaviorIllustration />;
    case "code":
      return <CodeIllustration />;
    case "pins":
      return (
        <div className="grid grid-cols-2 gap-3 rounded-3xl border border-border bg-panel p-6 shadow-[var(--rf-shadow)] sm:grid-cols-4">
          {PIN_LEGEND.map(([l, c]) => (
            <div key={l} className="flex items-center gap-2.5 text-[13px]">
              <svg width="42" height="12"><line x1="2" y1="6" x2="30" y2="6" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray={l === "Ground" ? "4 3" : undefined} /><circle cx="36" cy="6" r="4.5" fill={c} /></svg>
              {l}
            </div>
          ))}
        </div>
      );
    case "ownership":
      return (
        <div className="grid gap-3 rounded-3xl border border-border bg-panel p-5 shadow-[var(--rf-shadow)] sm:grid-cols-3">
          {[
            ["G", "Generated", "bg-accent/15 text-accent", "Rewritten on every generation"],
            ["M", "Mixed", "bg-warn/15 text-warn", "USER regions are preserved"],
            ["U", "User", "bg-ok/15 text-ok", "Never touched by RoboForge"],
          ].map(([b, t, cls, d]) => (
            <div key={b} className="rounded-2xl border border-border bg-panel-2 p-4">
              <span className={clsx("rounded-md px-2 py-0.5 font-mono text-[12px] font-bold", cls)}>{b}</span>
              <div className="mt-2 font-semibold">{t}</div>
              <div className="text-[12.5px] text-muted">{d}</div>
            </div>
          ))}
        </div>
      );
  }
}

export function TutorialView({ t }: { t: Tutorial }) {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });
  const [active, setActive] = useState(t.sections[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    t.sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [t]);
  const idx = TUTORIALS.findIndex((x) => x.slug === t.slug);
  const prev = TUTORIALS[idx - 1];
  const next = TUTORIALS[idx + 1];

  return (
    <>
      <motion.div className="fixed left-0 right-0 top-0 z-[55] h-1 origin-left bg-accent" style={{ scaleX: progress }} />

      {/* Opener */}
      <header className="mx-auto max-w-7xl px-5">
        <Link href="/learn" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[14px] font-semibold text-muted hover:bg-raised hover:text-fg"><ArrowLeft className="size-4" /> All tutorials</Link>
        <div className="mt-4 grid items-center gap-10 overflow-hidden rounded-[32px] border border-border bg-panel p-6 shadow-[var(--rf-shadow)] sm:p-10 md:grid-cols-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-[12.5px] font-bold text-white">Lesson {idx + 1} of {TUTORIALS.length}</span>
              <span className="rounded-full bg-raised px-3 py-1 text-[12.5px] font-bold text-muted">{t.level}</span>
              <span className="flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12.5px] font-bold text-muted"><Clock className="size-3.5" /> {t.minutes} min</span>
            </div>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="display mt-5 text-[40px] sm:text-[54px]">{t.title}</motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4 text-[17px] leading-relaxed text-muted">{t.summary}</motion.p>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 0.6 }} className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Photo photo={t.photo} className="absolute inset-0" priority sizes="(min-width: 768px) 40vw, 100vw" />
            <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/80 backdrop-blur">Photo: {PHOTOS[t.photo].author} / Unsplash</span>
          </motion.div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-12">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav className="sticky top-28">
            <div className="mb-4 text-[13px] font-bold text-muted">In this lesson</div>
            <ol className="space-y-1">
              {t.sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2 text-[14.5px] font-semibold transition-all", active === s.id ? "bg-accent/10 text-accent" : "text-muted hover:bg-raised hover:text-fg")}>
                    <span className={clsx("grid size-6 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold", active === s.id ? "bg-accent text-white" : "bg-raised text-muted")}>{i + 1}</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="min-w-0 space-y-16 lg:col-span-8 lg:col-start-5">
          {t.sections.map((s, si) => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <Reveal>
                <div className="flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-[18px] font-extrabold text-white shadow-[0_3px_0_var(--rf-accent-strong)]">{si + 1}</span>
                  <h2 className="display text-[30px] sm:text-[36px]">{s.heading}</h2>
                </div>
                <div className="mt-5 space-y-4 text-[17px] leading-[1.7] text-fg/85">
                  {s.body.map((b, i) => <p key={i}><Inline text={b} /></p>)}
                </div>
                {s.steps && (
                  <ol className="mt-6 space-y-3">
                    {s.steps.map((st, i) => (
                      <motion.li key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }} className="flex gap-4 rounded-2xl border border-border bg-panel p-4 text-[16px] leading-relaxed shadow-[var(--rf-shadow)]">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/12 text-[14px] font-extrabold text-accent">{i + 1}</span>
                        <span><Inline text={st} /></span>
                      </motion.li>
                    ))}
                  </ol>
                )}
                {s.tip && (
                  <div className="mt-6 flex gap-4 rounded-2xl bg-[#ffc933]/20 p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffc933] text-[#0e1b3d]"><Lightbulb className="size-5" /></span>
                    <div><div className="text-[14px] font-extrabold">Tip</div><p className="mt-1 text-[15.5px] leading-relaxed"><Inline text={s.tip} /></p></div>
                  </div>
                )}
                {s.warning && (
                  <div className="mt-6 flex gap-4 rounded-2xl bg-[#ff5a5f]/12 p-5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ff5a5f] text-white"><AlertTriangle className="size-5" /></span>
                    <div><div className="text-[14px] font-extrabold">Heads up</div><p className="mt-1 text-[15.5px] leading-relaxed"><Inline text={s.warning} /></p></div>
                  </div>
                )}
                {s.visual && <div className="mt-8"><VisualBlock v={s.visual} /></div>}
              </Reveal>
            </section>
          ))}
          <nav className="grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link href={`/learn/${prev.slug}`} className="card-pop group p-6">
                <div className="text-[13px] font-bold text-muted">← Previous lesson</div>
                <div className="mt-1 text-[19px] font-bold group-hover:text-accent">{prev.title}</div>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/learn/${next.slug}`} className="group rounded-3xl bg-accent p-6 text-right text-white shadow-[0_5px_0_var(--rf-accent-strong)] transition-transform hover:-translate-y-1">
                <div className="text-[13px] font-bold text-white/75">Next lesson →</div>
                <div className="mt-1 text-[19px] font-bold">{next.title}</div>
              </Link>
            ) : (
              <Link href="/signup" className="group rounded-3xl bg-[#14b886] p-6 text-right text-white shadow-[0_5px_0_#0d8f68] transition-transform hover:-translate-y-1">
                <div className="text-[13px] font-bold text-white/75">You finished the course!</div>
                <div className="mt-1 text-[19px] font-bold">Build your own robot <ArrowRight className="inline size-5" /></div>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
