"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatNumber, RECAP_LINES, type IsoOverview } from "@/lib/ops/shared/isoRecap";
import type { IsoCode } from "@/lib/ops/shared/isoForms";
import { fetchOverview } from "./isoApi";

type Month = { label: string; from: string; to: string };

/**
 * Tabel "Rekap per form & indikator" (sheet Rekap Bulanan). Total periode datang dari server; kolom per bulan diambil
 * satu per satu dari route handler (tiap bulan = satu permintaan ringan), supaya satu halaman tidak menjalankan belasan kueri berat.
 */
export function RecapTable({ overview, months, links }: { overview: IsoOverview; months: Month[]; links: Partial<Record<IsoCode, string>> }) {
  const [monthly, setMonthly] = useState<Record<string, IsoOverview | "gagal">>({});
  const monthsKey = months.map((m) => `${m.label}:${m.from}:${m.to}`).join("|");

  useEffect(() => {
    let cancelled = false;
    setMonthly({});
    (async () => {
      for (const month of months) {
        try {
          const data = await fetchOverview(month);
          if (cancelled) return;
          setMonthly((current) => ({ ...current, [month.label]: data }));
        } catch {
          if (cancelled) return;
          setMonthly((current) => ({ ...current, [month.label]: "gagal" }));
        }
      }
    })();
    return () => { cancelled = true; };
    // months ikut berubah hanya bila monthsKey berubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey]);

  const cols = 3 + months.length;
  return (
    <div className="admin-table">
      <table>
        <caption style={{ textAlign: "left" }}>
          Rekap per form &amp; indikator
          <span className="muted small" style={{ display: "block", fontWeight: 400 }}>Sama seperti sheet “Rekap Bulanan” di file Rekap Form Audit SNI. Klik nama form untuk membuka datanya.</span>
        </caption>
        <thead>
          <tr>
            <th>Uraian</th>
            <th>Sumber</th>
            {months.map((m) => <th key={m.label} className="num">{m.label}</th>)}
            <th className="num">Total periode</th>
          </tr>
        </thead>
        <tbody>
          {RECAP_LINES.map((line) => {
            const href = line.code ? links[line.code as IsoCode] : undefined;
            const bold = line.label === "TOTAL REKAMAN";
            return [
              line.section ? (
                <tr key={`s-${line.section}`}><td colSpan={cols} style={{ background: "var(--p-head)", fontWeight: 700, fontSize: 12.5, letterSpacing: ".04em", color: "var(--biru-tua)" }}>{line.section}</td></tr>
              ) : null,
              <tr key={`${line.section ?? ""}${line.label}`} style={bold ? { fontWeight: 600 } : undefined}>
                <td>{href ? <Link href={href}>{line.label}</Link> : line.label}</td>
                <td className="small muted">{line.source}</td>
                {months.map((m) => {
                  const data = monthly[m.label];
                  return <td key={m.label} className="num">{data === undefined ? "…" : data === "gagal" ? "-" : formatNumber(line.value(data), line.format)}</td>;
                })}
                <td className="num"><b>{formatNumber(line.value(overview), line.format)}</b></td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
