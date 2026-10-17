#!/usr/bin/env node
// Membuat atau mereset akun di D1.
// Akun kantor (email & password):
//   npm run admin:create -- --email admin@istanablock.com --name "Admin" --password "rahasia-panjang" [--roles keuangan] [--remote]
//   Tanpa --roles: akun baru menjadi pemilik; akun yang sudah ada tidak diubah perannya.
// Akun lapangan (nomor HP & PIN, hanya aplikasi Operasional):
//   npm run admin:create -- --phone 0812xxxxxxxx --pin <6 angka> --name "Nama" --roles gudang [--driver ID_SOPIR] [--remote]
// Biasanya akun dibuat pemilik di /internal/pengguna; skrip ini untuk akun pertama atau saat lupa password.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const args = process.argv.slice(2);
const get = (k) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = get("email")?.trim().toLowerCase();
const name = get("name") ?? "Admin";
const password = get("password");
const remote = args.includes("--remote");
const ROLES = ["owner", "web", "keuangan", "operasional", "gudang", "sopir"];
const FIELD = ["operasional", "gudang", "sopir"];
const phoneRaw = get("phone");
const pin = get("pin");
const driver = get("driver");
const roles = get("roles")?.split(",").map((r) => r.trim()).filter(Boolean);
if (roles && (!roles.length || roles.some((r) => !ROLES.includes(r)))) {
  console.error(`Peran tidak dikenal. Pilihan: ${ROLES.join(", ")}`);
  process.exit(1);
}

let phone = null;
if (phoneRaw) {
  phone = phoneRaw.replace(/[^\d]/g, "").replace(/^0/, "62").replace(/^8/, "628");
  if (!/^628\d{7,12}$/.test(phone)) {
    console.error("Nomor HP tidak valid. Contoh: 081234567890");
    process.exit(1);
  }
  if (!pin || !/^\d{6}$/.test(pin) || /^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
    console.error("PIN harus 6 angka, bukan angka sama semua atau berurutan.");
    process.exit(1);
  }
  if (!roles || roles.some((r) => !FIELD.includes(r))) {
    console.error(`Akun nomor HP wajib --roles dari: ${FIELD.join(", ")}`);
    process.exit(1);
  }
} else if (!email || !password) {
  console.error('Pakai: npm run admin:create -- --email EMAIL --name "NAMA" --password "PASSWORD" [--remote]');
  process.exit(1);
}
if (!phone && password.length < 10) {
  console.error("Password minimal 10 karakter.");
  process.exit(1);
}

const ITER = 100_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(phone ? pin : password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
const b64 = (u) => Buffer.from(u).toString("base64");
const hash = `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rolesJson = roles ? q(JSON.stringify(roles)) : null;
const sql = phone
  ? `INSERT INTO users (phone, name, pin_hash, roles, driver_id) VALUES (${q(phone)}, ${q(name)}, ${q(hash)}, ${rolesJson}, ${driver ? q(driver) : "NULL"}) ` +
    `ON CONFLICT(phone) DO UPDATE SET name = excluded.name, pin_hash = excluded.pin_hash, roles = excluded.roles, driver_id = excluded.driver_id, updated_at = unixepoch();`
  :
  `INSERT INTO users (email, name, password_hash${rolesJson ? ", roles" : ""}) VALUES (${q(email)}, ${q(name)}, ${q(hash)}${rolesJson ? `, ${rolesJson}` : ""}) ` +
  `ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash${rolesJson ? ", roles = excluded.roles" : ""}, updated_at = unixepoch();`;

// SQL ditulis ke file sementara agar aman dari masalah kutip di Windows/PowerShell.
const dir = mkdtempSync(join(tmpdir(), "ib-admin-"));
const file = join(dir, "admin.sql");
writeFileSync(file, sql);
const wrangler = join(fileURLToPath(new URL("..", import.meta.url)), "node_modules", "wrangler", "bin", "wrangler.js");
const r = spawnSync(process.execPath, [wrangler, "d1", "execute", "DB", remote ? "--remote" : "--local", "--file", file], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (r.status === 0) console.log(`\nAkun ${phone ?? email} siap dipakai (${remote ? "produksi" : "lokal"})${roles ? ` dengan peran ${roles.join(", ")}` : ""}.`);
process.exit(r.status ?? 1);
