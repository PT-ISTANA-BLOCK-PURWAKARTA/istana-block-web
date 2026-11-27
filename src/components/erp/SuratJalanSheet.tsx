// Surat jalan format Zahir (sama seperti app lama): tanpa harga, sopir & nomor polisi, 6 kotak tanda tangan
// (Hormat Kami / Sopir / Control Qty 1 & 2 / Cek Security / Penerima). Dua lembar: LEMBAR ASLI (biru) & LEMBAR COPY (abu).
import { PrintButton } from "@/components/erp/PrintButton";

export type SuratJalanData = {
  issuer: string; number: string; poNumber: string | null; date: string; terms: string | null; reference: { label: string; value: string } | null;
  recipient: (string | null | undefined)[]; note: string | null; lines: { quantity: number; unit: string; name: string; remark?: string | null }[];
  driverName: string | null; plateNumber: string | null; signerName: string | null; signatureUrl: string | null; isInternal?: boolean; paid?: boolean;
};
export type SuratJalanKop = { name: string; logo: string | null; address: string; phone: string } | null;

const shortDate = (day: string) => new Date(`${day}T12:00:00+07:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export function SuratJalanSheet({ data, kop, back, printedBy }: { data: SuratJalanData; kop: SuratJalanKop; back: string; printedBy: string }) {
  const driver = [data.driverName, data.plateNumber].filter(Boolean).join(" / ");
  const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Jakarta" });
  const page = (label: string, copy: boolean) => (
    <article key={label} className={`print-page sj-page${copy ? " sj-copy" : ""}`}>
      {kop && (
        <header className="sj-kop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {kop.logo && <img src={kop.logo} alt="" />}
          <div><b>{kop.name}</b><div>Office : {kop.address}</div><div>Phone : {kop.phone}</div></div>
        </header>
      )}
      <div className="sjtitle"><span>SURAT JALAN{data.isInternal && <i className="sjint">INTERNAL</i>}</span><b>{label}</b></div>
      <table className="sj">
        <thead><tr><th>No Surat Jalan</th><th>No PO</th><th>Tanggal</th><th>Terms</th>{data.reference && <th>{data.reference.label}</th>}</tr></thead>
        <tbody><tr><td className="c">{data.number}</td><td className="c">{data.poNumber ?? ""}</td><td className="c">{shortDate(data.date)}</td><td className="c">{data.terms ?? ""}</td>{data.reference && <td className="c">{data.reference.value}</td>}</tr></tbody>
      </table>
      <div className="sjgrid">
        <table className="sj"><thead><tr><th>Kepada Yth.</th></tr></thead><tbody><tr><td className="tall pre">{data.recipient.filter(Boolean).join("\n")}</td></tr></tbody></table>
        <table className="sj"><thead><tr><th>Catatan</th></tr></thead><tbody><tr><td className="tall pre">{data.note ?? ""}</td></tr></tbody></table>
      </div>
      <div className="sjitemswrap">
        {data.paid && <div className="istamp"><b>LUNAS</b></div>}
        <table className="sj items">
          <thead><tr><th style={{ width: 60 }}>Qty</th><th style={{ width: 70 }}>Satuan</th><th>Nama Barang</th><th style={{ width: "30%" }}>Keterangan</th></tr></thead>
          <tbody>
            {data.lines.map((l, i) => <tr key={i}><td className="c">{l.quantity.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td><td className="c">{l.unit.toUpperCase()}</td><td>{l.name}</td><td>{l.remark ?? ""}</td></tr>)}
            {Array.from({ length: Math.max(0, 3 - data.lines.length) }, (_, i) => <tr key={`e${i}`} className="empty"><td /><td /><td /><td /></tr>)}
          </tbody>
        </table>
      </div>
      <table className="sj"><tbody><tr><th style={{ width: 220 }}>Nama Sopir &amp; Nomor Polisi :</th><td>{driver || "......................................"}</td></tr></tbody></table>
      <div className="sjnote"><b>Perhatian:</b><br />1. Barang Yang Sudah Diterima Dalam Kondisi Baik &amp; Cukup (Tanda Tangan &amp; Stempel Perusahaan).<br />2. Barang Yang Sudah Dibeli Tidak Dapat Ditukar atau Dikembalikan.</div>
      <table className="sj signs6">
        <thead><tr>{["Hormat Kami,", "Sopir,", "Control Qty 1,", "Control Qty 2,", "Cek Security,", "Penerima,"].map((t) => <th key={t}>{t}</th>)}</tr></thead>
        <tbody><tr>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <td>{data.signatureUrl && <img src={data.signatureUrl} alt="" />}{data.signerName ?? ""}</td>
          <td>{data.driverName ?? ""}</td><td /><td /><td /><td />
        </tr></tbody>
      </table>
      <p className="sjprinted">Dicetak pada Tanggal {printedAt} Oleh {printedBy.toUpperCase()}</p>
    </article>
  );
  return (
    <div className="print-wrap">
      <div className="print-tools no-print"><a href={back} className="btn btn-ghost btn-sm">← Kembali</a><PrintButton label="Cetak / simpan PDF" /></div>
      {page("LEMBAR ASLI", false)}
      {page("LEMBAR COPY", true)}
    </div>
  );
}
