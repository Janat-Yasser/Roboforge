"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import clsx from "clsx";
import {
  ArrowRight,
  Boxes,
  Cable,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  GitBranch,
  GraduationCap,
  Hammer,
  MousePointer2,
  Play,
  Move3d,
  Rotate3d,
  ShieldCheck,
  Wrench,
  Workflow,
  Users,
} from "lucide-react";
import { RobotPreview } from "@/components/robot3d";
import { Reveal } from "@/components/ui/reveal";
import { Logo } from "@/components/ui/logo";
import { builtinCatalog, demoSpec } from "@/lib/demo";
import { PHOTOS, unsplash, type PhotoKey } from "@/lib/photos";
import { TUTORIALS } from "@/lib/tutorials";
import { MODULES, totalLessons } from "@/lib/courses";
import { BehaviorIllustration, CodeIllustration, PartsIllustration, SimIllustration, WiringIllustration } from "./illustrations";

function Img({ photo, w, h, className }: { photo: PhotoKey; w: number; h?: number; className?: string }) {
  const p = PHOTOS[photo];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={unsplash(p.id, w, h)} alt={p.alt} loading="lazy" decoding="async" draggable={false} className={clsx("h-full w-full object-cover", className)} style={{ backgroundColor: p.tone }} />;
}

function SectionHead({ tag, title, text, center, color = "var(--rf-accent)" }: { tag: string; title: React.ReactNode; text?: string; center?: boolean; color?: string }) {
  return (
    <Reveal className={clsx("max-w-2xl", center && "mx-auto text-center")}>
      <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
        {tag}
      </span>
      <h2 className="display mt-4 text-[38px] sm:text-[48px]">{title}</h2>
      {text && <p className="mt-4 text-[17px] leading-relaxed text-muted">{text}</p>}
    </Reveal>
  );
}

/* ------------------------------------------------------------------------------------------ */

const BOARDS = ["ESP32", "Arduino Uno", "STM32 Nucleo", "Raspberry Pi", "ROS 2", "PlatformIO", "TB6612FNG", "L298N", "VL53L0X", "MPU-6050", "RPLIDAR", "LiPo 2S–6S", "Servos", "CAN bus"];

export function WorksWith() {
  const row = [...BOARDS, ...BOARDS];
  return (
    <section className="py-10">
      <p className="text-center text-[14px] font-semibold text-muted">Works with the boards and parts you already have</p>
      <div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-marquee gap-3">
          {row.map((b, i) => (
            <span key={i} className="flex items-center gap-2 rounded-full border border-border bg-panel px-4 py-2 text-[14px] font-semibold shadow-[var(--rf-shadow)]">
              <span className="size-2 rounded-full" style={{ background: ["#1e6bff", "#ffc933", "#ff5a5f", "#14b886", "#7c5cff"][i % 5] }} />
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* How it works: auto-advancing tabs with a live demo panel.                                   */

const STEPS = [
  { icon: Boxes, color: "#1e6bff", title: "Pick your parts", text: "Choose controllers, motors, drivers, sensors and batteries from a library of real parts with real datasheet numbers.", ui: <PartsIllustration /> },
  { icon: Cable, color: "#e8a400", title: "Wire them up", text: "Drag from pin to pin — or let Auto-wire pick safe pins. 45 checks run on every change and explain every fix.", ui: <WiringIllustration /> },
  { icon: Workflow, color: "#ff5a5f", title: "Program the behavior", text: "Snap together events, sensor reads, conditions, motor commands and waits. No code needed to start.", ui: <BehaviorIllustration /> },
  { icon: Play, color: "#7c5cff", title: "Watch it drive", text: "Run the behavior in a 2D simulator before you build anything. Move the boxes, press the e-stop, see what the sensors see.", ui: <SimIllustration /> },
  { icon: Code2, color: "#14b886", title: "Get real code", text: "Generate firmware and ROS 2 packages, run the tests in a sandbox and export a Git-ready project.", ui: <CodeIllustration /> },
];
const STEP_MS = 7000;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [t, setT] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-20%" });
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (!inView || hovering) return;
    const start = performance.now() - t * STEP_MS;
    let raf = 0;
    const tick = (now: number) => {
      const p = (now - start) / STEP_MS;
      if (p >= 1) {
        setActive((a) => (a + 1) % STEPS.length);
        setT(0);
        return;
      }
      setT(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hovering, active]);
  const s = STEPS[active]!;
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <SectionHead center tag="How it works" title="From idea to a moving robot in five steps" text="Everything you do edits one Robot Specification, so hardware, wiring, behavior and code always stay in sync." />
      <div ref={ref} className="mt-14 grid items-center gap-10 lg:grid-cols-[400px_1fr]" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
        <div className="space-y-3" role="tablist">
          {STEPS.map((st, i) => {
            const on = i === active;
            return (
              <button
                key={st.title}
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(i);
                  setT(0);
                }}
                className={clsx("relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300", on ? "border-border bg-panel shadow-[var(--rf-shadow-lg)]" : "border-transparent hover:bg-panel/60")}
              >
                <div className="flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl text-white transition-transform duration-300" style={{ background: st.color, transform: on ? "rotate(-6deg) scale(1.05)" : "none" }}>
                    <st.icon className="size-5" />
                  </span>
                  <div>
                    <div className="text-[12.5px] font-bold" style={{ color: st.color }}>Step {i + 1}</div>
                    <div className="text-[18px] font-bold">{st.title}</div>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden pl-[60px] text-[15px] leading-relaxed text-muted">
                      <span className="block pt-2">{st.text}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
                {on && (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-raised">
                    <span className="block h-full" style={{ width: `${t * 100}%`, background: st.color }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative overflow-hidden rounded-[32px] p-6 sm:p-12" style={{ background: `color-mix(in srgb, ${s.color} 13%, var(--rf-panel))`, transition: "background 0.6s" }}>
          <motion.div key={`a${active}`} className="absolute -right-10 -top-10 size-44 rounded-full opacity-60" style={{ background: s.color }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} />
          <motion.div key={`b${active}`} className="absolute -bottom-8 left-10 size-24 rotate-12 rounded-3xl opacity-40" style={{ background: s.color }} initial={{ y: 60, rotate: 0 }} animate={{ y: 0, rotate: 12 }} transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }} />
          <div className="relative min-h-[360px]">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, x: 40, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -40, scale: 0.97 }} transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}>
                {s.ui}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

export function Live3D() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const spec = useMemo(() => (mounted ? demoSpec() : null), [mounted]);
  const FEATS = [
    { icon: Move3d, title: "Updates as you build", text: "Add a sensor or a motor and it appears on the robot instantly." },
    { icon: MousePointer2, title: "Click to select", text: "Pick parts in 3D and edit them on the canvas — they stay in sync." },
    { icon: ShieldCheck, title: "Problems light up", text: "Parts with wiring errors are highlighted right on the model." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="relative overflow-hidden rounded-[36px] bg-[#0e1b3d] text-white">
        <div className="absolute -left-24 -top-24 size-72 rounded-full bg-[#1e6bff]/40 blur-3xl" />
        <div className="absolute -bottom-24 right-10 size-72 rounded-full bg-[#7c5cff]/30 blur-3xl" />
        <div className="relative grid items-center gap-6 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-bold text-[#ffc933]"><Rotate3d className="size-4" /> Live 3D preview</span>
            <h2 className="mt-4 text-[38px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">See your robot come to life — while you build it.</h2>
            <div className="mt-8 space-y-5">
              {FEATS.map((f, i) => (
                <motion.div key={f.title} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1 }} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-[#ffc933]"><f.icon className="size-5" /></span>
                  <div>
                    <div className="text-[17px] font-bold">{f.title}</div>
                    <div className="mt-0.5 text-[15px] text-white/65">{f.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>
            <Link href="/demo/hardware?view=3d" className="btn-ink mt-10">Open the 3D demo <ArrowRight className="size-4" /></Link>
          </Reveal>
          <Reveal delay={0.1} className="relative aspect-square max-h-[520px] w-full">
            <div className="absolute inset-4 rounded-full bg-white/5" />
            {spec && <RobotPreview spec={spec} catalog={builtinCatalog()} dark autoRotate spinWheels cameraDistance={0.48} />}
            <motion.span animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3.2 }} className="absolute left-2 top-10 rounded-xl bg-white px-3 py-2 text-[13px] font-bold text-[#0e1b3d] shadow-xl">✓ Wiring valid</motion.span>
            <motion.span animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 3.6 }} className="absolute bottom-16 right-2 rounded-xl bg-[#ffc933] px-3 py-2 text-[13px] font-bold text-[#0e1b3d] shadow-xl">Distance sensor · 0x29</motion.span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/70 backdrop-blur">Drag to spin it</span>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Project ideas: draggable, snapping card carousel.                                           */

const PROJECTS: { photo: PhotoKey; title: string; level: "Beginner" | "Intermediate" | "Advanced"; parts: string[]; href: string; ready?: boolean }[] = [
  { photo: "roverBench", title: "Obstacle-avoiding rover", level: "Beginner", parts: ["ESP32", "ToF sensor", "2 motors"], href: "/demo/hardware", ready: true },
  { photo: "robotCarCase", title: "Smart robot car", level: "Beginner", parts: ["Arduino Uno", "L298N", "Ultrasonic"], href: "/signup" },
  { photo: "trackedRover", title: "Tank-tread explorer", level: "Intermediate", parts: ["ESP32", "TB6612FNG", "IMU"], href: "/signup" },
  { photo: "mecanumRover", title: "Mecanum competition bot", level: "Advanced", parts: ["STM32", "CAN motors", "LiDAR"], href: "/signup" },
  { photo: "legoRobots", title: "Classroom line follower", level: "Beginner", parts: ["Arduino", "IR sensors", "Servos"], href: "/signup" },
  { photo: "robotArmStudio", title: "Desktop robot arm", level: "Advanced", parts: ["ESP32", "6 servos", "ROS 2"], href: "/signup" },
];
const LEVEL_COLOR = { Beginner: "#14b886", Intermediate: "#e8a400", Advanced: "#ff5a5f" };

export function ProjectCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const measure = () => {
    const el = track.current;
    if (!el) return;
    setPages(Math.max(1, Math.round(el.scrollWidth / el.clientWidth + 0.49)));
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const by = (d: number) => track.current?.scrollBy({ left: d * (track.current.clientWidth * 0.8), behavior: "smooth" });
  return (
    <section className="py-24">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-5">
        <SectionHead tag="Project ideas" color="#ff5a5f" title="What will you build?" text="Start from a working robot or a blank canvas. Here are a few ideas to get your gears turning." />
        <div className="flex gap-2">
          <button onClick={() => by(-1)} className="grid size-12 place-items-center rounded-full border-2 border-border bg-panel transition hover:border-fg/40 disabled:opacity-40" disabled={page === 0} aria-label="Previous projects"><ChevronLeft className="size-5" /></button>
          <button onClick={() => by(1)} className="grid size-12 place-items-center rounded-full bg-fg text-bg transition hover:scale-105 disabled:opacity-40" disabled={page >= pages - 1} aria-label="Next projects"><ChevronRight className="size-5" /></button>
        </div>
      </div>
      <div
        ref={track}
        onScroll={measure}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = { x: e.clientX, left: track.current!.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x;
          if (Math.abs(dx) > 4) drag.current.moved = true;
          track.current!.scrollLeft = drag.current.left - dx;
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null))}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) e.preventDefault();
        }}
        className="no-scrollbar mt-12 flex cursor-grab snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-5 px-5 pb-8 active:cursor-grabbing xl:scroll-px-[max(1.25rem,calc((100vw-80rem)/2+1.25rem))] xl:px-[max(1.25rem,calc((100vw-80rem)/2+1.25rem))]"
      >
        {PROJECTS.map((p, i) => (
          <motion.div key={p.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.5 }} className="w-[300px] shrink-0 snap-start sm:w-[340px]">
            <Link href={p.href} draggable={false} className="card-pop group block overflow-hidden">
              <div className="relative h-56 overflow-hidden">
                <Img photo={p.photo} w={700} h={460} className="transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-[12px] font-bold text-white" style={{ background: LEVEL_COLOR[p.level] }}>{p.level}</span>
                {p.ready && <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-[12px] font-bold text-[#0e1b3d]">▶ Try now</span>}
              </div>
              <div className="p-5">
                <h3 className="text-[19px] font-bold transition-colors group-hover:text-accent">{p.title}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.parts.map((x) => <span key={x} className="rounded-lg bg-raised px-2 py-1 text-[12.5px] font-semibold text-muted">{x}</span>)}
                </div>
                <div className="mt-4 flex items-center justify-between text-[13.5px] font-bold text-accent">
                  {p.ready ? "Open in the demo" : "Start this project"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
                <div className="mt-3 text-[11px] text-faint">Photo: {PHOTOS[p.photo].author} / Unsplash</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        {Array.from({ length: pages }, (_, i) => (
          <button key={i} onClick={() => track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" })} aria-label={`Page ${i + 1}`} className={clsx("h-2 rounded-full transition-all duration-300", i === page ? "w-8 bg-accent" : "w-2 bg-border-strong hover:bg-faint")} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

const AUDIENCES: { photo: PhotoKey; icon: typeof Users; color: string; title: string; text: string }[] = [
  { photo: "legoRobots", icon: GraduationCap, color: "#1e6bff", title: "Students & classrooms", text: "Real engineering, explained step by step. Every wire checked, every pin labelled." },
  { photo: "workshop3d", icon: Wrench, color: "#ff5a5f", title: "Makers & hobbyists", text: "From a 3D-printed chassis to firmware that works on the first upload." },
  { photo: "studentsLab", icon: Users, color: "#14b886", title: "Teams & labs", text: "One shared design, real ROS 2 packages and a Git-ready codebase." },
];

export function Audiences() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <SectionHead center tag="Made for everyone who builds" color="#14b886" title="Beginner-friendly. Engineer-approved." />
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {AUDIENCES.map((a, i) => (
          <Reveal key={a.title} delay={i * 0.08}>
            <div className="card-pop group h-full overflow-hidden">
              <div className="relative h-60 overflow-hidden">
                <Img photo={a.photo} w={800} h={520} className="transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute -bottom-6 left-6 grid size-14 place-items-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:-rotate-6" style={{ background: a.color }}>
                  <a.icon className="size-6" />
                </span>
              </div>
              <div className="p-6 pt-10">
                <h3 className="text-[20px] font-bold">{a.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{a.text}</p>
                <div className="mt-4 text-[11px] text-faint">Photo: {PHOTOS[a.photo].author} / Unsplash</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

const FEATURES = [
  { icon: ShieldCheck, color: "#1e6bff", title: "45 live checks", text: "Voltages, logic levels, pin conflicts, bus addresses and power." },
  { icon: Rotate3d, color: "#7c5cff", title: "3D preview", text: "Your robot's chassis, wheels, boards and sensors — live." },
  { icon: Cpu, color: "#e8a400", title: "Automatic pin map", text: "Every controller pin's role and connection, derived for you." },
  { icon: Hammer, color: "#ff5a5f", title: "Sandboxed builds", text: "Compile and run the generated tests safely, with live logs." },
  { icon: Workflow, color: "#14b886", title: "ROS 2 ready", text: "URDF, launch files and a behavior node generated for you." },
  { icon: GitBranch, color: "#0e1b3d", title: "Git-ready export", text: "A clean repository with docs, CI and your edits preserved." },
];

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 0.06}>
            <div className="card-pop group flex h-full gap-4 p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 dark:ring-1 dark:ring-white/10" style={{ background: f.color }}>
                <f.icon className="size-6" />
              </span>
              <div>
                <h3 className="text-[17px] font-bold">{f.title}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{f.text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

const LEVEL_BADGE: Record<string, string> = { Beginner: "#14b886", Intermediate: "#e8a400", Advanced: "#ff5a5f" };

export function LearnTeaser() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHead tag="Tutorials" color="#7c5cff" title="New to robots? Start here." text="Short, hands-on lessons that take you from an empty project to a robot that avoids obstacles." />
        <Link href="/learn" className="btn-line">All tutorials <ArrowRight className="size-4" /></Link>
      </div>
      <Reveal className="mt-10">
        <Link href="/courses" className="group relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[28px] bg-[#0e1b3d] p-7 text-white transition-transform hover:-translate-y-1 sm:p-9">
          <span className="animate-drift absolute right-[6%] top-[20%] hidden size-14 rounded-full bg-[#ffc933] md:block" />
          <span className="animate-drift absolute right-[18%] bottom-[14%] hidden size-9 rotate-12 rounded-xl bg-[#ff5a5f] md:block" style={{ animationDelay: "1.2s" }} />
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#1e6bff]"><GraduationCap className="size-8" /></span>
          <div className="relative max-w-xl">
            <div className="text-[13px] font-bold text-[#ffc933]">Free course · {MODULES.length} modules · {totalLessons} lessons</div>
            <div className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight">Intro to Robotics, Electronics &amp; Coding</div>
            <div className="mt-1 text-[15px] text-white/70">From “what is a robot?” to writing the C++ that drives one — with exercises and quizzes.</div>
          </div>
          <span className="relative ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[15px] font-bold text-[#0e1b3d]">Start the course <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
      </Reveal>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {TUTORIALS.map((t, i) => (
          <Reveal key={t.slug} delay={i * 0.06}>
            <Link href={`/learn/${t.slug}`} className="card-pop group block h-full overflow-hidden">
              <div className="relative h-44 overflow-hidden">
                <Img photo={t.photo} w={600} h={380} className="transition-transform duration-700 group-hover:scale-110" />
                <span className="absolute left-3 top-3 grid size-9 place-items-center rounded-xl bg-white text-[15px] font-extrabold text-[#0e1b3d] shadow">{i + 1}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-[12.5px] font-bold">
                  <span style={{ color: LEVEL_BADGE[t.level] }}>{t.level}</span>
                  <span className="text-faint">·</span>
                  <span className="flex items-center gap-1 text-muted"><Clock className="size-3.5" /> {t.minutes} min</span>
                </div>
                <h3 className="mt-2 text-[18px] font-bold leading-snug transition-colors group-hover:text-accent">{t.title}</h3>
                <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted">{t.summary}</p>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------ */

const SHAPES = [
  { c: "#ffc933", cls: "left-[6%] top-[18%] size-16 rounded-full", d: 0 },
  { c: "#ff5a5f", cls: "left-[14%] bottom-[14%] size-12 rounded-xl rotate-12", d: 1.2 },
  { c: "#14b886", cls: "right-[10%] top-[16%] size-14 rounded-2xl -rotate-12", d: 0.6 },
  { c: "#7c5cff", cls: "right-[18%] bottom-[18%] size-10 rounded-full", d: 1.8 },
  { c: "#ffffff", cls: "left-[42%] top-[8%] size-5 rounded-full opacity-60", d: 2.4 },
];

export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-8">
      <Reveal className="relative overflow-hidden rounded-[36px] bg-[#1e6bff] px-6 py-20 text-center text-white sm:px-12">
        {SHAPES.map((s, i) => (
          <span key={i} className={clsx("animate-drift absolute hidden sm:block", s.cls)} style={{ background: s.c, animationDelay: `${s.d}s` }} />
        ))}
        <motion.div className="relative mx-auto w-fit" animate={{ y: [0, -10, 0], rotate: [0, -4, 4, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}>
          <div className="rounded-[26px] bg-white/15 p-3"><Logo size={72} /></div>
        </motion.div>
        <h2 className="relative mx-auto mt-8 max-w-2xl text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[56px]">Ready to build your first robot?</h2>
        <p className="relative mx-auto mt-4 max-w-lg text-[17px] text-white/85">It's free to start. Try the demo right now, or create an account to save your projects.</p>
        <div className="relative mt-9 flex flex-wrap justify-center gap-3">
          <Link href={signedIn ? "/projects" : "/signup"} className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[16px] font-bold text-[#0e1b3d] shadow-[0_4px_0_#0b4fd6] transition-all hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_1px_0_#0b4fd6]">
            {signedIn ? "Open my projects" : "Create a free account"} <ArrowRight className="size-4" />
          </Link>
          <Link href="/demo/hardware" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/40 px-7 py-3.5 text-[16px] font-bold transition-colors hover:border-white hover:bg-white/10">
            Try the demo
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
