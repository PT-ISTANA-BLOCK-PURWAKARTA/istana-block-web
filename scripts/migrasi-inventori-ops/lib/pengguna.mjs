// Pengguna (A.1 users + dutyOfficers, bagian C): cocokkan akun web, buat akun baru, kredensial acak.
// Hash persis scripts/create-admin.mjs / src/lib/password.ts: pbkdf2$100000$<salt b64 16B>$<hash b64 32B>.
import { webcrypto, randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { insert, sec, lit, normalizePhone, normName, readCsv, writeCsv } from "./core.mjs";

const ROLE_MAP = { superadmin: "operasional", admin: "operasional", qc: "qc", mandor: "mandor", satpam: "satpam", driver: "sopir" };
const FIELD = ["operasional", "gudang", "sopir", "qc", "mandor", "satpam"];
const ITER = 100_000;
const PW_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // tanpa 0/O/1/l/I

// sama dengan weakPin di src/lib/roles.ts
function weakPin(pin) {
  if (!/^\d{6}$/.test(pin)) return "PIN harus 6 angka.";
  if (/^(\d)\1{5}$/.test(pin)) return "sama semua";
  if ("0123456789012345".includes(pin) || "9876543210987654".includes(pin)) return "berurutan";
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return "pola berulang";
  return null;
}
function genPin() {
  for (;;) { const p = String(randomInt(0, 1_000_000)).padStart(6, "0"); if (!weakPin(p)) return p; }
}
const genPassword = () => Array.from({ length: 14 }, () => PW_ALPHA[randomInt(0, PW_ALPHA.length)]).join("");

async function hashSecret(secret) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, key, 256);
  const b64 = (u) => Buffer.from(u).toString("base64");
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

function rolesOf(u, active) {
  const roles = [], notes = [];
  const base = ROLE_MAP[u.role];
  if (base) roles.push(base); else notes.push(`peran sumber tak dikenal: ${u.role}`);
  if (active && u.canApproveQc) roles.push("manajer_qc");
  if (u.canSignAsLeader || u.canRatePrice || u.canViewSummary) roles.push("pimpinan");
  if (u.role === "admin" && !u.canCompleteOrders) notes.push("hak melebar: operasional web otomatis boleh selesaikan");
  if (active && u.canViewSandTests && u.role !== "qc") notes.push("canViewSandTests tanpa padanan (hilang)");
  if (u.role === "superadmin") notes.push("superadmin -> operasional (bukan owner); naikkan manual bila perlu");
  return { roles: [...new Set(roles)], notes };
}

export async function migrate(ctx) {
  const users = ctx.rows("SELECT * FROM users ORDER BY id");
  const officers = ctx.rows("SELECT * FROM dutyOfficers ORDER BY id");
  const shared = new Set(officers.filter((o) => o.isActive).map((o) => o.accountUserId));

  const mapFile = path.join(ctx.planDir, "user-map.json");
  const prevMap = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, "utf8")) : {};
  const prevUsers = prevMap.users ?? {}, prevOfficers = prevMap.officers ?? {};
  const credFile = path.join(ctx.secretDir, "akun-baru.csv");
  const oldCreds = new Map(readCsv(credFile).map((r) => [r.id_sumber, r]));

  const web = ctx.webRows("SELECT id, email, name, phone, roles, signature_key FROM users");
  const webById = new Map(web.map((w) => [w.id, w]));
  const byEmail = new Map(), byPhone = new Map();
  for (const w of web) {
    if (w.email) byEmail.set(String(w.email).trim().toLowerCase(), w);
    const p = normalizePhone(w.phone) ?? w.phone;
    if (p) byPhone.set(p, w);
  }
  const usedEmail = new Set(byEmail.keys()), usedPhone = new Set(byPhone.keys());
  let nextId = Math.max(0, ...web.map((w) => w.id), ...Object.values(prevUsers).map((x) => x.id), ...Object.values(prevOfficers).map((x) => x.id)) + 1;

  const newMap = { users: {}, officers: {} };
  const credRows = new Map(oldCreds); // id_sumber -> baris (dipertahankan antar-proses)
  let nNew = 0, nOff = 0;

  for (const u of users) {
    const active = !!u.isActive, isShared = shared.has(u.id);
    const { roles, notes } = rolesOf(u, active);
    const email = String(u.email ?? "").trim().toLowerCase() || null;
    const phone = normalizePhone(u.phone);
    if (u.phone && !phone) notes.push(`HP tidak valid: ${u.phone}`);
    let prev = prevUsers[u.id];
    // user-map basi (snapshot lain): entri 'cocok' tanpa akun web, atau 'baru' yang id-nya diambil pengguna lain -> abaikan
    if (prev && (prev.hasil === "cocok" ? !webById.has(prev.id) : webById.has(prev.id) && webById.get(prev.id).name !== u.name)) {
      ctx.warn(`user-map.json basi untuk pengguna sumber #${u.id}: dicocokkan ulang`);
      prev = undefined;
    }
    let hasil = "baru", webRow = null, id, kunci = "", newEmail = email, newPhone = phone;

    if (prev) {
      id = prev.id; hasil = prev.hasil; kunci = "user-map";
      if (hasil === "cocok") webRow = webById.get(id) ?? null;
      else { newEmail = prev.email ?? null; newPhone = prev.phone ?? null; }
    } else if (!isShared) {
      const a = email ? byEmail.get(email) : null, b = phone ? byPhone.get(phone) : null;
      if (a && b && a.id !== b.id) {
        hasil = "ambigu"; kunci = "email+hp";
        notes.push(`email cocok akun web #${a.id}, HP cocok #${b.id}: akun baru tanpa email/HP`);
        newEmail = newPhone = null;
      } else if (a || b) { webRow = a ?? b; hasil = "cocok"; kunci = a ? "email" : "hp"; id = webRow.id; }
    }

    if (webRow) {
      let cur = [];
      try { cur = JSON.parse(webRow.roles); } catch { /* biarkan */ }
      const sama = cur.length === roles.length && roles.every((r) => cur.includes(r));
      if (!sama) notes.push(`peran web ${JSON.stringify(cur)} != usulan ${JSON.stringify(roles)} (web tidak diubah)`);
      if (u.signatureUrl) {
        if (!webRow.signature_key) {
          const key = ctx.photo(u.signatureUrl, "ttd", { ref: `users/${u.id}` });
          if (key) ctx.emit("01-users", `UPDATE users SET signature_key = ${lit(key)} WHERE id = ${webRow.id} AND (signature_key IS NULL OR signature_key = '');`);
        } else notes.push("TTD web sudah ada; TTD lama tidak dipakai");
      }
      ctx.userMap.set(u.id, webRow.id);
      newMap.users[u.id] = { id: webRow.id, hasil };
      ctx.report("cocok-pengguna", { id_sumber: u.id, nama: u.name, kunci: kunci + (email || phone ? ` ${kunci === "hp" ? phone : email}` : ""), hasil, id_target: webRow.id, peran_web: webRow.roles, peran_usulan: JSON.stringify(roles), catatan: notes.join("; ") });
      continue;
    }

    // ---- akun baru ----
    if (!prev) {
      id = nextId++;
      if (isShared) { newEmail = newPhone = null; notes.push("akun bersama (Duty Phone): tanpa kredensial, petugas jadi pengguna terpisah"); }
      else {
        if (newEmail && usedEmail.has(newEmail)) { notes.push(`email ${newEmail} sudah dipakai akun lain: dikosongkan`); newEmail = null; hasil = "ambigu"; }
        if (newPhone && usedPhone.has(newPhone)) { notes.push(`HP ${newPhone} sudah dipakai akun lain: dikosongkan`); newPhone = null; hasil = "ambigu"; }
      }
      if (newEmail) usedEmail.add(newEmail);
      if (newPhone) usedPhone.add(newPhone);
    }
    ctx.userMap.set(u.id, id);
    newMap.users[u.id] = { id, hasil, email: newEmail, phone: newPhone };
    nNew++;
    ctx.newUsers.push({ id, name: u.name, email: newEmail, phone: newPhone });

    // kredensial
    const hasField = roles.some((r) => FIELD.includes(r)), hasOffice = roles.some((r) => !FIELD.includes(r));
    const eligible = active && !isShared && roles.length > 0;
    const wantPin = eligible && hasField && !!newPhone;
    const wantPw = eligible && !!newEmail && (hasOffice || !wantPin);
    let passwordHash = null, pinHash = null, pin = "", password = "";
    if (ctx.final && (wantPin || wantPw)) {
      const old = oldCreds.get(`user-${u.id}`);
      if (wantPin) { pin = old?.pin || genPin(); pinHash = await hashSecret(pin); }
      if (wantPw) { password = old?.password || genPassword(); passwordHash = await hashSecret(password); }
      credRows.set(`user-${u.id}`, { id_sumber: `user-${u.id}`, id_web: id, nama: u.name, peran: roles.join("|"), email: newEmail ?? "", hp: newPhone ?? "", pin, password, status: "baru" });
    }
    const alasan = [];
    if (!active) alasan.push("akun sumber nonaktif");
    if (isShared) alasan.push("akun bersama (Duty Phone)");
    if (active && !isShared && !roles.length) alasan.push("tanpa peran");
    if (eligible && !wantPin && !wantPw) alasan.push(hasField && !newEmail && !newPhone ? "tanpa email/HP yang sah" : hasOffice ? "peran kantor butuh email" : "tanpa HP/email sah");
    if (eligible && hasOffice && !wantPw) alasan.push("peran kantor (manajer_qc/pimpinan) hanya efektif lewat email+password: butuh email");
    if (alasan.length) ctx.report("perlu-kredensial", { id_web: id, nama: u.name, peran: roles.join("|"), email: newEmail ?? "", hp: newPhone ?? "", jenis: "pengguna", alasan: [...new Set(alasan)].join("; ") });

    let sig = null;
    if (u.signatureUrl) sig = ctx.photo(u.signatureUrl, "ttd", { ref: `users/${u.id}` });
    ctx.emit("01-users", insert("users", { id, email: newEmail, name: u.name, password_hash: passwordHash, phone: newPhone, pin_hash: pinHash, roles: JSON.stringify(roles), created_at: sec(u.createdAt), updated_at: sec(u.updatedAt) ?? sec(u.createdAt), signature_key: sig }));
    ctx.report("cocok-pengguna", { id_sumber: u.id, nama: u.name, kunci: kunci || (email ? `email ${email}` : phone ? `hp ${phone}` : "-"), hasil, id_target: id, peran_web: "", peran_usulan: JSON.stringify(roles), catatan: notes.join("; ") });
  }
  ctx.count("users", nNew);

  // ---- petugas jaga: satu akun per petugas, tanpa kredensial ----
  const roleOfAccount = new Map(users.map((u) => [u.id, rolesOf(u, !!u.isActive).roles.filter((r) => FIELD.includes(r))]));
  for (const o of officers) {
    const nm = normName(o.name);
    const prev = prevOfficers[o.id];
    if (ctx.officerMap.has(nm)) {
      ctx.report("cocok-pengguna", { id_sumber: `petugas-${o.id}`, nama: o.name, kunci: "nama", hasil: "cocok", id_target: ctx.officerMap.get(nm), peran_web: "", peran_usulan: "", catatan: "nama petugas sama dengan petugas lain: digabung" });
      newMap.officers[o.id] = { id: ctx.officerMap.get(nm) };
      continue;
    }
    const id = prev?.id ?? nextId++;
    const roles = roleOfAccount.get(o.accountUserId) ?? [];
    ctx.officerMap.set(nm, id);
    newMap.officers[o.id] = { id };
    nOff++;
    ctx.newUsers.push({ id, name: o.name, email: null, phone: null });
    ctx.emit("01-users", insert("users", { id, name: o.name, roles: JSON.stringify(roles), created_at: sec(o.createdAt), updated_at: sec(o.createdAt) }));
    ctx.report("cocok-pengguna", { id_sumber: `petugas-${o.id}`, nama: o.name, kunci: "petugas jaga", hasil: "baru", id_target: id, peran_web: "", peran_usulan: JSON.stringify(roles), catatan: o.isActive ? "" : "petugas nonaktif" });
    ctx.report("perlu-kredensial", { id_web: id, nama: o.name, peran: roles.join("|"), email: "", hp: "", jenis: "petugas jaga", alasan: "pemilik mengisi HP+PIN lewat /internal/pengguna" });
  }
  ctx.count("dutyOfficers", nOff);

  if (ctx.final) {
    fs.mkdirSync(ctx.planDir, { recursive: true });
    fs.writeFileSync(mapFile, JSON.stringify(newMap, null, 2), "utf8");
    if (credRows.size) writeCsv(credFile, [...credRows.values()]);
  }
}
