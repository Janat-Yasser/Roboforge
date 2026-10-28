"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import clsx from "clsx";
import { AlertTriangle, ArrowLeft, ArrowRight, Calculator, Check, CheckCircle2, ChevronDown, Clock, Copy, Dumbbell, Info, Lightbulb, ListChecks, PlayCircle, RotateCcw, Target, Trophy, XCircle } from "lucide-react";
import { Inline } from "@/components/learn/tutorial-view";
import { MODULES, headingId, lessonKey, type Block, type Lesson, type Module, type QuizQuestion } from "@/lib/courses";
import { useProgress } from "./progress";

/* ---------------------------------------------------------------------------------------- */

const KW = /\b(void|int|float|bool|const|unsigned|long|if|else|for|return|switch|case|break|enum|while|true|false|HIGH|LOW|OUTPUT|INPUT_PULLUP)\b/;

function highlight(line: string) {
  const parts = line.split(/(\/\/.*$|"[^"]*"|#include\s*<[^>]+>|\b\d+(?:\.\d+)?\b|\b(?:void|int|float|bool|const|unsigned|long|if|else|for|return|switch|case|break|enum|while|true|false|HIGH|LOW|OUTPUT|INPUT_PULLUP)\b)/g);
  return parts.map((p, k) =>
    !p ? null
    : p.startsWith("//") ? <span key={k} className="text-[#7f8db0] italic">{p}</span>
    : p.startsWith("#include") ? <span key={k} className="text-[#ff9ec4]">{p}</span>
    : p.startsWith('"') ? <span key={k} className="text-[#9fe0a8]">{p}</span>
    : KW.test(p) && p.match(KW)![0] === p ? <span key={k} className="text-[#8fb6ff]">{p}</span>
    : /^\d/.test(p) ? <span key={k} className="text-[#ffd35c]">{p}</span>
    : <span key={k}>{p}</span>,
  );
}

function CodeBlock({ code, title, lang }: { code: string; title?: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl bg-[#0e1b3d] text-[#e7ecff] shadow-[var(--rf-shadow-lg)]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <span className="flex gap-1.5"><span className="size-2.5 rounded-full bg-[#ff5a5f]" /><span className="size-2.5 rounded-full bg-[#ffc933]" /><span className="size-2.5 rounded-full bg-[#14b886]" /></span>
        <span className="text-[12.5px] font-semibold text-white/70">{title ?? lang}</span>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }).catch(() => {});
          }}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-white/70 hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.7]">
        {code.split("\n").map((l, i) => (
          <div key={i} className="flex">
            <span className="mr-4 inline-block w-6 shrink-0 select-none text-right text-white/25">{i + 1}</span>
            <span className="whitespace-pre">{lang === "cpp" ? highlight(l) : l}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function Exercise({ b, color }: { b: Extract<Block, { type: "exercise" }>; color: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="overflow-hidden rounded-3xl border-2 bg-panel" style={{ borderColor: color }}>
      <div className="flex items-center gap-3 px-6 py-4 text-white" style={{ background: color }}>
        <Dumbbell className="size-5" />
        <div className="text-[13px] font-bold text-white/80">Hands-on exercise</div>
        <div className="text-[17px] font-extrabold">{b.title}</div>
      </div>
      <div className="p-6">
        <p className="text-[16px] leading-relaxed"><Inline text={b.task} /></p>
        {b.steps && (
          <ol className="mt-4 space-y-2">
            {b.steps.map((st, i) => (
              <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-raised text-[12px] font-extrabold" style={{ color }}>{i + 1}</span>
                <span><Inline text={st} /></span>
              </li>
            ))}
          </ol>
        )}
        {b.solution && (
          <>
            <button onClick={() => setShow((v) => !v)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-raised px-4 py-2.5 text-[14px] font-bold transition-colors hover:bg-border" aria-expanded={show}>
              <ChevronDown className={clsx("size-4 transition-transform", show && "rotate-180")} />
              {show ? "Hide solution" : "Try it first — then show the solution"}
            </button>
            <AnimatePresence initial={false}>
              {show && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <ul className="mt-4 space-y-2.5 rounded-2xl bg-green/8 p-5">
                    {b.solution.map((x, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><Check className="mt-1 size-4 shrink-0 text-green" /><span><Inline text={x} /></span></li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

function BlockView({ b, color }: { b: Block; color: string }) {
  switch (b.type) {
    case "h":
      return (
        <h2 id={headingId(b.text)} className="display scroll-mt-28 pt-6 text-[28px] sm:text-[32px]">
          <span className="mr-3 inline-block h-7 w-1.5 translate-y-1 rounded-full" style={{ background: color }} />
          {b.text}
        </h2>
      );
    case "note":
      return (
        <div className="flex gap-4 rounded-2xl border border-border bg-panel-2 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: color }}><Info className="size-5" /></span>
          <div><div className="text-[15px] font-extrabold">{b.title}</div><p className="mt-1 text-[15.5px] leading-relaxed text-fg/85"><Inline text={b.text} /></p></div>
        </div>
      );
    case "example":
      return (
        <div className="overflow-hidden rounded-3xl border border-border bg-panel shadow-[var(--rf-shadow)]">
          <div className="flex items-center gap-3 border-b border-border bg-panel-2 px-6 py-3.5">
            <Calculator className="size-5" style={{ color }} />
            <span className="text-[13px] font-bold text-muted">Worked example</span>
            <span className="text-[16px] font-extrabold">{b.title}</span>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-[16px] font-semibold leading-relaxed"><Inline text={b.problem} /></p>
            <ol className="space-y-2.5">
              {b.steps.map((st, i) => (
                <li key={i} className="flex gap-3 text-[15.5px] leading-relaxed">
                  <span className="mt-0.5 text-[13px] font-extrabold" style={{ color }}>Step {i + 1}</span>
                  <span><Inline text={st} /></span>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl px-5 py-4 text-[15.5px] leading-relaxed" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
              <span className="font-extrabold">Answer: </span><Inline text={b.answer} />
            </div>
          </div>
        </div>
      );
    case "mistakes":
      return (
        <div className="rounded-3xl border border-border bg-panel p-6 shadow-[var(--rf-shadow)]">
          <div className="flex items-center gap-2 text-[17px] font-extrabold"><XCircle className="size-5 text-err" /> Common mistakes</div>
          <div className="mt-4 divide-y divide-border">
            {b.items.map(([m, fix]) => (
              <div key={m} className="grid gap-1 py-3 sm:grid-cols-[1fr_1.4fr] sm:gap-6">
                <div className="flex gap-2 text-[15px] font-bold"><span className="text-err">✕</span><Inline text={m} /></div>
                <div className="flex gap-2 text-[15px] text-fg/85"><span className="text-green">✓</span><span><Inline text={fix} /></span></div>
              </div>
            ))}
          </div>
        </div>
      );
    case "exercise":
      return <Exercise b={b} color={color} />;
    case "p":
      return <p className="text-[17px] leading-[1.75] text-fg/85"><Inline text={b.text} /></p>;
    case "list":
      return (
        <ul className="space-y-2.5">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[16.5px] leading-relaxed"><span className="mt-2.5 size-2 shrink-0 rounded-full" style={{ background: color }} /><span><Inline text={it} /></span></li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-3">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-border bg-panel p-4 text-[16px] leading-relaxed shadow-[var(--rf-shadow)]">
              <span className="grid size-8 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-white" style={{ background: color }}>{i + 1}</span>
              <span><Inline text={it} /></span>
            </li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <div className="flex gap-4 rounded-2xl bg-[#ffc933]/20 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ffc933] text-[#0e1b3d]"><Lightbulb className="size-5" /></span>
          <div><div className="text-[14px] font-extrabold">Tip</div><p className="mt-1 text-[15.5px] leading-relaxed"><Inline text={b.text} /></p></div>
        </div>
      );
    case "warn":
      return (
        <div className="flex gap-4 rounded-2xl bg-[#ff5a5f]/12 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#ff5a5f] text-white"><AlertTriangle className="size-5" /></span>
          <div><div className="text-[14px] font-extrabold">Safety note</div><p className="mt-1 text-[15.5px] leading-relaxed"><Inline text={b.text} /></p></div>
        </div>
      );
    case "code":
      return <CodeBlock code={b.code} title={b.title} lang={b.lang} />;
    case "terms":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {b.items.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-border bg-panel p-4 shadow-[var(--rf-shadow)]">
              <div className="text-[15px] font-extrabold" style={{ color }}>{t}</div>
              <div className="mt-1 text-[14.5px] leading-relaxed text-muted"><Inline text={d} /></div>
            </div>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-2xl border border-border bg-panel shadow-[var(--rf-shadow)]">
          <table className="w-full text-[14.5px]">
            <thead className="bg-panel-2 text-left text-[13px] font-bold text-muted">
              <tr>{b.head.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={clsx("px-4 py-3 align-top", j === 0 && "font-bold")}><Inline text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/* ---------------------------------------------------------------------------------------- */

function Quiz({ quiz, color, onPass }: { quiz: QuizQuestion[]; color: string; onPass: () => void }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const score = picked.filter((p, i) => p === quiz[i]!.answer).length;
  const all = picked.every((p) => p !== null);
  const passed = checked && score === quiz.length;
  useEffect(() => {
    if (passed) onPass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passed]);
  return (
    <div className="rounded-[28px] border border-border bg-panel p-6 shadow-[var(--rf-shadow)] sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-[26px]">Check your understanding</h2>
        <span className="rounded-full bg-raised px-3 py-1 text-[13px] font-bold text-muted">{quiz.length} questions</span>
      </div>
      <div className="mt-6 space-y-7">
        {quiz.map((q, qi) => (
          <fieldset key={qi}>
            <legend className="text-[16.5px] font-bold"><span className="mr-2" style={{ color }}>{qi + 1}.</span>{q.q}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.options.map((o, oi) => {
                const sel = picked[qi] === oi;
                const right = checked && oi === q.answer;
                const wrong = checked && sel && oi !== q.answer;
                return (
                  <button
                    key={oi}
                    type="button"
                    disabled={checked}
                    onClick={() => setPicked((p) => p.map((x, i) => (i === qi ? oi : x)))}
                    className={clsx(
                      "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] font-semibold transition-all",
                      right ? "border-green bg-green/10" : wrong ? "border-err bg-err/10" : sel ? "border-accent bg-accent/8" : "border-border hover:border-border-strong hover:bg-raised/50",
                    )}
                  >
                    <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full border-2 text-[11px] font-extrabold", right ? "border-green bg-green text-white" : wrong ? "border-err bg-err text-white" : sel ? "border-accent bg-accent text-white" : "border-border-strong text-muted")}>
                      {right ? <Check className="size-3.5" /> : wrong ? <XCircle className="size-3.5" /> : String.fromCharCode(65 + oi)}
                    </span>
                    {o}
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {checked && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className={clsx("mt-3 overflow-hidden rounded-xl px-4 py-2.5 text-[14.5px]", picked[qi] === q.answer ? "bg-green/10 text-fg" : "bg-err/8 text-fg")}>
                  <strong>{picked[qi] === q.answer ? "Correct! " : "Not quite. "}</strong>{q.explain}
                </motion.p>
              )}
            </AnimatePresence>
          </fieldset>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {!checked ? (
          <button disabled={!all} onClick={() => setChecked(true)} className="btn-ink disabled:cursor-not-allowed">Check answers</button>
        ) : (
          <>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={clsx("flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-extrabold", passed ? "bg-green text-white" : "bg-raised")}>
              {passed ? <Trophy className="size-5" /> : null} {score} / {quiz.length} correct{passed ? " — lesson complete!" : ""}
            </motion.div>
            {!passed && (
              <button onClick={() => { setChecked(false); setPicked(quiz.map(() => null)); }} className="btn-line !py-2.5"><RotateCcw className="size-4" /> Try again</button>
            )}
          </>
        )}
        {!all && !checked && <span className="text-[13.5px] text-muted">Answer every question to check.</span>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------- */

export function LessonView({ m, index }: { m: Module; index: number }) {
  const l: Lesson = m.lessons[index]!;
  const key = lessonKey(m.slug, l.slug);
  const { done, mark } = useProgress();
  const isDone = !!done[key];
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 200, damping: 30 });

  const prev = index > 0 ? { m, l: m.lessons[index - 1]! } : MODULES[m.n - 2] ? { m: MODULES[m.n - 2]!, l: MODULES[m.n - 2]!.lessons.at(-1)! } : null;
  const next = index < m.lessons.length - 1 ? { m, l: m.lessons[index + 1]! } : MODULES[m.n] ? { m: MODULES[m.n]!, l: MODULES[m.n]!.lessons[0]! } : null;

  return (
    <>
      <motion.div className="fixed inset-x-0 top-0 z-[55] h-1 origin-left" style={{ scaleX: bar, background: m.color }} />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-24 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Link href={`/courses/${m.slug}`} className="flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-fg"><ArrowLeft className="size-4" /> Module {m.n}</Link>
            <div className="mt-3 text-[18px] font-extrabold" style={{ color: m.color }}>{m.title}</div>
            <ol className="mt-4 space-y-1">
              {m.lessons.map((x, i) => {
                const d = !!done[lessonKey(m.slug, x.slug)];
                const on = i === index;
                return (
                  <li key={x.slug}>
                    <Link href={`/courses/${m.slug}/${x.slug}`} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition-colors", on ? "bg-panel text-fg shadow-[var(--rf-shadow)]" : "text-muted hover:bg-raised hover:text-fg")}>
                      <span className={clsx("grid size-7 shrink-0 place-items-center rounded-lg text-[12px] font-extrabold", d ? "bg-green text-white" : on ? "text-white" : "bg-raised")} style={!d && on ? { background: m.color } : undefined}>
                        {d ? <Check className="size-4" /> : `${m.n}.${i + 1}`}
                      </span>
                      <span className="leading-snug">{x.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 flex gap-1.5">
              {MODULES.map((mm) => (
                <Link key={mm.slug} href={`/courses/${mm.slug}`} title={mm.title} className={clsx("h-1.5 flex-1 rounded-full transition-opacity", mm.slug === m.slug ? "" : "opacity-30 hover:opacity-60")} style={{ background: mm.color }} />
              ))}
            </div>
          </div>
        </aside>

        {/* Lesson */}
        <article className="min-w-0 max-w-3xl">
          <Link href={`/courses/${m.slug}`} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-muted hover:text-fg lg:hidden"><ArrowLeft className="size-4" /> {m.title}</Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full px-3 py-1 text-[12.5px] font-bold text-white" style={{ background: m.color }}>Lesson {m.n}.{index + 1}</span>
            <span className="flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-[12.5px] font-bold text-muted"><Clock className="size-3.5" /> {l.minutes} min</span>
            {isDone && <span className="flex items-center gap-1 rounded-full bg-green/12 px-3 py-1 text-[12.5px] font-bold text-green"><CheckCircle2 className="size-3.5" /> Completed</span>}
          </div>
          <motion.h1 key={l.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="display mt-4 text-[38px] sm:text-[50px]">{l.title}</motion.h1>
          <p className="mt-3 text-[19px] leading-relaxed text-muted">{l.summary}</p>

          <div className="mt-8 grid gap-4 md:grid-cols-[1.3fr_1fr]">
            <div className="rounded-3xl p-6 text-white" style={{ background: m.color }}>
              <div className="flex items-center gap-2 text-[15px] font-extrabold"><Target className="size-5" /> By the end of this lesson you can</div>
              <ul className="mt-3 space-y-2">
                {l.objectives.map((o) => (
                  <li key={o} className="flex gap-2.5 text-[15px] leading-snug text-white/95"><Check className="mt-0.5 size-4 shrink-0" />{o}</li>
                ))}
              </ul>
            </div>
            <nav className="rounded-3xl border border-border bg-panel p-6 shadow-[var(--rf-shadow)]" aria-label="On this page">
              <div className="flex items-center gap-2 text-[15px] font-extrabold"><ListChecks className="size-5" style={{ color: m.color }} /> On this page</div>
              <ol className="mt-3 space-y-1.5">
                {l.blocks.filter((b): b is Extract<Block, { type: "h" }> => b.type === "h").map((h, i) => (
                  <li key={h.text}>
                    <a href={`#${headingId(h.text)}`} className="flex gap-2 text-[14.5px] font-semibold text-muted transition-colors hover:text-fg">
                      <span className="w-5 shrink-0 text-right text-faint">{i + 1}.</span>{h.text}
                    </a>
                  </li>
                ))}
                <li><a href="#quiz" className="flex gap-2 text-[14.5px] font-semibold text-muted hover:text-fg"><span className="w-5 shrink-0 text-right text-faint">✓</span>Quiz</a></li>
              </ol>
            </nav>
          </div>

          <div className="mt-8 space-y-6">
            {l.blocks.map((b, i) => (
              <motion.div key={`${l.slug}-${i}`} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45 }}>
                <BlockView b={b} color={m.color} />
              </motion.div>
            ))}
          </div>

          <div className="mt-12 rounded-3xl border border-border bg-panel-2 p-6 sm:p-7">
            <div className="flex items-center gap-2 text-[18px] font-extrabold"><ListChecks className="size-5" style={{ color: m.color }} /> Key takeaways</div>
            <ul className="mt-4 space-y-2.5">
              {l.recap.map((r) => (
                <li key={r} className="flex gap-3 text-[15.5px] leading-relaxed"><CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: m.color }} /><Inline text={r} /></li>
              ))}
            </ul>
          </div>

          {l.tryIt && (
            <Link href={l.tryIt.href} className="group mt-12 flex items-center gap-5 overflow-hidden rounded-[28px] p-6 text-white transition-transform hover:-translate-y-1 sm:p-8" style={{ background: m.color, boxShadow: `0 6px 0 ${m.dark}` }}>
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20"><PlayCircle className="size-7" /></span>
              <div>
                <div className="text-[13px] font-bold text-white/80">Hands-on practice</div>
                <div className="text-[20px] font-extrabold">{l.tryIt.label}</div>
              </div>
              <ArrowRight className="ml-auto size-6 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
          )}

          <div id="quiz" className="mt-12 scroll-mt-28">
            <Quiz key={l.slug} quiz={l.quiz} color={m.color} onPass={() => mark(key)} />
          </div>

          <div className="mt-6 flex justify-end">
            <button onClick={() => mark(key, !isDone)} className="text-[14px] font-semibold text-muted underline-offset-2 hover:text-fg hover:underline">
              {isDone ? "Mark as not done" : "Mark as done without the quiz"}
            </button>
          </div>

          <nav className="mt-10 grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link href={`/courses/${prev.m.slug}/${prev.l.slug}`} className="card-pop group p-6">
                <div className="text-[13px] font-bold text-muted">← Previous</div>
                <div className="mt-1 text-[18px] font-bold group-hover:text-accent">{prev.l.title}</div>
              </Link>
            ) : <span />}
            {next ? (
              <Link href={`/courses/${next.m.slug}/${next.l.slug}`} className="group rounded-3xl p-6 text-right text-white transition-transform hover:-translate-y-1" style={{ background: next.m.color, boxShadow: `0 5px 0 ${next.m.dark}` }}>
                <div className="text-[13px] font-bold text-white/80">{next.m === m ? "Next lesson →" : `Next: Module ${next.m.n} →`}</div>
                <div className="mt-1 text-[18px] font-bold">{next.l.title}</div>
              </Link>
            ) : (
              <Link href="/signup" className="group rounded-3xl bg-[#14b886] p-6 text-right text-white shadow-[0_5px_0_#0d8f68] transition-transform hover:-translate-y-1">
                <div className="text-[13px] font-bold text-white/80">Course complete!</div>
                <div className="mt-1 text-[18px] font-bold">Build your own robot →</div>
              </Link>
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
