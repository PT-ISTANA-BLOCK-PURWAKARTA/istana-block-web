// Pekerjaan terjadwal (Cron Trigger "*/5 * * * *", lihat wrangler.jsonc dan scheduled() di worker.ts).
// Berjalan di luar request Next.js: TANPA "server-only" dan TANPA impor next/* atau alias "@/" supaya aman
// dibundel langsung oleh Wrangler bersama worker.ts. Pakai impor relatif dan drizzle(env.DB) langsung.
//
// Setiap job punya gerbang waktu sendiri (jam WIB, menit 0-4 pada tick 5-menitan) dan harus cepat kembali
// bila belum waktunya (batas CPU Workers Free 10 ms per eksekusi). Kegagalan satu job tidak menghentikan yang lain.
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

export type CronDb = ReturnType<typeof drizzle<typeof schema>>;
export type CronContext = { env: CloudflareEnv; db: CronDb; now: Date };

/** Titik masuk dari worker.ts: jalankan keempat job secara paralel. */
export async function runScheduledJobs(env: CloudflareEnv, _ctx: ExecutionContext) {
  const c: CronContext = { env, db: drizzle(env.DB, { schema }), now: new Date() };
  const jobs = { sendDueReminders, remindBackup, sendScheduledSummaries, remindIsoSchedules };
  const results = await Promise.allSettled(Object.values(jobs).map((job) => job(c)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[cron] ${Object.keys(jobs)[i]} gagal:`, r.reason);
  });
}

/** Pengingat kalender: kirim push ke peserta untuk ops_calendar_reminders yang jatuh tempo (tandai sentAt dulu agar tak dobel). */
export async function sendDueReminders(_c: CronContext): Promise<void> {
  // TODO (subagen kalender): ambil <=50 pengingat remindAt<=now & sentAt null; abaikan yang terlewat >2 jam; kirim push ke peserta.
}

/** Senin 08.00-08.04 WIB: ingatkan pemilik bila backup terakhir >= 6 hari atau belum pernah. */
export async function remindBackup(_c: CronContext): Promise<void> {
  // TODO (subagen keamanan): gerbang Senin 08:00 WIB; baca ops_backup_runs terakhir; push ke pemilik, url /operasional/keamanan.
}

/** 07.00-07.04 WIB: kirim laporan pimpinan (harian tiap hari, mingguan tiap Senin, bulanan tiap tanggal 1) ke pemegang izin laporan. */
export async function sendScheduledSummaries(_c: CronContext): Promise<void> {
  // TODO (subagen laporan): gerbang 07:00 WIB; susun ringkasan periode lalu; push ke akun ber-izin "laporan".
}

/** 07.00-07.04 WIB: ingatkan QC & pemilik bila ada jadwal F-IB-06 terlambat/segera, NCR Open lewat target, atau tindak lanjut rapat terlambat. */
export async function remindIsoSchedules(_c: CronContext): Promise<void> {
  // TODO (subagen ISO): gerbang 07:00 WIB; cek iso_records; push ke QC & pemilik, url /operasional/rekap-iso.
}
