// Copyright (c) 2026 Janat Yasser. All rights reserved.
/**
 * RoboForge Academy course model. Text supports **bold**, `code` and *italic* (rendered by <Inline/>).
 */
import type { PhotoKey } from "../photos";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
  explain: string;
}

export type Block =
  /** Section heading — also listed in the lesson's "On this page" menu. */
  | { type: "h"; text: string }
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "tip"; text: string }
  | { type: "warn"; text: string }
  | { type: "note"; title: string; text: string }
  | { type: "code"; lang: string; title?: string; code: string }
  | { type: "terms"; items: [string, string][] }
  | { type: "table"; head: string[]; rows: string[][] }
  /** Worked example: a problem and its step-by-step solution. */
  | { type: "example"; title: string; problem: string; steps: string[]; answer: string }
  /** Common mistakes: what goes wrong and how to fix it. */
  | { type: "mistakes"; items: [string, string][] }
  /** Hands-on exercise with an optional hidden solution. */
  | { type: "exercise"; title: string; task: string; steps?: string[]; solution?: string[] };

export interface Lesson {
  slug: string;
  title: string;
  minutes: number;
  summary: string;
  objectives: string[];
  blocks: Block[];
  recap: string[];
  tryIt?: { label: string; href: string };
  quiz: QuizQuestion[];
}

export interface Module {
  slug: string;
  n: number;
  title: string;
  tagline: string;
  description: string;
  color: string;
  dark: string;
  photo: PhotoKey;
  outcomes: string[];
  lessons: Lesson[];
}
