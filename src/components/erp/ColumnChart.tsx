"use client";

import { useState } from "react";

export type ChartSeries = { name: string; color: string; values: number[] };

const W = 640;
const PAD = { top: 22, right: 8, bottom: 26, left: 52 };

/** Angka ringkas untuk sumbu & label: 1,2 jt / 850 rb / 12. */
function compact(n: number, money: boolean) {
  const a = Math.abs(n);
  const f = (v: number, s: string) => `${(Math.round(v * 10) / 10).toLocaleString("id-ID")}${s}`;
  if (!money) return n.toLocaleString("id-ID");
  if (a >= 1e9) return f(n / 1e9, " M");
  if (a >= 1e6) return f(n / 1e6, " jt");
  if (a >= 1e3) return f(n / 1e3, " rb");
  return n.toLocaleString("id-ID");
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * p;
}

/** Kolom dengan ujung atas membulat 4px dan dasar persegi. */
function colPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Grafik kolom (satu atau dua seri) dengan tooltip saat disorot/difokus keyboard.
 * Semua angka juga tersedia di laporan tabel yang ditautkan di bawah grafik.
 */
export function ColumnChart({ categories, series, money = true, height = 220, label, showEvery = 1, short }: { categories: string[]; series: ChartSeries[]; money?: boolean; height?: number; label: string; showEvery?: number; short?: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const top = Math.max(0, ...series.flatMap((s) => s.values));
  // Hitungan (bukan rupiah) memakai garis bantu bilangan bulat.
  const max = money ? niceMax(top) : Math.max(4, Math.ceil(top / 4) * 4);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = innerW / Math.max(1, categories.length);
  const gap = 2;
  const barW = Math.min(24, (slot * 0.62 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / max) * innerH;
  const last = categories.length - 1;

  return (
    <figure className="chart" style={{ margin: 0 }} onPointerLeave={() => setHover(null)}>
      {series.length > 1 && (
        <ul className="chart-legend" aria-hidden="true">
          {series.map((s) => (
            <li key={s.name}><i style={{ background: s.color }} />{s.name}</li>
          ))}
        </ul>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{compact(t, money)}</text>
          ))}
        </g>
        <g className="xlabels">
          {categories.map((c, i) =>
            (categories.length - 1 - i) % showEvery === 0 ? (
              <text key={c + i} x={PAD.left + slot * i + slot / 2} y={H - 8} textAnchor="middle">{short?.[i] ?? c}</text>
            ) : null,
          )}
        </g>
        {categories.map((c, i) => {
          const x0 = PAD.left + slot * i + (slot - groupW) / 2;
          const desc = `${c}: ${series.map((s) => `${s.name} ${compact(s.values[i] ?? 0, money)}`).join(", ")}`;
          return (
            <g
              key={c + i}
              className="bar"
              tabIndex={0}
              role="img"
              aria-label={desc}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              <rect className="hit" x={PAD.left + slot * i} y={PAD.top} width={slot} height={innerH} fill="transparent" rx={6} />
              {series.map((s, k) => {
                const v = s.values[i] ?? 0;
                const top = y(v);
                const h = PAD.top + innerH - top;
                return h > 0 ? <path key={s.name} className="mark" d={colPath(x0 + k * (barW + gap), top, barW, h)} fill={s.color} /> : null;
              })}
              {/* Label hanya di kolom terakhir (periode berjalan); sisanya lewat sumbu & tooltip. */}
              {i === last && series.length === 1 && (series[0].values[i] ?? 0) > 0 && (
                <text x={x0 + groupW / 2} y={y(series[0].values[i]) - 6} textAnchor="middle" className="cap" style={{ fontSize: 11.5, fontWeight: 600, fill: "var(--tinta)" }}>
                  {compact(series[0].values[i], money)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`, top: `${(y(Math.max(...series.map((s) => s.values[hover] ?? 0))) / H) * 100}%` }} role="status">
          <b>{categories[hover]}</b>
          {series.map((s) => (
            <div key={s.name}>
              <span><i style={{ background: s.color }} />{s.name}</span>
              <strong>{money ? `Rp${(s.values[hover] ?? 0).toLocaleString("id-ID")}` : (s.values[hover] ?? 0).toLocaleString("id-ID")}</strong>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}
