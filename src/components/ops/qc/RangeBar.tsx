import Link from "next/link";
import { RangeForm } from "@/components/erp/ui";
import { monthStart, yearStart } from "@/lib/erp/util";
import { weekRange } from "./labels";
import "./qc.css";

/** Awal bulan, n bulan sebelum bulan `day` ("YYYY-MM-01"). */
function monthsAgo(day: string, n: number) {
  let y = Number(day.slice(0, 4));
  let m = Number(day.slice(5, 7)) - n;
  while (m < 1) { m += 12; y--; }
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** Pilihan cepat periode + kotak Dari/Sampai. `kind` "minggu" (Sabtu-Jumat, bulan ini) atau "rekap" (bulan, 3 bulan, tahun). */
export function RangeBar({ tab, from, to, now, kind = "minggu" }: { tab: string; from: string; to: string; now: string; kind?: "minggu" | "rekap" }) {
  const presets =
    kind === "rekap"
      ? [{ label: "Bulan ini", from: monthStart(now), to: now }, { label: "3 bulan", from: monthsAgo(now, 2), to: now }, { label: "Tahun ini", from: yearStart(now), to: now }]
      : [{ label: "Minggu ini", ...weekRange(now, 0) }, { label: "Minggu lalu", ...weekRange(now, -1) }, { label: "Bulan ini", from: monthStart(now), to: now }];
  return (
    <div className="qc-presets">
      <nav className="seg no-print" aria-label="Periode cepat">
        {presets.map((p) => (
          <Link key={p.label} href={`/operasional/qc?tab=${tab}&from=${p.from}&to=${p.to}`} aria-current={p.from === from && p.to === to ? "page" : undefined}>{p.label}</Link>
        ))}
      </nav>
      <RangeForm from={from} to={to} extra={<input type="hidden" name="tab" value={tab} />} />
    </div>
  );
}
