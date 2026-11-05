// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { IdeShell } from "@/components/ide/shell";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <IdeShell projectId={id}>{children}</IdeShell>;
}
