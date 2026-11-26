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
