// Web Push (VAPID) tanpa pustaka. Dipakai dari server action (lewat getDb/getEnv) dan dari cron (drizzle(env.DB)).
// TANPA "server-only" dan TANPA alias "@/" karena ikut dibundel worker.ts untuk handler scheduled.
// Tanpa VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY semua fungsi kirim menjadi no-op.
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../../db/schema";

export type OpsDb = DrizzleD1Database<typeof schema>;
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export function pushConfigured(env: CloudflareEnv): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/** Kirim push ke semua langganan milik user tersebut. Tidak pernah melempar error. */
export async function pushToUsers(db: OpsDb, env: CloudflareEnv, userIds: number[], message: PushMessage): Promise<void> {
  // TODO (subagen kalender & push): implementasi RFC 8291 + VAPID RFC 8292 (port worker/push.ts sumber).
  void db, env, userIds, message;
}
