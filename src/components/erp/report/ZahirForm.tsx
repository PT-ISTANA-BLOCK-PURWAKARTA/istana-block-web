// Lembar cetak bergaya formulir laporan Zahir: jam & tanggal cetak di kiri atas, nama perusahaan huruf besar di tengah,
// judul laporan biru, periode, lalu tabel. Nomor "Halaman : n" muncul di setiap halaman cetak (CSS @page).
// Memakai kelas report-sheet supaya tombol "Unduh Excel" ikut bekerja.
import { SheetExcel } from "./SheetExcel";

const dt = () => {
  const now = new Date();
  const time = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).replace(".", ":");
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).replace(/ (\d{4})$/, ", $1");
  return { time, date };
};

export function ZahirForm({ company, title, period, children }: { company: string; title: string; period: string; children: React.ReactNode }) {
  const { time, date } = dt();
  return (
    <article className="report-sheet zf">
      <div className="zf-stamp"><span>{time}</span><span>{date}</span></div>
      <header className="zf-head">
        <b>{company.toUpperCase()}</b>
        <h2>{title}</h2>
        <p>{period}</p>
        <SheetExcel title={title} period={period} />
      </header>
      <div className="zf-body">{children}</div>
      <footer className="zf-foot no-print">Halaman : 1</footer>
    </article>
  );
}

/** Angka gaya Zahir: 1,234,567.00 (kosong bila 0 kecuali `zero`). */
export const zn = (v: number, zero = false) => (v ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : zero ? "0.00" : "");
/** Saldo gaya Zahir: negatif dalam kurung. */
export const zb = (v: number) => (v < 0 ? `(${zn(-v)})` : zn(v, true));
export const zDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const zLongDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
export const zPeriod = (from: string, to: string) => `${zLongDate(from)} - ${zLongDate(to)}`;
