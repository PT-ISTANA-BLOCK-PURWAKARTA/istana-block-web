import type { Settings } from "@/lib/settings";

/**
 * Lembar laporan dengan kop perusahaan (logo, nama badan usaha, alamat, kontak, NPWP).
 * Tampil sama di layar dan saat dicetak / disimpan PDF.
 */
export function ReportSheet({
  site,
  npwp,
  title,
  period,
  unit = "Dalam Rupiah",
  printedBy,
  sign = false,
  children,
}: {
  site: Settings;
  npwp?: string;
  title: string;
  period: string;
  unit?: string | null;
  printedBy: string;
  sign?: boolean;
  children: React.ReactNode;
}) {
  const phones = [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ");
  const now = new Date();
  const printed = now.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" });
  return (
    <article className="report-sheet">
      <header className="kop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-istana-block.webp" alt="Istana Block Purwakarta" width={160} height={48} className="kop-logo" />
        <div className="kop-text">
          <b>{site.legal_name || site.company_name}</b>
          {site.address && <span>{site.address.replace(/\s*\n\s*/g, ", ")}</span>}
          <span>{[phones && `Telp. ${phones}`, site.email].filter(Boolean).join(" · ")}</span>
          {npwp && <span>NPWP {npwp}</span>}
        </div>
      </header>
      <div className="kop-rule" aria-hidden="true" />
      <div className="report-title">
        <h2>{title}</h2>
        <p>{period}</p>
        {unit && <p className="report-unit">({unit})</p>}
      </div>
      <div className="report-body">{children}</div>
      {sign && (
        <div className="report-sign print-only">
          <div><span>Disiapkan oleh,</span><div className="sign-line" /><b>{printedBy}</b></div>
          <div><span>Disetujui oleh,</span><div className="sign-line" /><b>Pemilik</b></div>
        </div>
      )}
      <footer className="report-foot">
        Dicetak {printed} oleh {printedBy} · Aplikasi Keuangan Istana Block
      </footer>
    </article>
  );
}

/** Catatan "cara membaca" singkat untuk pembaca yang bukan akuntan. */
export function ReadingNote({ children }: { children: React.ReactNode }) {
  return <p className="reading-note no-print">{children}</p>;
}
