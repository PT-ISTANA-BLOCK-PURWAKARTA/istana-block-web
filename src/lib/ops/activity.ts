import "server-only";
import { headers } from "next/headers";
import { getDb, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth";

/** Kunci isian yang nilainya tidak boleh masuk log. */
const SECRET_KEY = /pass|secret|pin|token|signature|endpoint|base64/i;
const MAX_DETAILS = 2000;

function clean(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (depth > 4) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 30).map((x) => clean(x, depth + 1));
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    if (typeof File !== "undefined" && v instanceof File) return `[berkas ${v.name}]`;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? "[disembunyikan]" : clean(x, depth + 1);
    return out;
  }
  return String(v);
}

/**
 * Catat satu aktivitas ke ops_activity_logs. TIDAK PERNAH melempar error (kegagalan log tidak boleh menggagalkan aksi).
 * action = "modul.aksi" (mis. "produksi.simpan"), label = kalimat sehari-hari (mis. "Menyimpan hasil produksi").
 * details disamarkan (pass/secret/pin/token/signature/endpoint) dan dipotong 2000 huruf.
 */
export async function logActivity(
  me: Pick<CurrentUser, "id" | "name" | "roles"> | null,
  entry: { action: string; label: string; summary?: string; details?: unknown; success?: boolean },
) {
  try {
    let ip: string | null = null;
    let device: string | null = null;
    try {
      const h = await headers();
      ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      device = h.get("user-agent")?.slice(0, 200) ?? null;
    } catch {
      // di luar konteks request (mis. cron): ip & perangkat dikosongkan
    }
    let details: string | null = null;
    if (entry.details !== undefined) {
      const text = typeof entry.details === "string" ? entry.details : JSON.stringify(clean(entry.details));
      details = text.length > MAX_DETAILS ? text.slice(0, MAX_DETAILS) : text;
    }
    const db = await getDb();
    await db.insert(schema.activityLogs).values({
      userId: me?.id ?? null,
      userName: me?.name ?? null,
      role: me?.roles.join(",") ?? null,
      action: entry.action,
      label: entry.label,
      summary: entry.summary?.slice(0, 300) ?? null,
      details,
      success: entry.success ?? true,
      ip,
      device,
    });
  } catch {
    // sengaja diam
  }
}
