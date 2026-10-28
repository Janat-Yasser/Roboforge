"use client";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/** Client-only 3D robot preview (three.js is loaded on demand). */
export const RobotPreview = dynamic(() => import("./robot-viewer"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-muted">
      <Loader2 className="size-5 animate-spin" />
    </div>
  ),
});
