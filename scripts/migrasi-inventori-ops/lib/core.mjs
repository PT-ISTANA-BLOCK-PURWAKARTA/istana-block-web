// Inti skrip migrasi inventori-ops -> istana-block-web: literal SQL, konteks (muat backup + snapshot),
// penampung keluaran/laporan, peta id (pengguna, kontak, barang, sopir, kendaraan) dan pendaftar foto.
// Hanya modul bawaan Node. Spesifikasi: docs/arsip/migrasi-data-inventori-ops.md
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// ---------- literal & pembantu ----------
export function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return String(v);
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return `'${t.replace(/'/g, "''")}'`;
}

/** INSERT OR IGNORE dari objek kolom snake_case. Kunci bernilai undefined dilewati (default kolom berlaku). */
export function insert(table, row) {
  const ks = Object.keys(row).filter((k) => row[k] !== undefined);
  return `INSERT OR IGNORE INTO "${table}" (${ks.join(",")}) VALUES (${ks.map((k) => lit(row[k])).join(",")});`;
}

export const sec = (ms) => (ms === null || ms === undefined || ms === "" || !Number.isFinite(Number(ms)) ? null : Math.floor(Number(ms) / 1000));
export const wibDate = (ms) => (sec(ms) === null ? null : new Date(sec(ms) * 1000 + 7 * 3600e3).toISOString().slice(0, 10));
export const iid = (table, id) => `iops-${table}-${id}`;
export const sha1 = (s) => createHash("sha1").update(s).digest("hex");

/** Sama dengan normalizePhone di src/lib/roles.ts. */
export function normalizePhone(v) {
  let d = String(v ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return /^628\d{7,12}$/.test(d) ? d : null;
}

/** Nama untuk pencocokan: huruf kecil, trim, spasi tunggal. */
export const normName = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows) {
  const head = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!head.includes(k)) head.push(k);
  return [head.join(","), ...rows.map((r) => head.map((k) => csvCell(r[k])).join(","))].join("\r\n") + "\r\n";
}
export function writeCsv(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "﻿" + toCsv(rows), "utf8"); // BOM agar Excel membaca UTF-8
}
/** Baca CSV sederhana (kutip ganda didukung) menjadi array objek; berkas tak ada -> []. */
export function readCsv(file) {
  if (!fs.existsSync(file)) return [];
  const t = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const recs = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); cell = ""; recs.push(row); row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); recs.push(row); }
  const [head, ...body] = recs.filter((r) => r.some((x) => x !== ""));
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""])));
}

const CT = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif", pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
const NOT_MIGRATED = {
  sessions: "sesi lama tak berlaku", pushSubscriptions: "langganan push terikat origin lama", deliveryNotifications: "notifikasi efemeral",
  qualityControlNotifications: "notifikasi efemeral", driverLocations: "titik GPS tidak dimigrasi", activityLogs: "log audit tetap di backup",
  backupRuns: "riwayat backup app lama", d1_migrations: "metadata alat",
};

function loadSql(file, label) {
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
  try {
    db.exec(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(`Gagal memuat ${label} (${file}): ${e.message}`);
  }
  return db;
}

// ---------- konteks ----------
export class Ctx {
  /** opts: { backupDir, snapshot, outDir, final, open, cutoverSec } */
  constructor(opts) {
    this.opts = opts;
    this.final = !!opts.final;
    this.open = opts.open ?? "stop";
    this.backupDir = path.resolve(opts.backupDir);
    this.outDir = path.resolve(opts.outDir);
    this.secretDir = path.resolve(this.outDir, "..", "rahasia");
    const dbDir = path.join(this.backupDir, "database");
    const sqls = fs.existsSync(dbDir) ? fs.readdirSync(dbDir).filter((f) => /^backup-.*\.sql$/.test(f)).sort() : [];
    if (!sqls.length) throw new Error(`Tidak ada database/backup-*.sql di ${this.backupDir}`);
    this.backupFile = path.join(dbDir, sqls[sqls.length - 1]);
    // waktu cutover: --cutover, kalau tidak ada = waktu backup dari nama berkas (WIB) agar keluaran deterministik
    const bm = /backup-(\d{4})-(\d\d)-(\d\d)_(\d\d)(\d\d)/.exec(sqls[sqls.length - 1]);
    this.cutoverSec = opts.cutoverSec ?? (bm ? Math.floor(Date.UTC(+bm[1], +bm[2] - 1, +bm[3], +bm[4] - 7, +bm[5]) / 1000) : Math.floor(fs.statSync(this.backupFile).mtimeMs / 1000));
    this.src = loadSql(this.backupFile, "backup");
    this.web = loadSql(path.resolve(opts.snapshot), "snapshot web");
    this.files = new Map(); // nama dasar -> pernyataan[]
    this.reports = new Map(); // nama -> baris[]
    this.counts = {}; // tabel sumber -> jumlah baris target
    this.targetCounts = {}; // tabel target -> jumlah INSERT yang di-emit
    this.warnings = [];
    this.userMap = new Map(); // id sumber -> id pengguna web
    this.officerMap = new Map(); // nama petugas ternormalisasi -> id pengguna web
    this.contactMap = new Map();
    this.driverMap = new Map();
    this.vehicleMap = new Map();
    this.itemCache = new Map();
    this.skipped = new Set();
    this.newUsers = []; // pengguna yang dibuat migrasi {id,name,email,phone}: bahan verifikasi 08
    this.manifest = new Map(); // key target -> { src, key, contentType, name? }
    this.requested = new Set(); // path relatif di foto/ yang diminta
    this.planDir = path.join(this.outDir, "plan");
    this.alias = new Map(); // nama sumber ternormalisasi -> id/nama item web
    for (const r of readCsv(path.join(this.planDir, "alias-barang.csv"))) {
      const a = normName(r.nama_sumber ?? r.nama ?? ""), b = String(r.item_web ?? r.item ?? "").trim();
      if (a && b) this.alias.set(a, b);
    }
  }

  rows(sql, ...p) { return this.src.prepare(sql).all(...p); }
  webRows(sql, ...p) { return this.web.prepare(sql).all(...p); }
  warn(msg) { this.warnings.push(msg); console.warn(`PERINGATAN: ${msg}`); }

  emit(fileName, stmt) {
    const s = String(stmt).trim();
    if (!s) return;
    const out = s.endsWith(";") ? s : `${s};`;
    if (Buffer.byteLength(out) > 90_000) this.warn(`pernyataan >90KB di ${fileName} (${Buffer.byteLength(out)} byte): ${out.slice(0, 80)}...`);
    if (!this.files.has(fileName)) this.files.set(fileName, []);
    this.files.get(fileName).push(out);
    const m = /^INSERT OR IGNORE INTO "([^"]+)"/.exec(out);
    if (m) this.targetCounts[m[1]] = (this.targetCounts[m[1]] ?? 0) + 1;
  }

  report(name, row) {
    if (!this.reports.has(name)) this.reports.set(name, []);
    this.reports.get(name).push(row);
  }

  count(srcTable, n = 1) { this.counts[srcTable] = (this.counts[srcTable] ?? 0) + n; }

  // ---- peta id ----
  user(srcId) {
    if (srcId === null || srcId === undefined || srcId === "" || !/^\d+$/.test(String(srcId).trim())) return null;
    return this.userMap.get(Number(srcId)) ?? null;
  }
  officer(name) { return this.officerMap.get(normName(name)) ?? null; }
  contact(srcId) { return this.contactMap.get(Number(srcId)) ?? null; }
  driver(srcId) { return this.driverMap.get(Number(srcId)) ?? null; }
  vehicle(srcId) { return this.vehicleMap.get(Number(srcId)) ?? null; }
  skipOrder(srcOrderId) { this.skipped.add(Number(srcOrderId)); }
  isSkipped(srcOrderId) { return this.skipped.has(Number(srcOrderId)); }

  /** Cari/buat item (fin_items) untuk nama persis; lihat A.2. Mengembalikan id item web atau id baru iops-items-*. */
  item({ productId, name, unit } = {}) {
    let nm = name, un = unit;
    if ((nm === undefined || nm === null || nm === "") && productId !== null && productId !== undefined) {
      const p = this.src.prepare("SELECT name, unit FROM products WHERE id = ?").get(productId);
      nm = p?.name; un = un || p?.unit;
    }
    nm = String(nm ?? "").trim().replace(/\s+/g, " ");
    if (!nm) return null;
    un = String(un ?? "").trim() || "pcs";
    const key = normName(nm);
    if (!this.webItems) {
      this.webItems = this.webRows("SELECT id, code, name, active, created_at FROM fin_items ORDER BY active DESC, created_at ASC, id ASC").filter((w) => !String(w.id).startsWith("iops-")); // iops-* = impor sebelumnya
      this.webItemByName = new Map();
      for (const w of this.webItems) { const k = normName(w.name); if (!this.webItemByName.has(k)) this.webItemByName.set(k, w); }
    }
    const ck = `${key}|${un}`;
    if (this.itemCache.has(ck)) return this.itemCache.get(ck);
    const rep = (hasil, id, catatan = "") => this.report("cocok-barang", { id_sumber: productId ?? "", nama: nm, kunci: key, hasil, id_target: id, catatan });
    // padanan manual (plan/alias-barang.csv) lalu nama persis
    const al = this.alias.get(key);
    let w = null;
    if (al) {
      w = this.webItems.find((x) => x.id === al) ?? this.webItemByName.get(normName(al)) ?? null;
      if (!w) this.warn(`alias-barang: "${nm}" -> "${al}" tidak ditemukan di fin_items web; diabaikan`);
    }
    w = w ?? this.webItemByName.get(key);
    if (w) { this.itemCache.set(ck, w.id); rep("cocok", w.id, al ? "via alias-barang.csv" : ""); return w.id; }
    const h = sha1(`${key}|${un}`);
    const id = `iops-items-${h.slice(0, 12)}`;
    this.itemCache.set(ck, id);
    // nama mirip -> catatan untuk digabung manual
    const flat = (s) => normName(s).replace(/[^a-z0-9]/g, "");
    const fk = flat(nm);
    const mirip = fk ? this.webItems.filter((x) => { const f = flat(x.name); return f && (f === fk || (Math.min(f.length, fk.length) >= 5 && (f.includes(fk) || fk.includes(f)))); }).slice(0, 3) : [];
    rep("baru", id, mirip.length ? `mirip: ${mirip.map((x) => `${x.name} (${x.id})`).join("; ")}` : "");
    this.emit("02-master", insert("fin_items", { id, code: `IOPS-${h.slice(12, 20).toUpperCase()}`, name: nm, kind: "barang_jadi", unit: un, sell_price: 0, buy_price: 0, track_stock: 0, active: 1, note: "Dibuat migrasi inventori-ops", created_at: this.cutoverSec, updated_at: this.cutoverSec }));
    if (productId !== null && productId !== undefined) this.count("products", 1);
    return id;
  }

  /** Daftarkan berkas foto; kembalikan key R2 target atau null (hilang -> foto-hilang.csv). */
  photo(srcUrlOrKey, folder, meta = {}) {
    if (srcUrlOrKey === null || srcUrlOrKey === undefined || String(srcUrlOrKey).trim() === "") return null;
    let k = String(srcUrlOrKey).trim();
    try { if (/^https?:\/\//i.test(k)) k = new URL(k).pathname; } catch { /* pakai apa adanya */ }
    k = k.split(/[?#]/)[0].replace(/^\/+/, "").replace(/^files\//, "");
    try { k = decodeURIComponent(k); } catch { /* biarkan */ }
    const hilang = (alasan) => { this.report("foto-hilang", { rujukan: meta.ref ?? "", folder, key_sumber: k, alasan }); return null; };
    if (!k || k.split("/").includes("..")) return hilang("key tidak sah");
    const src = path.join(this.backupDir, "foto", ...k.split("/"));
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return hilang("tidak ada di foto/");
    this.requested.add(k);
    const base = path.posix.basename(k);
    const ext = base.includes(".") ? base.split(".").pop().toLowerCase() : "";
    const ct = CT[ext];
    if (!ct) return hilang(`ekstensi tidak dikenal (.${ext})`);
    const key = folder === "pengiriman" && meta.deliveryId !== undefined ? `pengiriman/legacy/${meta.deliveryId}/${base}` : `${folder}/legacy/${base}`;
    if (!this.manifest.has(key)) this.manifest.set(key, { src, key, contentType: ct, ...(meta.name ? { name: meta.name } : {}) });
    return key;
  }

  // ---- penulisan keluaran ----
  /** Tulis laporan, hitungan, dan (bila final) berkas .sql. Mengembalikan daftar berkas SQL yang ditulis. */
  finish() {
    // foto yatim
    const fotoDir = path.join(this.backupDir, "foto");
    const walk = (d, rel = "") => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name), `${rel}${e.name}/`) : [`${rel}${e.name}`]) : [];
    for (const rel of walk(fotoDir).sort()) if (!this.requested.has(rel)) this.report("foto-yatim", { key_sumber: rel, ukuran: fs.statSync(path.join(fotoDir, ...rel.split("/"))).size, catatan: "tidak dirujuk kolom mana pun / tidak diunggah" });
    // hitungan
    const srcTables = this.rows("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").map((r) => r.name);
    const hit = srcTables.map((t) => ({
      tabel_sumber: t, baris_sumber: this.rows(`SELECT count(*) AS n FROM "${t}"`)[0].n, baris_target: this.counts[t] ?? 0,
      status: NOT_MIGRATED[t] ? "tidak dimigrasi" : (this.counts[t] === undefined ? "belum ada penghitung" : "dimigrasi"), keterangan: NOT_MIGRATED[t] ?? "",
    }));
    this.reports.set("hitungan", hit);
    if (this.warnings.length) this.reports.set("peringatan", this.warnings.map((w) => ({ pesan: w })));
    fs.rmSync(path.join(this.outDir, "laporan"), { recursive: true, force: true }); // buang laporan basi proses sebelumnya
    if (this.final && fs.existsSync(this.outDir)) for (const f of fs.readdirSync(this.outDir)) if (/^\d\d.*\.sql$/.test(f)) fs.rmSync(path.join(this.outDir, f));
    fs.mkdirSync(path.join(this.outDir, "laporan"), { recursive: true });
    for (const [name, rows] of this.reports) if (rows.length) writeCsv(path.join(this.outDir, "laporan", `${name}.csv`), rows);
    const written = [];
    if (this.final) {
      for (const [base, stmts] of [...this.files].sort(([a], [b]) => a.localeCompare(b))) {
        let part = [], bytes = 0, n = 1;
        const flush = () => {
          if (!part.length) return;
          const f = path.join(this.outDir, n === 1 ? `${base}.sql` : `${base}-${n}.sql`);
          fs.writeFileSync(f, `-- migrasi inventori-ops: ${path.basename(f)} (${part.length} pernyataan)\n${part.join("\n")}\n`, "utf8");
          written.push(f); n++; part = []; bytes = 0;
        };
        for (const s of stmts) {
          const b = Buffer.byteLength(s) + 1;
          if (part.length && (part.length >= 1000 || bytes + b > 2_000_000)) flush();
          part.push(s); bytes += b;
        }
        flush();
      }
    }
    return written;
  }
}
