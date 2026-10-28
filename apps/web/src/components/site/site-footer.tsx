import Link from "next/link";
import { Logo, Wordmark } from "../ui/logo";

const COLS = [
  { title: "Product", links: [["How it works", "/#how"], ["Parts library", "/parts"], ["Try the demo", "/demo/hardware"], ["Sign up free", "/signup"]] },
  { title: "Learn", links: [["Robotics & coding course", "/courses"], ["Your first robot", "/learn/first-robot"], ["Wiring & validation", "/learn/wiring"], ["Programming behavior", "/learn/behavior"], ["Code & export", "/learn/code"]] },
  { title: "Boards", links: [["ESP32", "/parts/esp32-devkitc"], ["Arduino Uno", "/parts/arduino-uno-r3"], ["STM32 Nucleo", "/parts/stm32-nucleo-f446re"], ["ROS 2", "/learn/code"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-panel">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2.5"><Logo size={36} /><Wordmark /></Link>
          <p className="mt-4 max-w-xs text-[14.5px] leading-relaxed text-muted">Design, wire and program real robots in your browser — then take home code that runs on the real thing.</p>
          <div className="mt-6 flex gap-2">
            {["#1e6bff", "#ffc933", "#ff5a5f", "#14b886", "#7c5cff"].map((c) => <span key={c} className="size-3 rounded-full" style={{ background: c }} />)}
          </div>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="mb-4 text-[14px] font-bold">{c.title}</div>
            <ul className="space-y-2.5 text-[14.5px]">
              {c.links.map(([l, h]) => (
                <li key={l}><Link href={h!} className="text-muted transition-colors hover:text-accent">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-[13px] text-faint">
          <span>© RoboForge — made for makers, students and robotics engineers.</span>
          <span>Photos from <a className="underline-offset-2 hover:text-fg hover:underline" href="https://unsplash.com/?utm_source=roboforge&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>, credited on each image.</span>
        </div>
      </div>
    </footer>
  );
}
