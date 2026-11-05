"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import clsx from "clsx";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { PHOTOS, srcSet, unsplash, type PhotoKey } from "@/lib/photos";

interface Slide {
  photo: PhotoKey;
  tab: string;
  tag: string;
  color: string;
  title: [string, string];
  text: string;
  cta: { label: string; href: string };
}

const SLIDES: Slide[] = [
  {
    photo: "roverBench",
    tab: "Design",
    tag: "Robot design studio",
    color: "#1e6bff",
    title: ["Build real robots,", "right in your browser."],
    text: "Drag in real parts, connect the wires and watch your robot come together in 3D — then get code that runs on the real thing.",
    cta: { label: "Start building — it's free", href: "/signup" },
  },
  {
    photo: "wiredBoard",
    tab: "Wire",
    tag: "45 automatic checks",
    color: "#ffc933",
    title: ["Wire it right", "the first time."],
    text: "RoboForge checks every voltage, pin and bus while you connect things, and tells you exactly how to fix what's wrong.",
    cta: { label: "See the wiring tutorial", href: "/learn/wiring" },
  },
  {
    photo: "trackedRover",
    tab: "Program",
    tag: "Behavior blocks",
    color: "#ff5a5f",
    title: ["Teach your robot", "how to think."],
    text: "Snap together events, sensors, conditions and motors. Your robot multitasks, and the emergency stop always wins.",
    cta: { label: "Watch it drive in the demo", href: "/demo/simulate" },
  },
  {
    photo: "handsOnBoard",
    tab: "Code",
    tag: "Firmware + ROS 2",
    color: "#14b886",
    title: ["Real code.", "Yours to keep."],
    text: "Get clean firmware for ESP32, Arduino and STM32 plus ROS 2 packages — tested in a sandbox and ready for Git.",
    cta: { label: "How code generation works", href: "/learn/code" },
  },
];

const DURATION = 6500;

/** Full-bleed photo slideshow: autoplay with progress tabs, arrows, swipe and keyboard control. */
export function HeroCarousel({ signedIn }: { signedIn: boolean }) {
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const last = useRef<number | null>(null);

  const go = useCallback((to: number, d?: number) => {
    setState(([cur]) => [((to % SLIDES.length) + SLIDES.length) % SLIDES.length, d ?? (to > cur ? 1 : -1)]);
  }, []);
  const next = useCallback(() => setState(([cur]) => [(cur + 1) % SLIDES.length, 1]), []);
  const prev = useCallback(() => setState(([cur]) => [(cur - 1 + SLIDES.length) % SLIDES.length, -1]), []);

  // Autoplay clock (pauses on hover or when the user pauses).
  const pRef = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = (t: number) => {
      if (last.current !== null && !paused && !userPaused) {
        pRef.current += (t - last.current) / DURATION;
        if (pRef.current >= 1) {
          pRef.current = 0;
          next();
        }
        setProgress(pRef.current);
      }
      last.current = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, userPaused, next]);
  useEffect(() => {
    pRef.current = 0;
    setProgress(0);
  }, [index]);

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60 || info.velocity.x < -400) {
      next();
    } else if (info.offset.x > 60 || info.velocity.x > 400) {
      prev();
    }
  }

  const s = SLIDES[index]!;
  const cta = index === 0 && signedIn ? { label: "Open my projects", href: "/projects" } : s.cta;

  return (
    <section className="mx-auto max-w-7xl px-3 pt-2 sm:px-5" aria-roledescription="carousel" aria-label="What RoboForge does">
      <div
        className="relative h-[640px] overflow-hidden rounded-[28px] bg-[#0e1b3d] sm:h-[620px] md:rounded-[36px] lg:h-[min(80vh,700px)]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") prev();
        }}
        tabIndex={0}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            className="absolute inset-0"
            variants={{
              enter: (d: number) => ({ clipPath: d > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" }),
              center: { clipPath: "inset(0 0 0 0%)" },
              exit: (d: number) => ({ clipPath: "inset(0 0 0 0%)", x: d > 0 ? "-12%" : "12%", opacity: 0.4 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.9, ease: [0.77, 0, 0.18, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={onDragEnd}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}: ${s.title.join(" ")}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={unsplash(PHOTOS[s.photo].id, 1800)}
              srcSet={srcSet(PHOTOS[s.photo].id)}
              sizes="(min-width: 1280px) 1240px, 100vw"
              alt={PHOTOS[s.photo].alt}
              draggable={false}
              className="animate-kenburns absolute inset-0 h-full w-full select-none object-cover"
              style={{ backgroundColor: PHOTOS[s.photo].tone }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a1330]/90 via-[#0a1330]/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a1330]/80 via-transparent to-transparent" />

            <div className="relative flex h-full max-w-3xl flex-col justify-center px-7 pb-32 pt-10 text-white sm:px-12 md:px-16">
              <motion.span
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.5 }}
                className="inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold"
                style={{ background: s.color, color: s.color === "#ffc933" ? "#0e1b3d" : "#fff" }}
              >
                {s.tag}
              </motion.span>
              <h1 className="mt-5 text-[38px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-[50px] lg:text-[60px]">
                {s.title.map((line, li) => (
                  <span key={li} className="block overflow-hidden pb-1">
                    <motion.span
                      className="block"
                      initial={{ y: "110%" }}
                      animate={{ y: "0%" }}
                      transition={{ delay: 0.5 + li * 0.1, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
                      style={li === 1 ? { color: s.color } : undefined}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </h1>
              <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.6 }} className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/80">
                {s.text}
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }} className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={cta.href} className="btn-ink">{cta.label} <ArrowRight className="size-4" /></Link>
                <Link href="/demo/hardware" className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-6 py-3 text-[15px] font-bold text-white transition-colors hover:border-white hover:bg-white/10">
                  <Play className="size-4 fill-current" /> Try the demo
                </Link>
              </motion.div>
            </div>
            <span className="absolute right-6 top-5 rounded-full bg-black/25 px-2.5 py-1 text-[11px] text-white/60 backdrop-blur">Photo: {PHOTOS[s.photo].author} / Unsplash</span>
          </motion.div>
        </AnimatePresence>

        {/* Controls */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end gap-4 p-5 sm:p-7 md:px-16">
          <div className="grid flex-1 grid-cols-4 gap-2 sm:max-w-xl sm:gap-3" role="tablist" aria-label="Slides (swipe to change)">
            {SLIDES.map((sl, i) => (
              <button key={sl.tab} role="tab" aria-selected={i === index} onClick={() => go(i)} className="group text-left">
                <span className={clsx("mb-2 block text-[12.5px] font-bold transition-colors sm:text-[13.5px]", i === index ? "text-white" : "text-white/55 group-hover:text-white/85")}>
                  <span className="mr-1.5 hidden text-white/40 sm:inline">0{i + 1}</span>
                  {sl.tab}
                </span>
                <span className="block h-1 overflow-hidden rounded-full bg-white/20">
                  <span className="block h-full rounded-full" style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%", background: i === index ? sl.color : "rgba(255,255,255,.55)" }} />
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setUserPaused((v) => !v)} className="hidden size-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/25 sm:grid" aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}>
              {userPaused ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
            </button>
            <button onClick={prev} className="hidden size-11 sm:grid place-items-center rounded-full bg-white/12 text-white backdrop-blur transition-colors hover:bg-white/25" aria-label="Previous slide"><ChevronLeft className="size-5" /></button>
            <button onClick={next} className="hidden size-11 sm:grid place-items-center rounded-full bg-white text-[#0e1b3d] transition-transform hover:scale-105" aria-label="Next slide"><ChevronRight className="size-5" /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
