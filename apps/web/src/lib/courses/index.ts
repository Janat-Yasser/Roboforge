import { CODING } from "./coding";
import { ELECTRONICS } from "./electronics";
import { ROBOTICS } from "./robotics";
import type { Module } from "./types";

export type { Block, Lesson, Module, QuizQuestion } from "./types";

/** RoboForge Academy: three modules, taken in order. */
export const MODULES: Module[] = [ROBOTICS, ELECTRONICS, CODING];

export function moduleBySlug(slug: string) {
  return MODULES.find((m) => m.slug === slug);
}

export function lessonBySlugs(mod: string, lesson: string) {
  const m = moduleBySlug(mod);
  const i = m?.lessons.findIndex((l) => l.slug === lesson) ?? -1;
  return m && i >= 0 ? { module: m, lesson: m.lessons[i]!, index: i } : undefined;
}

export const lessonKey = (m: string, l: string) => `${m}/${l}`;
export const totalLessons = MODULES.reduce((a, m) => a + m.lessons.length, 0);
export const totalMinutes = MODULES.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.minutes, 0), 0);
export const totalQuestions = MODULES.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.quiz.length, 0), 0);

/** Anchor id for a heading block. */
export const headingId = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
