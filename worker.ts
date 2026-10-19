// Pembungkus Worker OpenNext: respons halaman publik disimpan di cache, sehingga kunjungan
// berikutnya tidak menjalankan Next.js lagi. Tujuannya menekan waktu CPU per request di paket
// Workers Free (batas 10 ms). Batas itu penyebab error 503 "1102" di staging (audit 2026-10-19).
//
// Lapis 1: memori isolate. Berlaku di mana saja, termasuk *.workers.dev.
// Lapis 2: Cache API Cloudflare. Hanya berfungsi di domain sendiri, tidak di workers.dev.
//
// Tidak pernah di-cache: panel internal & API, pengunjung yang login (cookie sesi), selain GET,
// request Range (video), dan respons selain 200.
//
// Parameter iklan (gclid, utm_*, ...) dibuang sebelum request diteruskan ke Next.js. Isi halaman
// tidak bergantung padanya, sehingga setiap klik iklan bisa dilayani dari cache dan HTML yang
// di-cache tidak memuat gclid pengunjung lain. Browser tetap menyimpan gclid di address bar,
// jadi GTM tetap membacanya. Pada redirect (301 alamat lama), parameter itu ditempel lagi ke
// Location, sama seperti src/middleware.ts.

// @ts-ignore `.open-next/worker.js` baru ada setelah `opennextjs-cloudflare build`.
import { default as handler } from "./.open-next/worker.js";

const PAGE_TTL = 300; // halaman & navigasi: 5 menit (keputusan pemilik 2026-10-19)
const MEDIA_TTL = 31_536_000; // /media/...: key berisi UUID, isi berkas tidak pernah berubah
const META_TTL = 3600; // sitemap.xml & robots.txt

const NO_CACHE = /^\/(situs|akuntansi|operasional|internal|api|admin|keuangan|reel)(\/|$)/;
const SESSION = /(?:^|;\s*)ib_session=/; // nama cookie = SESSION_COOKIE di src/lib/session.ts
const TRACKING = /^(utm_.+|gclid|gbraid|wbraid|gad_.+|fbclid|msclkid|_gl|srsltid)$/;
// Header yang membedakan payload navigasi Next.js (RSC/prefetch) dari HTML biasa.
const VARY = ["rsc", "next-router-prefetch", "next-router-state-tree", "next-router-segment-prefetch", "next-url"];

type Entry = { expires: number; headers: [string, string][]; body: ArrayBuffer };

const MEM_MAX_ENTRIES = 300;
const MEM_MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MEM_MAX_BYTES = 32 * 1024 * 1024; // batas memori isolate 128 MB
const memory = new Map<string, Entry>();
let memBytes = 0;

function ttlFor(req: Request, url: URL): number | null {
  if (req.method !== "GET" || req.headers.has("range")) return null;
  if (NO_CACHE.test(url.pathname) || SESSION.test(req.headers.get("cookie") ?? "")) return null;
  if (url.pathname.startsWith("/media/")) return MEDIA_TTL;
  if (url.pathname === "/sitemap.xml" || url.pathname === "/robots.txt") return META_TTL;
  return PAGE_TTL;
}

/** Pisahkan parameter pelacakan dari URL. */
function splitTracking(url: URL) {
  const clean = new URL(url.href);
  const tracking: [string, string][] = [];
  for (const [name, value] of url.searchParams) {
    if (TRACKING.test(name)) {
      tracking.push([name, value]);
      clean.searchParams.delete(name);
    }
  }
  return { clean, tracking };
}

/** Tempel lagi parameter pelacakan ke Location redirect, tanpa menimpa query milik tujuan. */
function withTracking(res: Response, base: URL, tracking: [string, string][]) {
  const location = res.headers.get("location");
  if (!tracking.length || !location || res.status < 300 || res.status >= 400) return res;
  const target = new URL(location, base);
  for (const [name, value] of tracking) if (!target.searchParams.has(name)) target.searchParams.append(name, value);
  const out = new Response(res.body, res);
  out.headers.set("location", location.startsWith("/") ? target.pathname + target.search + target.hash : target.href);
  return out;
}

/** Kunci = URL bersih (query diurutkan) + hash versi deploy & header navigasi Next.js. */
async function cacheKey(req: Request, clean: URL, version: string) {
  const u = new URL(clean.href);
  u.searchParams.sort();
  const vary = [version, ...VARY.map((h) => req.headers.get(h) ?? "")].join("\n");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(vary)));
  u.searchParams.set("__ibc", [...digest.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join(""));
  return u.href;
}

function remember(key: string, entry: Entry) {
  if (entry.body.byteLength > MEM_MAX_ENTRY_BYTES) return;
  const old = memory.get(key);
  if (old) {
    memBytes -= old.body.byteLength;
    memory.delete(key);
  }
  memory.set(key, entry);
  memBytes += entry.body.byteLength;
  // Buang entri tertua bila melewati batas (Map menyimpan urutan sisip).
  for (const [k, v] of memory) {
    if (memory.size <= MEM_MAX_ENTRIES && memBytes <= MEM_MAX_BYTES) break;
    memory.delete(k);
    memBytes -= v.body.byteLength;
  }
}

// tsconfig memuat lib "dom", yang tidak mengenal caches.default milik Cloudflare.
const edgeCache = () => (caches as unknown as { default: Cache }).default;

function respond(entry: Entry, status: "HIT" | "HIT-EDGE" | "MISS") {
  const headers = new Headers(entry.headers);
  headers.set("x-ib-cache", status);
  return new Response(entry.body, { status: 200, headers });
}

async function fromEdge(key: string): Promise<Entry | null> {
  try {
    const res = await edgeCache().match(key);
    if (!res) return null;
    const expires = Number(res.headers.get("x-ib-expires"));
    if (!expires || expires <= Date.now()) return null;
    const headers = new Headers(res.headers);
    const original = headers.get("x-ib-cc");
    headers.delete("x-ib-expires");
    headers.delete("x-ib-cc");
    if (original) headers.set("cache-control", original);
    else headers.delete("cache-control");
    return { expires, headers: [...headers], body: await res.arrayBuffer() };
  } catch {
    return null;
  }
}

async function toEdge(key: string, entry: Entry, ttl: number) {
  try {
    const headers = new Headers(entry.headers);
    const original = headers.get("cache-control");
    if (original) headers.set("x-ib-cc", original); // dipulihkan saat disajikan ke browser
    headers.set("cache-control", `public, max-age=${ttl}`);
    headers.set("x-ib-expires", String(entry.expires));
    await edgeCache().put(key, new Response(entry.body, { status: 200, headers }));
  } catch {
    // Cache API tidak tersedia (mis. *.workers.dev): cukup lapis memori.
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const ttl = ttlFor(req, url);
    if (ttl === null) return handler.fetch(req, env, ctx);

    const { clean, tracking } = splitTracking(url);
    const key = await cacheKey(req, clean, env.CF_VERSION_METADATA?.id ?? "lokal");
    const now = Date.now();
    const mem = memory.get(key);
    if (mem && mem.expires > now) return respond(mem, "HIT");

    const edge = await fromEdge(key);
    if (edge) {
      remember(key, edge);
      return respond(edge, "HIT-EDGE");
    }

    const forwarded = tracking.length ? new Request(clean.href, req) : req;
    const res: Response = await handler.fetch(forwarded, env, ctx);
    if (res.status !== 200 || res.headers.has("set-cookie")) return withTracking(res, clean, tracking);
    const entry: Entry = { expires: now + ttl * 1000, headers: [...res.headers], body: await res.arrayBuffer() };
    remember(key, entry);
    ctx.waitUntil(toEdge(key, entry, ttl));
    return respond(entry, "MISS");
  },
} satisfies ExportedHandler<CloudflareEnv>;
