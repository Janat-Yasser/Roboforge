import clsx from "clsx";

/** RoboForge mascot mark: a friendly robot head on a blue tile with a yellow antenna. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={clsx("shrink-0", className)}>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#1e6bff" />
      <line x1="20" y1="6.5" x2="20" y2="11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="6" r="2.6" fill="#ffc933" />
      <rect x="8.5" y="11.5" width="23" height="17" rx="6" fill="#fff" />
      <circle cx="15.2" cy="19.8" r="2.7" fill="#0e1b3d" />
      <circle cx="24.8" cy="19.8" r="2.7" fill="#0e1b3d" />
      <circle cx="16" cy="19" r="0.9" fill="#fff" />
      <circle cx="25.6" cy="19" r="0.9" fill="#fff" />
      <path d="M16.5 24.2c2 1.5 5 1.5 7 0" stroke="#ff5a5f" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <rect x="4" y="16.5" width="3" height="7" rx="1.5" fill="#ffc933" />
      <rect x="33" y="16.5" width="3" height="7" rx="1.5" fill="#ffc933" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={clsx("text-[20px] font-extrabold leading-none tracking-tight", className)}>
      Robo<span className="text-accent">Forge</span>
    </span>
  );
}
