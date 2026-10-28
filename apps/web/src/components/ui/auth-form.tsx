"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { PHOTOS, unsplash, type PhotoKey } from "@/lib/photos";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo, Wordmark } from "./logo";

const SLIDES: { photo: PhotoKey; title: string; text: string; color: string }[] = [
  { photo: "roverBench", title: "Design robots you can actually build", text: "Real parts, real wiring, real code.", color: "#1e6bff" },
  { photo: "handsOnBoard", title: "Catch wiring mistakes before they cost you", text: "45 checks run while you design.", color: "#ffc933" },
  { photo: "studentsLab", title: "Learn robotics the hands-on way", text: "Step-by-step tutorials for every level.", color: "#14b886" },
];

const PERKS = ["Save unlimited projects", "Generate firmware & ROS 2", "Run builds in a sandbox"];

function Slideshow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5500);
    return () => clearInterval(t);
  }, []);
  const s = SLIDES[i]!;
  return (
    <div className="relative h-full overflow-hidden rounded-[32px] bg-[#0e1b3d]">
      <AnimatePresence initial={false}>
        <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.06 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.1, ease: "easeOut" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={unsplash(PHOTOS[s.photo].id, 1400)} alt={PHOTOS[s.photo].alt} className="animate-kenburns h-full w-full object-cover" style={{ backgroundColor: PHOTOS[s.photo].tone }} />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a1330]/90 via-[#0a1330]/25 to-[#0a1330]/40" />
      <div className="relative flex h-full flex-col justify-between p-10 text-white">
        <Link href="/" className="flex w-fit items-center gap-2.5 rounded-2xl bg-white/12 py-2 pl-2 pr-4 backdrop-blur">
          <Logo size={34} />
          <span className="text-[19px] font-extrabold tracking-tight">RoboForge</span>
        </Link>
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }}>
              <span className="inline-block h-1.5 w-12 rounded-full" style={{ background: s.color }} />
              <h2 className="mt-5 max-w-md text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em]">{s.title}</h2>
              <p className="mt-3 text-[17px] text-white/80">{s.text}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {SLIDES.map((_, k) => (
                <button key={k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={clsx("h-2 rounded-full transition-all duration-500", k === i ? "w-10 bg-white" : "w-2 bg-white/40 hover:bg-white/70")} />
              ))}
            </div>
            <span className="text-[11px] text-white/50">Photo: {PHOTOS[s.photo].author} / Unsplash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const strength = Math.min(4, [password.length >= 8, /[A-Z]/.test(password) && /[a-z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password) || password.length >= 14].filter(Boolean).length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: signup ? { email, name, password } : { email, password } });
      router.push(params.get("next") ?? "/projects");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const INPUT = "h-12 w-full rounded-xl border-2 border-border bg-panel px-4 text-[15px] font-medium outline-none transition-all placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--rf-accent)_15%,transparent)] focus-visible:outline-none";

  return (
    <div className="grid min-h-full bg-bg lg:grid-cols-[1.05fr_1fr]">
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="hidden p-4 lg:block">
        <div className="sticky top-4 h-[calc(100vh-2rem)]"><Slideshow /></div>
      </motion.div>

      <div className="flex min-h-screen flex-col px-6 sm:px-12">
        <div className="flex items-center justify-between py-5">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-xl px-2 py-1 text-[14px] font-semibold text-muted hover:bg-raised hover:text-fg"><ArrowLeft className="size-4" /> Home</Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center">
          <motion.form onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} className="mx-auto w-full max-w-[420px] pb-16">
            <Link href="/" className="mb-8 flex items-center gap-2.5 lg:hidden"><Logo size={36} /><Wordmark /></Link>
            <h1 className="display text-[36px] sm:text-[42px]">{signup ? "Create your account" : "Welcome back!"}</h1>
            <p className="mt-2 text-[16px] text-muted">{signup ? "Free for personal robots. Start building in seconds." : "Log in to keep building your robots."}</p>

            {signup && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {PERKS.map((p) => (
                  <li key={p} className="flex items-center gap-1.5 rounded-full bg-green/12 px-3 py-1 text-[12.5px] font-bold text-green"><Check className="size-3.5" /> {p}</li>
                ))}
              </ul>
            )}

            <div className="mt-8 space-y-5">
              {signup && (
                <div>
                  <label className="mb-1.5 block text-[14px] font-bold" htmlFor="name">Name</label>
                  <input id="name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Ada Lovelace" />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-[14px] font-bold" htmlFor="email">Email</label>
                <input id="email" type="email" className={INPUT} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
              </div>
              <div>
                <label className="mb-1.5 block text-[14px] font-bold" htmlFor="password">Password</label>
                <div className="relative">
                  <input id="password" type={show ? "text" : "password"} className={clsx(INPUT, "pr-12")} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={signup ? 8 : 1} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "At least 8 characters" : ""} />
                  <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-raised hover:text-fg" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {signup && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="flex flex-1 gap-1.5">
                      {[0, 1, 2, 3].map((i) => (
                        <motion.span key={i} className="h-1.5 flex-1 rounded-full" animate={{ backgroundColor: i < strength ? ["#e5484d", "#e8a400", "#1e6bff", "#14b886"][strength - 1] : "var(--rf-border)" }} />
                      ))}
                    </div>
                    <span className="whitespace-nowrap text-[12.5px] font-bold text-faint">{password.length < 8 ? "8+ characters" : ["", "Weak", "Okay", "Good", "Strong"][strength]}</span>
                  </div>
                )}
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }} exit={{ opacity: 0 }} className="mt-5 flex items-center gap-2 rounded-xl bg-err/10 px-4 py-3 text-[14px] font-semibold text-err">
                  <AlertCircle className="size-4 shrink-0" /> {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button className="btn-ink mt-7 w-full !py-3.5 !text-[16px]" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
              {!busy && <ArrowRight className="size-4" />}
            </button>
            <p className="mt-6 text-center text-[14.5px] text-muted">
              {signup ? (
                <>Already have an account? <Link className="font-bold text-accent hover:underline" href={`/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>Log in</Link></>
              ) : (
                <>New to RoboForge? <Link className="font-bold text-accent hover:underline" href="/signup">Create a free account</Link></>
              )}
            </p>
            <div className="mt-8 flex items-center gap-4 text-[13px] text-faint"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <Link href="/demo/hardware" className="btn-line mt-6 w-full">Try the demo without an account</Link>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
