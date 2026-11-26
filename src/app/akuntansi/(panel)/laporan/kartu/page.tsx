// Kartu Piutang / Kartu Hutang & Mutasi (seperti laporan Zahir "Kartu Piutang - Mata Uang Dasar" dan "Mutasi Piutang").
// Tanpa kontak dipilih: mutasi per kontak (saldo awal, bertambah, dibayar, saldo akhir). Dengan kontak: kartu berjalan per dokumen.
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { PeriodBar } from "@/components/erp/report/PeriodBar";
import { ReadingNote, ReportSheet } from "@/components/erp/report/ReportSheet";
import { BackLink, Kpis, PageHead } from "@/components/erp/ui";
import { Select } from "@/components/ui";
import { periodLabel, rangePresets } from "@/lib/erp/periods";
import { reportContext } from "@/lib/erp/reportctx";
import { contactCard } from "@/lib/erp/reports";
import { formatAmount, isDate, monthStart, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Kartu piutang / hutang" };

export default async function Kartu({ searchParams }: { searchParams: Promise<{ jenis?: string; kontak?: string; from?: string; to?: string }> }) {
  const { me, db, site, npwp } = await reportContext();
  const sp = await searchParams;
  const kind = sp.jenis === "hutang" ? "hutang" : "piutang";
  const to = isDate(sp.to) ? sp.to : today();
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const all = await contactCard(db, kind, from, to);
  const contact = all.summary.find((c) => c.id === sp.kontak);
  const card = contact ? await contactCard(db, kind, from, to, contact.id) : null;
  const Name = kind === "piutang" ? "Piutang" : "Hutang";
  const who = kind === "piutang" ? "Pelanggan" : "Pemasok";
  const docHref = (k: "doc" | "pay", id: string) =>
    kind === "piutang" ? (k === "doc" ? `/akuntansi/penjualan/${id}` : `/akuntansi/penerimaan/${id}`) : k === "doc" ? `/akuntansi/pembelian/${id}` : `/akuntansi/pembayaran/${id}`;
  const path = "/akuntansi/laporan/kartu";
  const keep: Record<string, string> = { jenis: kind, ...(contact ? { kontak: contact.id } : {}) };
  const tot = all.summary.reduce((a, c) => ({ opening: a.opening + c.opening, up: a.up + c.up, down: a.down + c.down, closing: a.closing + c.closing }), { opening: 0, up: 0, down: 0, closing: 0 });

  return (
    <>
      <div className="no-print">
        <BackLink href={`/akuntansi/laporan?k=${kind === "piutang" ? "penjualan" : "pembelian"}&t=1`}>Laporan</BackLink>
        <PageHead title={contact ? `Kartu ${Name} · ${contact.name}` : `Mutasi ${Name}`} sub={contact ? `Setiap faktur dan pembayaran ${contact.name}, dengan saldo berjalan.` : `Saldo awal, bertambah, dibayar, dan saldo akhir ${kind} tiap ${who.toLowerCase()}. Klik nama untuk melihat kartunya.`}>
          <Link href={`${path}?jenis=${kind === "piutang" ? "hutang" : "piutang"}`} className="btn btn-ghost btn-sm">Lihat {kind === "piutang" ? "hutang" : "piutang"}</Link>
          <PrintButton label="Cetak / PDF" />
        </PageHead>
        <PeriodBar
          path={path}
          presets={rangePresets()}
          from={from}
          to={to}
          keep={keep}
          keepInForm={false}
          extra={
            <>
              <input type="hidden" name="jenis" value={kind} />
              <label className="grow">
                <span>{who}</span>
                <Select name="kontak" defaultValue={contact?.id ?? ""} searchable menuWidth={320} options={[{ value: "", label: `Semua ${who.toLowerCase()} (mutasi)` }, ...all.summary.map((c) => ({ value: c.id, label: c.name }))]} />
              </label>
            </>
          }
        />
      </div>
      <ReportSheet site={site} npwp={npwp} title={contact ? `Kartu ${Name} · ${contact.name}` : `Mutasi ${Name} - Mata Uang Dasar`} period={`Periode ${periodLabel(from, to)}`} printedBy={me.name}>
        {card ? (
          <>
            <Kpis
              items={[
                { label: "Saldo awal", value: formatAmount(card.opening), sub: `per ${tgl(from)}` },
                { label: "Faktur", value: formatAmount(card.lines.reduce((a, r) => a + r.up, 0)), sub: "bertambah" },
                { label: kind === "piutang" ? "Diterima" : "Dibayar", value: formatAmount(card.lines.reduce((a, r) => a + r.down, 0)), sub: "berkurang" },
                { label: "Saldo akhir", value: formatAmount(card.closing), sub: `per ${tgl(to)}`, tone: card.closing > 0 ? "warn" : undefined },
              ]}
            />
            <div className="admin-table report">
              <table>
                <thead><tr><th>Tanggal</th><th>Nomor</th><th>Jenis</th><th className="num">Bertambah</th><th className="num">Berkurang</th><th className="num">Saldo</th></tr></thead>
                <tbody>
                  <tr className="r-sub"><td colSpan={5}>Saldo awal</td><td className="num tabular">{formatAmount(card.opening)}</td></tr>
                  {card.lines.map((r) => (
                    <tr key={`${r.kind}${r.id}`}>
                      <td className="nowrap">{tgl(r.date)}</td>
                      <td><Link href={docHref(r.kind, r.id)}>{r.number}</Link></td>
                      <td className="small">{r.kind === "doc" ? `Faktur ${kind === "piutang" ? "penjualan" : "pembelian"}` : kind === "piutang" ? "Penerimaan" : "Pembayaran"}</td>
                      <td className="num tabular">{formatAmount(r.up, { blankZero: true })}</td>
                      <td className="num tabular">{formatAmount(r.down, { blankZero: true })}</td>
                      <td className="num tabular">{formatAmount(r.balance)}</td>
                    </tr>
                  ))}
                  {card.lines.length === 0 && <tr><td colSpan={6} className="muted">Tidak ada transaksi pada periode ini.</td></tr>}
                </tbody>
                <tfoot><tr><th colSpan={5}>Saldo akhir</th><th className="num">{formatAmount(card.closing)}</th></tr></tfoot>
              </table>
            </div>
          </>
        ) : (
          <div className="admin-table report">
            <table>
              <thead><tr><th>{who}</th><th className="num">Saldo awal</th><th className="num">Bertambah</th><th className="num">{kind === "piutang" ? "Diterima" : "Dibayar"}</th><th className="num">Saldo akhir</th></tr></thead>
              <tbody>
                {all.summary.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`${path}?${new URLSearchParams({ jenis: kind, kontak: c.id, from, to })}`}>{c.name}</Link></td>
                    <td className="num tabular">{formatAmount(c.opening, { blankZero: true })}</td>
                    <td className="num tabular">{formatAmount(c.up, { blankZero: true })}</td>
                    <td className="num tabular">{formatAmount(c.down, { blankZero: true })}</td>
                    <td className="num tabular">{formatAmount(c.closing)}</td>
                  </tr>
                ))}
                {all.summary.length === 0 && <tr><td colSpan={5} className="muted">Belum ada {kind} pada periode ini.</td></tr>}
              </tbody>
              <tfoot><tr><th>Jumlah</th><th className="num">{formatAmount(tot.opening)}</th><th className="num">{formatAmount(tot.up)}</th><th className="num">{formatAmount(tot.down)}</th><th className="num">{formatAmount(tot.closing)}</th></tr></tfoot>
            </table>
          </div>
        )}
        <ReadingNote>
          Dihitung dari faktur dan pembayaran yang dialokasikan ke faktur (faktur batal tidak dihitung). Pembayaran yang belum dialokasikan / uang muka belum termasuk.
        </ReadingNote>
      </ReportSheet>
    </>
  );
}
