import "./duty.css";
import Link from "next/link";
import { getDb } from "@/db";
import { currentShift, STALE_SHIFT_SECONDS } from "@/lib/ops/duty";
import { formatDateTime } from "@/lib/ops/shared/format";
import { needsShift, type Role } from "@/lib/roles";

/**
 * Bilah status piket untuk akun yang WAJIB piket (satpam/mandor): "Sedang piket sejak …" atau "Belum absen piket",
 * dengan tautan ke /operasional/piket. Untuk akun lain tidak menampilkan apa pun. Server component; pasang di layout panel.
 * Tidak menulis ke database (shift basi hanya dianggap belum piket; penutupan otomatis terjadi di halaman/aksi piket).
 */
export async function DutyBar({ me }: { me: { id: number; roles: readonly Role[] } }) {
  if (!needsShift(me.roles)) return null;
  const db = await getDb();
  const shift = await currentShift(db, me.id);
  const stale = shift ? Date.now() - shift.startedAt.getTime() > STALE_SHIFT_SECONDS * 1000 : false;
  const on = Boolean(shift) && !stale;
  return (
    <div className={`duty-bar${on ? "" : " is-off"}`} role="status">
      <span className="duty-dot" aria-hidden="true" />
      {on && shift ? (
        <span>Sedang piket sejak <b>{formatDateTime(shift.startedAt)}</b></span>
      ) : (
        <span><b>Belum absen piket.</b> Absen dulu sebelum mencatat barang masuk, uji pasir, atau “Sudah dimuat”.</span>
      )}
      <Link href="/operasional/piket">{on ? "Kelola piket" : "Absen piket"}</Link>
    </div>
  );
}
