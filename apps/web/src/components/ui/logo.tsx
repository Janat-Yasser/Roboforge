export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill="#1d2735" stroke="#4f9cf9" strokeWidth="1.5" />
      <path d="M10 22V10h7a4 4 0 0 1 0 8h-7m7 0 5 4" fill="none" stroke="#4f9cf9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="10" r="1.8" fill="#3fb97c" />
    </svg>
  );
}
