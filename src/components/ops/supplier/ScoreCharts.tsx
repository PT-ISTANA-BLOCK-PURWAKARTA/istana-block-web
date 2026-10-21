"use client";

// Grafik nilai overall supplier buatan sendiri (tanpa pustaka): peringkat (batang) dan kurva per bulan (garis), dengan tooltip.
import { useEffect, useRef, useState } from "react";
import { monthName, monthShort } from "@/components/ops/receipts/util";
import { GRADES, SCORE_WEIGHTS, gradeOf, type ScoreParts } from "@/lib/ops/shared/score";
import type { CurveSeries } from "./summaries";

const num = (value: number | null) => (value === null ? "-" : String(Math.round(value)));

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver((entries) => setWidth(Math.max(280, Math.round(entries[0].contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function PartsLine({ parts }: { parts: ScoreParts }) {
  return <span className="muted">Kualitas {num(parts.quality)} · Kecepatan {num(parts.speed)} · Harga {num(parts.price)}</span>;
}

export type RankItem = { key: string; label: string; overall: number; parts: ScoreParts; count: number; complete: boolean };

/** Peringkat nilai overall per supplier (satu warna; grade & angka ditulis di ujung batang). */
export function OverallBars({ items }: { items: RankItem[] }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="sup-bars" role="list" aria-label="Peringkat nilai overall per supplier">
      {items.map((item) => {
        const grade = gradeOf(item.overall)!;
        const active = hover === item.key;
        return (
          <div
            key={item.key}
            role="listitem"
            tabIndex={0}
            className={`sup-bar-row${active ? " is-hover" : ""}`}
            onPointerEnter={() => setHover(item.key)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(item.key)}
            onBlur={() => setHover(null)}
          >
            <span className="sup-bar-name" title={item.label}>{item.label}</span>
            <span className="sup-bar-track">
              {[40, 60, 80].map((mark) => <span key={mark} className="sup-bar-mark" style={{ left: `${mark}%` }} />)}
              <span className="sup-bar-fill" style={{ width: `${Math.max(item.overall, 1)}%`, opacity: item.complete ? 1 : 0.55 }} />
            </span>
            <span className="sup-bar-value"><b>{item.overall}</b> <span className="small muted">{grade.grade}</span></span>
            {active && (
              <span className="sup-tip" role="tooltip">
                <b>{item.label}</b> — overall {item.overall} ({grade.grade} · {grade.label})<br />
                <PartsLine parts={item.parts} /><br />
                <span className="muted">{item.count} kiriman dinilai{item.complete ? "" : " · belum semua komponen dinilai"}</span>
              </span>
            )}
          </div>
        );
      })}
      <p className="small muted">Garis putih di batang = batas grade C (40), B (60), A (80). Batang pudar = nilai sementara (belum ada kualitas, kecepatan, atau harga).</p>
    </div>
  );
}

/** Kurva nilai overall per bulan untuk beberapa supplier (maks. 4 garis), garis bantu + tooltip saat hover/sentuh. */
export function OverallCurve({ months, series }: { months: string[]; series: CurveSeries[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const height = 240;
  const pad = { left: 34, right: 120, top: 14, bottom: 28 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const x = (index: number) => pad.left + (months.length === 1 ? plotWidth / 2 : (index / (months.length - 1)) * plotWidth);
  const y = (value: number) => pad.top + (1 - value / 100) * plotHeight;
  const path = (values: (number | null)[]) =>
    values.map((value, index) => (value === null ? "" : `${index > 0 && values[index - 1] !== null ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)).join(" ");
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    let best = 0;
    months.forEach((_, index) => { if (Math.abs(x(index) - px) < Math.abs(x(best) - px)) best = index; });
    setHoverIndex(best);
  };
  // Label langsung di ujung kanan tiap garis, digeser agar tidak bertumpuk.
  const ends = series
    .map((item) => ({ item, last: item.values.map((value, index) => ({ value, index })).filter((point) => point.value !== null).pop() }))
    .filter((end) => end.last)
    .sort((a, b) => y(a.last!.value!) - y(b.last!.value!));
  let previous = -Infinity;
  const labelY = new Map(ends.map((end) => { const target = Math.max(y(end.last!.value!), previous + 14); previous = target; return [end.item.key, target]; }));

  return (
    <div ref={ref} className="sup-curve">
      <ul className="chart-legend" aria-label="Legenda">
        {series.map((item) => <li key={item.key}><i style={{ background: item.color }} />{item.label}</li>)}
      </ul>
      <svg width={width} height={height} role="img" aria-label="Kurva nilai overall per bulan" onPointerMove={onMove} onPointerLeave={() => setHoverIndex(null)}>
        {[0, 40, 60, 80, 100].map((tick) => (
          <g key={tick}>
            <line className={tick === 0 ? "sup-axis" : "sup-grid"} x1={pad.left} x2={pad.left + plotWidth} y1={y(tick)} y2={y(tick)} />
            <text className="sup-text" x={pad.left - 6} y={y(tick) + 3.5} textAnchor="end" fontSize={10}>{tick}</text>
          </g>
        ))}
        {GRADES.filter((item) => item.min > 0).map((item) => <text key={item.grade} className="sup-text" x={pad.left + 4} y={y(item.min) - 4} fontSize={9}>{item.grade} ≥{item.min}</text>)}
        {months.map((month, index) => <text key={month} className="sup-text" x={x(index)} y={height - 8} textAnchor="middle" fontSize={10}>{monthShort(month)}</text>)}
        {hoverIndex !== null && <line className="sup-axis" x1={x(hoverIndex)} x2={x(hoverIndex)} y1={pad.top} y2={pad.top + plotHeight} />}
        {series.map((item) => (
          <g key={item.key}>
            <path d={path(item.values)} fill="none" style={{ stroke: item.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {item.values.map((value, index) => (value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={4} style={{ fill: item.color }} stroke="#ffffff" strokeWidth={2} />))}
          </g>
        ))}
        {ends.map((end) => (
          <g key={end.item.key}>
            <circle cx={pad.left + plotWidth + 12} cy={labelY.get(end.item.key)!} r={3.5} style={{ fill: end.item.color }} />
            <text className="sup-ink" x={pad.left + plotWidth + 20} y={labelY.get(end.item.key)! + 3.5} fontSize={11}>{end.item.label.length > 15 ? `${end.item.label.slice(0, 14)}…` : end.item.label}</text>
          </g>
        ))}
      </svg>
      {hoverIndex !== null && (
        <div className="chart-tip sup-curve-tip" style={{ left: Math.min(Math.max(x(hoverIndex), 90), width - 90), top: 160 }}>
          <b>{monthName(months[hoverIndex])}</b>
          {series.map((item) => (
            <div key={item.key}>
              <span><i style={{ background: item.color }} />{item.label}</span>
              <strong>{num(item.values[hoverIndex])}{item.values[hoverIndex] !== null ? ` ${gradeOf(item.values[hoverIndex])!.grade}` : ""}</strong>
            </div>
          ))}
        </div>
      )}
      <p className="small muted">Nilai overall = kualitas {SCORE_WEIGHTS.quality}% + kecepatan {SCORE_WEIGHTS.speed}% + harga {SCORE_WEIGHTS.price}% (skala 0–100). Bulan tanpa titik = belum ada kiriman yang dinilai.</p>
    </div>
  );
}
