// Web Push (RFC 8291 aes128gcm + VAPID RFC 8292) dengan WebCrypto, tanpa pustaka. Dipakai dari server action/route
// (lewat getDb/getEnv) dan dari cron (drizzle(env.DB)).
// TANPA "server-only" dan TANPA alias "@/" karena ikut dibundel worker.ts untuk handler scheduled.
// Tanpa VAPID_PUBLIC_KEY & VAPID_PRIVATE_KEY semua fungsi kirim menjadi no-op.
import { inArray } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

export type OpsDb = DrizzleD1Database<typeof schema>;
export type PushMessage = { title: string; body: string; url?: string; tag?: string };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

const encoder = new TextEncoder();
/** Subrequest Workers Free dibatasi 50 per eksekusi: satu pengiriman = satu fetch, jadi dibatasi di sini. */
const MAX_SENDS = 40;

const bs = (bytes: Uint8Array) => bytes as unknown as BufferSource;

/** Terima base64 biasa maupun base64url. */
export function decodeBase64(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
}
export const encodeBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const cryptoKey = await crypto.subtle.importKey("raw", bs(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, bs(data)));
}

export function pushConfigured(env: CloudflareEnv): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

/**
 * Alamat layanan push yang dikenal (Chrome/Edge/Android lewat FCM, Firefox, Safari, Windows). Dipakai untuk
 * menolak langganan dengan alamat sembarang supaya server tidak bisa disuruh mengirim ke host lain.
 */
export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.port || endpoint.length > 1000) return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" || /(^|\.)push\.services\.mozilla\.com$/.test(host) || /(^|\.)push\.apple\.com$/.test(host) || /\.notify\.windows\.com$/.test(host);
  } catch {
    return false;
  }
}

/** Enkripsi isi notifikasi untuk satu langganan (Content-Encoding: aes128gcm, satu record). */
async function encryptPayload(payload: Uint8Array, subscription: { p256dh: string; auth: string }) {
  const clientPublicRaw = decodeBase64(subscription.p256dh);
  const authSecret = decodeBase64(subscription.auth);
  const serverKeys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const serverPublic = new Uint8Array((await crypto.subtle.exportKey("raw", serverKeys.publicKey)) as ArrayBuffer);
  const clientPublic = await crypto.subtle.importKey("raw", bs(clientPublicRaw), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublic }, serverKeys.privateKey, 256));
  // HKDF(auth, ecdh, "WebPush: info" || 0 || ua_public || as_public) -> IKM, lalu HKDF(salt, IKM) -> CEK & nonce.
  const ikm = await hmac(await hmac(authSecret, sharedSecret), concat(encoder.encode("WebPush: info\0"), clientPublicRaw, serverPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(encoder.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(encoder.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const aesKey = await crypto.subtle.importKey("raw", bs(cek), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: bs(nonce) }, aesKey, bs(concat(payload, new Uint8Array([2])))));
  const header = new Uint8Array(21 + serverPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = serverPublic.length;
  header.set(serverPublic, 21);
  return concat(header, ciphertext);
}

/** Subjek VAPID: alamat situs (https) atau mailto. */
function vapidSubject(env: CloudflareEnv) {
  return /^https:\/\//.test(env.SITE_URL ?? "") ? env.SITE_URL : "mailto:admin@istanablockpurwakarta.com";
}

/** Penandatangan VAPID: kunci diimpor sekali per pengiriman, JWT dipakai ulang per layanan push tujuan. */
async function vapidSigner(env: CloudflareEnv) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE_KEY!), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (value: object) => encodeBase64Url(encoder.encode(JSON.stringify(value)));
  const cache = new Map<string, string>();
  return async (endpoint: string) => {
    const audience = new URL(endpoint).origin;
    let token = cache.get(audience);
    if (!token) {
      const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapidSubject(env) })}`;
      const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bs(encoder.encode(unsigned))));
      token = `${unsigned}.${encodeBase64Url(signature)}`;
      cache.set(audience, token);
    }
    return `vapid t=${token}, k=${env.VAPID_PUBLIC_KEY}`;
  };
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Kirim ke satu langganan. Mengembalikan false bila langganan sudah tidak berlaku (404/410). */
async function sendOne(sign: (endpoint: string) => Promise<string>, subscription: Subscription, payload: Uint8Array) {
  const body = await encryptPayload(payload, subscription);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: { authorization: await sign(subscription.endpoint), "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "86400", urgency: "high" },
    body: bs(body) as unknown as BodyInit,
  });
  if (response.status === 404 || response.status === 410) return false;
  if (!response.ok) console.error(`[push] ${new URL(subscription.endpoint).host} ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return true;
}

/**
 * Kirim notifikasi ke semua HP/komputer milik pengguna tertentu; langganan kedaluwarsa (404/410) dihapus.
 * Tidak pernah melempar error. `sent` = jumlah perangkat yang diterima layanan push; `skipped` = langganan yang
 * tidak dikirim karena batas MAX_SENDS atau `budget` habis.
 * `budget` (opsional, dipakai cron): anggaran fetch bersama beberapa job dalam satu eksekusi; dikurangi per fetch.
 */
export async function pushToUsers(db: OpsDb, env: CloudflareEnv, userIds: number[], message: PushMessage, budget?: { fetchLeft: number }): Promise<{ sent: number; skipped: number }> {
  try {
    if (!pushConfigured(env)) return { sent: 0, skipped: 0 };
    const ids = [...new Set(userIds)];
    if (!ids.length) return { sent: 0, skipped: 0 };
    const subscriptions: Subscription[] = [];
    for (let i = 0; i < ids.length; i += 90) {
      subscriptions.push(
        ...(await db
          .select({ id: schema.pushSubscriptions.id, endpoint: schema.pushSubscriptions.endpoint, p256dh: schema.pushSubscriptions.p256dh, auth: schema.pushSubscriptions.auth })
          .from(schema.pushSubscriptions)
          .where(inArray(schema.pushSubscriptions.userId, ids.slice(i, i + 90)))),
      );
    }
    if (!subscriptions.length) return { sent: 0, skipped: 0 };
    // Ambil jatah dan kurangi anggaran tanpa await di antaranya, supaya job paralel tidak berebut jatah yang sama.
    const take = budget ? Math.max(0, Math.min(MAX_SENDS, budget.fetchLeft)) : MAX_SENDS;
    const targets = subscriptions.slice(0, take);
    if (budget) budget.fetchLeft -= targets.length;
    const skipped = subscriptions.length - targets.length;
    if (skipped > 0) console.error(`[push] ${subscriptions.length} langganan, hanya ${targets.length} yang dikirim sekarang.`);
    if (!targets.length) return { sent: 0, skipped };
    const payload = encoder.encode(JSON.stringify({ title: clip(message.title, 120), body: clip(message.body, 300), url: message.url, tag: message.tag }));
    const sign = await vapidSigner(env);
    const results = await Promise.allSettled(targets.map((subscription) => sendOne(sign, subscription, payload)));
    const expired = targets.filter((_, index) => { const r = results[index]; return r.status === "fulfilled" && r.value === false; }).map((subscription) => subscription.id);
    for (let i = 0; i < expired.length; i += 90) {
      await db.delete(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.id, expired.slice(i, i + 90)));
    }
    for (const result of results) if (result.status === "rejected") console.error("[push] gagal:", result.reason);
    return { sent: results.filter((result) => result.status === "fulfilled" && result.value).length, skipped };
  } catch (error) {
    console.error("[push] gagal:", error);
    return { sent: 0, skipped: 0 };
  }
}
