import { notFound } from "next/navigation";
import { ModuleView } from "@/components/courses/module-view";
import { MODULES, moduleBySlug } from "@/lib/courses";

export function generateStaticParams() {
  return MODULES.map((m) => ({ module: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  return { title: moduleBySlug((await params).module)?.title ?? "Course" };
}

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const m = moduleBySlug((await params).module);
  if (!m) notFound();
  return <ModuleView m={m} />;
}
