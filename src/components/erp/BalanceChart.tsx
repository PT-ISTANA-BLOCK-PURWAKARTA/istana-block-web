"use client";

import { useState } from "react";

const W = 640;
const PAD = { top: 18, right: 10, bottom: 26, left: 56 };

function compact(n: number) {
  const a = Math.abs(n);
  const f = (v: number, s: string) => `${(Math.round(v * 10) / 10).toLocaleString("id-ID")}${s}`;
  if (a >= 1e9) return f(n / 1e9, " M");
  if (a >= 1e6) return f(n / 1e6, " jt");
  if (a >= 1e3) return f(n / 1e3, " rb");
  return n.toLocaleString("id-ID");
}

function niceStep(range: number) {
  if (range <= 0) return 1;
  const raw = range / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

const dayLabel = (d: string) => { const [, m, day] = d.split("-"); return `${Number(day)}/${Number(m)}`; };
const longLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Grafik saldo berjalan (seperti "Grafik Buku Besar Saldo Berjalan" di Zahir): saldo akhir tiap hari dalam periode. */
export function BalanceChart({ points, label, height = 220 }: { points: { date: string; balance: number }[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = points.map((p) => p.balance);
  const lo0 = Math.min(0, ...values), hi0 = Math.max(0, ...values);
  const step = niceStep(hi0 - lo0 || Math.abs(hi0) || 1);
  const lo = Math.floor(lo0 / step) * step, hi = Math.max(lo + step, Math.ceil(hi0 / step) * step);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(t);
  const x = (i: number) => PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1).toFixed(1)},${y(Math.max(lo, 0))}L${x(0).toFixed(1)},${y(Math.max(lo, 0))}Z`;
  const every = Math.max(1, Math.ceil(points.length / 10));
  const slot = innerW / Math.max(1, points.length - 1);

  return (
    <figure className="chart balance-chart" style={{ margin: "4px 0 14px" }} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id="bc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b9be8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b9be8" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <g className="grid">{ticks.map((t) => <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />)}</g>
        <g className="axis">{ticks.map((t) => <text key={t} x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>)}</g>
        <g className="xlabels">
          {points.map((p, i) => ((points.length - 1 - i) % every === 0 ? <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle">{dayLabel(p.date)}</text> : null))}
        </g>
        <path d={area} fill="url(#bc-fill)" />
        <path d={line} fill="none" stroke="#2585d6" strokeWidth={2} strokeLinejoin="round" />
        {points.length <= 62 && points.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.balance)} r={hover === i ? 4.5 : 2.5} fill={p.balance < 0 ? "#dc2626" : "#2585d6"} stroke="#fff" strokeWidth={1} />)}
        {hover !== null && points.length > 62 && <circle cx={x(hover)} cy={y(points[hover].balance)} r={4.5} fill="#2585d6" stroke="#fff" />}
        {points.map((p, i) => (
          <rect key={p.date} x={x(i) - slot / 2} y={PAD.top} width={Math.max(slot, 4)} height={innerH} fill="transparent" onPointerEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(points[hover].balance) / H) * 100}%` }} role="status">
          <b>{longLabel(points[hover].date)}</b>
          <div><span>Saldo</span><strong>Rp{points[hover].balance.toLocaleString("id-ID")}</strong></div>
        </div>
      )}
    </figure>
  );
}

