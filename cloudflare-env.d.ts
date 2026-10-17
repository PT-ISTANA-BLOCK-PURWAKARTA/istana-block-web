// Tipe binding Cloudflare yang dipakai aplikasi ini.
// Bisa dibuat ulang dengan `npm run cf-typegen` setelah wrangler.jsonc diubah.
interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  SITE_URL: string;
  AUTH_SECRET: string;
  /** "1" di Worker demo: penanda data contoh + noindex. */
  DEMO_MODE?: string;
}
