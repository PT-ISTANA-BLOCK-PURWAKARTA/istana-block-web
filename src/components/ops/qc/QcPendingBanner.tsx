import Link from "next/link";
import type { QcPending } from "@/lib/ops/qc";
import "./qc.css";

/**
 * Notifikasi QC: data menunggu ACC (manajer QC), menunggu TTD pimpinan, atau dikembalikan untuk revisi (QC).
 * `needsSignature` = pemegang izin ACC/TTD yang belum membuat tanda tangan bergambar.
 */
export function QcPendingBanner({ pending, needsSignature }: { pending: QcPending; needsSignature: boolean }) {
  const lines = [
    pending.mixToApprove ? `${pending.mixToApprove} data mix desain menunggu ACC Anda` : null,
    pending.strengthToApprove ? `${pending.strengthToApprove} laporan uji kuat tekan menunggu ACC Anda` : null,
    pending.strengthToSign ? `${pending.strengthToSign} laporan uji kuat tekan menunggu tanda tangan Pimpinan` : null,
    pending.mixRevisions ? `${pending.mixRevisions} data mix desain dikembalikan untuk revisi` : null,
    pending.strengthRevisions ? `${pending.strengthRevisions} laporan uji tekan dikembalikan untuk revisi` : null,
  ].filter(Boolean) as string[];
  if (!lines.length && !needsSignature) return null;
  return (
    <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
      {lines.length > 0 && (
        <div className="flag flag-info qc-banner" role="status">
          <div>
            <b>Perlu tindakan QC</b>
            <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        </div>
      )}
      {needsSignature && (
        <div className="flag flag-warn qc-banner" role="status">
          <div>
            Anda belum membuat tanda tangan. Tanda tangan dicetak otomatis di formulir QC yang Anda ACC/tandatangani.{" "}
            <Link href="/operasional/profil#tanda-tangan" style={{ fontWeight: 700 }}>Buat tanda tangan</Link>
          </div>
        </div>
      )}
    </div>
  );
}
