// Lihat + analisa data Operasional di dalam Keuangan (data sama, tanpa pindah ke /operasional):
// filter bulan/status/cari, ringkasan, rekap per bulan & per status, pihak terbesar, daftar rinci (cetak / Excel).
import { notFound } from "next/navigation";
import { ZahirForm, zDate, zn } from "@/components/erp/report/ZahirForm";
import { Kpis, PageHead } from "@/components/erp/ui";
import { PrintButton } from "@/components/erp/PrintButton";
import { BLN, isYm, monthRange, ymAdd, ymLabel } from "@/lib/erp/monthly";
import { isOpsKind, loadOps, OPS } from "@/lib/erp/opsData";
import { reportContext } from "@/lib/erp/reportctx";
import { formatAmount, today } from "@/lib/erp/util";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ jenis: string }> }) {
  const j = (await params).jenis;
  return { title: isOpsKind(j) ? OPS[j].title : "Operasional" };
}

export default async function OpsView({ params, searchParams }: { params: Promise<{ jenis: string }>; searchParams: Promise<{ dari?: string; sampai?: string; status?: string; q?: string }> }) {
  const { db, site } = await reportContext();
  const { jenis } = await params;
  if (!isOpsKind(jenis)) notFound();
  const cfg = OPS[jenis];
  const sp = await searchParams;
  const now = today().slice(0, 7);
  const sampai = isYm(sp.sampai) ? sp.sampai : now;
  const dari = isYm(sp.dari) && sp.dari <= sampai ? sp.dari : ymAdd(sampai, -5);
  const months = monthRange(dari, sampai);
  const all = await loadOps(db, jenis, months[0].from, months[months.length - 1].to);
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = all.filter((r) => (!sp.status || r.status === sp.status) && (!q || `${r.number} ${r.party} ${r.items} ${r.extra.join(" ")}`.toLowerCase().includes(q)));
  const hasValue = !!cfg.valueLabel;
  const total = rows.reduce((s, r) => s + r.value, 0);
  const statuses = [...new Set([...Object.keys(cfg.statuses), ...all.map((r) => r.status)])];
  const byMonth = months.map((m) => { const list = rows.filter((r) => r.date.slice(0, 7) === m.ym); return { m, n: list.length, value: list.reduce((s, r) => s + r.value, 0), qty: list.reduce((s, r) => s + r.qty, 0), st: Object.fromEntries(statuses.map((s) => [s, list.filter((r) => r.status === s).length])) }; });
  const parties = [...rows.reduce((map, r) => { const e = map.get(r.party) ?? { n: 0, value: 0, qty: 0 }; e.n++; e.value += r.value; e.qty += r.qty; map.set(r.party, e); return map; }, new Map<string, { n: number; value: number; qty: number }>())].sort((a, b) => (hasValue ? b[1].value - a[1].value : b[1].n - a[1].n)).slice(0, 10);
  const stLabel = (s: string) => cfg.statuses[s] ?? s.replace(/_/g, " ");
  const isGoods = jenis === "barang-masuk";
  const period = months.length > 1 ? `${months[0].label} – ${months[months.length - 1].label}` : months[0].label;
  const presets = [{ l: "Bulan ini", d: now }, { l: "3 bulan", d: ymAdd(now, -2) }, { l: "6 bulan", d: ymAdd(now, -5) }, { l: "12 bulan", d: ymAdd(now, -11) }];

  return (
    <>
      <div className="no-print">
        <PageHead title={cfg.title} sub={`${cfg.sub} Hanya lihat & analisa; data diisi di Operasional dan langsung tampil di sini.`}>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <form method="get" className="filter-bar">
          <div className="field"><label htmlFor="ov-d">Dari bulan</label><input id="ov-d" type="month" name="dari" defaultValue={dari} /></div>
          <div className="field"><label htmlFor="ov-s">Sampai bulan</label><input id="ov-s" type="month" name="sampai" defaultValue={sampai} /></div>
          <div className="field"><label htmlFor="ov-st">Status</label><select id="ov-st" name="status" defaultValue={sp.status ?? ""}><option value="">Semua</option>{statuses.map((s) => <option key={s} value={s}>{stLabel(s)}</option>)}</select></div>
          <div className="field grow"><label htmlFor="ov-q">Cari</label><input id="ov-q" name="q" defaultValue={sp.q} placeholder={`nomor, ${cfg.party.toLowerCase()}, barang…`} /></div>
          <button className="btn btn-blue btn-sm">Tampilkan</button>
          {presets.map((p) => <a key={p.l} href={`?dari=${p.d}&sampai=${now}`} className={`btn btn-ghost btn-sm${p.d === dari && sampai === now ? " is-on" : ""}`}>{p.l}</a>)}
        </form>
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={cfg.title} period={period}>
        <Kpis items={[
          { label: "Jumlah", value: rows.length.toLocaleString("id-ID"), sub: `${months.length} bulan · rata-rata ${(rows.length / months.length).toLocaleString("id-ID", { maximumFractionDigits: 1 })}/bulan` },
          ...(hasValue ? [{ label: cfg.valueLabel!, value: formatAmount(total), sub: `rata-rata ${formatAmount(rows.length ? Math.round(total / rows.length) : 0)} per dokumen` }] : []),
          ...(isGoods ? [{ label: "Total kuantitas", value: rows.reduce((s, r) => s + r.qty, 0).toLocaleString("id-ID", { maximumFractionDigits: 1 }), sub: "campuran satuan, lihat per barang" }] : []),
          ...statuses.filter((s) => rows.some((r) => r.status === s)).sort((x, y) => rows.filter((r) => r.status === y).length - rows.filter((r) => r.status === x).length).slice(0, 3).map((s) => ({ label: stLabel(s), value: rows.filter((r) => r.status === s).length.toLocaleString("id-ID"), sub: `${Math.round((rows.filter((r) => r.status === s).length / Math.max(1, rows.length)) * 100)}%` })),
        ]} />
        <h3 className="zf-h3">Rekap per bulan</h3>
        <table className="zf-table">
          <thead><tr><th>Bulan</th><th className="num">Jumlah</th>{hasValue && <th className="num">{cfg.valueLabel}</th>}{statuses.filter((s) => rows.some((r) => r.status === s)).map((s) => <th key={s} className="num">{stLabel(s)}</th>)}</tr></thead>
          <tbody>{byMonth.map((x) => <tr key={x.m.ym}><td>{ymLabel(x.m.ym)}{x.m.partial ? "*" : ""}</td><td className="num">{x.n || ""}</td>{hasValue && <td className="num">{zn(x.value)}</td>}{statuses.filter((s) => rows.some((r) => r.status === s)).map((s) => <td key={s} className="num">{x.st[s] || ""}</td>)}</tr>)}</tbody>
          <tfoot><tr className="zf-total"><td>Jumlah</td><td className="num">{rows.length}</td>{hasValue && <td className="num">{zn(total, true)}</td>}{statuses.filter((s) => rows.some((r) => r.status === s)).map((s) => <td key={s} className="num">{rows.filter((r) => r.status === s).length}</td>)}</tr></tfoot>
        </table>
        {parties.length > 0 && (
          <>
            <h3 className="zf-h3">{cfg.party} terbesar</h3>
            <table className="zf-table">
              <thead><tr><th style={{ width: 36 }}>No</th><th>{cfg.party}</th><th className="num">Jumlah</th>{hasValue && <th className="num">{cfg.valueLabel}</th>}{hasValue && <th className="num">%</th>}</tr></thead>
              <tbody>{parties.map(([p, e], i) => <tr key={p}><td>{i + 1}</td><td>{p}</td><td className="num">{e.n}</td>{hasValue && <td className="num">{zn(e.value, true)}</td>}{hasValue && <td className="num">{total ? ((e.value / total) * 100).toFixed(1) : "0.0"}</td>}</tr>)}</tbody>
            </table>
          </>
        )}
        <h3 className="zf-h3">Rincian ({rows.length})</h3>
        <table className="zf-table">
          <thead><tr><th className="zf-c-date">Tanggal</th><th>Nomor</th><th>{cfg.party}</th><th>Barang / isi</th>{isGoods && <th className="num">Jumlah</th>}{hasValue && <th className="num">{cfg.valueLabel}</th>}<th>Status</th>{cfg.extra.map((e) => <th key={e}>{e}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{r.date ? zDate(r.date) : "-"}</td><td className="nowrap">{r.number}</td><td>{r.party}</td><td className="small">{r.items}</td>
                {isGoods && <td className="num">{r.qty.toLocaleString("id-ID", { maximumFractionDigits: 3 })} {r.unit}</td>}
                {hasValue && <td className="num">{zn(r.value)}</td>}
                <td className="small">{stLabel(r.status)}</td>{r.extra.map((e, i) => <td key={i} className="small">{e}</td>)}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8}>Tidak ada data pada periode ini.</td></tr>}
          </tbody>
        </table>
        <p className="small muted">Periode per {BLN[Number(now.slice(5, 7)) - 1]} {now.slice(0, 4)}; * bulan berjalan sampai hari ini.</p>
      </ZahirForm>
    </>
  );
}
