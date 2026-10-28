"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "rf.academy.progress";
const EVENT = "rf:academy-progress";

function read(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}

/** Per-browser lesson progress (kept on this device only). */
export function useProgress() {
  const [done, setDone] = useState<Record<string, true>>({});
  useEffect(() => {
    setDone(read());
    const sync = () => setDone(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const mark = useCallback((key: string, value = true) => {
    const next = { ...read() };
    if (value) next[key] = true;
    else delete next[key];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    setDone(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { done, mark };
}
