#!/usr/bin/env node
/**
 * Deploy hasil build OpenNext (.open-next/) langsung dengan `wrangler deploy`.
 *
 *   node scripts/deploy-worker.mjs                         # Worker produksi (wrangler.jsonc)
 *   node scripts/deploy-worker.mjs -c wrangler.demo.jsonc  # Worker demo
 *
 * Kenapa tidak `opennextjs-cloudflare deploy`: perintah itu selalu menyalakan runtime Workers lokal
 * (getPlatformProxy) untuk membaca variabel, dan di sebagian Windows runtime itu crash
 * ("access violation ... has overflowed its stack"). Langkah tambahan OpenNext saat deploy hanya mengisi
 * incremental cache dan skew protection, dan proyek ini tidak memakai keduanya (open-next.config.ts kosong),
 * jadi hasil deploy-nya sama.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
if (!existsSync(join(ROOT, ".open-next", "worker.js"))) {
  console.error("Build OpenNext belum ada. Jalankan dulu: npx opennextjs-cloudflare build");
  process.exit(1);
}
const onc = readFileSync(join(ROOT, "open-next.config.ts"), "utf8");
if (/incrementalCache|tagCache|skewProtection/.test(onc)) {
  console.error("open-next.config.ts memakai cache/skew protection: deploy harus lewat `npx opennextjs-cloudflare deploy`.");
  process.exit(1);
}
const wrangler = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
// OPEN_NEXT_DEPLOY mencegah wrangler mengoper balik ke `opennextjs-cloudflare deploy`.
const r = spawnSync(process.execPath, [wrangler, "deploy", ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
});
process.exit(r.status ?? 1);
