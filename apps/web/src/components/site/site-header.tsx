// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";
import { ArrowRight, BookOpen, Boxes, GraduationCap, Menu, Play, Sparkles, X } from "lucide-react";
import { Logo, Wordmark } from "../ui/logo";
import { ThemeToggle } from "../theme/theme-toggle";

const NAV = [
  { href: "/#how", label: "How it works", icon: Sparkles },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/learn", label: "Tutorials", icon: BookOpen },
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/demo/hardware", label: "Demo", icon: Play },
];

export function SiteHeader({ signedIn }: { signedIn: boolean; overlay?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={clsx("sticky top-0 z-50 transition-all duration-300", scrolled ? "border-b border-border bg-panel/85 shadow-[var(--rf-shadow)] backdrop-blur-xl" : "border-b border-transparent bg-bg")}>
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="RoboForge home">
          <motion.span whileHover={{ rotate: [0, -12, 10, 0] }} transition={{ duration: 0.6 }}><Logo size={36} /></motion.span>
          <Wordmark />
        </Link>
        <nav className="ml-4 hidden items-center md:flex" onMouseLeave={() => setHover(null)}>
          {NAV.map((n) => {
            const active = !n.href.startsWith("/#") && pathname.startsWith(n.href.split("/").slice(0, 2).join("/"));
            return (
              <Link
                key={n.href}
                href={n.href}
                onMouseEnter={() => setHover(n.href)}
                className={clsx("relative rounded-xl px-4 py-2 text-[15px] font-semibold transition-colors", active ? "text-accent" : "text-muted hover:text-fg")}
              >
                {hover === n.href && <motion.span layoutId="nav-hover" className="absolute inset-0 -z-10 rounded-xl bg-raised" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/projects" className="btn-ink !hidden !px-5 !py-2.5 !text-[14px] sm:!inline-flex">My projects <ArrowRight className="size-4" /></Link>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-xl px-3 py-2 text-[15px] font-semibold text-fg hover:bg-raised sm:inline-flex">Log in</Link>
              <Link href="/signup" className="btn-ink !hidden !px-5 !py-2.5 !text-[14px] sm:!inline-flex">Start building</Link>
            </>
          )}
          <button className="grid size-10 place-items-center rounded-xl hover:bg-raised md:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute inset-x-3 top-[76px] rounded-3xl border border-border bg-panel p-3 shadow-[var(--rf-shadow-lg)] md:hidden">
            {NAV.map((n, i) => (
              <motion.div key={n.href} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
                <Link href={n.href} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-[16px] font-semibold hover:bg-raised">
                  <n.icon className="size-5 text-accent" /> {n.label}
                </Link>
              </motion.div>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border pt-3">
              {signedIn ? (
                <Link href="/projects" className="btn-ink col-span-2">My projects</Link>
              ) : (
                <>
                  <Link href="/login" className="btn-line !py-2.5">Log in</Link>
                  <Link href="/signup" className="btn-ink !py-2.5">Sign up</Link>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
