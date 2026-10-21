import { tgl } from "@/lib/erp/util";

/** Masa berlaku dokumen (SIM/STNK/KIR) dengan penanda sisa hari: merah bila lewat, kuning bila <= 30 hari. */
export function ExpiryText({ date, now }: { date: string | null | undefined; now: string }) {
  if (!date) return <span className="muted">—</span>;
  const left = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86400000);
  const tone = left < 0 ? "text-bahaya" : left <= 30 ? "text-warn" : "";
  return (
    <span className={tone || undefined}>
      {tgl(date)}
      {left < 0 ? <div className="small">lewat {-left} hari</div> : left <= 30 ? <div className="small">sisa {left} hari</div> : null}
    </span>
  );
}
