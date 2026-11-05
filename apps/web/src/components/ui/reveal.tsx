// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { motion, type HTMLMotionProps } from "motion/react";

/** Fades/slides content in when it scrolls into view. */
export function Reveal({ delay = 0, y = 24, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }}
      {...rest}
    />
  );
}
