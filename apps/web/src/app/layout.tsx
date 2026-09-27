import type { Metadata } from "next";
import { Toaster } from "@/lib/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "RoboForge",
  description: "Engineering IDE for robots: hardware, wiring, validation, behavior and code generation from one Robot Specification.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
