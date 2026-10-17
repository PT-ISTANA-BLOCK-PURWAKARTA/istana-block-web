import { PrintButton } from "./PrintButton";
import type { Settings } from "@/lib/settings";

/** Kerangka dokumen cetak A4 (faktur, surat jalan) dengan kop perusahaan. */
export function PrintDoc({
  site,
  npwp,
  title,
  subtitle,
  back,
  children,
}: {
  site: Settings;
  npwp?: string;
  title: string;
  subtitle?: string;
  back: string;
  children: React.ReactNode;
}) {
  const phones = [site.phone_office, site.phone || site.whatsapp].filter(Boolean).join(" · ");
  return (
    <div className="print-wrap">
      <div className="print-tools no-print">
        <a href={back} className="btn btn-ghost btn-sm">← Kembali</a>
        <PrintButton label="Cetak / simpan PDF" />
      </div>
      <article className="print-page">
        <header className="print-head">
          <div className="print-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-istana-block.webp" alt="" width={147} height={44} />
            <div>
              <b>{site.legal_name || site.company_name}</b>
              {site.address && <div>{site.address}</div>}
              {phones && <div>Telp. {phones}</div>}
              {site.email && <div>{site.email}</div>}
              {npwp && <div>NPWP {npwp}</div>}
            </div>
          </div>
          <div className="print-title">
            <h1>{title}</h1>
            {subtitle && <div>{subtitle}</div>}
          </div>
        </header>
        {children}
      </article>
    </div>
  );
}

/** Kolom tanda tangan di kaki dokumen. */
export function Sign({ labels }: { labels: string[] }) {
  return (
    <div className="print-sign" style={{ ["--sign-cols" as string]: labels.length }}>
      {labels.map((l) => (
        <div key={l}><span>{l}</span><div className="sign-line" /></div>
      ))}
    </div>
  );
}
