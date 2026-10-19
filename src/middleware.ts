import { NextResponse, type NextRequest } from "next/server";
import legacyRedirects from "@/data/legacy-redirects.json";
import { isCanonicalHost } from "@/lib/host";
import { SESSION_COOKIE } from "@/lib/session";

// Berjalan di Edge runtime: hanya Web API (URL, Map, Response), tanpa modul Node.

/** Kunci pencarian: diawali "/", tanpa "/" di akhir, huruf kecil, sudah di-decode. */
function lookupKey(p: string) {
  let s = p.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      /* biarkan apa adanya */
    }
  }
  if (!s.startsWith("/")) s = `/${s}`;
  if (s.length > 1) s = s.replace(/\/+$/, "") || "/";
  try {
    s = decodeURIComponent(s);
  } catch {
    /* URL dengan % tidak valid: pakai versi mentah */
  }
  return s.toLowerCase();
}

// Peta alamat lama → alamat baru ("410" = sengaja dihapus). Dibaca sekali saat worker mulai.
const LEGACY = new Map<string, string>();
for (const [from, to] of Object.entries(legacyRedirects as Record<string, string>)) {
  LEGACY.set(lookupKey(from), String(to).trim());
}

const GONE_HTML = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Halaman sudah tidak tersedia | Istana Block Purwakarta</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f1f1ee;color:#14213d;font:16px/1.6 system-ui,sans-serif;text-align:center}
main{max-width:480px}h1{color:#0e2a6b;font-size:28px;line-height:1.2;margin:0 0 12px}p{margin:0 0 24px;color:#4b5568}
a{display:inline-block;background:#d63f12;color:#fff;padding:14px 26px;border-radius:999px;font-weight:600;text-decoration:none}a:hover{background:#b8350e}</style></head>
<body><main><h1>Halaman ini sudah tidak tersedia</h1><p>Konten di alamat ini telah dihapus secara permanen. Silakan lihat produk dan daftar harga terbaru kami.</p><a href="/produk">Lihat produk</a></main></body></html>`;

function gone() {
  return new NextResponse(GONE_HTML, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });
}

const PANELS = [
  { base: "/situs", login: "/situs/masuk" },
  { base: "/akuntansi", login: "/akuntansi/masuk" },
  { base: "/operasional", login: "/operasional/masuk" },
  { base: "/internal/pengguna", login: "/internal" },
];

function oldPanelPath(path: string) {
  if (path === "/admin" || path === "/admin/login") return "/internal";
  if (path === "/admin/pengguna") return "/internal/pengguna";
  if (path.startsWith("/admin/")) return `/situs/${path.slice(7)}`;
  if (path === "/keuangan" || path.startsWith("/keuangan/")) return `/akuntansi${path.slice(9)}`;
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // (a) "/produk/" → "/produk" (kecuali beranda).
  const path = pathname !== "/" && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") || "/" : pathname;

  // (b) Alamat lama WordPress.
  const target = LEGACY.get(lookupKey(path));
  if (target === "410") return gone(); // (c) sengaja dihapus
  if (target) {
    const url = new URL(target, req.url);
    // Pertahankan query string asli (utm_*, dll.) tanpa menimpa query milik tujuan.
    for (const [k, v] of req.nextUrl.searchParams) if (!url.searchParams.has(k)) url.searchParams.append(k, v);
    // Abaikan entri yang menunjuk ke dirinya sendiri agar tidak terjadi loop.
    const self = url.origin === req.nextUrl.origin && lookupKey(url.pathname) === lookupKey(path);
    if (!self) return NextResponse.redirect(url, 301);
  }

  // (d) Hanya garis miring di akhir yang dibuang → satu kali 301.
  if (path !== pathname) {
    // Pakai URL biasa: NextURL menambahkan lagi "/" di akhir bila skipTrailingSlashRedirect aktif.
    const url = new URL(req.url);
    url.pathname = path;
    return NextResponse.redirect(url, 301);
  }

  // (e) Alamat panel lama: /admin → halaman pilih aplikasi, /admin/… → /situs/…, /keuangan/… → /akuntansi/….
  const old = oldPanelPath(path);
  if (old) {
    const url = req.nextUrl.clone();
    url.pathname = old;
    return NextResponse.redirect(url, 301);
  }

  // (f) Aplikasi internal: hanya pengalihan cepat ke halaman masuk aplikasi itu. Pemeriksaan sesi
  // dan peran yang sebenarnya dilakukan di setiap halaman dan server action (requireModule/requirePerm).
  const app = PANELS.find((p) => path === p.base || path.startsWith(`${p.base}/`));
  if (app && path !== app.login && !req.cookies.get(SESSION_COOKIE)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = app.login;
    url.search = path === app.base ? "" : `?next=${encodeURIComponent(path + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  // (g) Lanjut seperti biasa. Worker demo dan host selain SITE_URL (staging *.workers.dev, URL preview):
  // semua halaman noindex, supaya salinan situs tidak bersaing dengan domain resmi. Redirect 301 di atas
  // sengaja tidak diberi header ini. Host dibaca dari URL request, bukan header x-forwarded-host yang bisa
  // dipalsukan, dan cache worker.ts memakai host di kunci URL, jadi header ini tidak bocor ke domain resmi.
  const res = NextResponse.next();
  if (process.env.DEMO_MODE === "1" || !isCanonicalHost(req.nextUrl.host, process.env.SITE_URL)) {
    res.headers.set("x-robots-tag", "noindex, nofollow");
  }
  return res;
}

// Semua path kecuali aset Next.js, media R2, video, gambar statis, dan file berekstensi
// (mis. /sitemap.xml, /robots.txt, /icon.svg).
export const config = {
  matcher: ["/((?!_next/|media(?:/|$)|reel(?:/|$)|reel-src(?:/|$)|img(?:/|$)|brand(?:/|$)|.*\\.[^/]+$).*)"],
};
