// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import clsx from "clsx";
import { PHOTOS, srcSet, unsplash, type PhotoKey } from "@/lib/photos";

interface PhotoProps {
  photo: PhotoKey;
  className?: string;
  /** Tailwind aspect class for the frame, e.g. "aspect-[4/5]". Omit when the parent sets the size. */
  aspect?: string;
  /** Parallax travel in % of the frame height (0 = none). */
  parallax?: number;
  /** Curtain reveal when scrolled into view. */
  reveal?: boolean;
  sizes?: string;
  priority?: boolean;
  caption?: string | false;
  imgClassName?: string;
}

/**
 * Editorial photograph: tinted placeholder, soft fade-in on load, optional curtain reveal and
 * scroll parallax, and a figure caption with the photographer's credit.
 */
export function Photo({ photo, className, aspect, parallax = 0, reveal = false, sizes = "100vw", priority, caption, imgClassName }: PhotoProps) {
  const info = PHOTOS[photo];
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${parallax}%`, `${parallax}%`]);
  const frame = (
    <div ref={ref} className={clsx("relative overflow-hidden", aspect, !caption && className)} style={{ backgroundColor: info.tone }}>
      <motion.div className="absolute inset-0" style={parallax ? { y, scale: 1 + (parallax * 2.2) / 100 } : undefined}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={unsplash(info.id, 1600)}
          srcSet={srcSet(info.id)}
          sizes={sizes}
          alt={info.alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setLoaded(true);
          }}
          className={clsx("h-full w-full object-cover transition-[opacity,filter,transform] duration-[1200ms] ease-out", loaded ? "opacity-100 blur-0" : "opacity-0 blur-md", imgClassName)}
        />
      </motion.div>
      {reveal && (
        <motion.div
          aria-hidden
          className="absolute inset-0 origin-top bg-bg"
          initial={{ scaleY: 1 }}
          whileInView={{ scaleY: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1.1, ease: [0.77, 0, 0.18, 1] }}
        />
      )}
    </div>
  );
  if (caption === undefined || caption === false) return frame;
  return (
    <figure className={className}>
      {frame}
      <figcaption className="mt-3 flex items-baseline justify-between gap-4">
        <span className="text-[14px] text-muted">{caption}</span>
        <Credit photo={photo} />
      </figcaption>
    </figure>
  );
}

/** Photographer credit. Use `plain` inside another link (nested <a> is invalid HTML). */
export function Credit({ photo, className, plain }: { photo: PhotoKey; className?: string; plain?: boolean }) {
  const who = `${PHOTOS[photo].author} / Unsplash`;
  return (
    <span className={clsx("credit shrink-0", className)}>
      Photo · {plain ? who : <a href="https://unsplash.com/?utm_source=roboforge&utm_medium=referral" target="_blank" rel="noreferrer">{who}</a>}
    </span>
  );
}
