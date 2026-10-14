/** Tepi seksi berbentuk deretan paving segi enam, dengan beberapa blok "lepas" di atasnya. */
const W = 48;
const S = W / Math.sqrt(3);
const BASE = 75;
const LOOSE_COLORS = ["#254186", "#0E2A6B", "#0E2A6B", "#B5B4AF", "#FE5722"];

function hexPath(cx: number, cy: number) {
  const v = [
    [cx, cy - S],
    [cx + W / 2, cy - S / 2],
    [cx + W / 2, cy + S / 2],
    [cx, cy + S],
    [cx - W / 2, cy + S / 2],
    [cx - W / 2, cy - S / 2],
  ];
  return "M" + v.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") + " Z";
}

// Pseudo-acak deterministik agar render server & klien identik.
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function HexDivider({ color = "#0E2A6B", flip = false, seed = 3 }: { color?: string; flip?: boolean; seed?: number }) {
  const r = rand(seed);
  const base = [`M0 ${BASE} L1440 ${BASE} L1440 110 L0 110 Z`];
  for (let i = 0; i < 31; i++) base.push(hexPath(24 + 48 * i, BASE));
  const loose: { d: string; c: string }[] = [];
  for (let i = 0; i < 30; i++) {
    if (r() < 0.38) loose.push({ d: hexPath(48 * (i + 1), BASE - 1.5 * S), c: LOOSE_COLORS[Math.floor(r() * LOOSE_COLORS.length)].replace("#0E2A6B", color) });
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 1440 110" className="divider" preserveAspectRatio="xMidYMax slice" style={{ minHeight: 56 }}>
      <g transform={flip ? "translate(0,110) scale(1,-1)" : undefined}>
        <path d={base.join(" ")} fill={color} />
        {loose.map((l, i) => (
          <path key={i} d={l.d} fill={l.c} />
        ))}
      </g>
    </svg>
  );
}
