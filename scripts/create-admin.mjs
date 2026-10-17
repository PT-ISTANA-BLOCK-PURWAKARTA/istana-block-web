#!/usr/bin/env node
// Membuat atau mereset akun admin di D1.
// Pemakaian:
//   npm run admin:create -- --email admin@istanablock.com --name "Admin" --password "rahasia-panjang" [--roles keuangan,gudang] [--remote]
// Tanpa --roles: akun baru menjadi pemilik; akun yang sudah ada tidak diubah perannya.
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
const ROLES = ["owner", "web", "keuangan", "operasional", "gudang"];
const roles = get("roles")?.split(",").map((r) => r.trim()).filter(Boolean);
if (roles && (!roles.length || roles.some((r) => !ROLES.includes(r)))) {
  console.error(`Peran tidak dikenal. Pilihan: ${ROLES.join(", ")}`);
  process.exit(1);
}

if (!email || !password) {
  console.error('Pakai: npm run admin:create -- --email EMAIL --name "NAMA" --password "PASSWORD" [--remote]');
  process.exit(1);
}
if (password.length < 10) {
  console.error("Password minimal 10 karakter.");
  process.exit(1);
}

const ITER = 100_000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
const b64 = (u) => Buffer.from(u).toString("base64");
const hash = `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const rolesJson = roles ? q(JSON.stringify(roles)) : null;
const sql =
  `INSERT INTO users (email, name, password_hash${rolesJson ? ", roles" : ""}) VALUES (${q(email)}, ${q(name)}, ${q(hash)}${rolesJson ? `, ${rolesJson}` : ""}) ` +
  `ON CONFLICT(email) DO UPDATE SET name = excluded.name, password_hash = excluded.password_hash${rolesJson ? ", roles = excluded.roles" : ""}, updated_at = unixepoch();`;

// SQL ditulis ke file sementara agar aman dari masalah kutip di Windows/PowerShell.
const dir = mkdtempSync(join(tmpdir(), "ib-admin-"));
const file = join(dir, "admin.sql");
writeFileSync(file, sql);
const wrangler = join(fileURLToPath(new URL("..", import.meta.url)), "node_modules", "wrangler", "bin", "wrangler.js");
const r = spawnSync(process.execPath, [wrangler, "d1", "execute", "DB", remote ? "--remote" : "--local", "--file", file], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (r.status === 0) console.log(`\nAkun ${email} siap dipakai (${remote ? "produksi" : "lokal"})${roles ? ` dengan peran ${roles.join(", ")}` : ""}.`);
process.exit(r.status ?? 1);
