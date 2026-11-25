"use client";

// Kerangka form transaksi gaya Zahir Online: kartu putih dengan judul & nomor dokumen di kiri atas,
// tombol Tutup · Baru · Cetak · Simpan (hijau) di kanan atas (tetap terlihat saat menggulir), isi, dan catatan di bawah.
// Dipakai di dalam <ActionForm> (Simpan = submit).
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
      <div className="zw-top">
        <div className="zw-title">
          <h1><Icon name={icon} size={20} /> {title}</h1>
          <span className="zw-no">No. <b>{number || "[Otomatis]"}</b></span>
        </div>
        <div className="zw-toolbar" role="toolbar" aria-label={`Perintah ${title}`}>
          <Link href={closeHref} className="zw-tool"><Icon name="back" size={16} /> Tutup</Link>
          <Link href={newHref} className="zw-tool"><Icon name="doc" size={16} /> Baru</Link>
          {printHref ? (
            <Link href={printHref} target="_blank" className="zw-tool"><Icon name="report" size={16} /> Cetak</Link>
          ) : (
            <span className="zw-tool is-off" title="Simpan dulu untuk mencetak"><Icon name="report" size={16} /> Cetak</span>
          )}
          <SubmitButton className="zw-tool zw-save" pendingText="Menyimpan…"><Icon name="check" size={16} /> Simpan</SubmitButton>
        </div>
      </div>
      <div className="zw-body">{children}</div>
      {status && <div className="zw-status">{status}</div>}
    </div>
  );
}
