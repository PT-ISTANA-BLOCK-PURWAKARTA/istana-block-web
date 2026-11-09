/**
 * Apakah `host` (nilai header Host atau URL.host, boleh berisi port) adalah host situs resmi,
 * yaitu hostname SITE_URL atau "www."-nya. Host lain (*.workers.dev, URL preview, Worker demo)
 * tidak boleh masuk indeks Google: lihat src/app/robots.ts dan src/middleware.ts.
 *
 * Gagal-aman: bila SITE_URL kosong/tidak valid atau host tidak diketahui, hasilnya true. Salah
 * konfigurasi tidak boleh membuat situs produksi ter-noindex. Hanya memakai Web API (jalan di Edge).
 */
export function isCanonicalHost(host: string | null | undefined, siteUrl: string | null | undefined): boolean {
  let canonical = "";
  try {
    canonical = new URL(siteUrl ?? "").hostname.toLowerCase();
  } catch {
    return true;
  }
  // Buang port dan titik FQDN di ujung ("situs.com.:443" → "situs.com").
  const h = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!canonical || !h) return true;
  // Apex dan www dianggap sama, juga bila SITE_URL kelak ditulis dengan "www.": salah satunya
  // dialihkan 301 oleh Cloudflare, jangan sampai yang lain malah ter-noindex.
  const base = canonical.replace(/^www\./, "");
  return h === base || h === `www.${base}`;
}

/**
 * Saklar indeks pencarian (var SEARCH_INDEXING di wrangler.jsonc): hanya nilai "on" yang membuka indeks.
 * Selain itu (termasuk kosong) SEMUA host, juga SITE_URL, noindex + robots Disallow + tanpa GTM.
 * Dipakai src/middleware.ts, src/app/robots.ts, src/app/layout.tsx, dan GoogleTagManager.
 */
export function indexingOn(value: string | null | undefined): boolean {
  return value === "on";
}

/** Boleh diindeks = saklar "on" DAN host situs resmi. */
export function isIndexable(host: string | null | undefined, siteUrl: string | null | undefined, indexing: string | null | undefined): boolean {
  return indexingOn(indexing) && isCanonicalHost(host, siteUrl);
}
