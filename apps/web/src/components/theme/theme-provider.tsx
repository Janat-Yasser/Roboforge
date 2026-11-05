// Copyright (c) 2026 Janat Yasser. All rights reserved.
"use client";
import { ThemeProvider as NextThemes } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange={false}>
      {children}
    </NextThemes>
  );
}
