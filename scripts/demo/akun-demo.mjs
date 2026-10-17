#!/usr/bin/env node
/**
 * Membuat akun untuk presentasi di Worker demo (atau lokal): satu akun per peran, termasuk akun lapangan
 * (nomor HP + PIN) untuk kepala gudang dan keempat sopir data contoh.
 *
 *   node scripts/demo/akun-demo.mjs --password "sandi-demo-panjang" --remote --config wrangler.demo.jsonc
 *   node scripts/demo/akun-demo.mjs --password "sandi-demo-panjang"            # database lokal
 *
 * PIN dibuat acak setiap kali dijalankan dan dicetak di akhir. Simpan daftarnya untuk presentasi.
 * Nomor HP memakai pola 0811 0000 xxxx (bukan nomor sungguhan).
 */
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const get = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const password = get("password");
if (!password || password.length < 10) {
  console.error('Pakai: node scripts/demo/akun-demo.mjs --password "minimal-10-karakter" [--remote --config wrangler.demo.jsonc]');
  process.exit(1);
}
const pass = [...(args.includes("--remote") ? ["--remote"] : []), ...(get("config") ? ["--config", get("config")] : [])];
const script = fileURLToPath(new URL("../create-admin.mjs", import.meta.url));

/** PIN 6 angka yang tidak berurutan / tidak berulang. */
function pin() {
  for (;;) {
    const p = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (/^(\d)\1{5}$/.test(p) || "0123456789".includes(p) || "9876543210".includes(p) || /^(\d\d)\1\1$/.test(p) || /^(\d{3})\1$/.test(p)) continue;
    return p;
  }
}

const OFFICE = [
  ["pemilik@demo.istanablock", "Pemilik (demo)", "owner"],
  ["situs@demo.istanablock", "Admin Situs (demo)", "web"],
  ["keuangan@demo.istanablock", "Rina — Keuangan (demo)", "keuangan"],
  ["operasional@demo.istanablock", "Dimas — Operasional (demo)", "operasional"],
];
const FIELD = [
  ["0811 0000 9001", "Yayan — Kepala gudang (demo)", "gudang", null],
  ["0811 0000 4101", "Asep Saepudin", "sopir", "demo-dr-d1"],
  ["0811 0000 4102", "Ujang Kurnia", "sopir", "demo-dr-d2"],
  ["0811 0000 4103", "Dede Rahmat", "sopir", "demo-dr-d3"],
  ["0811 0000 4104", "Cecep Hidayat", "sopir", "demo-dr-d4"],
];

const run = (a) => {
  const r = spawnSync(process.execPath, [script, ...a, ...pass], { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, ADMIN_QUIET: "1" } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
const rows = [];
for (const [email, name, role] of OFFICE) {
  run(["--email", email, "--name", name, "--password", password, "--roles", role]);
  rows.push([name, email, "password di atas"]);
}
for (const [phone, name, role, driver] of FIELD) {
  const p = pin();
  run(["--phone", phone, "--pin", p, "--name", name, "--roles", role, ...(driver ? ["--driver", driver] : [])]);
  rows.push([name, phone, `PIN ${p}`]);
}
console.log("\nAkun demo:");
for (const [name, login, secret] of rows) console.log(`  ${name.padEnd(30)} ${login.padEnd(30)} ${secret}`);
console.log("\nKantor masuk dengan email + password; gudang & sopir masuk di /operasional/masuk dengan nomor HP + PIN.");
