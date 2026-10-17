import Link from "next/link";
import type { Preset } from "@/lib/erp/periods";

/**
 * Pilihan periode: tombol cepat (bulan ini, bulan lalu, …) + tanggal sendiri.
 * Semua lewat tautan/GET supaya alamat laporan bisa disalin dan dibuka lagi.
 */
export function PeriodBar({ path, presets, from, to, single, extra, keep = {}, keepInForm = true }: { path: string; presets: Preset[]; from?: string; to: string; single?: boolean; extra?: React.ReactNode; keep?: Record<string, string>; keepInForm?: boolean }) {
  const href = (p: Preset) => `${path}?${new URLSearchParams({ ...keep, ...(p.from ? { from: p.from } : {}), to: p.to })}`;
  const active = presets.find((p) => p.to === to && (single || p.from === from));
  return (
    <div className="period-bar no-print">
      <nav className="presets" aria-label="Pilihan periode">
        {presets.map((p) => (
          <Link key={p.key} href={href(p)} aria-current={active?.key === p.key ? "true" : undefined}>
            {p.label}
          </Link>
        ))}
      </nav>
      <form method="get" className="period-custom">
        {keepInForm && Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {!single && (
          <label>
            <span>Dari</span>
            <input name="from" type="date" defaultValue={from} />
          </label>
        )}
        <label>
          <span>{single ? "Per tanggal" : "Sampai"}</span>
          <input name="to" type="date" defaultValue={to} />
        </label>
        {extra}
        <button type="submit" className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
    </div>
  );
}
