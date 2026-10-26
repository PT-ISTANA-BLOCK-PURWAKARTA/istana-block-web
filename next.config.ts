import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import legacyUploads from "./src/data/legacy-uploads.json";

const nextConfig: NextConfig = {
  // Tanpa next/image (semua <img> biasa) dan Workers tidak bisa menjalankan sharp saat runtime.
  // Ukuran responsif: varian webp dibuat saat pengembangan (npm run gambar:varian), dipakai lewat src/lib/img.ts.
  images: { unoptimized: true },
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Garis miring di akhir URL dan alamat lama WordPress ditangani src/middleware.ts
  // (peta di src/data/legacy-redirects.json) supaya cukup SATU kali 301, bukan 308 → 301.
  skipTrailingSlashRedirect: true,
  // Sitemap WordPress lama (masih terdaftar di Search Console) → sitemap baru. Matcher middleware
  // melewatkan path berekstensi, jadi tidak bisa lewat legacy-redirects.json. statusCode 301
  // (bukan permanent: true yang memberi 308); query string ikut terbawa.
  //
  // Gambar WordPress lama (/wp-content/uploads/...): HANYA yang terdaftar di src/data/legacy-uploads.json
  // (gambar berklik di Search Console > Performance > Search type: Image, og:image lama, PDF katalog).
  // Sisanya sengaja dibiarkan 404 (audit P12(c)/MG-05): tanpa pola wildcard, jadi tidak ada regex berat
  // di Worker dan tidak bentrok dengan berkas baru. Tanda khusus path-to-regexp di nama berkas di-escape.
  async redirects() {
    const sitemap = ["/sitemap_index.xml", "/post-sitemap.xml", "/page-sitemap.xml", "/category-sitemap.xml", "/author-sitemap.xml"].map((source) => ({
      source,
      destination: "/sitemap.xml",
      statusCode: 301 as const,
    }));
    const uploads = Object.entries(legacyUploads as Record<string, string>)
      .filter(([from, to]) => from.startsWith("/wp-content/uploads/") && to.startsWith("/"))
      .map(([from, to]) => ({
        source: from.replace(/[():*+?{}\\]/g, "\\$&"),
        destination: to,
        statusCode: 301 as const,
      }));
    return [...sitemap, ...uploads];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      { source: "/internal/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/internal", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/situs/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/akuntansi/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/operasional/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;

// Menyediakan binding D1 & R2 lokal (Miniflare) saat `next dev`.
initOpenNextCloudflareForDev();
