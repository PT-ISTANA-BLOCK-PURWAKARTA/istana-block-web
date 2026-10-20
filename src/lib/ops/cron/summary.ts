import type { CronContext } from "./types";

/** 07.00-07.04 WIB: kirim laporan pimpinan (harian tiap hari, mingguan tiap Senin, bulanan tiap tanggal 1) ke pemegang izin laporan. */
export async function sendScheduledSummaries(_c: CronContext): Promise<void> {
  // TODO (subagen laporan): gerbang 07:00 WIB; susun ringkasan periode lalu; push ke akun ber-izin "laporan".
}
