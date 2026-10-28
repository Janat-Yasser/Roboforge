"use client";
import { motion } from "motion/react";
import { Boxes } from "lucide-react";
import { Photo } from "@/components/editorial/photo";
import { PHOTOS } from "@/lib/photos";

export function PartsHero({ count }: { count: number }) {
  return (
    <div className="grid items-center gap-8 overflow-hidden rounded-[36px] bg-[#14b886] p-7 text-white sm:p-12 md:grid-cols-2">
      <div>
        <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold"><Boxes className="size-4" /> {count} parts and growing</motion.span>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-5 text-[44px] font-extrabold leading-[1.03] tracking-[-0.035em] sm:text-[58px]">Real parts. Real numbers.</motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-4 max-w-md text-[17px] text-white/90">
          Every part knows its supply range, current draw, pin functions and bus addresses — that's how RoboForge checks your wiring before anything gets warm.
        </motion.p>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.94, rotate: 2 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.15, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }} className="relative aspect-[5/4] overflow-hidden rounded-3xl shadow-2xl">
        <Photo photo="arduinoFlat" className="absolute inset-0" priority sizes="(min-width: 768px) 45vw, 100vw" />
        <span className="absolute bottom-3 right-3 rounded-full bg-black/40 px-2.5 py-1 text-[11px] text-white/85 backdrop-blur">Photo: {PHOTOS.arduinoFlat.author} / Unsplash</span>
      </motion.div>
    </div>
  );
}
