// Copyright (c) 2026 Janat Yasser. All rights reserved.
import { IdeShell } from "@/components/ide/shell";

export const metadata = { title: "Demo robot" };

/** Public, unsaved workspace with the Scout demo robot. */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <IdeShell demo>{children}</IdeShell>;
}
