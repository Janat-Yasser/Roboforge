// Copyright (c) 2026 Janat Yasser. All rights reserved.
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { Toaster } from "@/lib/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RoboForge — design, wire and program robots", template: "%s · RoboForge" },
  description: "Build robots visually: pick parts, wire them, see your robot in 3D, program its behavior and generate real firmware and ROS 2 code.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
