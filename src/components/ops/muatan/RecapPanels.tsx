// Rekap di Muatan & tugas sopir: Rekap orderan selesai (tab Selesai), Barang keluar (muatan) dan
// Rekap perjalanan sopir per minggu (tab Rekap) — padanan FinishedRecap / StockOutPanel / DriverTripRecap app lama.
import Link from "next/link";
import { addDays, formatQty } from "@/lib/erp/util";
import { loadTotals } from "@/lib/ops/muatanBoard";

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

function RangeForm({ tab, from, to, prefix }: { tab: string; from: string; to: string; prefix: string }) {
  return (
    <form method="get" className="ds-chips-row">
      <input type="hidden" name="tab" value={tab} />
      <input type="date" name={`${prefix}dari`} defaultValue={from} aria-label="Dari tanggal" />
      <span className="muted">s/d</span>
      <input type="date" name={`${prefix}sampai`} defaultValue={to} aria-label="Sampai tanggal" />
      <button type="submit" className="btn btn-ghost btn-sm">Tampilkan</button>
    </form>
  );
}

export function FinishedRecap({ rows, from, to }: { rows: { lines: { name: string; qty: number; unit: string }[]; driver: string | null; isInternal: number }[]; from: string; to: string }) {
  const totals = loadTotals(rows);
  const per = new Map<string, number>();
  for (const r of rows) per.set(r.driver || "Tanpa sopir", (per.get(r.driver || "Tanpa sopir") ?? 0) + 1);
  const perDriver = [...per.entries()].sort((a, b) => b[1] - a[1]);
  const internal = rows.filter((r) => r.isInternal).length;
  return (
    <section className="ohome-card">
      <div className="ohome-card-head">
        <div><h2>Rekap orderan selesai</h2><p className="small muted">Orderan yang sudah tiba / diterima pada periode ini.</p></div>
        <RangeForm tab="selesai" from={from} to={to} prefix="" />
      </div>
      {!rows.length ? <p className="small muted" style={{ textAlign: "center" }}>Belum ada orderan selesai pada periode ini.</p> : (
        <>
          <div className="rc-stats">
            <div><span className="small muted">PO selesai</span><b>{rows.length}</b></div>
            <div><span className="small muted">Sopir</span><b>{perDriver.length}</b></div>
            {internal > 0 && <div className="is-violet"><span className="small">Orderan internal</span><b>{internal}</b></div>}
          </div>
          <div className="rc-two">
            <div><p className="rc-label">Per barang</p>{totals.map((t) => <p key={`${t.name}|${t.unit}`} className="rc-row"><span>{t.name}</span><span>{formatQty(t.qty)} {t.unit} · {t.trips} PO</span></p>)}</div>
            <div><p className="rc-label">Per sopir</p>{perDriver.map(([n, c]) => <p key={n} className="rc-row"><span>{n}</span><span>{c} PO</span></p>)}</div>
          </div>
        </>
      )}
    </section>
  );
}

export function StockOutPanel({ rows, from, to }: { rows: { name: string; unit: string; loaded: number; ordered: number; trips: number }[]; from: string; to: string }) {
  return (
    <section className="ohome-card">
      <div className="ohome-card-head">
        <div><h2>Barang keluar (muatan)</h2><p className="small muted">Stok keluar = jumlah yang dikonfirmasi dimuat mandor / satpam saat &quot;Sudah dimuat&quot;.</p></div>
        <RangeForm tab="rekap" from={from} to={to} prefix="" />
      </div>
      {!rows.length ? <p className="small muted" style={{ textAlign: "center" }}>Belum ada muatan pada periode ini.</p> : (
        <div className="rc-cards">
          {rows.map((t) => (
            <div key={`${t.name}|${t.unit}`}>
              <p className="rc-name">{t.name}</p>
              <b>{formatQty(t.loaded)} <span className="small muted">{t.unit}</span></b>
              <p className="small muted">{t.trips} PO{Math.abs(t.loaded - t.ordered) > 1e-9 ? ` · pesanan ${formatQty(t.ordered)} (selisih ${formatQty(t.loaded - t.ordered)})` : ""}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function WeeklyTripRecap({ data, week, from, to }: { data: { days: string[]; drivers: { name: string; plates: string[]; perDay: number[]; total: number; done: number }[]; total: number }; week: string; from: string; to: string }) {
  const href = (w: string) => `/operasional/muatan?${new URLSearchParams({ tab: "rekap", dari: from, sampai: to, minggu: w })}`;
  return (
    <section className="ohome-card">
      <div className="ohome-card-head">
        <h2>🚚 Rekap perjalanan sopir <span className="small muted">· {data.total} perjalanan</span></h2>
        <div className="ds-chips-row">
          <Link href={href(addDays(week, -7))} className="btn btn-ghost btn-sm" aria-label="Minggu sebelumnya">‹</Link>
          <b className="small">{short(data.days[0])} – {short(data.days[6])}</b>
          <Link href={href(addDays(week, 7))} className="btn btn-ghost btn-sm" aria-label="Minggu berikutnya">›</Link>
        </div>
      </div>
      <div className="admin-table">
        <table className="compact">
          <thead><tr><th>Sopir</th><th>Kendaraan</th>{data.days.map((d, i) => <th key={d} className="num">{DAY_NAMES[i]}<br /><span className="small">{short(d)}</span></th>)}<th className="num">Total</th><th className="num">Selesai</th></tr></thead>
          <tbody>
            {data.drivers.map((p) => (
              <tr key={p.name}><td><b>{p.name}</b></td><td className="small">{p.plates.join(", ") || "-"}</td>{p.perDay.map((n, i) => <td key={i} className="num">{n || ""}</td>)}<td className="num"><b>{p.total}</b></td><td className="num">{p.done}</td></tr>
            ))}
            {!data.drivers.length && <tr><td colSpan={11} className="muted">Belum ada perjalanan minggu ini.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
