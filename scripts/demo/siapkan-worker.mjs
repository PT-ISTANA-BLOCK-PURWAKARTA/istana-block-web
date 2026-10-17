#!/usr/bin/env node
/**
 * Membuat database D1 dan bucket R2 untuk Worker demo (sekali di awal). Aman dijalankan ulang:
 * yang sudah ada dilewati. Konfigurasi produksi (wrangler.jsonc) tidak disentuh.
 *
 *   npm run demo:worker:siapkan
 *
 * Nama diambil dari wrangler.demo.jsonc. wrangler.demo.jsonc sengaja tidak berisi database_id:
 * Wrangler mencari database dari namanya, jadi tidak perlu menyalin ID.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CONFIG = "wrangler.demo.jsonc";
const text = readFileSync(new URL(`../../${CONFIG}`, import.meta.url), "utf8");
const DB = text.match(/"database_name":\s*"([^"]+)"/)?.[1];
const BUCKET = text.match(/"bucket_name":\s*"([^"]+)"/)?.[1];
if (!DB || !BUCKET) {
  console.error(`database_name atau bucket_name tidak ditemukan di ${CONFIG}.`);
  process.exit(1);
}

const isWin = process.platform === "win32";
function wrangler(args, { show = false } = {}) {
  const r = spawnSync(isWin ? "npx.cmd" : "npx", ["wrangler", ...args], { encoding: "utf8", shell: isWin, stdio: show ? "inherit" : "pipe" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const who = wrangler(["whoami"]);
if (!who.ok || /not authenticated|You are not/i.test(who.out)) {
  console.error("Belum login ke Cloudflare. Jalankan dulu: npx wrangler login");
  process.exit(1);
}

// Database D1
const list = wrangler(["d1", "list", "--json"]);
let dbs = [];
try {
  dbs = JSON.parse(list.out.slice(list.out.indexOf("[")));
} catch {
  console.error(`Gagal membaca daftar database D1:\n${list.out}`);
  process.exit(1);
}
if (dbs.some((d) => d.name === DB)) {
  console.log(`✓ Database D1 "${DB}" sudah ada.`);
} else {
  console.log(`Membuat database D1 "${DB}" (Asia-Pasifik)…`);
  const r = wrangler(["d1", "create", DB, "--location", "apac", "--update-config=false", "-c", CONFIG], { show: true });
  if (!r.ok) process.exit(1);
}

// Bucket R2
if (wrangler(["r2", "bucket", "info", BUCKET]).ok) {
  console.log(`✓ Bucket R2 "${BUCKET}" sudah ada.`);
} else {
  console.log(`Membuat bucket R2 "${BUCKET}" (Asia-Pasifik)…`);
  const r = wrangler(["r2", "bucket", "create", BUCKET, "--location", "apac", "--update-config=false", "-c", CONFIG], { show: true });
  if (!r.ok) {
    console.error("Bila pesan galat menyebut R2 belum aktif: aktifkan R2 di dashboard (Storage & databases → R2), lalu ulangi.");
    process.exit(1);
  }
}

console.log(`\nSiap. Langkah berikutnya:
  npx wrangler secret put AUTH_SECRET -c ${CONFIG}
  npm run demo:worker:migrate
  npm run demo:worker:seed`);
