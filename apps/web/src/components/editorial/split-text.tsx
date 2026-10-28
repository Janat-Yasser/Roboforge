"use client";
import { motion } from "motion/react";
import clsx from "clsx";

/**
 * Headline that rises in word by word from behind a mask. Wrap words in *asterisks* to set them
 * in italic accent.
 */
export function SplitText({ text, className, delay = 0, stagger = 0.06, as = "h1", inView = false }: { text: string; className?: string; delay?: number; stagger?: number; as?: "h1" | "h2" | "h3" | "p"; inView?: boolean }) {
  const Tag = motion[as];
  const lines = text.split("\n");
  let i = 0;
  let inItalic = false;
  return (
    <Tag className={className} initial="hidden" {...(inView ? { whileInView: "show", viewport: { once: true, margin: "-10%" } } : { animate: "show" })}>
      {lines.map((line, li) => {
        const words = line.split(" ");
        return (
          <span key={li} className="block">
            {words.map((word, wi) => {
              // *spans of words* are set in italic accent; asterisks may open and close on different words.
              const opens = word.startsWith("*");
              if (opens) inItalic = true;
              const italic = inItalic;
              if (/\*[.,!?]?$/.test(word) && (word.length > 1 || !opens)) inItalic = false;
              const clean = word.replace(/\*/g, "");
              const idx = i++;
              return (
                <span key={wi} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                  <motion.span
                    className={clsx("inline-block", italic && "italic text-accent")}
                    variants={{ hidden: { y: "105%", rotate: 4 }, show: { y: "0%", rotate: 0 } }}
                    transition={{ duration: 0.9, ease: [0.2, 0.75, 0.15, 1], delay: delay + idx * stagger }}
                  >
                    {clean}
                  </motion.span>
                  {wi < words.length - 1 && "\u00a0"}
                </span>
              );
            })}
          </span>
        );
      })}
    </Tag>
  );
}
