// Tipe binding Cloudflare yang dipakai aplikasi ini.
// Bisa dibuat ulang dengan `npm run cf-typegen` setelah wrangler.jsonc diubah.
interface CloudflareEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  SITE_URL: string;
  AUTH_SECRET: string;
  /** "1" di Worker demo: penanda data contoh + noindex. */
  DEMO_MODE?: string;
  /** Container Google Tag Manager situs publik, mis. "GTM-PXSMDXD8". Kosong = tidak dimuat. */
  GTM_ID?: string;
  /** ID deploy Worker; dipakai worker.ts sebagai bagian kunci cache. */
  CF_VERSION_METADATA?: WorkerVersionMetadata;
  /** Kunci publik VAPID (base64url, titik P-256 tak terkompresi) untuk Web Push. Kosong = push nonaktif. */
  VAPID_PUBLIC_KEY?: string;
  /** Kunci privat VAPID (JWK JSON), secret: `wrangler secret put VAPID_PRIVATE_KEY`. Kosong = push nonaktif. */
  VAPID_PRIVATE_KEY?: string;
}
