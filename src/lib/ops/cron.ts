// Pekerjaan terjadwal (Cron Trigger "*/5 * * * *", lihat wrangler.jsonc dan scheduled() di worker.ts).
// Berjalan di luar request Next.js: TANPA "server-only" dan TANPA impor next/* atau alias "@/" supaya aman
// dibundel langsung oleh Wrangler bersama worker.ts. Pakai impor relatif dan drizzle(env.DB) langsung.
//
// Setiap job punya gerbang waktu sendiri (jam WIB, menit 0-4 pada tick 5-menitan) dan harus cepat kembali
// bila belum waktunya (batas CPU Workers Free 10 ms per eksekusi). Kegagalan satu job tidak menghentikan yang lain.
// Isi tiap job ada di berkas terpisah di cron/ supaya modul pemiliknya bisa mengubahnya sendiri.
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import { sendDueReminders } from "./cron/calendar";
import { remindBackup } from "./cron/backup";
import { sendScheduledSummaries } from "./cron/summary";
import { remindIsoSchedules } from "./cron/iso";
import type { CronContext } from "./cron/types";

export type { CronContext, CronDb } from "./cron/types";

/** Titik masuk dari worker.ts: jalankan keempat job secara paralel. */
export async function runScheduledJobs(env: CloudflareEnv, _ctx: ExecutionContext) {
  // 40 dari 50 subrequest Workers Free untuk fetch push; sisanya cadangan kueri D1 dan lainnya.
  const c: CronContext = { env, db: drizzle(env.DB, { schema }), now: new Date(), budget: { fetchLeft: 40 } };
  const jobs = { sendDueReminders, remindBackup, sendScheduledSummaries, remindIsoSchedules };
  const results = await Promise.allSettled(Object.values(jobs).map((job) => job(c)));
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error(`[cron] ${Object.keys(jobs)[i]} gagal:`, r.reason);
  });
}
