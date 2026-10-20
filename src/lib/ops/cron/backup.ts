import type { CronContext } from "./types";

/** Senin 08.00-08.04 WIB: ingatkan pemilik bila backup terakhir >= 6 hari atau belum pernah. */
export async function remindBackup(_c: CronContext): Promise<void> {
  // TODO (subagen keamanan): gerbang Senin 08:00 WIB; baca ops_backup_runs terakhir; push ke pemilik, url /operasional/keamanan.
}
