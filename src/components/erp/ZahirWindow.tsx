"use client";

// Bingkai form transaksi seperti jendela Zahir Accounting 6: bilah judul, toolbar ikon (Baru · Simpan · Cetak · Tutup),
// isi (kepala dokumen + tabel rincian), dan bilah status di bawah. Dipakai di dalam <ActionForm> (Simpan = submit).
import Link from "next/link";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Icon, type IconName } from "@/components/panel/Icon";

export function ZahirWindow({
  title,
  icon = "doc",
  number,
  newHref,
  closeHref,
  printHref,
  status,
  children,
}: {
  title: string;
  icon?: IconName;
  /** Nomor dokumen; kosong = "[Otomatis]" (dibuat saat disimpan). */
  number?: string | null;
  newHref: string;
  closeHref: string;
  printHref?: string | null;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="zw">
      <div className="zw-title">
        <span className="zw-title-text"><Icon name={icon} size={16} /> {title}</span>
        <span className="zw-no">No. <b>{number || "[Otomatis]"}</b></span>
        <Link href={closeHref} className="zw-x" aria-label="Tutup">×</Link>
      </div>
      <div className="zw-toolbar" role="toolbar" aria-label={`Perintah ${title}`}>
        <Link href={newHref} className="zw-tool"><Icon name="doc" size={20} /><span>Baru</span></Link>
        <SubmitButton className="zw-tool zw-save" pendingText="Menyimpan…"><Icon name="check" size={20} /><span>Simpan</span></SubmitButton>
        {printHref ? (
          <Link href={printHref} target="_blank" className="zw-tool"><Icon name="report" size={20} /><span>Cetak</span></Link>
        ) : (
          <span className="zw-tool is-off" title="Simpan dulu untuk mencetak"><Icon name="report" size={20} /><span>Cetak</span></span>
        )}
        <Link href={closeHref} className="zw-tool"><Icon name="close" size={20} /><span>Tutup</span></Link>
      </div>
      <div className="zw-body">{children}</div>
      {status && <div className="zw-status">{status}</div>}
    </div>
  );
}
