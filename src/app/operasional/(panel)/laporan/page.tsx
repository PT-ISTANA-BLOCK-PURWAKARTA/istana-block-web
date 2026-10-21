import "./laporan.css";
import Link from "next/link";
import { Kpis, PageHead } from "@/components/erp/ui";
import { SummaryExport } from "@/components/ops/summary/SummaryExport";
import { Delta, PREVIOUS_LABEL, QtyTable, share } from "@/components/ops/summary/parts";
import { DateField } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { isDate, today } from "@/lib/erp/util";
import { fmt } from "@/lib/ops/shared/format";
import { PERIOD_LABELS, PERIODS, shiftPeriod, type Period } from "@/lib/ops/shared/period";
import { getSummary } from "@/lib/ops/summary";
import { permsOf, type Perm } from "@/lib/roles";

export const metadata = { title: "Laporan pimpinan" };
export const dynamic = "force-dynamic";

const href = (period: Period, day: string) => `/operasional/laporan?periode=${period}&tanggal=${day}`;

export default async function Laporan({ searchParams }: { searchParams: Promise<{ periode?: string; tanggal?: string }> }) {
  const me = await requirePerm("laporan");
  const sp = await searchParams;
  const period: Period = (PERIODS as readonly string[]).includes(sp.periode ?? "") ? (sp.periode as Period) : "harian";
  const now = today();
  const day = isDate(sp.tanggal) && sp.tanggal <= now ? sp.tanggal : now;
  const data = await getSummary(period, day);
  const { orders: o, production: p, receipts: r, sand: s, mix: m } = data.current;
  const prev = data.previous;
  const prevDay = shiftPeriod(period, day, -1);
  const nextDay = shiftPeriod(period, day, 1);
  const nextOff = nextDay > now;

  // Tautan ke halaman rinci hanya bila akun ini boleh membukanya (pimpinan tidak punya semua izin).
  const perms = permsOf(me.roles);
  const canOpen = (...list: Perm[]) => list.some((x) => perms.has(x));
  const linkMuatan = canOpen("muat");
  const linkProduksi = canOpen("stok", "keuangan", "produksi_lapangan");
  const linkBahan = canOpen("lihat_barang_masuk", "nilai_mutu", "nilai_kirim", "nilai_harga");
  const linkQc = canOpen("qc", "setujui_qc", "ttd_pimpinan");

  return (
    <>
      <PageHead title={`Ringkasan ${PERIOD_LABELS[period].toLowerCase()}`} sub={`Pengiriman, produksi, bahan baku, dan QC dalam satu halaman, dibandingkan dengan ${PREVIOUS_LABEL[period]}. Notifikasi otomatis dikirim pukul 07.00: harian setiap hari, mingguan tiap Senin, bulanan tiap tanggal 1.`}>
        <SummaryExport summary={data} />
      </PageHead>

      <div className="lp-nav">
        <nav className="seg" aria-label="Periode">
          {PERIODS.map((x) => (
            <Link key={x} href={href(x, day)} aria-current={x === period ? "page" : undefined}>{PERIOD_LABELS[x]}</Link>
          ))}
        </nav>
        <div className="lp-steps">
          <Link href={href(period, prevDay)} className="btn btn-ghost btn-sm" aria-label="Periode sebelumnya">‹ Sebelumnya</Link>
          <span className="lp-label">{data.label}</span>
          <Link href={href(period, nextDay)} className={`btn btn-ghost btn-sm${nextOff ? " is-off" : ""}`} aria-label="Periode berikutnya" aria-disabled={nextOff} tabIndex={nextOff ? -1 : undefined}>Berikutnya ›</Link>
          <Link href={href(period, now)} className="btn btn-ghost btn-sm">Sekarang</Link>
        </div>
        <form className="lp-date" method="get">
          <input type="hidden" name="periode" value={period} />
          <div className="field">
            <label htmlFor="lp-tanggal">Tanggal acuan</label>
            <DateField id="lp-tanggal" name="tanggal" defaultValue={day} max={now} />
          </div>
          <button type="submit" className="btn btn-blue btn-sm">Tampilkan</button>
        </form>
      </div>

      <Kpis
        items={[
          {
            label: "Pengiriman selesai",
            value: o.delivered,
            sub: (
              <>
                {share(o.onTime, o.delivered)} tepat waktu{o.late ? ` · ${o.late} telat` : ""}
                <Delta now={o.delivered} before={prev.orders.delivered} period={period} />
              </>
            ),
          },
          {
            label: "PO baru",
            value: o.created,
            sub: (
              <>
                {o.customers} pelanggan{o.cancelled ? ` · ${o.cancelled} dibatalkan` : ""}
                <Delta now={o.created} before={prev.orders.created} period={period} />
              </>
            ),
          },
          {
            label: "Input produksi",
            value: p.entries,
            sub: (
              <>
                reject {fmt(p.rejects)}{p.issueDays ? ` · ${p.issueDays} hari ada kendala` : ""}
                <Delta now={p.entries} before={prev.production.entries} period={period} />
              </>
            ),
          },
          {
            label: "Bahan baku masuk",
            value: `${r.trips} rit`,
            sub: (
              <>
                {s.avgSilt === null ? "belum ada uji lumpur" : `lumpur rata² ${fmt(s.avgSilt)}%`}{r.rejected ? ` · ${r.rejected} ditolak` : ""}
                <Delta now={r.trips} before={prev.receipts.trips} period={period} />
              </>
            ),
          },
        ]}
      />

      {(data.now.inTransit > 0 || data.now.mixWaitingAcc > 0) && (
        <p className="lp-now" style={{ marginTop: 16 }}>
          Saat ini: <b>{data.now.inTransit}</b> surat jalan dalam perjalanan · <b>{data.now.mixWaitingAcc}</b> catatan mix desain menunggu ACC.
        </p>
      )}

      <div className="dash-grid" style={{ marginTop: 16 }}>
        <section className="admin-card lp-card">
          <h2>Pengiriman</h2>
          <QtyTable title="Terkirim per produk" items={o.deliveredProducts} empty="Belum ada pengiriman selesai." />
          <QtyTable title="PO baru per produk" items={o.orderedProducts} empty="Belum ada PO baru." />
          {linkMuatan && <Link href="/operasional/muatan" className="lp-more">Lihat muatan & tugas sopir →</Link>}
        </section>

        <section className="admin-card lp-card">
          <h2>Produksi</h2>
          <QtyTable title="Hasil produksi" items={p.products} empty="Belum ada input hasil produksi." />
          {p.issues.length > 0 && (
            <div className="lp-issues">
              <b>Kendala</b>
              {p.issues.map((item) => (
                <p key={item.issue}>
                  <b>{item.issue}</b> {item.count}×{item.notes[0] ? <span className="muted small"> — {item.notes[0]}</span> : null}
                </p>
              ))}
            </div>
          )}
          {linkProduksi && <Link href="/operasional/produksi" className="lp-more">Lihat detail produksi →</Link>}
        </section>

        <section className="admin-card lp-card">
          <h2>Barang masuk & bahan baku</h2>
          <QtyTable title="Diterima" items={r.items} empty="Tidak ada barang masuk." />
          <p className="lp-line">
            Uji lumpur: <b>{s.tests}</b>
            {s.tests ? <> · rata² <b>{fmt(s.avgSilt)}%</b> · {share(s.good, s.tests)} bagus ≤5% · <b>{s.overLimit}</b> lewat batas</> : null} · {r.suppliers} supplier
          </p>
          {linkBahan && <Link href="/operasional/bahan-baku" className="lp-more">Lihat tier & nilai supplier →</Link>}
        </section>

        <section className="admin-card lp-card">
          <h2>QC & piket</h2>
          <p className="lp-line">
            Mix desain dicatat <b>{m.logs}</b> · {share(m.ok, m.logs)} sesuai · <b>{m.waiting}</b> menunggu ACC
          </p>
          <p className="lp-line">
            Uji kuat tekan: <b>{data.strength.reports}</b> laporan · {data.strength.samples} benda uji · <b>{data.strength.passed}</b> memenuhi{data.strength.failed ? ` · ${data.strength.failed} belum` : ""}
          </p>
          <div className="lp-qty">
            <h3>Piket</h3>
            {data.duty.length ? data.duty.map((d) => <p key={d.name} className="lp-line">{d.name}: {d.shifts} shift · {d.hours} jam</p>) : <p className="muted small">Belum ada absen piket.</p>}
          </div>
          {linkQc && <Link href="/operasional/qc" className="lp-more">Lihat QC →</Link>}
        </section>
      </div>
    </>
  );
}
