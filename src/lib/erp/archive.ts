import { UserError } from "./server";

/** Awalan id untuk data arsip hasil migrasi dari aplikasi inventori-ops (PO, surat jalan, produksi, dan turunannya). */
const ARCHIVE_PREFIX = "iops-";

/** Apakah id ini milik arsip aplikasi lama (baca-saja, tidak boleh memposting stok/jurnal)? */
export function isArchive(id: string | null | undefined): boolean {
  return !!id && id.startsWith(ARCHIVE_PREFIX);
}

/** Tolak perubahan atas data arsip. `what` = nama objek, mis. "Pesanan", "Surat jalan", "Catatan produksi". */
export function assertLive(id: string | null | undefined, what: string): void {
  if (isArchive(id)) throw new UserError(`${what} ini arsip dari aplikasi lama dan bersifat baca-saja.`);
}
