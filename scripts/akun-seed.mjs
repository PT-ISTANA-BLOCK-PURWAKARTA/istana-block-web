#!/usr/bin/env node
/**
 * Membuat semua akun login sekaligus dari file daftar akun LOKAL (tidak masuk repo, karena berisi password).
 *
 *   npm run akun:demo                      # akun-demo.local.json      → Worker demo (remote, wrangler.demo.jsonc)
 *   npm run akun:produksi -- --yakin       # akun-produksi.local.json  → D1 produksi (remote)
 *   node scripts/akun-seed.mjs demo --local   # uji ke D1 lokal
 *
 * Contoh isi file: seed/akun-demo.contoh.json dan seed/akun-produksi.contoh.json.
 * Salin menjadi akun-demo.local.json / akun-produksi.local.json di folder repo, lalu isi password, email, dan nomor HP.
 *
 * Akun yang sudah ada:
 *   - demo     : ditimpa (nama, peran, password/PIN kembali ke isi file), cocok setelah data demo dimuat ulang.
 *   - produksi : dilewati, supaya password yang sudah diganti pemiliknya tidak kembali ke bawaan.
 *                Tambahkan --timpa untuk mengatur ulang semuanya ke isi file.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const args = process.argv.slice(2);
const env = args[0];
if (!["demo", "produksi"].includes(env)) {
  console.error("Pakai: node scripts/akun-seed.mjs demo|produksi [--local] [--timpa] [--yakin]");
  process.exit(1);
}
const local = args.includes("--local");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FILE = join(ROOT, `akun-${env}.local.json`);
if (!existsSync(FILE)) {
  console.log(`Lewati pembuatan akun: ${FILE} belum ada. Salin dari seed/akun-${env}.contoh.json lalu isi.`);
  process.exit(env === "demo" ? 0 : 1);
}
if (env === "produksi" && !local && !args.includes("--yakin")) {
  console.error("Ini akan menulis akun ke database PRODUKSI. Ulangi dengan --yakin bila memang itu maksudnya.");
  process.exit(1);
}
const overwrite = env === "demo" || args.includes("--timpa");

const cfg = JSON.parse(readFileSync(FILE, "utf8"));
const ROLES = ["owner", "web", "keuangan", "operasional", "gudang", "sopir"];
const FIELD = ["operasional", "gudang", "sopir"];
const weak = (p) => /^(\d)\1{5}$/.test(p) || "0123456789012345".includes(p) || "9876543210987654".includes(p) || /^(\d\d)\1\1$/.test(p) || /^(\d{3})\1$/.test(p);
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

const ITER = 100_000;
async function hashOf(secret) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  const b64 = (u) => Buffer.from(u).toString("base64");
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const sql = [];
const rows = [];
let weakUsed = false;
for (const a of cfg.akun ?? []) {
  const roles = a.peran ?? [];
  if (!roles.length || roles.some((r) => !ROLES.includes(r))) fail(`Peran tidak dikenal untuk ${a.nama}: ${roles.join(", ")}. Pilihan: ${ROLES.join(", ")}`);
  const conflict = overwrite ? "DO UPDATE SET name = excluded.name, roles = excluded.roles, %s, updated_at = unixepoch()" : "DO NOTHING";
  if (a.hp) {
    const phone = String(a.hp).replace(/[^\d]/g, "").replace(/^0/, "62").replace(/^8/, "628");
    if (!/^628\d{7,12}$/.test(phone) || /ISI/i.test(a.hp)) fail(`Nomor HP belum diisi/tidak valid untuk ${a.nama}: ${a.hp}`);
    if (roles.some((r) => !FIELD.includes(r))) fail(`Akun nomor HP (${a.nama}) hanya boleh peran ${FIELD.join(", ")}.`);
    const pin = String(a.pin ?? cfg.pin_bawaan ?? "");
    if (!/^\d{6}$/.test(pin)) fail(`PIN harus 6 angka (${a.nama}).`);
    if (weak(pin)) {
      if (!cfg.izinkan_pin_mudah) fail(`PIN ${pin} terlalu mudah ditebak (${a.nama}). Ganti, atau set "izinkan_pin_mudah": true di ${FILE}.`);
      weakUsed = true;
    }
    const driver = a.sopir ? q(a.sopir) : "NULL";
    sql.push(
      `INSERT INTO users (phone, name, pin_hash, roles, driver_id) VALUES (${q(phone)}, ${q(a.nama)}, ${q(await hashOf(pin))}, ${q(JSON.stringify(roles))}, ${driver}) ON CONFLICT(phone) ` +
        conflict.replace("%s", "pin_hash = excluded.pin_hash, driver_id = excluded.driver_id") + ";",
    );
    rows.push([a.nama, a.hp, `PIN ${pin}`, roles.join(", ")]);
  } else {
    const email = String(a.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+$/.test(email) || /ISI/i.test(email)) fail(`Email belum diisi/tidak valid untuk ${a.nama}: ${a.email}`);
    const password = String(a.password ?? cfg.password_bawaan ?? "");
    if (password.length < 10) fail(`Password minimal 10 karakter (${a.nama}).`);
    sql.push(
      `INSERT INTO users (email, name, password_hash, roles) VALUES (${q(email)}, ${q(a.nama)}, ${q(await hashOf(password))}, ${q(JSON.stringify(roles))}) ON CONFLICT(email) ` +
        conflict.replace("%s", "password_hash = excluded.password_hash") + ";",
    );
    rows.push([a.nama, email, "password", roles.join(", ")]);
  }
}
if (!sql.length) fail(`Tidak ada akun di ${FILE}.`);

const dir = mkdtempSync(join(tmpdir(), "ib-akun-"));
const file = join(dir, "akun.sql");
writeFileSync(file, sql.join("\n"));
const wrangler = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const target = [local ? "--local" : "--remote", ...(env === "demo" ? ["--config", "wrangler.demo.jsonc"] : [])];
const r = spawnSync(process.execPath, [wrangler, "d1", "execute", "DB", ...target, "--file", file], { cwd: ROOT, stdio: ["ignore", "ignore", "inherit"] });
rmSync(dir, { recursive: true, force: true });
if (r.status !== 0) fail("Gagal menulis akun ke database.");

console.log(`\nAkun ${env} (${local ? "lokal" : "remote"}, ${overwrite ? "akun lama ditimpa" : "akun lama dilewati"}):`);
for (const [n, login, secret, roles] of rows) console.log(`  ${n.padEnd(30)} ${login.padEnd(30)} ${secret.padEnd(10)} ${roles}`);
if (weakUsed) console.log(`\nPerhatian: PIN bawaan mudah ditebak. Minta setiap orang menggantinya di Akun saya → Ganti PIN.`);
