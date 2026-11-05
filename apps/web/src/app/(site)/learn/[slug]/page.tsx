// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { notFound } from "next/navigation";
import { TutorialView } from "@/components/learn/tutorial-view";
import { TUTORIALS, tutorialBySlug } from "@/lib/tutorials";

export function generateStaticParams() {
  return TUTORIALS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = tutorialBySlug((await params).slug);
  return { title: t?.title ?? "Tutorial" };
}

export default async function TutorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = tutorialBySlug((await params).slug);
  if (!t) notFound();
  return <TutorialView t={t} />;
}
