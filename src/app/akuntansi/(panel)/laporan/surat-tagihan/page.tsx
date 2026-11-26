// Surat Tagihan Untuk Pelanggan (Zahir): surat berisi daftar faktur yang belum lunas per pelanggan, siap cetak / PDF.
import Link from "next/link";
import { PrintButton } from "@/components/erp/PrintButton";
import { ZahirForm, zDate, zLongDate, zn } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { Select } from "@/components/ui";
import { reportContext } from "@/lib/erp/reportctx";
import { aging } from "@/lib/erp/reports";
import { getFinSettings } from "@/lib/erp/server";
import { isDate, terbilang, today } from "@/lib/erp/util";

export const metadata = { title: "Surat Tagihan" };

export default async function SuratTagihan({ searchParams }: { searchParams: Promise<{ kontak?: string; per?: string }> }) {
  const { db, site, me } = await reportContext();
  const sp = await searchParams;
  const asOf = isDate(sp.per) ? sp.per : today();
  const [ag, fin] = await Promise.all([aging(db, "piutang", asOf), getFinSettings(db)]);
  const c = ag.contacts.find((x) => x.id === sp.kontak);
  return (
    <>
      <div className="no-print">
        <BackLink href="/akuntansi/laporan?k=penjualan&t=1">Laporan</BackLink>
        <PageHead title="Surat Tagihan Untuk Pelanggan" sub="Pilih pelanggan yang masih punya faktur belum lunas, lalu cetak atau simpan PDF untuk dikirim.">
          {c && <PrintButton label="Cetak / PDF" />}
        </PageHead>
        <form method="get" className="filter-bar">
          <label className="grow"><span>Pelanggan</span><Select name="kontak" defaultValue={c?.id ?? ""} searchable options={[{ value: "", label: "Pilih pelanggan…" }, ...ag.contacts.map((x) => ({ value: x.id, label: `${x.name} · sisa ${x.total.toLocaleString("id-ID")}` }))]} /></label>
          <div className="field"><label htmlFor="st-per">Per tanggal</label><input id="st-per" type="date" name="per" defaultValue={asOf} /></div>
          <button className="btn btn-blue btn-sm">Tampilkan</button>
        </form>
      </div>
      {!c ? (
        <div className="admin-table no-print">
          <table>
            <thead><tr><th>Pelanggan</th><th className="num">Faktur</th><th className="num">Sisa tagihan</th><th className="num">Lewat jatuh tempo</th><th /></tr></thead>
            <tbody>{ag.contacts.map((x) => <tr key={x.id}><td>{x.name}</td><td className="num">{x.docs.length}</td><td className="num">{x.total.toLocaleString("id-ID")}</td><td className="num">{(x.total - x.buckets[0]).toLocaleString("id-ID")}</td><td><Link href={`/akuntansi/laporan/surat-tagihan?kontak=${x.id}&per=${asOf}`}>Buat surat</Link></td></tr>)}
              {!ag.contacts.length && <tr><td colSpan={5} className="muted">Tidak ada faktur penjualan yang belum lunas.</td></tr>}</tbody>
          </table>
        </div>
      ) : (
        <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title="Surat Tagihan" period={`Purwakarta, ${zLongDate(asOf)}`}>
          <p>Kepada Yth.<br /><b>{c.name}</b><br />di tempat</p>
          <p>Dengan hormat,<br />Bersama surat ini kami sampaikan rincian tagihan atas pembelian Bapak/Ibu yang belum kami terima pembayarannya per {zLongDate(asOf)}:</p>
          <table className="zf-table">
            <thead><tr><th style={{ width: 36 }}>No</th><th>No. Faktur</th><th>Tanggal</th><th>Jatuh Tempo</th><th className="num">Total Faktur</th><th className="num">Sudah Dibayar</th><th className="num">Sisa Tagihan</th></tr></thead>
            <tbody>{c.docs.map((d, i) => <tr key={d.id}><td>{i + 1}</td><td>{d.number}</td><td>{zDate(d.date)}</td><td>{zDate(d.dueDate)}{d.overdue > 0 ? ` (lewat ${d.overdue} hr)` : ""}</td><td className="num">{zn(d.total, true)}</td><td className="num">{zn(d.paid)}</td><td className="num">{zn(d.open, true)}</td></tr>)}</tbody>
            <tfoot><tr className="zf-total"><td colSpan={6}>TOTAL TAGIHAN</td><td className="num">{zn(c.total, true)}</td></tr></tfoot>
          </table>
          <p><i>Terbilang: {terbilang(c.total)} rupiah</i></p>
          <p>Mohon pembayaran dapat ditransfer ke rekening berikut:<br /><b style={{ whiteSpace: "pre-line" }}>{fin.bankInfo || "(isi rekening di Pengaturan Keuangan)"}</b></p>
          <p>Bila pembayaran sudah dilakukan, mohon abaikan surat ini dan kirimkan bukti transfer kepada kami. Atas perhatian dan kerja samanya kami ucapkan terima kasih.</p>
          <div style={{ marginTop: 40, width: 240 }}><span>Hormat kami,</span><div className="sign-line" style={{ height: 60 }} /><b>{me.name}</b><div className="small">{site.legal_name || site.company_name}</div></div>
        </ZahirForm>
      )}
    </>
  );
}
