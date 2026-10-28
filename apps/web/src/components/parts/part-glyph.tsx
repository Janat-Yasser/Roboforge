import type { ComponentDefinition } from "@roboforge/spec";
import { CATEGORY_COLOR, SIGNAL_COLOR, signalClass } from "../hardware/pin-style";

/** Small illustrated rendering of a part: a board with its pins along the edges, coloured by signal type. */
export function PartGlyph({ def, size = 96 }: { def: ComponentDefinition; size?: number }) {
  const color = CATEGORY_COLOR[def.category];
  const pins = def.pins.filter((p) => p.type !== "nc").slice(0, 40);
  const half = Math.ceil(pins.length / 2);
  const left = pins.slice(0, half);
  const right = pins.slice(half);
  const h = 70;
  const step = (n: number) => (n > 1 ? (h - 14) / (n - 1) : 0);
  const round = def.category === "motor" || def.category === "servo";
  const battery = def.power?.kind === "battery";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${def.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      {round ? (
        <>
          <circle cx="50" cy="50" r="30" fill={`url(#g-${def.id})`} />
          <circle cx="50" cy="50" r="10" fill="white" opacity="0.85" />
          <circle cx="50" cy="50" r="4" fill={color} />
        </>
      ) : battery ? (
        <>
          <rect x="18" y="28" width="64" height="44" rx="8" fill={`url(#g-${def.id})`} />
          <rect x="30" y="42" width="40" height="16" rx="3" fill="#facc15" />
          <rect x="82" y="44" width="5" height="12" rx="2" fill={color} />
        </>
      ) : (
        <>
          <rect x="22" y="15" width="56" height={h} rx="9" fill={`url(#g-${def.id})`} />
          <rect x="38" y="36" width="24" height="24" rx="4" fill="#0f172a" opacity="0.85" />
          <circle cx="32" cy="24" r="2" fill="white" opacity="0.8" />
        </>
      )}
      {!round && !battery &&
        [left, right].map((col, side) =>
          col.map((p, i) => {
            const y = 22 + i * step(col.length);
            const x = side === 0 ? 22 : 78;
            const c = SIGNAL_COLOR[signalClass(p.type)];
            return <circle key={`${side}-${p.name}`} cx={x} cy={y} r={Math.max(1.4, Math.min(3, 30 / col.length))} fill={c} stroke="white" strokeWidth="0.6" />;
          }),
        )}
    </svg>
  );
}
