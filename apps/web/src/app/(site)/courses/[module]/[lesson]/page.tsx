import { notFound } from "next/navigation";
import { LessonView } from "@/components/courses/lesson-view";
import { MODULES, lessonBySlugs } from "@/lib/courses";

export function generateStaticParams() {
  return MODULES.flatMap((m) => m.lessons.map((l) => ({ module: m.slug, lesson: l.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string; lesson: string }> }) {
  const p = await params;
  return { title: lessonBySlugs(p.module, p.lesson)?.lesson.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ module: string; lesson: string }> }) {
  const p = await params;
  const found = lessonBySlugs(p.module, p.lesson);
  if (!found) notFound();
  return <LessonView m={found.module} index={found.index} />;
}
