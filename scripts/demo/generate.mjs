#!/usr/bin/env node
/**
 * Generator DATA CONTOH modul keuangan & operasional Istana Block: 1 Januari 2026 s.d. "hari ini".
 *
 *   node scripts/demo/generate.mjs                     # hari ini = tanggal sekarang (WIB)
 *   node scripts/demo/generate.mjs --hari-ini 2026-10-20
 *
 * Menulis:
 *   seed/demo-erp.sql          → muat dengan  npm run demo:local   (atau demo:remote / demo:worker:data)
 *   seed/demo-erp-hapus.sql    → hapus data contoh saja
 *   seed/erp-mulai-bersih.sql  → kosongkan semua transaksi sebelum mulai memakai data asli
 *
 * Cerita data: pabrik produk beton di Purwakarta dengan 4 kendaraan, ±40 pelanggan (developer, kontraktor,
 * pelaksana proyek desa, kawasan industri, toko bangunan, lembaga, perorangan) dan 6 pemasok. Permintaan
 * mengikuti musim (hujan Jan–Feb, Ramadan, pabrik libur Lebaran 16–28 Maret, ramai saat kemarau Jun–Okt).
 * Setiap angka laporan berasal dari dokumen: pesanan → surat jalan (stok keluar + HPP) → faktur → penerimaan;
 * produksi memakai bahan baku dan upah borongan; bahan dibeli bila stok menipis; gaji, THR, BBM, uang jalan,
 * listrik, cicilan bank, penyusutan, PPN, dan stok opname dicatat seperti di aplikasi
 * (src/app/akuntansi/actions, src/app/operasional/actions). Jadi neraca selalu seimbang dan laporan saling cocok.
 *
 * Nama pelanggan, pemasok, kendaraan, dan sopir FIKTIF. Harga jual diambil dari daftar harga website bila ada;
 * harga paving, kanstin, genteng, harga pokok, harga bahan, gaji, dan biaya lain adalah PERKIRAAN (angka contoh).
 * Semua id berawalan "demo-" sehingga bisa dihapus bersih.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = new URL("../../", import.meta.url);
const argv = process.argv.slice(2);
const argOf = (k) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const wibToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const TODAY = argOf("hari-ini") ?? process.env.DEMO_HARI_INI ?? wibToday();
if (!/^2026-(0[4-9]|1[0-2])-\d{2}$/.test(TODAY)) throw new Error(`--hari-ini harus antara April dan Desember 2026 (dapat: ${TODAY}).`);
const START = "2026-01-01";
const OPENING = "2025-12-31";
/** "Sekarang" di hari ini: jam 10.30 WIB (truk pagi sudah berangkat, sore belum). */
const NOW_HOUR = 10.5;

/* =================================================================== util */

let seed = 20260101;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);
const ibetween = (a, b) => Math.floor(between(a, b + 1));
const chance = (p) => rnd() < p;
const round = (n) => Math.round(n);
const r3 = (n) => Math.round(n * 1000) / 1000;
const roundTo = (n, step) => Math.round(n / step) * step;

function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Minggu
const ym = (d) => d.slice(0, 7);
const lastDay = (ymStr) => addDays(`${ymStr === "2026-12" ? "2027-01" : nextMonth(ymStr)}-01`, -1);
function nextMonth(ymStr) {
  const [y, m] = ymStr.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const bulan = (d) => BULAN[Number(d.slice(5, 7)) - 1];

// Libur nasional & cuti bersama 2026 (SKB 3 Menteri), plus pabrik libur Lebaran 16–28 Maret.
const HOLIDAYS = new Set([
  "2026-01-01", "2026-01-16", "2026-02-16", "2026-02-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22", "2026-03-23", "2026-03-24",
  "2026-04-03", "2026-05-01", "2026-05-14", "2026-05-15", "2026-05-27", "2026-05-28", "2026-06-01", "2026-06-16", "2026-08-17", "2026-08-25", "2026-12-24", "2026-12-25",
]);
const CLOSED_FROM = "2026-03-16";
const CLOSED_TO = "2026-03-28";
const isClosed = (d) => d >= CLOSED_FROM && d <= CLOSED_TO;
const isWorkday = (d) => dow(d) !== 0 && !HOLIDAYS.has(d) && !isClosed(d);
function nextWorkday(d) {
  let x = addDays(d, 1);
  while (!isWorkday(x)) x = addDays(x, 1);
  return x;
}
const onOrNextWorkday = (d) => (isWorkday(d) ? d : nextWorkday(d));
function onOrPrevWorkday(d) {
  let x = d;
  while (!isWorkday(x)) x = addDays(x, -1);
  return x;
}
function addWorkdays(d, n) {
  let x = d;
  for (let i = 0; i < n; i++) x = nextWorkday(x);
  return x;
}
/** Detik epoch untuk jam WIB tertentu (jam boleh pecahan). */
const epoch = (d, h = 9, m = 0) => Math.floor(Date.parse(`${d}T00:00:00+07:00`) / 1000 + Math.round(h * 3600) + m * 60);

/* =================================================================== SQL builder */

class Raw {
  constructor(sql) {
    this.sql = sql;
  }
}
const lit = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Raw) return v.sql;
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const TABLES = new Map();
function put(table, row) {
  if (!TABLES.has(table)) TABLES.set(table, { cols: Object.keys(row), rows: [], byId: new Map() });
  const t = TABLES.get(table);
  const r = t.cols.map((c) => lit(row[c]));
  t.rows.push(r);
  if (row.id !== undefined) t.byId.set(row.id, r);
  return r;
}
function setCol(table, id, col, value) {
  const t = TABLES.get(table);
  const r = t.byId.get(id);
  if (!r) throw new Error(`${table} ${id} tidak ada`);
  r[t.cols.indexOf(col)] = lit(value);
}
let idn = 0;
const id = (p) => `demo-${p}-${String(++idn).padStart(6, "0")}`;

/* =================================================================== akun (id dari drizzle/0003_coa.sql) */

const A = {
  kas: "acc_1-1100", bank: "acc_1-1300", piutang: "acc_1-2100", persJadi: "acc_1-3100", persBahan: "acc_1-3200",
  ppnMasukan: "acc_1-4100", tanah: "acc_1-5100", bangunan: "acc_1-5200", mesin: "acc_1-5300", kendaraan: "acc_1-5400", peralatan: "acc_1-5500",
  akum: "acc_1-6100", hutang: "acc_2-1100", ppnKeluaran: "acc_2-2100", umJual: "acc_2-2200", hutPajak: "acc_2-2400", hutBank: "acc_2-3100",
  modal: "acc_3-1000", labaDitahan: "acc_3-2000", saldoAwal: "acc_3-3000", prive: "acc_3-4000",
  penjualan: "acc_4-1100", ongkir: "acc_4-1300",
  hpp: "acc_5-1100", selisih: "acc_5-1200", upah: "acc_6-1100", gaji: "acc_6-1200", bbm: "acc_6-2100", rawatKend: "acc_6-2200", uangJalan: "acc_6-2300",
  listrik: "acc_6-3100", rawatMesin: "acc_6-3200", telp: "acc_6-4200", atk: "acc_6-4300", iklan: "acc_6-4400", susut: "acc_6-5100", lain: "acc_6-9100",
  bunga: "acc_7-1100", adminBank: "acc_8-1100", bebanLuar: "acc_8-1200",
};
const balance = new Map();
const bal = (a) => balance.get(a) ?? 0;

/* =================================================================== penomoran & jurnal */

const seq = new Map();
function nextNumber(prefix, date) {
  const key = `${prefix}/${date.slice(2, 4)}${date.slice(5, 7)}`;
  const n = (seq.get(key) ?? 0) + 1;
  seq.set(key, n);
  return `${key}/${String(n).padStart(4, "0")}`;
}

const monthly = new Map(); // "2026-03" → {rev, hpp, opex, other}
const mstat = (d) => {
  const k = ym(d);
  if (!monthly.has(k)) monthly.set(k, { rev: 0, hpp: 0, opex: 0, other: 0 });
  return monthly.get(k);
};
const GROUP = (a) => {
  const code = a.slice(4);
  if (code.startsWith("4")) return "rev";
  if (code.startsWith("5")) return "hpp";
  if (code.startsWith("6")) return "opex";
  if (code.startsWith("7") || code.startsWith("8")) return "other";
  return null;
};

/** Sama dengan journalOps di aplikasi: angka negatif pindah sisi, baris nol dibuang, wajib seimbang. */
function journal({ number, date, memo, source, sourceId, lines, hour = 16 }) {
  const ls = lines
    .map((l) => {
      let d = round(l.debit ?? 0);
      let c = round(l.credit ?? 0);
      if (d < 0) [c, d] = [c - d, 0];
      if (c < 0) [d, c] = [d - c, 0];
      return { ...l, debit: d, credit: c };
    })
    .filter((l) => l.debit || l.credit);
  if (!ls.length) return null;
  const d = ls.reduce((a, l) => a + l.debit, 0);
  const c = ls.reduce((a, l) => a + l.credit, 0);
  if (d !== c) throw new Error(`Jurnal ${number} tidak seimbang: ${d} ≠ ${c}`);
  const jid = source === "manual" ? sourceId : id("jr");
  const ts = epoch(date, hour, Math.floor(rnd() * 59));
  put("fin_journals", { id: jid, number, date, memo, source, source_id: sourceId, created_by: null, created_at: ts, updated_at: ts });
  ls.forEach((l, i) => {
    put("fin_journal_lines", { id: id("jl"), journal_id: jid, date, account_id: l.account, debit: l.debit, credit: l.credit, memo: l.memo ?? "", contact_id: l.contact ?? null, sort: i });
    balance.set(l.account, bal(l.account) + l.debit - l.credit);
    const g = GROUP(l.account);
    if (g && date >= START) {
      const s = mstat(date);
      s[g] += g === "rev" || g === "other" ? l.credit - l.debit : l.debit - l.credit;
    }
  });
  if (bal(A.kas) < -1 || bal(A.bank) < -1) throw new Error(`Saldo minus setelah ${number} (${date}): kas ${bal(A.kas)}, bank ${bal(A.bank)}`);
  return jid;
}
function manualJournal(date, memo, lines, hour = 17) {
  const jid = id("ju");
  journal({ number: nextNumber("JU", date), date, memo, source: "manual", sourceId: jid, hour, lines });
  return jid;
}

/* =================================================================== barang */

const seedSql = readFileSync(new URL("seed/seed.sql", ROOT), "utf8");
const PRODUCTS = [];
for (const m of seedSql.matchAll(/INSERT INTO products \(slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows,[^)]*\) VALUES \('([^']+)', '([^']+)', '([^']+)', '(?:[^']|'')*', '(?:[^']|'')*', (NULL|\d+), (NULL|\d+), '([^']*)', '[^']*', '(?:[^']|'')*', '((?:[^']|'')*)'/g)) {
  PRODUCTS.push({ slug: m[1], name: m[2], category: m[3], unit: m[6], rows: JSON.parse(m[7].replace(/''/g, "'")) });
}
if (PRODUCTS.length < 7) throw new Error("Produk di seed/seed.sql tidak terbaca.");
const PREFIX = { Paving: "PVG", Saluran: "UDT", Buis: "BUS", Kanstin: "KST", Atap: "GTG", Jasa: "JSA", Lainnya: "LN" };
function itemNameFrom(productName, group, variant) {
  const first = (x) => x.trim().toLowerCase().split(/[\s(/]+/)[0];
  const p = productName.trim();
  const g = (group ?? "").trim();
  const v = (variant ?? "").trim();
  if (v && first(v) === first(p)) return v;
  const parts = [p];
  if (g && first(g) !== first(p)) parts.push(g);
  if (v && v !== p) parts.push(v);
  return parts.join(" — ");
}
const SITE = new Map();
PRODUCTS.forEach((p, pi) => {
  p.rows.forEach((r, i) => {
    const code = `${PREFIX[p.category] ?? "LN"}-${String(pi + 1).padStart(2, "0")}${String(i + 1).padStart(2, "0")}`;
    SITE.set(code, { slug: p.slug, name: itemNameFrom(p.name, r.group, r.variant).slice(0, 160), unit: r.unit || p.unit, price: r.price ?? 0, detail: r.detail ?? "" });
  });
});

/**
 * Barang jadi yang dijual. price = harga jual (website bila ada, selain itu perkiraan); std = harga pokok standar;
 * w = berat kg/satuan; cast = press | basah; steel = batang besi Ø6/satuan; labor = upah borongan/satuan;
 * batch = sekali cetak; fam = jalur produksi; min = stok minimum.
 */
const FG = {
  "PVG-0101": { price: 85000, std: 38000, min: 250, w: 105, cast: "press", labor: 8400, batch: 110, fam: "paving" },
  "PVG-0102": { price: 88000, std: 41000, min: 120, w: 140, cast: "press", labor: 9800, batch: 100, fam: "paving", pigment: 0.25 },
  "PVG-0103": { price: 86000, std: 39000, min: 60, w: 128, cast: "press", labor: 9100, batch: 100, fam: "paving" },
  "PVG-0105": { price: 78000, std: 35000, min: 100, w: 100, cast: "press", labor: 9100, batch: 120, fam: "paving" },
  "KST-0402": { price: 15000, std: 6800, min: 400, w: 17, cast: "press", labor: 1200, batch: 300, fam: "kanstin" },
  "KST-0403": { price: 22000, std: 9900, min: 200, w: 24, cast: "press", labor: 1600, batch: 200, fam: "kanstin" },
  "KST-0405": { price: 34000, std: 16000, min: 60, w: 42, cast: "press", labor: 2600, batch: 120, fam: "kanstin" },
  "GTG-0501": { price: 4500, std: 2050, min: 1500, w: 4.4, cast: "press", labor: 400, batch: 1200, fam: "genteng", pigment: 0.012 },
  "GTG-0503": { price: 9500, std: 3600, min: 150, w: 3.6, cast: "press", labor: 600, batch: 200, fam: "genteng", pigment: 0.01 },
  "UDT-0201": { std: 128000, min: 20, w: 163.3, cast: "basah", steel: 1.5, labor: 19500, batch: 20, fam: "udit" },
  "UDT-0203": { std: 172000, min: 20, w: 248.6, cast: "basah", steel: 2, labor: 24700, batch: 20, fam: "udit" },
  "UDT-0206": { std: 236000, min: 10, w: 373.8, cast: "basah", steel: 3, labor: 32500, batch: 15, fam: "udit" },
  "UDT-0209": { std: 305000, min: 6, w: 472, cast: "basah", steel: 3.5, labor: 39000, batch: 12, fam: "udit" },
  "UDT-0213": { std: 58000, min: 10, w: 48, cast: "basah", steel: 0.8, labor: 9100, batch: 30, fam: "udit" },
  "UDT-0214": { std: 79000, min: 10, w: 62, cast: "basah", steel: 1, labor: 11000, batch: 30, fam: "udit" },
  "UDT-0215": { std: 118000, min: 10, w: 78, cast: "basah", steel: 1.5, labor: 13000, batch: 20, fam: "udit" },
  "BUS-0301": { std: 27000, min: 60, w: 50, cast: "basah", labor: 4600, batch: 60, fam: "buis" },
  "BUS-0302": { std: 39000, min: 50, w: 96, cast: "basah", labor: 5800, batch: 50, fam: "buis" },
  "BUS-0303": { std: 49000, min: 40, w: 116.5, cast: "basah", labor: 6500, batch: 40, fam: "buis" },
  "BUS-0304": { std: 76000, min: 20, w: 170, cast: "basah", labor: 9100, batch: 30, fam: "buis" },
  "BUS-0305": { std: 98000, min: 20, w: 211, cast: "basah", labor: 11700, batch: 30, fam: "buis" },
  "BUS-0307": { std: 104000, min: 16, w: 230, cast: "basah", labor: 13000, batch: 24, fam: "buis" },
  "BUS-0310": { std: 455000, min: 6, w: 592, cast: "basah", steel: 4, labor: 49400, batch: 12, fam: "buis" },
  "BUS-0311": { std: 118000, min: 10, w: 140, cast: "basah", steel: 0.5, labor: 11700, batch: 12, fam: "buis" },
};
/** Bahan baku: harga dasar (Januari) dan kenaikan harga per bulan (indeks). */
const RM = {
  "BB-SMN": { name: "Semen PCC 50 kg", unit: "sak", price: 63500, min: 250, batch: 320, tax: true, sup: "S1" },
  "BB-PSR": { name: "Pasir beton", unit: "m³", price: 280000, min: 14, batch: 21, tax: false, sup: "S2" },
  "BB-ABU": { name: "Abu batu", unit: "m³", price: 235000, min: 20, batch: 28, tax: false, sup: "S2" },
  "BB-SPL": { name: "Split 1–2 cm", unit: "m³", price: 315000, min: 14, batch: 21, tax: false, sup: "S2" },
  "BB-BSI": { name: "Besi beton polos Ø6 mm × 12 m", unit: "batang", price: 31500, min: 250, batch: 600, tax: true, sup: "S3" },
  "BB-PGM": { name: "Pigmen oksida merah", unit: "kg", price: 39000, min: 30, batch: 75, tax: true, sup: "S3" },
};
const PRICE_INDEX = { "01": 1, "02": 1, "03": 1.01, "04": 1.01, "05": 1.02, "06": 1.02, "07": 1.045, "08": 1.05, "09": 1.05, "10": 1.06, "11": 1.06, "12": 1.06 };
const ITEM = new Map();
for (const [code, f] of Object.entries(FG)) {
  const s = SITE.get(code);
  if (!s) throw new Error(`Kode ${code} tidak ada di daftar harga website.`);
  ITEM.set(code, { code, name: s.name, unit: s.unit, kind: "barang_jadi", ...f, price: s.price || f.price, slug: s.slug, note: s.price ? s.detail : `${s.detail ? `${s.detail}. ` : ""}Harga jual perkiraan; ganti dengan harga resmi.` });
}
for (const [code, r] of Object.entries(RM)) ITEM.set(code, { code, kind: "bahan_baku", std: r.price, ...r, note: "Harga beli perkiraan." });
for (const it of ITEM.values()) {
  if (it.kind !== "barang_jadi") continue;
  const mat = Object.entries(recipe(it.code, 100)).reduce((a, [m, n]) => a + n * ITEM.get(m).price, 0) / 100;
  it.std = roundTo(mat + it.labor, 100);
}
const iref = (code) => new Raw(`(SELECT id FROM fin_items WHERE code = ${lit(code)})`);
const invAcc = (code) => (ITEM.get(code).kind === "bahan_baku" ? A.persBahan : A.persJadi);

/** Resep bahan per satuan barang jadi (campuran perkiraan, termasuk susut ±5%). */
function recipe(code, qty) {
  const it = ITEM.get(code);
  const vol = (it.w / 2350) * qty * 1.08; // m³ beton, termasuk susut
  const out = {};
  if (it.cast === "press") {
    out["BB-SMN"] = (vol * 365) / 50;
    out["BB-ABU"] = vol * 0.82;
    out["BB-PSR"] = vol * 0.32;
  } else {
    out["BB-SMN"] = (vol * 410) / 50;
    out["BB-PSR"] = vol * 0.48;
    out["BB-SPL"] = vol * 0.75;
  }
  if (it.steel) out["BB-BSI"] = it.steel * 1.6 * qty;
  if (it.pigment) out["BB-PGM"] = it.pigment * qty;
  for (const k of Object.keys(out)) out[k] = Math.ceil(out[k] * 10) / 10;
  return out;
}

/* =================================================================== persediaan */

const stock = new Map();
const lv = (code) => stock.get(code) ?? { qty: 0, value: 0 };
const unitCost = (code) => {
  const l = lv(code);
  return l.qty > 0.0005 && l.value > 0 ? l.value / l.qty : ITEM.get(code).std;
};
function move(code, date, qty, value, source, sourceId, note, hour = 8) {
  const l = lv(code);
  const n = { qty: r3(l.qty + qty), value: l.value + value };
  if (n.qty < -1e-6) throw new Error(`Stok ${code} minus pada ${date} (${n.qty}) — ${note}`);
  if (Math.abs(n.qty) < 1e-6) n.value = 0;
  stock.set(code, n);
  const ts = epoch(date, hour, Math.floor(rnd() * 59));
  put("inv_stock_moves", { id: id("sm"), item_id: iref(code), date, qty: r3(qty), value, source, source_id: sourceId, note, created_at: ts, updated_at: ts });
}

/* =================================================================== wilayah, armada, sopir */

const HOME = [-6.5569, 107.4431];
/** Titik tujuan & jalur kasar dari pabrik (koordinat perkiraan untuk peta lacak). zone: 1 dekat, 2 sedang, 3 jauh. */
const AREAS = {
  pwk: { name: "Purwakarta", zone: 1, km: 6, ll: [-6.5402, 107.4528], via: [[-6.5480, 107.4470]] },
  bbk: { name: "Babakancikao, Purwakarta", zone: 1, km: 9, ll: [-6.5176, 107.4672], via: [[-6.5420, 107.4500], [-6.5280, 107.4590]] },
  bgs: { name: "Bungursari, Purwakarta", zone: 1, km: 13, ll: [-6.4952, 107.4818], via: [[-6.5420, 107.4500], [-6.5180, 107.4560], [-6.5050, 107.4690]] },
  cbt: { name: "Cibatu, Purwakarta", zone: 1, km: 16, ll: [-6.5084, 107.5303], via: [[-6.5480, 107.4650], [-6.5320, 107.4930], [-6.5190, 107.5130]] },
  jtl: { name: "Jatiluhur, Purwakarta", zone: 1, km: 10, ll: [-6.5268, 107.3897], via: [[-6.5520, 107.4250], [-6.5400, 107.4040]] },
  plr: { name: "Plered, Purwakarta", zone: 1, km: 14, ll: [-6.6372, 107.3858], via: [[-6.5750, 107.4280], [-6.6050, 107.4080], [-6.6250, 107.3950]] },
  skt: { name: "Sukatani, Purwakarta", zone: 1, km: 11, ll: [-6.6106, 107.4447], via: [[-6.5750, 107.4420], [-6.5950, 107.4450]] },
  cmp: { name: "Cikampek, Karawang", zone: 2, km: 22, ll: [-6.4185, 107.4568], via: [[-6.5420, 107.4500], [-6.5100, 107.4520], [-6.4750, 107.4580], [-6.4450, 107.4600]] },
  ktb: { name: "Kotabaru, Karawang", zone: 2, km: 26, ll: [-6.4010, 107.4290], via: [[-6.5420, 107.4500], [-6.5100, 107.4520], [-6.4750, 107.4580], [-6.4300, 107.4520], [-6.4120, 107.4400]] },
  klr: { name: "Klari, Karawang", zone: 2, km: 34, ll: [-6.3622, 107.3682], via: [[-6.5100, 107.4520], [-6.4450, 107.4600], [-6.4180, 107.4520], [-6.3980, 107.4280], [-6.3780, 107.3980]] },
  kjt: { name: "Kalijati, Subang", zone: 2, km: 30, ll: [-6.5124, 107.6646], via: [[-6.5320, 107.4930], [-6.5150, 107.5450], [-6.5100, 107.6000], [-6.5130, 107.6350]] },
  krw: { name: "Karawang", zone: 3, km: 46, ll: [-6.3055, 107.3051], via: [[-6.5100, 107.4520], [-6.4450, 107.4600], [-6.4180, 107.4520], [-6.3980, 107.4280], [-6.3700, 107.3800], [-6.3400, 107.3400]] },
  tlj: { name: "Telukjambe, Karawang", zone: 3, km: 50, ll: [-6.3289, 107.2736], via: [[-6.5100, 107.4520], [-6.4450, 107.4600], [-6.3980, 107.4280], [-6.3700, 107.3800], [-6.3450, 107.3250], [-6.3330, 107.2950]] },
  sbg: { name: "Subang", zone: 3, km: 44, ll: [-6.5697, 107.7587], via: [[-6.5320, 107.4930], [-6.5100, 107.6000], [-6.5130, 107.6650], [-6.5400, 107.7100]] },
  pgd: { name: "Pagaden, Subang", zone: 3, km: 48, ll: [-6.4537, 107.7905], via: [[-6.5320, 107.4930], [-6.5100, 107.6000], [-6.5130, 107.6650], [-6.4850, 107.7300]] },
  pdl: { name: "Padalarang, Bandung Barat", zone: 3, km: 52, ll: [-6.8432, 107.4794], via: [[-6.5300, 107.4400], [-6.6000, 107.4280], [-6.6900, 107.4450], [-6.7700, 107.4650]] },
};

const VEH = {
  V1: { plate: "T 8417 BD", name: "Truk engkel bak kayu", capacity: "± 7 ton (65–70 m² paving / 20 U-Ditch 40×40)", kg: 7000, gps: "864895031234567" },
  V2: { plate: "T 8593 BC", name: "Truk engkel bak besi", capacity: "± 7 ton", kg: 7000, gps: "864895031234575" },
  V3: { plate: "T 9125 AB", name: "Colt diesel bak", capacity: "± 4,5 ton (40–45 m² paving)", kg: 4500, gps: "864895031234583" },
  V4: { plate: "T 8862 CA", name: "Pickup bak", capacity: "± 1 ton", kg: 1100, gps: null },
};
const DRV = {
  D1: { name: "Asep Saepudin", phone: "0811 0000 4101", note: "SIM B1 umum · truk T 8417 BD", veh: "V1" },
  D2: { name: "Ujang Kurnia", phone: "0811 0000 4102", note: "SIM B1 umum · truk T 8593 BC", veh: "V2" },
  D3: { name: "Dede Rahmat", phone: "0811 0000 4103", note: "SIM B1 · colt T 9125 AB", veh: "V3" },
  D4: { name: "Cecep Hidayat", phone: "0811 0000 4104", note: "SIM A · pickup T 8862 CA", veh: "V4" },
};
const DRIVER_OF = Object.fromEntries(Object.entries(DRV).map(([k, d]) => [d.veh, k]));
const MASTER_TS = epoch(OPENING, 10);
for (const [k, v] of Object.entries(VEH))
  put("ops_vehicles", { id: `demo-vh-${k.toLowerCase()}`, plate: v.plate, name: v.name, capacity: v.capacity, gps_device_id: v.gps, active: 1, note: v.gps ? "GPS tracker GT06 · kartu data Telkomsel" : "Belum dipasang GPS; lokasi dari HP sopir saat mengantar.", created_at: MASTER_TS, updated_at: MASTER_TS });
for (const [k, v] of Object.entries(DRV)) put("ops_drivers", { id: `demo-dr-${k.toLowerCase()}`, name: v.name, phone: v.phone, active: 1, note: v.note, created_at: MASTER_TS, updated_at: MASTER_TS });

/* =================================================================== kontak */

/**
 * seg: developer | kontraktor | desa | industri | toko | lembaga | perorangan
 * pay: tepat | biasa | lambat | sangat_lambat | macet (perilaku bayar), freq: pesanan/bulan pada musim normal.
 */
const CUSTOMERS = [
  ["C01", "PT Graha Asri Sentosa", "developer", "bgs", 30, "biasa", 0.75, "Developer Perumahan Griya Asri. Tagihan ke bagian keuangan, lampirkan surat jalan bertanda tangan.", "Ruko Sudirman Blok B-7, Jl. Jend. Sudirman, Purwakarta"],
  ["C02", "PT Bumi Citra Purwakarta", "developer", "jtl", 30, "lambat", 0.6, "Perumahan Citra Jatiluhur. Pembayaran sering mundur 2–4 minggu dari jatuh tempo.", "Jl. Ir. H. Juanda No. 88, Jatiluhur"],
  ["C03", "PT Karya Hunian Mandiri", "developer", "cmp", 30, "biasa", 0.55, "Perumahan subsidi di Cikampek.", "Jl. Ahmad Yani No. 12, Cikampek"],
  ["C04", "CV Griya Permata Indah", "developer", "bbk", 30, "tepat", 0.45, "Cluster kecil 40 unit.", "Jl. Raya Babakancikao No. 5"],
  ["C05", "CV Karya Mandiri Konstruksi", "kontraktor", "krw", 30, "biasa", 0.55, "Kontraktor drainase & jalan. Penawaran lewat email pengadaan.", "Jl. Tuparev No. 41, Karawang"],
  ["C06", "CV Bumi Parahyangan Teknik", "kontraktor", "sbg", 30, "lambat", 0.45, "Saluran & gorong-gorong. Bayar per termin.", "Jl. Otto Iskandardinata, Subang"],
  ["C07", "CV Tirta Bangun Lestari", "kontraktor", "klr", 30, "biasa", 0.4, "Drainase kawasan pergudangan.", "Jl. Raya Klari No. 7, Karawang"],
  ["C08", "CV Mitra Sinergi Teknik", "kontraktor", "pwk", 30, "tepat", 0.4, "Pekerjaan sipil swasta di Purwakarta.", "Jl. Veteran No. 21, Purwakarta"],
  ["C09", "CV Sarana Bangun Persada", "kontraktor", "cbt", 30, "biasa", 0.35, "Ruko & jalan lingkungan.", "Jl. Raya Cibatu, Purwakarta"],
  ["C10", "CV Jaya Abadi Teknik", "kontraktor", "tlj", 45, "lambat", 0.35, "Saluran perumahan Telukjambe.", "Telukjambe Timur, Karawang"],
  ["C11", "CV Pakuan Desa Mandiri", "desa", "kjt", 45, "sangat_lambat", 0.35, "Pelaksana proyek dana desa. Pembayaran menunggu pencairan termin.", "Kalijati, Subang"],
  ["C12", "CV Rahayu Karya Desa", "desa", "pgd", 45, "macet", 0.3, "Pelaksana proyek desa. Ada tagihan tertunggak, konfirmasi ke pemilik sebelum kirim.", "Pagaden, Subang"],
  ["C13", "CV Lembur Kuring Teknik", "desa", "plr", 45, "lambat", 0.3, "Saluran irigasi tersier & jalan desa.", "Plered, Purwakarta"],
  ["C14", "CV Sinar Galuh Utama", "desa", "skt", 45, "sangat_lambat", 0.25, "Gorong-gorong jalan desa.", "Sukatani, Purwakarta"],
  ["C15", "PT Mitra Gudang Nusantara", "industri", "bgs", 45, "tepat", 0.3, "Area parkir & drainase gudang. Termin 45 hari setelah faktur.", "Kawasan industri, Bungursari, Purwakarta"],
  ["C16", "PT Sentosa Logistik Indonesia", "industri", "ktb", 45, "biasa", 0.25, "Pool truk & gudang.", "Kotabaru, Karawang"],
  ["C17", "PT Prima Kemas Industri", "industri", "klr", 45, "tepat", 0.2, "Pabrik kemasan; area loading & drainase.", "Kawasan industri Klari, Karawang"],
  ["C18", "Toko Bangunan Sinar Jaya", "toko", "cmp", 14, "tepat", 1.7, "Reseller. Ambil rutin buis kecil, kanstin, genteng.", "Jl. Raya Cikampek–Purwakarta, Cikampek"],
  ["C19", "TB Maju Makmur", "toko", "plr", 14, "biasa", 1.4, "Reseller di Plered.", "Pasar Plered, Purwakarta"],
  ["C20", "TB Berkah Abadi", "toko", "cbt", 14, "tepat", 1.2, "Reseller, sering ambil sendiri pakai truk toko.", "Jl. Raya Cibatu, Purwakarta"],
  ["C21", "TB Sumber Alam", "toko", "pwk", 14, "biasa", 1.5, "Reseller dalam kota.", "Jl. Kapten Halim, Purwakarta"],
  ["C22", "TB Harapan Baru", "toko", "sbg", 14, "lambat", 0.9, "Reseller di Subang.", "Jl. Ahmad Yani, Subang"],
  ["C23", "TB Sejahtera Bangunan", "toko", "jtl", 14, "biasa", 1.0, "Reseller dekat Waduk Jatiluhur.", "Jatiluhur, Purwakarta"],
  ["C24", "TB Rizky Material", "toko", "krw", 14, "biasa", 0.9, "Reseller di Karawang.", "Jl. Kertabumi, Karawang"],
  ["C25", "TB Cahaya Mulya", "toko", "skt", 14, "sangat_lambat", 0.7, "Reseller. Sering minta tempo lebih; batasi kredit.", "Sukatani, Purwakarta"],
  ["C26", "Panitia Pembangunan Masjid Al-Hidayah", "lembaga", "skt", 0, "tepat", 0.1, "DP 50% saat pesan, pelunasan setelah barang lengkap.", "Kp. Sukamulya, Sukatani, Purwakarta"],
  ["C27", "Yayasan Pendidikan Nurul Falah", "lembaga", "pwk", 0, "tepat", 0.1, "Halaman sekolah & lapangan upacara.", "Jl. Industri, Purwakarta"],
  ["C28", "Pondok Pesantren Daarul Ilmi", "lembaga", "plr", 0, "biasa", 0.1, "Jalan lingkungan pesantren.", "Plered, Purwakarta"],
  ["C29", "DKM Masjid At-Taqwa", "lembaga", "ktb", 0, "tepat", 0.08, "Halaman parkir masjid.", "Kotabaru, Karawang"],
  ["C30", "H. Dedi Supriatna", "perorangan", "plr", 0, "tepat", 0.12, "Perorangan.", "Plered, Purwakarta"],
  ["C31", "Ibu Nining Kurniasih", "perorangan", "pwk", 0, "tepat", 0.12, "Perorangan.", "Jl. Veteran gang Melati, Purwakarta"],
  ["C32", "Rudi Hartono", "perorangan", "cbt", 0, "tepat", 0.12, "Perorangan, pesan lewat WhatsApp.", "Cibatu, Purwakarta"],
  ["C33", "Ahmad Fauzi", "perorangan", "jtl", 0, "tepat", 0.1, "Perorangan.", "Jatiluhur, Purwakarta"],
  ["C34", "Euis Komariah", "perorangan", "bbk", 0, "tepat", 0.1, "Perorangan.", "Babakancikao, Purwakarta"],
  ["C35", "Yusuf Maulana", "perorangan", "cmp", 0, "tepat", 0.1, "Perorangan.", "Cikampek, Karawang"],
  ["C36", "Hendra Gunawan", "perorangan", "bgs", 0, "tepat", 0.1, "Perorangan.", "Bungursari, Purwakarta"],
  ["C37", "Siti Rohmah", "perorangan", "skt", 0, "tepat", 0.1, "Perorangan.", "Sukatani, Purwakarta"],
  ["C38", "Agus Setiawan", "perorangan", "krw", 0, "tepat", 0.08, "Perorangan.", "Karawang Barat"],
  ["C39", "Dadang Sudrajat", "perorangan", "sbg", 0, "tepat", 0.08, "Perorangan.", "Subang"],
];
const SUPPLIERS = {
  S1: { name: "Toko Bangunan Sumber Rezeki", term: 14, address: "Jl. Ipik Gandamanah, Purwakarta", note: "Distributor semen. Faktur pajak tersedia." },
  S2: { name: "UD Pasir Citarum Jaya", term: 7, address: "Kec. Plered, Purwakarta", note: "Pasir, abu batu, split per rit dump truck (± 7 m³). Dibayar tunai ke sopir." },
  S3: { name: "CV Baja Prima Karawang", term: 30, address: "Jl. Raya Klari, Karawang", note: "Besi beton, kawat, pigmen." },
  S4: { name: "Bengkel Las & Cetakan Mandiri", term: 14, address: "Jatiluhur, Purwakarta", note: "Pembuatan & servis cetakan, mesin press." },
  S5: { name: "CV Dian Teknik Ban & Aki", term: 14, address: "Jl. Raya Sadang, Purwakarta", note: "Ban, aki, oli armada." },
  S6: { name: "Koperasi Karyawan Istana Block", term: 0, address: "Pabrik", note: "Konsumsi lembur & seragam." },
};
const CID = {};
const CUST = {};
CUSTOMERS.forEach(([k, name, seg, area, term, pay, freq, note, address], i) => {
  CID[k] = `demo-ct-${k.toLowerCase()}`;
  const taxable = ["developer", "kontraktor", "desa", "industri"].includes(seg);
  const company = ["perorangan", "lembaga"].includes(seg) ? "" : name;
  CUST[k] = { key: k, name, seg, area, term, pay, freq, taxable };
  const ts = epoch(OPENING, 10);
  put("fin_contacts", { id: CID[k], kind: "pelanggan", name, company, phone: `0811 0000 2${String(i + 1).padStart(3, "0")}`, email: "", address, npwp: "", term_days: term, note, active: 1, created_at: ts, updated_at: ts });
});
Object.entries(SUPPLIERS).forEach(([k, s], i) => {
  CID[k] = `demo-ct-${k.toLowerCase()}`;
  const ts = epoch(OPENING, 10);
  put("fin_contacts", { id: CID[k], kind: "pemasok", name: s.name, company: k === "S6" ? "" : s.name, phone: `0811 0000 3${String(i + 1).padStart(3, "0")}`, email: "", address: s.address, npwp: "", term_days: s.term, note: s.note, active: 1, created_at: ts, updated_at: ts });
});

for (const it of ITEM.values()) {
  put("fin_items", {
    id: `demo-it-${it.code}`, code: it.code, name: it.name, kind: it.kind, unit: it.unit, sell_price: it.kind === "bahan_baku" ? 0 : it.price, buy_price: it.std,
    track_stock: 1, min_stock: it.min, product_id: it.slug ? new Raw(`(SELECT id FROM products WHERE slug = ${lit(it.slug)})`) : null, revenue_account_id: null, active: 1, note: it.note ?? "",
    created_at: MASTER_TS, updated_at: MASTER_TS,
  });
}

/* =================================================================== permintaan: pesanan pelanggan */

const SEASON = { "01": 0.62, "02": 0.72, "03": 0.78, "04": 0.85, "05": 0.95, "06": 1.05, "07": 1.15, "08": 1.12, "09": 1.2, "10": 1.12, "11": 1.1, "12": 0.85 };
const SEG_SEASON = {
  desa: { "01": 0.1, "02": 0.15, "03": 0.15, "04": 0.4, "05": 0.8, "06": 1.4, "07": 1.6, "08": 1.6, "09": 1.7, "10": 1.5, "11": 1.3, "12": 0.6 },
  lembaga: { "01": 1, "02": 1.6, "03": 0.4, "04": 0.8, "05": 1, "06": 1.2, "07": 1.3, "08": 1.2, "09": 1, "10": 1, "11": 1, "12": 0.8 },
};
const DISC = { developer: 0.05, kontraktor: 0.04, desa: 0.02, industri: 0.04, toko: 0.08, lembaga: 0.02, perorangan: 0 };
const priceFor = (code, seg) => roundTo(ITEM.get(code).price * (1 - DISC[seg]), ITEM.get(code).price >= 50000 ? 1000 : 100);
const qtyStep = (code) => (ITEM.get(code).unit === "m²" ? 5 : ITEM.get(code).w > 100 ? 1 : 10);
const q = (code, a, b) => Math.max(qtyStep(code), roundTo(between(a, b), qtyStep(code)));

/** Isi pesanan per jenis pelanggan (perkiraan kebutuhan proyek nyata). */
function basket(seg) {
  const L = [];
  const add = (code, a, b) => L.push([code, q(code, a, b)]);
  switch (seg) {
    case "developer": {
      const pv = pick(["PVG-0101", "PVG-0101", "PVG-0101", "PVG-0105", "PVG-0102"]);
      const m2 = q(pv, 220, 680);
      L.push([pv, m2]);
      L.push([pick(["KST-0402", "KST-0402", "KST-0403"]), roundTo(m2 * between(0.55, 0.9), 10)]);
      if (chance(0.25)) {
        add(pick(["UDT-0201", "UDT-0203"]), 20, 60);
        if (chance(0.6)) add("UDT-0214", 6, 20);
      }
      break;
    }
    case "kontraktor": {
      const r = rnd();
      if (r < 0.55) {
        const ud = pick(["UDT-0201", "UDT-0203", "UDT-0203", "UDT-0206", "UDT-0209"]);
        const n = q(ud, ud === "UDT-0209" ? 12 : 30, ud === "UDT-0209" ? 40 : 120);
        L.push([ud, n]);
        const cover = { "UDT-0201": "UDT-0213", "UDT-0203": "UDT-0214", "UDT-0206": "UDT-0215", "UDT-0209": "UDT-0215" }[ud];
        if (chance(0.7)) L.push([cover, roundTo(n * between(0.2, 0.4), 2) || 2]);
      } else if (r < 0.85) {
        add(pick(["BUS-0305", "BUS-0307", "BUS-0304"]), 24, 70);
        if (chance(0.3)) add("BUS-0310", 6, 18);
      } else {
        add("PVG-0101", 200, 520);
        add("KST-0405", 60, 160);
      }
      break;
    }
    case "desa": {
      if (chance(0.55)) {
        add(pick(["BUS-0310", "BUS-0310", "BUS-0305"]), 10, 30);
        if (chance(0.5)) add("BUS-0307", 10, 24);
      } else {
        add(pick(["UDT-0201", "UDT-0203"]), 30, 90);
        if (chance(0.5)) add("UDT-0213", 8, 20);
      }
      break;
    }
    case "industri": {
      add(pick(["PVG-0105", "PVG-0101"]), 260, 760);
      add(pick(["UDT-0206", "UDT-0209"]), 20, 60);
      add("UDT-0215", 10, 30);
      break;
    }
    case "toko": {
      const opts = [
        () => add("BUS-0301", 30, 100), () => add("BUS-0302", 30, 80), () => add("BUS-0303", 20, 50), () => add("KST-0402", 100, 300),
        () => add("KST-0403", 50, 150), () => add("GTG-0501", 500, 2000), () => add("GTG-0503", 40, 140), () => add("PVG-0101", 30, 90), () => add("BUS-0311", 4, 12),
      ];
      const n = ibetween(2, 4);
      const used = new Set();
      while (used.size < n) used.add(Math.floor(rnd() * opts.length));
      for (const i of used) opts[i]();
      if (L.some(([c]) => c === "GTG-0501") && !L.some(([c]) => c === "GTG-0503")) L.push(["GTG-0503", roundTo(L.find(([c]) => c === "GTG-0501")[1] / 12, 10) || 10]);
      break;
    }
    case "lembaga": {
      const pv = pick(["PVG-0101", "PVG-0102", "PVG-0103"]);
      L.push([pv, q(pv, 150, 420)]);
      add("KST-0403", 80, 220);
      break;
    }
    case "perorangan": {
      const r = rnd();
      if (r < 0.55) {
        const pv = pick(["PVG-0102", "PVG-0103", "PVG-0101", "PVG-0102"]);
        L.push([pv, q(pv, 35, 140)]);
        if (chance(0.6)) add("KST-0402", 30, 90);
      } else if (r < 0.8) {
        add("BUS-0307", 4, 8);
        L.push(["BUS-0311", ibetween(1, 2)]);
      } else {
        add("GTG-0501", 600, 1600);
        add("GTG-0503", 40, 120);
      }
      break;
    }
  }
  // Gabungkan kode yang sama.
  const m = new Map();
  for (const [c, n] of L) m.set(c, (m.get(c) ?? 0) + n);
  return [...m].map(([code, qty]) => ({ code, qty }));
}

const PROJECTS = {
  developer: ["blok {B}", "jalan lingkungan blok {B}", "fasum taman & jogging track", "carport unit tipe 36 blok {B}", "jalan utama cluster"],
  kontraktor: ["saluran Jl. {J}", "drainase perumahan", "gorong-gorong akses gudang", "saluran pasar {A}", "jalan lingkungan {A}"],
  desa: ["gorong-gorong jalan desa", "saluran irigasi tersier", "drainase jalan poros desa", "box culvert jalan desa"],
  industri: ["parkir truk & drainase gudang {B}", "area loading dock", "jalan inspeksi pabrik"],
  lembaga: ["halaman & jalan masuk", "lapangan upacara", "parkir jamaah"],
  perorangan: ["halaman rumah", "carport rumah", "sumur resapan rumah", "atap rumah"],
  toko: ["stok toko"],
};
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const fillProject = (s, area) => cap(s).replace("{B}", pick(["A", "B", "C", "D", "E", "F"])).replace("{J}", pick(["Ahmad Yani", "Siliwangi", "Pahlawan", "Kertabumi", "Raya Klari"])).replace("{A}", AREAS[area].name.split(",")[0]);
const ESTATE = { C01: "Perumahan Griya Asri Bungursari", C02: "Perumahan Citra Jatiluhur", C03: "Perumahan Karya Hunian Cikampek", C04: "Cluster Permata Indah" };
const VILLAGES = ["Sukamulya", "Mekarjaya", "Cibening", "Sindangsari", "Tegalsari", "Margamulya", "Karyamekar", "Cijunti"];
/** Alamat kirim (lokasi proyek / rumah), bukan alamat kantor pelanggan. */
function deliveryAddress(c, area) {
  const n = ibetween(2, 120);
  switch (c.seg) {
    case "developer": return `${ESTATE[c.key] ?? "Lokasi perumahan"}, gerbang proyek`;
    case "kontraktor": return `Lokasi proyek, Jl. ${pick(["Raya", "Desa", "Lingkungan"])} ${pick(VILLAGES)}`;
    case "desa": return `Desa ${pick(VILLAGES)}, titik bongkar di ${pick(["balai desa", "pos pelaksana", "ujung jalan desa"])}`;
    case "industri": return `${c.name.includes("Gudang") ? "Kompleks gudang" : "Kawasan pabrik"}, ${pick(["gerbang 2", "pos satpam utara", "blok C"])}`;
    case "lembaga": return `${c.name.replace(/^(Panitia Pembangunan|DKM) /, "")}, ${pick(["halaman depan", "jalan masuk"])}`;
    default: return `${pick(["Jl. Melati", "Gg. Mawar", "Jl. Pahlawan", "Kp. Sukamaju", "Perum Griya Indah blok C"])} No. ${n}`;
  }
}
const SITE_CONTACTS = ["Pak Udin (mandor)", "Pak Sutisna", "Pak Engkos", "Pak Wahyu (site engineer)", "Bu Sri (toko)", "Pak Asep (pelaksana)", "Pak Jajang", "Pak Ade", "Ibu Lilis", "Pak Rahmat (pengawas)"];

const ORDERS = [];
const DEMAND = 1.45; // pengali volume pesanan (kalibrasi omzet)
function orderTotal(lines, ongkir, taxable) {
  const sub = lines.reduce((a, l) => a + l.qty * l.price, 0) + ongkir;
  return round(sub + (taxable ? (sub * 11) / 100 : 0));
}
const monthsList = [];
for (let m = ym(START); m <= ym(TODAY); m = nextMonth(m)) monthsList.push(m);
for (const m of monthsList) {
  const mm = m.slice(5, 7);
  const days = [];
  for (let d = `${m}-01`; d <= lastDay(m) && d <= TODAY; d = addDays(d, 1)) if (isWorkday(d)) days.push(d);
  if (!days.length) continue;
  const share = days.length / [...Array(31)].map((_, i) => addDays(`${m}-01`, i)).filter((d) => d.startsWith(m) && isWorkday(d)).length;
  for (const c of Object.values(CUST)) {
    const expected = c.freq * DEMAND * SEASON[mm] * (SEG_SEASON[c.seg]?.[mm] ?? 1) * share;
    const n = Math.floor(expected) + (chance(expected - Math.floor(expected)) ? 1 : 0);
    for (let k = 0; k < n; k++) {
      let d = days[Math.floor(((k + rnd()) / n) * days.length)];
      const ramadan = d >= "2026-02-19" && d < CLOSED_FROM;
      if (ramadan && c.seg === "perorangan" && chance(0.5)) continue;
      if (c.seg === "perorangan" && chance(0.1)) d = addDays(d, 1) <= TODAY && dow(addDays(d, 1)) === 0 ? addDays(d, 1) : d; // pesan lewat WhatsApp hari Minggu
      addOrder(c, d);
    }
  }
}
ORDERS.sort((a, b) => a.date.localeCompare(b.date));
ORDERS.forEach((o, i) => (o.key = `O${i + 1}`));
function addOrder(c, d) {
  const lines = basket(c.seg).map((l) => ({ ...l, price: priceFor(l.code, c.seg) }));
  const self = c.seg === "toko" && (c.key === "C20" ? chance(0.75) : chance(0.35));
  const ongkir = ["perorangan", "lembaga"].includes(c.seg) ? { 1: 250000, 2: 450000, 3: 650000 }[AREAS[c.area].zone] + (lines.reduce((a, l) => a + l.qty * ITEM.get(l.code).w, 0) > 4000 ? 200000 : 0) : 0;
  const proj = fillProject(pick(PROJECTS[c.seg]), c.area);
  const lead = c.seg === "toko" ? ibetween(0, 2) : c.seg === "perorangan" ? ibetween(1, 4) : ibetween(2, 6);
  ORDERS.push({
    key: `O${ORDERS.length + 1}`, date: d, c, lines, ongkir, self, taxable: c.taxable, project: c.seg === "toko" ? "" : proj,
    req: addWorkdays(isWorkday(d) ? d : nextWorkday(d), lead),
    ref: ["developer", "kontraktor", "industri", "desa"].includes(c.seg) ? `${c.name.split(" ").slice(1).map((w) => w[0]).join("").toUpperCase()}/PO/${d.slice(5, 7)}/${ibetween(10, 99)}` : "",
    site: c.seg === "toko" ? `${pick(["Bu Sri", "Pak Haji Oman", "Pak Dodi", "Bu Yeni"])} (toko)` : c.seg === "perorangan" ? c.name : pick(SITE_CONTACTS),
    trips: [],
    deposit: c.seg === "perorangan" || c.seg === "lembaga" ? 0.5 : c.seg === "kontraktor" && chance(0.35) ? 0.3 : 0,
  });
}

/* Pesanan batal (sebelum ada pengiriman) dan draf menunggu DP. */
const cancelled = new Set();
for (const o of ORDERS) {
  if (o.date < addDays(TODAY, -10) && ["perorangan", "kontraktor", "lembaga"].includes(o.c.seg) && chance(0.05)) cancelled.add(o.key);
}
if (cancelled.size < 2) {
  const pool = ORDERS.filter((o) => o.date < addDays(TODAY, -20) && o.date > "2026-04-01" && ["perorangan", "kontraktor", "desa"].includes(o.c.seg) && !cancelled.has(o.key));
  while (cancelled.size < 2 && pool.length) cancelled.add(pool.splice(Math.floor(rnd() * pool.length), 1)[0].key);
}
const DRAFT_REASON = "Menunggu DP 50% sebelum dikonfirmasi.";
const drafts = new Set(ORDERS.filter((o) => o.date >= addDays(TODAY, -2) && o.c.seg === "perorangan").map((o) => o.key));
if (!drafts.size) {
  const c = CUST.C32;
  const lines = [{ code: "PVG-0102", qty: 60, price: priceFor("PVG-0102", "perorangan") }];
  ORDERS.push({ key: `O${ORDERS.length + 1}`, date: TODAY, c, lines, ongkir: 250000, self: false, taxable: false, project: "Carport rumah", req: addWorkdays(onOrNextWorkday(TODAY), 3), ref: "", site: c.name, trips: [], deposit: 0.5 });
  drafts.add(ORDERS.at(-1).key);
}

/* Cerita "hari ini" untuk demo: dua truk sedang di jalan (terlihat di Lacak truk), pickup pagi sudah kembali,
   colt diesel berangkat siang, dan beberapa rit besok di rencana muat. */
const STORY = [];
function prevWorkdays(n) {
  let x = TODAY;
  for (let i = 0; i < n; i++) {
    x = addDays(x, -1);
    while (!isWorkday(x)) x = addDays(x, -1);
  }
  return x;
}
function story(ck, date, lines, trips, extra = {}) {
  const c = CUST[ck];
  const o = {
    key: `O${ORDERS.length + 1}`, date, c, lines: lines.map(([code, qty]) => ({ code, qty, price: priceFor(code, c.seg) })), ongkir: extra.ongkir ?? 0, self: false, taxable: c.taxable,
    project: extra.project ?? "", address: extra.address, req: trips[0].date, ref: extra.ref ?? "", site: extra.site ?? c.name, trips: [], preset: trips, deposit: extra.deposit ?? 0,
  };
  ORDERS.push(o);
  STORY.push(o);
}
if (isWorkday(TODAY)) {
  const T1 = nextWorkday(TODAY);
  story("C05", prevWorkdays(6), [["UDT-0203", 60], ["UDT-0214", 20]], [
    { date: prevWorkdays(2), veh: "V1", depart: 8.2, load: { "UDT-0203": 20 } },
    { date: TODAY, veh: "V1", depart: 8.9, load: { "UDT-0203": 20 } },
    { date: T1, veh: "V1", depart: 7.4, load: { "UDT-0203": 20, "UDT-0214": 20 } },
  ], { ref: "KMK/PO/X/52", project: "Saluran Jl. Kertabumi", address: "Jl. Kertabumi (depan pasar)", site: "Pak Sutisna (pelaksana)", deposit: 0.3 });
  story("C16", prevWorkdays(4), [["PVG-0105", 255], ["UDT-0215", 16]], [
    { date: prevWorkdays(1), veh: "V2", depart: 9.1, load: { "PVG-0105": 70 } },
    { date: TODAY, veh: "V2", depart: 9.85, load: { "PVG-0105": 65 } },
    { date: T1, veh: "V2", depart: 7.3, load: { "PVG-0105": 65 } },
    { date: nextWorkday(T1), veh: "V2", depart: 7.3, load: { "PVG-0105": 55, "UDT-0215": 16 } },
  ], { ref: "SLI/PO/X/118", project: "Pool truk & area parkir", site: "Pak Rahmat (pengawas)" });
  story("C21", prevWorkdays(1), [["BUS-0301", 10], ["KST-0402", 35]], [{ date: TODAY, veh: "V4", depart: 7.4, load: { "BUS-0301": 10, "KST-0402": 35 } }], { site: "Bu Yeni (toko)" });
  story("C34", prevWorkdays(3), [["PVG-0103", 35]], [{ date: TODAY, veh: "V3", depart: 13.2, load: { "PVG-0103": 35 } }], { project: "Halaman rumah", deposit: 0.5, ongkir: 250000 });
}

/* =================================================================== jadwal armada */

const ZONE_COST = { 1: 1, 2: 1.5, 3: 2 };
const SLOTS = { V1: 3, V2: 3, V3: 3, V4: 3.5 };
const fleet = new Map(); // tanggal → {V1: dipakai, …}
const used = (d, v) => fleet.get(d)?.[v] ?? 0;
const useSlot = (d, v, n) => {
  if (!fleet.has(d)) fleet.set(d, {});
  fleet.get(d)[v] = used(d, v) + n;
};
const slotsOf = (d, v) => (dow(d) === 6 ? SLOTS[v] - 0.5 : SLOTS[v]);
const HORIZON = addWorkdays(TODAY, 3); // jadwal kirim sampai 3 hari kerja ke depan

/** Bagi sisa pesanan ke rit sesuai kapasitas kendaraan dan jadwal armada. */
function scheduleOrder(o) {
  const zone = AREAS[o.c.area].zone;
  if (o.preset) {
    for (const t of o.preset) {
      o.trips.push({ ...t, drv: DRIVER_OF[t.veh], slot: used(t.date, t.veh), preset: true });
      useSlot(t.date, t.veh, ZONE_COST[zone]);
    }
    return;
  }
  const rem = o.lines.map((l) => ({ code: l.code, left: l.qty }));
  const kg = () => rem.reduce((a, r) => a + r.left * ITEM.get(r.code).w, 0);
  let d = o.req < o.date ? onOrNextWorkday(o.date) : onOrNextWorkday(o.req);
  // Proyek besar dikirim bertahap (satu rit per hari) mengikuti kesiapan lokasi bongkar.
  const perDay = ["developer", "industri", "lembaga"].includes(o.c.seg) ? 1 : 2;
  if (o.self) {
    // Diambil pelanggan dengan truknya sendiri: satu atau dua kali angkut.
    while (kg() > 0.5 && d <= HORIZON) {
      const load = {};
      let cap = 8000;
      for (const r of rem) {
        if (r.left <= 0) continue;
        const n = Math.min(r.left, Math.floor(cap / ITEM.get(r.code).w / qtyStep(r.code)) * qtyStep(r.code));
        if (n <= 0) continue;
        load[r.code] = n;
        r.left -= n;
        cap -= n * ITEM.get(r.code).w;
      }
      o.trips.push({ date: d, veh: null, drv: null, load, self: true });
      d = nextWorkday(d);
    }
    return;
  }
  let guard = 0;
  while (kg() > 0.5 && d <= HORIZON && guard++ < 60) {
    let today = 0;
    // Kendaraan dipilih sesuai berat sisa: muatan kecil cukup pickup, besar pakai truk engkel.
    const order = kg() <= 1100 ? ["V4", "V3", "V1", "V2"] : kg() <= 4500 ? ["V3", "V1", "V2", "V4"] : ["V1", "V2", "V3"];
    for (const v of order) {
      if (today >= perDay || kg() <= 0.5) break;
      if (zone === 3 && v === "V4") continue;
      while (slotsOf(d, v) - used(d, v) >= ZONE_COST[zone] && today < perDay && kg() > 0.5) {
        const load = {};
        let cap = VEH[v].kg;
        for (const r of rem) {
          if (r.left <= 0) continue;
          const w = ITEM.get(r.code).w;
          const step = qtyStep(r.code);
          let n = Math.min(r.left, Math.floor(cap / w / step) * step);
          if (n <= 0 && r.left * w <= cap) n = r.left;
          if (n <= 0) continue;
          load[r.code] = n;
          r.left = r0(r.left - n);
          cap -= n * w;
        }
        if (!Object.keys(load).length) break;
        o.trips.push({ date: d, veh: v, drv: DRIVER_OF[v], load, slot: used(d, v) });
        useSlot(d, v, ZONE_COST[zone]);
        today++;
      }
    }
    d = nextWorkday(d);
  }
}
const r0 = (n) => Math.round(n * 1000) / 1000;
for (const o of STORY) scheduleOrder(o);
for (const o of ORDERS) if (!o.preset && !cancelled.has(o.key) && !drafts.has(o.key)) scheduleOrder(o);

/* Di lapangan hampir tidak ada hari kerja tanpa pengiriman: di sela proyek, toko langganan menambah stok kecil.
   Hari yang masih sepi diisi pesanan toko yang dipesan 1–2 hari kerja sebelumnya. */
{
  const tripsOn = (d) => ORDERS.reduce((a, o) => a + o.trips.filter((t) => t.date === d).length, 0);
  const prevWork = (d, n) => {
    let x = d;
    for (let i = 0; i < n; i++) {
      x = addDays(x, -1);
      while (!isWorkday(x)) x = addDays(x, -1);
    }
    return x;
  };
  const TOKO = CUSTOMERS.filter(([, , seg, area]) => seg === "toko" && AREAS[area].zone < 3).map(([k]) => k);
  for (let d = nextWorkday(addDays(START, 6)); d <= HORIZON; d = nextWorkday(d)) {
    const min = dow(d) === 6 ? 1 : 2;
    for (let guard = 0; tripsOn(d) < min && guard < 4; guard++) {
      const od = d > TODAY ? TODAY : prevWork(d, ibetween(1, 2));
      if (od < START) break;
      addOrder(CUST[pick(TOKO)], od);
      const o = ORDERS.at(-1);
      o.req = d;
      o.self = false;
      scheduleOrder(o);
    }
  }
}

/* Status surat jalan menurut "hari ini". */
for (const o of ORDERS) {
  for (const t of o.trips) {
    const cost = t.veh ? ZONE_COST[AREAS[o.c.area].zone] : 1;
    if (!t.preset) t.depart = 7 + (t.slot ?? 0) * 2.6 + between(0, 0.4); // jam berangkat
    t.travel = (AREAS[o.c.area].km / 32) * between(0.9, 1.25); // jam perjalanan
    t.unload = t.self ? 0.75 : between(0.6, 1.3);
    t.arrive = t.depart + t.travel + t.unload;
    if (t.date < TODAY) t.status = "terkirim";
    else if (t.date > TODAY) t.status = "dijadwalkan";
    else if (t.arrive < NOW_HOUR) t.status = "terkirim";
    else if (t.depart < NOW_HOUR) t.status = "berangkat";
    else t.status = "dijadwalkan";
    t.cost = cost;
  }
}

/* =================================================================== rencana produksi */

const FAMILY_DAYS = { paving: [1, 2, 3, 4, 5, 6], kanstin: [2, 4, 6], genteng: [1, 3, 5], udit: [1, 2, 3, 4, 5], buis: [1, 3, 5] };
const FAMILY_CAP = { paving: 3, kanstin: 2, genteng: 2, udit: 4, buis: 3 };
const FAMILY_NOTE = { paving: "Mesin press paving", kanstin: "Mesin press kanstin", genteng: "Press genteng beton", udit: "Cetak basah U-Ditch & cover", buis: "Cetak buis beton" };
const OPENING_FG = {
  "PVG-0101": 520, "PVG-0102": 210, "PVG-0103": 90, "PVG-0105": 160, "KST-0402": 900, "KST-0403": 380, "KST-0405": 110, "GTG-0501": 3200, "GTG-0503": 280,
  "UDT-0201": 40, "UDT-0203": 46, "UDT-0206": 18, "UDT-0209": 10, "UDT-0213": 24, "UDT-0214": 30, "UDT-0215": 22,
  "BUS-0301": 140, "BUS-0302": 110, "BUS-0303": 70, "BUS-0304": 36, "BUS-0305": 42, "BUS-0307": 30, "BUS-0310": 10, "BUS-0311": 16,
};
const OPENING_RM = { "BB-SMN": 420, "BB-PSR": 18, "BB-ABU": 26, "BB-SPL": 16, "BB-BSI": 520, "BB-PGM": 70 };

const demand = new Map(); // code → Map(date → qty)
for (const o of ORDERS) for (const t of o.trips) for (const [code, n] of Object.entries(t.load)) {
  if (!demand.has(code)) demand.set(code, new Map());
  demand.get(code).set(t.date, (demand.get(code).get(t.date) ?? 0) + n);
}
const sumDemand = (code, from, to) => {
  let s = 0;
  for (const [d, n] of demand.get(code) ?? []) if (d >= from && d <= to) s += n;
  return s;
};
const PLAN = [];
const planned = new Map(Object.entries(OPENING_FG)); // proyeksi stok awal hari
let projDay = START;
const shippedBefore = (code, d) => sumDemand(code, "2000-01-01", addDays(d, -1));
const producedBefore = new Map();
for (let d = START; d <= TODAY; d = addDays(d, 1)) {
  if (!isWorkday(d)) continue;
  const runs = {};
  for (const fam of Object.keys(FAMILY_DAYS)) {
    if (!FAMILY_DAYS[fam].includes(dow(d))) continue;
    // Jelang libur Lebaran: tambah stok supaya pengiriman awal April tidak kosong.
    const look = d >= "2026-03-02" && d < CLOSED_FROM ? 24 : 12;
    const short = [];
    for (const [code, f] of Object.entries(FG)) {
      if (f.fam !== fam) continue;
      const now = (OPENING_FG[code] ?? 0) + (producedBefore.get(code) ?? 0) - shippedBefore(code, d);
      const avg = sumDemand(code, addDays(d, -30), addDays(d, -1)) / 30;
      const target = Math.max(sumDemand(code, d, addDays(d, look)), d > addDays(HORIZON, -look) ? avg * look : 0) + f.min;
      if (now < target) short.push({ code, n: Math.ceil((target - now) / f.batch), gap: (target - now) / Math.max(1, target) });
    }
    short.sort((a, b) => b.gap - a.gap);
    let cap = FAMILY_CAP[fam];
    for (const s of short) {
      if (cap <= 0) break;
      const n = Math.min(s.n, cap);
      runs[s.code] = n * FG[s.code].batch;
      cap -= n;
    }
  }
  const byFam = {};
  for (const [code, n] of Object.entries(runs)) {
    (byFam[FG[code].fam] ??= {})[code] = n;
    producedBefore.set(code, (producedBefore.get(code) ?? 0) + n);
  }
  for (const [fam, items] of Object.entries(byFam)) PLAN.push({ date: d, fam, items });
}

/* =================================================================== mesin peristiwa */

const EVENTS = [];
let evn = 0;
const at = (date, prio, fn) => {
  if (date > TODAY) return;
  EVENTS.push({ date, prio, n: ++evn, fn });
};

/* ---------- saldo awal 31 Desember 2025 */
const LOAN_START = 450000000;
at(OPENING, 0, () => {
  const jid = id("ju");
  const assets = 9750000 + 420000000 + 1600000000 + 850000000 + 465000000 + 640000000 + 28500000 - 662000000;
  journal({
    number: nextNumber("JU", OPENING), date: OPENING, memo: "Saldo awal per 31 Desember 2025 (neraca tutup buku 2025)", source: "manual", sourceId: jid, hour: 9,
    lines: [
      { account: A.kas, debit: 9750000, memo: "Kas kantor" },
      { account: A.bank, debit: 420000000, memo: "Rekening operasional" },
      { account: A.tanah, debit: 1600000000, memo: "Tanah pabrik ± 6.400 m²" },
      { account: A.bangunan, debit: 850000000, memo: "Bangunan pabrik, gudang, kantor" },
      { account: A.mesin, debit: 465000000, memo: "Mesin press paving & kanstin, mixer, cetakan U-Ditch & buis" },
      { account: A.kendaraan, debit: 640000000, memo: "2 truk engkel, colt diesel, pickup" },
      { account: A.peralatan, debit: 28500000, memo: "Komputer, printer, meja" },
      { account: A.akum, credit: 662000000, memo: "Akumulasi penyusutan s.d. 31 Desember 2025" },
      { account: A.hutBank, credit: LOAN_START, memo: "Sisa kredit investasi mesin & truk" },
      { account: A.modal, credit: 2000000000 },
      { account: A.labaDitahan, credit: assets - LOAN_START - 2000000000, memo: "Laba ditahan s.d. 2025" },
    ],
  });
  for (const [code, qty] of [...Object.entries(OPENING_FG), ...Object.entries(OPENING_RM)]) {
    const it = ITEM.get(code);
    const aid = id("adj");
    const num = nextNumber("ADJ", OPENING);
    const value = round(qty * it.std);
    const ts = epoch(OPENING, 10);
    const reason = "Saldo awal hasil stok opname 31 Desember 2025";
    put("inv_adjustments", { id: aid, number: num, date: OPENING, item_id: iref(code), qty, unit_cost: it.std, reason, created_by: null, created_at: ts, updated_at: ts });
    move(code, OPENING, qty, value, "saldo_awal", aid, num);
    const memo = `Saldo awal stok ${it.name} · ${reason}`;
    journal({ number: num, date: OPENING, memo, source: "penyesuaian", sourceId: aid, hour: 10, lines: [{ account: invAcc(code), debit: value, memo }, { account: A.saldoAwal, credit: value, memo }] });
  }
});

/* ---------- piutang & hutang awal: faktur/tagihan 2025 yang belum lunas (lawan Ekuitas Saldo Awal) */
const OPEN_AR = [
  ["C01", "2025-12-12", 98450000], ["C01", "2025-12-26", 64120000], ["C02", "2025-11-28", 87300000], ["C02", "2025-12-19", 52800000], ["C03", "2025-12-15", 71250000],
  ["C04", "2025-12-22", 33600000], ["C05", "2025-12-10", 58900000], ["C06", "2025-11-25", 46750000], ["C07", "2025-12-18", 39400000], ["C08", "2025-12-23", 27300000],
  ["C10", "2025-12-05", 41800000], ["C11", "2025-12-08", 62400000], ["C12", "2025-09-12", 38500000], ["C12", "2025-12-16", 29700000], ["C13", "2025-12-11", 44200000],
  ["C15", "2025-12-17", 76900000], ["C16", "2025-12-29", 34500000], ["C18", "2025-12-27", 14850000], ["C19", "2025-12-24", 9600000], ["C21", "2025-12-29", 11250000],
  ["C22", "2025-12-15", 8700000], ["C24", "2025-12-22", 12400000], ["C25", "2025-11-29", 7350000],
];
const OPEN_AP = [["S1", "2025-12-22", 48600000], ["S1", "2025-12-29", 39150000], ["S3", "2025-12-10", 28800000], ["S2", "2025-12-30", 6720000]];
at(OPENING, 0.5, () => {
  OPEN_AR.forEach(([ck, date, total], i) => {
    const c = CUST[ck];
    const iid = `demo-inv-awal-${String(i + 1).padStart(2, "0")}`;
    const number = nextNumber("INV", date);
    const due = addDays(date, c.term || 14);
    const ts = epoch(date, 16);
    put("fin_invoices", { id: iid, number, date, due_date: due, contact_id: CID[ck], order_id: null, subtotal: total, discount: 0, ongkir: 0, taxable: false, tax_rate: 0, tax: 0, total, paid: 0, note: "Saldo awal piutang dari pembukuan 2025 (nilai sudah termasuk PPN).", void: 0, created_by: null, created_at: ts, updated_at: ts });
    put("fin_invoice_lines", { id: `${iid}-l1`, invoice_id: iid, item_id: null, order_line_id: null, account_id: A.saldoAwal, description: `Sisa tagihan faktur 2025 per ${Number(date.slice(8))} ${bulan(date)} 2025`, qty: 1, unit: "", price: total, amount: total, sort: 0 });
    journal({ number, date: OPENING, memo: `Saldo awal piutang ${number} — ${c.name}`, source: "faktur", sourceId: iid, hour: 11, lines: [{ account: A.piutang, debit: total, contact: CID[ck], memo: c.name }, { account: A.saldoAwal, credit: total, contact: CID[ck], memo: "Saldo awal piutang" }] });
    const inv = { id: iid, number, total, paid: 0, due, date };
    OPEN_INV.push({ ck, inv });
    if (date < "2025-10-01") return; // tunggakan lama, belum ada kabar pembayaran
    const st = { order: { c } };
    const [a, b] = PAY_DELAY[c.pay];
    const payAt = onOrNextWorkday(addDays(due < START ? START : due, ibetween(Math.max(a, 1), Math.max(b, 6))));
    at(payAt, 5, () => receipt(st, payAt, "bank", inv.total - inv.paid, `Pelunasan ${number}`, inv));
  });
  OPEN_AP.forEach(([sk, date, total], i) => {
    const sup = SUPPLIERS[sk];
    const bid = `demo-pb-awal-${String(i + 1).padStart(2, "0")}`;
    const number = nextNumber("PBL", date);
    const due = addDays(date, sup.term);
    const ts = epoch(date, 9);
    put("fin_bills", { id: bid, number, supplier_ref: `${sk === "S1" ? "SR" : sk === "S3" ? "BPK" : "NOTA"}-2025/${ibetween(100, 999)}`, date, due_date: due, contact_id: CID[sk], subtotal: total, discount: 0, taxable: false, tax_rate: 0, tax: 0, total, paid: 0, note: "Saldo awal hutang dari pembukuan 2025.", void: 0, created_by: null, created_at: ts, updated_at: ts });
    put("fin_bill_lines", { id: `${bid}-l1`, bill_id: bid, item_id: null, account_id: A.saldoAwal, description: `Sisa tagihan ${sup.name} 2025`, qty: 1, unit: "", price: total, amount: total, sort: 0 });
    journal({ number, date: OPENING, memo: `Saldo awal hutang ${number} — ${sup.name}`, source: "pembelian", sourceId: bid, hour: 11, lines: [{ account: A.saldoAwal, debit: total, contact: CID[sk], memo: "Saldo awal hutang" }, { account: A.hutang, credit: total, contact: CID[sk], memo: sup.name }] });
    const bill = { id: bid, number, date, due, sup: sk, total, paid: 0 };
    BILLS.push(bill);
    const payDate = onOrNextWorkday(due < START ? START : due);
    at(payDate, 6, () => payBill(bill, payDate, sk === "S2" ? "kas" : "bank"));
  });
});
const OPEN_INV = [];

/* ---------- kas & bank */
function cashTxn(date, kind, accountKey, lines, memo, contact = null, toKey = null, hour = 15) {
  const account = accountKey === "kas" ? A.kas : A.bank;
  const amount = kind === "transfer" ? lines : lines.reduce((a, l) => a + l.amount, 0);
  if (amount <= 0) return;
  const cid = id("kas");
  const number = nextNumber(kind === "masuk" ? "KM" : kind === "keluar" ? "KK" : "TRF", date);
  const ts = epoch(date, hour, 5);
  put("fin_cash_txns", { id: cid, number, date, kind, account_id: account, to_account_id: toKey ? (toKey === "kas" ? A.kas : A.bank) : null, contact_id: contact, amount, memo, created_by: null, created_at: ts, updated_at: ts });
  let jl;
  if (kind === "transfer") {
    const to = toKey === "kas" ? A.kas : A.bank;
    jl = [{ account: to, debit: amount, memo }, { account, credit: amount, memo }];
  } else {
    lines.forEach((l, sort) => put("fin_cash_lines", { id: id("kasl"), cash_id: cid, account_id: l.account, amount: l.amount, memo: l.memo ?? "", sort }));
    jl =
      kind === "masuk"
        ? [{ account, debit: amount, memo, contact }, ...lines.map((l) => ({ account: l.account, credit: l.amount, memo: l.memo || memo, contact }))]
        : [...lines.map((l) => ({ account: l.account, debit: l.amount, memo: l.memo || memo, contact })), { account, credit: amount, memo, contact }];
  }
  journal({ number, date, memo: memo || `Kas ${kind} ${number}`, source: "kas", sourceId: cid, hour, lines: jl });
}
/** Isi kas kantor dari bank bila tidak cukup untuk pengeluaran tunai. */
function ensureCash(date, need) {
  if (bal(A.kas) >= need + 2000000) return;
  ensureBank(date, need + 15000000);
  const amt = Math.ceil((need + 15000000 - bal(A.kas)) / 5000000) * 5000000;
  cashTxn(date, "transfer", "bank", amt, "Tarik tunai untuk kas kantor", null, "kas", 8);
}
/** Rekening koran (KMK): cairkan bila saldo bank tidak cukup; dilunasi saat saldo longgar. */
let kmk = 0;
function ensureBank(date, need) {
  if (bal(A.bank) >= need + 40000000) return;
  const amt = Math.ceil((need + 80000000 - bal(A.bank)) / 25000000) * 25000000;
  kmk += amt;
  manualJournal(date, `Pencairan kredit modal kerja (rekening koran) ${amt.toLocaleString("id-ID")}`, [{ account: A.bank, debit: amt, memo: "Pencairan KMK" }, { account: A.hutBank, credit: amt, memo: "Rekening koran / KMK" }], 8);
}

/* ---------- pembelian bahan & pembayaran pemasok */
const BILLS = [];
function addBill({ date, sup, lines, taxable, note = "", ref = "" }) {
  const c = SUPPLIERS[sup];
  const bid = id("pb");
  const number = nextNumber("PBL", date);
  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const tax = taxable ? round((subtotal * 11) / 100) : 0;
  const total = subtotal + tax;
  const due = addDays(date, c.term);
  const ts = epoch(date, 9);
  put("fin_bills", { id: bid, number, supplier_ref: ref, date, due_date: due, contact_id: CID[sup], subtotal, discount: 0, taxable, tax_rate: taxable ? 11 : 0, tax, total, paid: 0, note, void: 0, created_by: null, created_at: ts, updated_at: ts });
  lines.forEach((l, sort) => {
    const it = l.code ? ITEM.get(l.code) : null;
    put("fin_bill_lines", { id: id("pbl"), bill_id: bid, item_id: l.code ? iref(l.code) : null, account_id: l.account ?? A.persBahan, description: l.desc ?? it?.name ?? "", qty: l.qty, unit: l.unit ?? it?.unit ?? "", price: l.price, amount: l.amount, sort });
    if (l.code) move(l.code, date, l.qty, l.amount, "pembelian", bid, `${number} ${c.name}`, 9);
  });
  const byAcc = new Map();
  for (const l of lines) byAcc.set(l.account ?? A.persBahan, (byAcc.get(l.account ?? A.persBahan) ?? 0) + l.amount);
  journal({
    number, date, memo: `Pembelian ${number} — ${c.name}`, source: "pembelian", sourceId: bid, hour: 9,
    lines: [...[...byAcc].map(([account, amount]) => ({ account, debit: amount, contact: CID[sup] })), { account: A.ppnMasukan, debit: tax, contact: CID[sup] }, { account: A.hutang, credit: total, contact: CID[sup], memo: c.name }],
  });
  const bill = { id: bid, number, date, due, sup, total, paid: 0 };
  BILLS.push(bill);
  return bill;
}
function buyMaterials(date, need) {
  const bySup = new Map();
  for (const [code, qty] of need) {
    const r = ITEM.get(code);
    if (!bySup.has(r.sup)) bySup.set(r.sup, []);
    bySup.get(r.sup).push([code, qty]);
  }
  for (const [sup, list] of bySup) {
    const idx = PRICE_INDEX[date.slice(5, 7)];
    const lines = list.map(([code, qty]) => {
      const it = ITEM.get(code);
      const price = roundTo(it.price * idx * between(0.985, 1.025), it.price > 100000 ? 1000 : 100);
      return { code, qty, price, amount: round(qty * price) };
    });
    const taxable = list.some(([code]) => ITEM.get(code).tax);
    const ref = sup === "S1" ? `SR/${date.slice(5, 7)}${date.slice(8)}/${ibetween(100, 899)}` : sup === "S2" ? `NOTA ${ibetween(300, 999)}` : `BPK-${date.replace(/-/g, "").slice(2)}`;
    const bill = addBill({ date, sup, lines, taxable, ref, note: sup === "S2" ? "Dikirim per rit dump truck." : "" });
    const late = sup === "S3" && chance(0.3) ? ibetween(3, 12) : 0;
    const payDate = onOrNextWorkday(addDays(bill.due, late));
    at(payDate, 6, () => payBill(bill, payDate, sup === "S2" ? "kas" : "bank"));
  }
}
function payBill(bill, date, accKey, amount = bill.total - bill.paid, memo) {
  if (bill.paid >= bill.total || amount <= 0) return;
  const c = SUPPLIERS[bill.sup];
  const account = accKey === "kas" ? A.kas : A.bank;
  if (accKey === "kas") ensureCash(date, amount);
  else ensureBank(date, amount);
  const pid = id("byr");
  const number = nextNumber("BYR", date);
  const ts = epoch(date, 14);
  put("fin_payments", { id: pid, number, date, contact_id: CID[bill.sup], account_id: account, amount, memo: memo ?? (accKey === "kas" ? "Bayar tunai ke sopir dump truck" : `Transfer pelunasan ${bill.number}`), created_by: null, created_at: ts, updated_at: ts });
  put("fin_payment_allocations", { id: id("byra"), payment_id: pid, bill_id: bill.id, amount });
  bill.paid += amount;
  journal({ number, date, memo: `Pembayaran ${number} — ${c.name}`, source: "pembayaran", sourceId: pid, hour: 14, lines: [{ account: A.hutang, debit: amount, contact: CID[bill.sup] }, { account, credit: amount, contact: CID[bill.sup] }] });
}

/* ---------- produksi */
const weekLabor = new Map(); // hari bayar → upah
/** Upah borongan dibayar tiap Sabtu; minggu yang menyeberang bulan dibayar di hari kerja terakhir bulan itu
 *  supaya biaya upah tiap bulan tidak bergeser ke bulan berikutnya. */
function payday(d) {
  let x = d;
  while (dow(x) !== 6) x = addDays(x, 1);
  const sat = onOrNextWorkday(x);
  if (ym(sat) === ym(d)) return sat;
  let last = addDays(`${ym(addDays(`${ym(d)}-28`, 7))}-01`, -1);
  while (!isWorkday(last)) last = addDays(last, -1);
  return last < d ? sat : last;
}
const WEEKLY = new Set();
for (let s = START; s <= TODAY; s = addDays(s, 1)) if (dow(s) === 6) WEEKLY.add(onOrNextWorkday(s));
const prodToday = new Map(); // tanggal → total produksi (untuk listrik)
function produce(date, fam, items, extraNote = "") {
  const need = {};
  for (const [code, qty] of Object.entries(items)) for (const [m, mq] of Object.entries(recipe(code, qty))) need[m] = r3((need[m] ?? 0) + mq);
  const buy = Object.entries(need)
    .filter(([m, mq]) => lv(m).qty - mq < ITEM.get(m).min)
    .map(([m, mq]) => [m, Math.max(ITEM.get(m).batch, Math.ceil((mq + ITEM.get(m).min - lv(m).qty) / ITEM.get(m).batch) * ITEM.get(m).batch)]);
  if (buy.length) buyMaterials(date, buy);
  const pid = id("prd");
  const number = nextNumber("PRD", date);
  const out = Object.entries(items);
  const used = Object.entries(need);
  const usedValues = used.map(([m, mq]) => round(mq * unitCost(m)));
  const materials = usedValues.reduce((a, v) => a + v, 0);
  const labor = out.reduce((a, [code, n]) => a + n * ITEM.get(code).labor, 0);
  const total = materials + labor;
  const weights = out.map(([code, n]) => n * ITEM.get(code).std);
  const wsum = weights.reduce((a, w) => a + w, 0) || 1;
  const outValues = out.map((_, i) => round((total * weights[i]) / wsum));
  outValues[outValues.length - 1] += total - outValues.reduce((a, v) => a + v, 0);
  const note = `${FAMILY_NOTE[fam]}${extraNote}${fam === "paving" && items["PVG-0102"] && chance(0.5) ? ", sebagian warna merah" : ""}`;
  const ts = epoch(date, 15);
  put("inv_productions", { id: pid, number, date, labor_cost: labor, note, created_by: null, created_at: ts, updated_at: ts });
  out.forEach(([code, n], i) => {
    put("inv_production_lines", { id: id("pl"), production_id: pid, role: "hasil", item_id: iref(code), qty: n });
    move(code, date, n, outValues[i], "produksi", pid, number, 15);
  });
  used.forEach(([m, mq], i) => {
    put("inv_production_lines", { id: id("pl"), production_id: pid, role: "bahan", item_id: iref(m), qty: mq });
    move(m, date, -mq, -usedValues[i], "produksi", pid, number, 15);
  });
  journal({
    number, date, memo: `Hasil produksi ${number} · ${note}`, source: "produksi", sourceId: pid, hour: 15,
    lines: [
      ...out.map(([code], i) => ({ account: A.persJadi, debit: outValues[i], memo: ITEM.get(code).name })),
      ...used.map(([m], i) => ({ account: A.persBahan, credit: usedValues[i], memo: ITEM.get(m).name })),
      { account: A.upah, credit: labor, memo: "Biaya produksi diserap ke persediaan" },
    ],
  });
  const pd = payday(date);
  weekLabor.set(pd, (weekLabor.get(pd) ?? 0) + labor);
  prodToday.set(ym(date), (prodToday.get(ym(date)) ?? 0) + total);
}
// Hasil produksi dicatat sore setelah dihitung, jadi produksi "hari ini" belum tercatat pada jam demo (10.30).
for (const p of PLAN) if (p.date < TODAY) at(p.date, 2, () => produce(p.date, p.fam, p.items));

/* ---------- pesanan, surat jalan, faktur, penerimaan */
const ST = new Map();
const tripsOn = new Map(); // tanggal → [{zone}]
const PAY_DELAY = { tepat: [-5, 2], biasa: [0, 14], lambat: [10, 30], sangat_lambat: [25, 60], macet: [40, 95] };

function receipt(st, date, accKey, amount, memo, inv) {
  const c = st.order.c;
  const account = accKey === "deposit" ? A.umJual : accKey === "kas" ? A.kas : A.bank;
  const rid = id("trm");
  const number = nextNumber("TRM", date);
  const ts = epoch(date, accKey === "deposit" ? 16.5 : 13);
  put("fin_receipts", { id: rid, number, date, contact_id: CID[c.key], account_id: account, amount, memo, created_by: null, created_at: ts, updated_at: ts });
  if (inv) {
    put("fin_receipt_allocations", { id: id("trma"), receipt_id: rid, invoice_id: inv.id, amount });
    inv.paid += amount;
  }
  journal({
    number, date, memo: `Penerimaan ${number} — ${c.name}`, source: "penerimaan", sourceId: rid, hour: accKey === "deposit" ? 16.5 : 13,
    lines: inv ? [{ account, debit: amount, contact: CID[c.key] }, { account: A.piutang, credit: amount, contact: CID[c.key] }] : [{ account, debit: amount, contact: CID[c.key] }, { account: A.umJual, credit: amount, contact: CID[c.key], memo: "Uang muka / titipan pelanggan" }],
  });
}

function invoiceNow(st, date, last) {
  const o = st.order;
  const c = o.c;
  const rows = st.lines.map((l) => ({ l, qty: r3((st.delivered.get(l.id) ?? 0) - (st.invoiced.get(l.id) ?? 0)) })).filter((x) => x.qty > 0);
  if (!rows.length) return;
  const iid = `${st.id}-inv${st.invoices.length + 1}`;
  const number = nextNumber("INV", date);
  const amounts = rows.map(({ l, qty }) => round(qty * l.price));
  const subtotal = amounts.reduce((a, v) => a + v, 0);
  const ongkir = st.invoices.length === 0 ? o.ongkir : 0;
  const dpp = subtotal + ongkir;
  const tax = o.taxable ? round((dpp * 11) / 100) : 0;
  const total = dpp + tax;
  const due = addDays(date, c.term || 14);
  const ts = epoch(date, 16, 20);
  put("fin_invoices", {
    id: iid, number, date, due_date: due, contact_id: CID[c.key], order_id: st.id, subtotal, discount: 0, ongkir, taxable: o.taxable, tax_rate: o.taxable ? 11 : 0, tax, total, paid: 0,
    note: "", void: 0, created_by: null, created_at: ts, updated_at: ts,
  });
  rows.forEach(({ l, qty }, sort) => {
    put("fin_invoice_lines", { id: `${iid}-${l.code}`, invoice_id: iid, item_id: iref(l.code), order_line_id: l.id, account_id: A.penjualan, description: ITEM.get(l.code).name, qty, unit: ITEM.get(l.code).unit, price: l.price, amount: amounts[sort], sort });
    st.invoiced.set(l.id, r3((st.invoiced.get(l.id) ?? 0) + qty));
  });
  journal({
    number, date, memo: `Faktur ${number} — ${c.name}`, source: "faktur", sourceId: iid, hour: 16,
    lines: [{ account: A.piutang, debit: total, contact: CID[c.key], memo: c.name }, { account: A.penjualan, credit: subtotal, contact: CID[c.key] }, { account: A.ongkir, credit: ongkir, contact: CID[c.key] }, { account: A.ppnKeluaran, credit: tax, contact: CID[c.key] }],
  });
  const inv = { id: iid, number, total, paid: 0, due, date };
  st.invoices.push(inv);

  // Pakai uang muka dulu (hari yang sama), sisanya dibayar sesuai kebiasaan pelanggan.
  if (st.deposit > 0) {
    const use = Math.min(st.deposit, inv.total);
    receipt(st, date, "deposit", use, "Pemakaian uang muka", inv);
    st.deposit -= use;
  }
  const open = inv.total - inv.paid;
  if (open <= 0) return;
  if (["perorangan"].includes(c.seg)) {
    if (last) at(date, 5, () => receipt(st, date, chance(0.55) ? "kas" : "bank", open, "Pelunasan saat barang tiba", inv));
    else at(addWorkdays(date, ibetween(1, 4)), 5, () => receipt(st, onOrNextWorkday(addWorkdays(date, 1)), "bank", inv.total - inv.paid, "Transfer pembayaran", inv));
    return;
  }
  if (c.seg === "lembaga") {
    const d = onOrNextWorkday(addDays(date, ibetween(2, 10)));
    at(d, 5, () => receipt(st, d, "bank", inv.total - inv.paid, "Pelunasan dari panitia/yayasan", inv));
    return;
  }
  if (c.pay === "macet" && chance(0.6)) return; // belum dibayar sama sekali
  const [a, b] = PAY_DELAY[c.pay];
  const payAt = onOrNextWorkday(addDays(due, ibetween(a, b)));
  if (c.seg === "desa" && chance(0.6)) {
    const first = roundTo(open * between(0.45, 0.65), 100000);
    at(payAt, 5, () => receipt(st, payAt, "bank", Math.min(first, inv.total - inv.paid), "Pembayaran termin 1", inv));
    const second = onOrNextWorkday(addDays(payAt, ibetween(25, 50)));
    at(second, 5, () => receipt(st, second, "bank", inv.total - inv.paid, "Pelunasan termin 2", inv));
    return;
  }
  at(payAt, 5, () => receipt(st, payAt, c.seg === "toko" && chance(0.25) ? "kas" : "bank", inv.total - inv.paid, `Pembayaran ${inv.number}`, inv));
}

for (const o of ORDERS) {
  const st = { order: o, id: `demo-po-${o.key.toLowerCase()}`, lines: [], delivered: new Map(), invoiced: new Map(), invoices: [], deposit: 0, number: "" };
  ST.set(o.key, st);
  const status = cancelled.has(o.key) ? "batal" : drafts.has(o.key) ? "draft" : "dikonfirmasi";
  at(o.date, 1, () => {
    st.number = nextNumber("PO", o.date);
    const ts = epoch(o.date, 9 + between(0, 6));
    st.lines = o.lines.map((l, sort) => ({ id: `${st.id}-l${sort + 1}`, ...l, sort }));
    const area = AREAS[o.c.area];
    const ll = [area.ll[0] + between(-0.006, 0.006), area.ll[1] + between(-0.006, 0.006)].map((x) => x.toFixed(5));
    put("ops_orders", {
      id: st.id, number: st.number, date: o.date, contact_id: CID[o.c.key], customer_ref: o.ref, project: o.project,
      address: o.self ? "Diambil sendiri di pabrik" : `${o.address ?? deliveryAddress(o.c, area)}, ${area.name}`,
      maps_url: o.self ? "" : `https://www.google.com/maps?q=${ll[0]},${ll[1]}`, site_contact: o.self ? "" : `${o.site} 0811 0000 ${ibetween(5100, 5999)}`, requested_date: o.req,
      status, ongkir: o.ongkir, discount: 0, taxable: o.taxable,
      note: status === "batal" ? pick(["Dibatalkan pelanggan: proyek ditunda pemilik.", "Batal: pelanggan memakai produk cor di tempat.", "Batal: anggaran proyek belum cair."]) : status === "draft" ? DRAFT_REASON : o.self ? "Pelanggan ambil sendiri dengan truknya." : "",
      created_by: null, created_at: ts, updated_at: ts,
    });
    for (const l of st.lines) put("ops_order_lines", { id: l.id, order_id: st.id, item_id: iref(l.code), description: "", qty: l.qty, unit: ITEM.get(l.code).unit, price: l.price, sort: l.sort });
  });
  if (status !== "dikonfirmasi") continue;
  if (o.deposit) {
    const dd = o.c.seg === "perorangan" ? o.date : onOrNextWorkday(addDays(o.date, 1));
    const amount = roundTo(orderTotal(o.lines, o.ongkir, o.taxable) * o.deposit, 100000);
    at(isWorkday(dd) ? dd : o.date, 1.5, () => {
      receipt(st, isWorkday(dd) ? dd : o.date, o.c.seg === "perorangan" && chance(0.5) ? "kas" : "bank", amount, `DP ${Math.round(o.deposit * 100)}% ${o.project || "pesanan"}`, null);
      st.deposit += amount;
    });
  }
  const done = o.trips.filter((t) => t.status === "terkirim");
  const lastTrip = o.trips.at(-1);
  o.trips.forEach((t, ti) => {
    // Surat jalan untuk hari-hari ke depan sudah dibuat hari ini (status dijadwalkan).
    at(t.date > TODAY ? TODAY : t.date, t.date > TODAY ? 8 : 3 + ti / 1000, () => {
      if (t.status === "dijadwalkan") {
        // dibuat saat penjadwalan (sehari sebelumnya), stok belum keluar
      }
      const did = `${st.id}-sj${ti + 1}`;
      t.id = did;
      const number = nextNumber("SJ", t.date);
      const dep = epoch(t.date, t.depart);
      const arr = epoch(t.date, t.arrive);
      const created = t.date > TODAY ? epoch(TODAY, 9.5) : epoch(addDays(t.date, -1), 15.5);
      put("ops_deliveries", {
        id: did, number, order_id: st.id, date: t.date, vehicle_id: t.veh ? `demo-vh-${t.veh.toLowerCase()}` : null, driver_id: t.drv ? `demo-dr-${t.drv.toLowerCase()}` : null, status: t.status,
        departed_at: t.status === "dijadwalkan" ? null : dep, delivered_at: t.status === "terkirim" ? arr : null, received_by: t.status === "terkirim" ? (t.self ? `${o.site.split(" (")[0]} (sopir pelanggan)` : o.site.split(" (")[0]) : "", proof_key: null,
        note: t.self ? "Diambil pelanggan dengan truk sendiri." : "", created_by: null, created_at: created, updated_at: t.status === "terkirim" ? arr : created,
      });
      const jl = [];
      for (const [code, n] of Object.entries(t.load)) {
        const line = st.lines.find((l) => l.code === code);
        put("ops_delivery_lines", { id: `${did}-${code}`, delivery_id: did, order_line_id: line.id, item_id: iref(code), qty: n });
        if (t.status === "dijadwalkan") continue;
        if (lv(code).qty + 1e-6 < n) {
          const f = FG[code];
          produce(t.date, f.fam, { [code]: Math.ceil((n - lv(code).qty) / f.batch) * f.batch }, " (lembur untuk pengiriman)");
        }
        const value = round(n * unitCost(code));
        move(code, t.date, -n, -value, "pengiriman", did, number, t.depart);
        jl.push({ account: A.hpp, debit: value, memo: ITEM.get(code).name, contact: CID[o.c.key] }, { account: invAcc(code), credit: value, memo: ITEM.get(code).name });
        if (t.status === "terkirim") st.delivered.set(line.id, r3((st.delivered.get(line.id) ?? 0) + n));
      }
      if (jl.length) journal({ number, date: t.date, memo: `HPP surat jalan ${number} · ${st.number}`, source: "pengiriman", sourceId: did, hour: t.depart, lines: jl });
      if (t.status !== "dijadwalkan" && t.veh) {
        if (!tripsOn.has(t.date)) tripsOn.set(t.date, []);
        tripsOn.get(t.date).push({ zone: AREAS[o.c.area].zone, veh: t.veh });
      }
    });
  });
  // Faktur: per rit (toko), saat pesanan lengkap (perorangan/lembaga), atau tiap tanggal 15 & akhir bulan (proyek).
  const invDates = new Set();
  const complete = done.length === o.trips.length && o.trips.length > 0 && lastTrip && lastTrip.status === "terkirim" && o.lines.every((l) => o.trips.reduce((a, t) => a + (t.load[l.code] ?? 0), 0) >= l.qty - 1e-6);
  if (o.c.seg === "toko") for (const t of done) invDates.add(t.date);
  else if (["perorangan", "lembaga"].includes(o.c.seg)) {
    if (complete) invDates.add(lastTrip.date);
  } else {
    // Proyek ditagih tiap Jumat untuk barang yang sudah diterima minggu itu.
    for (const t of done) {
      let f = t.date;
      while (dow(f) !== 5) f = addDays(f, 1);
      const monthEnd = onOrPrevWorkday(lastDay(ym(t.date)));
      invDates.add(f > monthEnd && monthEnd >= t.date ? monthEnd : onOrNextWorkday(f));
    }
    if (complete) invDates.add(onOrNextWorkday(addDays(lastTrip.date, chance(0.5) ? 0 : 1)));
  }
  const sorted = [...invDates].filter((d) => d <= TODAY).sort();
  sorted.forEach((d, i) => at(d, 4, () => invoiceNow(st, d, complete && i === sorted.length - 1)));
}

/* ---------- biaya rutin */
const DONE = new Set();
function monthDone(day, key) {
  const k = `${key}:${ym(day)}`;
  if (DONE.has(k)) return true;
  DONE.add(k);
  return false;
}
/** Kantor & bank tetap jalan saat pabrik libur Lebaran (kecuali tanggal merah). */
const isOfficeDay = (d) => dow(d) !== 0 && dow(d) !== 6 && !HOLIDAYS.has(d);
const MONTH_GAJI = 72800000; // 14 karyawan tetap: admin, marketing, kepala gudang, sopir, kenek, satpam, mekanik
for (let d = START; d <= TODAY; d = addDays(d, 1)) {
  const day = d;
  const dd = Number(day.slice(8));
  const mm = day.slice(5, 7);
  // Senin pagi: isi kas kantor.
  if (dow(day) === 1 && isWorkday(day)) at(day, 0.5, () => ensureCash(day, 12000000));
  // Hari bayar mingguan (Sabtu): upah borongan produksi, solar & tol, uang jalan sopir, iuran lingkungan.
  // Akhir bulan (bukan hari bayar mingguan): hanya upah borongan produksi s.d. hari itu.
  if (isWorkday(day) && !WEEKLY.has(day)) {
    at(day, 7, () => {
      const labor = weekLabor.get(day) ?? 0;
      if (!labor) return;
      weekLabor.delete(day);
      const lines = [{ account: A.upah, amount: labor, memo: "Upah borongan produksi s.d. akhir bulan" }];
      ensureCash(day, labor);
      cashTxn(day, "keluar", "kas", lines, "Pembayaran upah borongan produksi akhir bulan", null, null, 16);
    });
  }
  if (WEEKLY.has(day)) {
    at(day, 7, () => {
      const labor = weekLabor.get(day) ?? 0;
      weekLabor.delete(day);
      let fuel = 0;
      let allow = 0;
      let trips = 0;
      for (let k = 0; k < 7; k++) {
        for (const t of tripsOn.get(addDays(day, -k)) ?? []) {
          trips++;
          fuel += { 1: 150000, 2: 230000, 3: 340000 }[t.zone];
          allow += { 1: 60000, 2: 85000, 3: 120000 }[t.zone];
        }
        tripsOn.delete(addDays(day, -k));
      }
      fuel = roundTo(fuel + 650000, 1000); // forklift & genset
      const lines = [
        ...(labor ? [{ account: A.upah, amount: labor, memo: "Upah borongan produksi minggu ini" }] : []),
        { account: A.bbm, amount: fuel, memo: `Solar armada & forklift (${trips} rit)` },
        ...(allow ? [{ account: A.uangJalan, amount: allow, memo: `Uang jalan sopir & kenek ${trips} rit` }] : []),
      ];
      ensureCash(day, lines.reduce((a, l) => a + l.amount, 0));
      cashTxn(day, "keluar", "kas", lines, "Pembayaran mingguan: upah produksi, solar, uang jalan", null, null, 16);
    });
  }
  if (!isOfficeDay(day)) continue;
  // Listrik & air (sekitar tanggal 6), bergantung volume produksi bulan lalu.
  if (dd >= 6 && !monthDone(day, "listrik")) {
    at(day, 7, () => {
      const prev = prodToday.get(ym(addDays(`${ym(day)}-01`, -1))) ?? 300000000;
      const pln = roundTo(4200000 + prev * 0.012, 1000);
      cashTxn(day, "keluar", "bank", [{ account: A.listrik, amount: pln, memo: "Tagihan PLN pabrik (golongan I-2)" }, { account: A.listrik, amount: ibetween(340, 420) * 1000, memo: "PDAM kantor" }], "Listrik & air bulan lalu", null, null, 10);
    });
  }
  if (dd >= 5 && !monthDone(day, "komisi") && day >= "2026-02-01") {
    at(day, 7, () => {
      const prev = monthly.get(ym(addDays(`${ym(day)}-01`, -1)))?.rev ?? 0;
      cashTxn(day, "keluar", "bank", [{ account: A.iklan, amount: roundTo(prev * 0.01, 1000), memo: `Komisi tim marketing 1% penjualan ${bulan(addDays(`${ym(day)}-01`, -1))}` }], "Komisi marketing", null, null, 10);
    });
  }
  if (dd >= 10 && !monthDone(day, "telp")) at(day, 7, () => cashTxn(day, "keluar", "bank", [{ account: A.telp, amount: 485000, memo: "Internet kantor & pulsa admin" }], "Telepon & internet", null, null, 10));
  if (dd >= 2 && !monthDone(day, "iklan")) at(day, 7, () => cashTxn(day, "keluar", "bank", [{ account: A.iklan, amount: SEASON[mm] >= 1 ? 2500000 : 1500000, memo: `Iklan pencarian & marketplace ${bulan(day)}` }], "Biaya iklan", null, null, 10));
  if (dd >= 20 && !monthDone(day, "cicilan")) {
    at(day, 7, () => {
      const inv = Math.max(0, LOAN_START - 12500000 * (Number(mm) - 1));
      const interest = round(((inv + kmk) * 0.105) / 12);
      ensureBank(day, 12500000 + interest);
      cashTxn(day, "keluar", "bank", [{ account: A.hutBank, amount: 12500000, memo: "Angsuran pokok kredit investasi" }, { account: A.bebanLuar, amount: interest, memo: "Bunga kredit investasi & rekening koran" }], `Angsuran bank ${bulan(day)}`, null, null, 9);
    });
  }
  // Gaji: tanggal 25 (Maret dibayar 13 Maret bersama THR karena pabrik libur Lebaran).
  const gajiDay = mm === "03" ? dd === 13 : dd >= 25 && !monthDone(day, "gaji");
  if (gajiDay) {
    at(day, 7, () => {
      ensureBank(day, MONTH_GAJI * (mm === "03" ? 2 : 1) + 30000000);
      cashTxn(day, "keluar", "bank", [{ account: A.gaji, amount: MONTH_GAJI, memo: "Gaji 14 karyawan tetap" }], `Gaji karyawan ${bulan(day)} 2026`, null, null, 9);
      if (mm === "03") cashTxn(day, "keluar", "bank", [{ account: A.gaji, amount: MONTH_GAJI, memo: "THR karyawan tetap (1 bulan gaji)" }, { account: A.upah, amount: 26000000, memo: "THR pekerja borongan produksi (26 orang)" }], "Tunjangan Hari Raya Idulfitri 1447 H", null, null, 10);
    });
  }
  // ATK & beban lain kecil, perawatan kendaraan dan mesin tidak tentu.
  if (dd >= 14 && !monthDone(day, "atk")) {
    at(day, 7, () => {
      const atk = ibetween(28, 55) * 10000;
      ensureCash(day, atk + 750000);
      cashTxn(day, "keluar", "kas", [{ account: A.atk, amount: atk, memo: pick(["Kertas, tinta printer, buku surat jalan rangkap 3", "Map, materai, kertas", "Tinta printer & buku nota"]) }, { account: A.lain, amount: 750000, memo: "Iuran keamanan & kebersihan lingkungan" }], "ATK & iuran lingkungan", null, null, 11);
    });
  }
  if (chance(0.06)) {
    at(day, 7, () => {
      const v = pick(Object.values(VEH));
      const amt = ibetween(45, 260) * 10000;
      ensureCash(day, amt);
      cashTxn(day, "keluar", "kas", [{ account: A.rawatKend, amount: amt, memo: `${pick(["Servis berkala & ganti oli", "Ganti kampas rem", "Tambal & spooring", "Ganti filter solar"])} ${v.plate}` }], "Perawatan kendaraan", null, null, 13);
    });
  }
  if (chance(0.03)) {
    at(day, 7, () => {
      const amt = ibetween(60, 380) * 10000;
      ensureCash(day, amt);
      cashTxn(day, "keluar", "kas", [{ account: A.rawatMesin, amount: amt, memo: pick(["Ganti seal hidrolik mesin press", "Las cetakan U-Ditch retak", "Ganti bearing mixer", "Oli hidrolik & gemuk"]) }], "Perawatan mesin", null, null, 13);
    });
  }
}

/* ---------- peristiwa sekali */
const ONE_OFF = [
  ["2026-02-12", () => addBill({ date: "2026-02-12", sup: "S5", taxable: true, ref: "DTB-0212", lines: [{ account: A.rawatKend, desc: "Ban 7.50-16 (4 buah) truk T 8417 BD", qty: 4, unit: "buah", price: 1450000, amount: 5800000 }] })],
  ["2026-04-28", () => { ensureBank("2026-04-28", 120000000); cashTxn("2026-04-28", "keluar", "bank", [{ account: A.prive, amount: 120000000, memo: "Dividen tahun buku 2025 (keputusan RUPS April 2026)" }], "Pembagian dividen tahun buku 2025", null, null, 10); }],
  ["2026-05-12", () => {
    const b = addBill({ date: "2026-05-12", sup: "S4", taxable: false, ref: "BLCM-05/26", note: "Dibayar dua kali.", lines: [{ account: A.mesin, desc: "Cetakan U-Ditch 600 × 600 × 1200 (2 set)", qty: 2, unit: "set", price: 19250000, amount: 38500000 }] });
    at("2026-05-19", 6, () => payBill(b, "2026-05-19", "bank", 20000000, "Pembayaran 1 cetakan U-Ditch"));
    at("2026-06-09", 6, () => payBill(b, "2026-06-09", "bank", undefined, "Pelunasan cetakan U-Ditch"));
  }],
  ["2026-06-18", () => { const b = addBill({ date: "2026-06-18", sup: "S4", taxable: false, ref: "BLCM-06/26", lines: [{ account: A.rawatMesin, desc: "Overhaul pompa hidrolik mesin press paving", qty: 1, unit: "paket", price: 7850000, amount: 7850000 }] }); at("2026-07-02", 6, () => payBill(b, "2026-07-02", "bank")); }],
  ["2026-07-08", () => { const b = addBill({ date: "2026-07-08", sup: "S5", taxable: true, ref: "DTB-0708", lines: [{ account: A.rawatKend, desc: "Aki 100 Ah (2 buah) colt T 9125 AB & truk T 8593 BC", qty: 2, unit: "buah", price: 1650000, amount: 3300000 }] }); at("2026-07-22", 6, () => payBill(b, "2026-07-22", "bank")); }],
  ["2026-08-14", () => { ensureCash("2026-08-14", 1500000); cashTxn("2026-08-14", "keluar", "kas", [{ account: A.lain, amount: 1500000, memo: "Sumbangan lomba HUT RI warga sekitar pabrik" }], "Sumbangan 17 Agustus", null, null, 11); }],
  ["2026-09-03", () => { const b = addBill({ date: "2026-09-03", sup: "S5", taxable: true, ref: "DTB-0903", lines: [{ account: A.rawatKend, desc: "Ban 7.50-16 (6 buah) truk T 8593 BC", qty: 6, unit: "buah", price: 1480000, amount: 8880000 }] }); at("2026-09-17", 6, () => payBill(b, "2026-09-17", "bank")); }],
];
for (const [d, fn] of ONE_OFF) at(d, 7, fn);
// Tagihan ban Februari dibayar saat jatuh tempo.
at("2026-02-26", 6.5, () => payBill(BILLS.find((b) => b.sup === "S5"), "2026-02-26", "bank"));

/* ---------- akhir bulan: bunga & admin bank, penyusutan; PPN */
const ppnSnap = new Map();
for (let m = "2026-01"; m <= ym(TODAY); m = nextMonth(m)) {
  const me = lastDay(m);
  if (me >= TODAY) continue;
  const mm = m.slice(5, 7);
  at(me, 9, () => {
    cashTxn(me, "masuk", "bank", [{ account: A.bunga, amount: roundTo(bal(A.bank) * 0.0008, 1) || 50000, memo: "Jasa giro" }], "Jasa giro bulan ini", null, null, 17);
    cashTxn(me, "keluar", "bank", [{ account: A.adminBank, amount: 27500 + ibetween(4, 12) * 6500, memo: "Administrasi rekening & biaya transfer antarbank" }], "Biaya administrasi bank", null, null, 17);
    const mesin = 5250000 + (me >= "2026-05-31" ? 400000 : 0);
    manualJournal(me, `Penyusutan aset tetap ${bulan(me)} 2026`, [
      { account: A.susut, debit: 3540000 + mesin + 6200000 + 350000, memo: `Bangunan 3.540.000; mesin & cetakan ${mesin.toLocaleString("id-ID")}; kendaraan 6.200.000; peralatan 350.000` },
      { account: A.akum, credit: 3540000 + mesin + 6200000 + 350000 },
    ]);
    // Lunasi rekening koran bila saldo bank longgar.
    if (kmk > 0 && bal(A.bank) > kmk + 250000000) {
      cashTxn(me, "keluar", "bank", [{ account: A.hutBank, amount: kmk, memo: "Pelunasan rekening koran" }], "Pelunasan kredit modal kerja", null, null, 17);
      kmk = 0;
    }
    ppnSnap.set(m, { out: -bal(A.ppnKeluaran), inn: bal(A.ppnMasukan) });
  });
  // Setor PPN masa ini pada tanggal 15 bulan berikutnya.
  const settle = onOrNextWorkday(`${nextMonth(m)}-15`);
  at(settle, 7.5, () => {
    const s = ppnSnap.get(m);
    if (!s) return;
    const comp = Math.min(s.out, s.inn);
    const net = s.out - s.inn;
    manualJournal(settle, `Kompensasi PPN masa ${bulan(me)} 2026`, [
      { account: A.ppnKeluaran, debit: s.out, memo: "PPN keluaran masa ini" },
      { account: A.ppnMasukan, credit: comp, memo: net >= 0 ? "PPN masukan dikreditkan" : "Dikompensasi; lebih bayar dibawa ke masa berikutnya" },
      { account: A.hutPajak, credit: Math.max(0, net), memo: "PPN kurang bayar" },
    ], 10);
    if (net > 0) {
      ensureBank(settle, net);
      cashTxn(settle, "keluar", "bank", [{ account: A.hutPajak, amount: net, memo: `Setor PPN masa ${bulan(me)} 2026` }], `Setoran PPN masa ${bulan(me)} 2026`, null, null, 11);
    }
  });
}

/* ---------- stok opname tiap akhir kuartal */
for (const [d, list] of [
  ["2026-03-31", [["PVG-0101", -9, "12 m² pecah saat bongkar muat, sebagian masih bisa dipakai"], ["KST-0402", -40, "kanstin retak di tumpukan lama"], ["BB-SMN", -6, "6 sak semen mengeras (atap gudang bocor saat hujan)"]]],
  ["2026-06-30", [["PVG-0102", -6, "pecah saat pemuatan"], ["BUS-0302", -4, "4 buis retak rambut"], ["GTG-0501", -85, "genteng gompal di tumpukan"], ["BB-PSR", -1.5, "selisih volume pasir"]]],
  ["2026-09-30", [["PVG-0101", -12, "pecah saat bongkar muat"], ["KST-0403", -25, "retak di tumpukan"], ["BUS-0303", 2, "selisih hitung: kelebihan 2 buis"], ["BB-SMN", -4, "4 sak semen mengeras"]]],
]) {
  at(d, 8.5, () => {
    for (const [code, n, why] of list) {
      if (lv(code).qty + n < 0) continue;
      const it = ITEM.get(code);
      const aid = id("adj");
      const number = nextNumber("ADJ", d);
      const cost = round(unitCost(code));
      const value = round(n * cost);
      const reason = `Stok opname ${Number(d.slice(8))} ${bulan(d)}: ${why}`;
      const ts = epoch(d, 16);
      put("inv_adjustments", { id: aid, number, date: d, item_id: iref(code), qty: n, unit_cost: cost, reason, created_by: null, created_at: ts, updated_at: ts });
      move(code, d, n, value, "penyesuaian", aid, number, 16);
      const memo = `Penyesuaian stok ${it.name} · ${reason}`;
      journal({ number, date: d, memo, source: "penyesuaian", sourceId: aid, hour: 16, lines: [{ account: A.selisih, debit: -value, memo }, { account: invAcc(code), credit: -value, memo }] });
    }
  });
}

/* =================================================================== jalankan */

EVENTS.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio || a.n - b.n);
for (let i = 0; i < EVENTS.length; i++) {
  const before = EVENTS.length;
  EVENTS[i].fn();
  if (EVENTS.length > before) {
    const rest = EVENTS.splice(i + 1);
    rest.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio || a.n - b.n);
    EVENTS.push(...rest);
  }
}

/* ---------- status & nilai turunan */
for (const st of ST.values()) {
  const o = st.order;
  if (!TABLES.get("ops_orders").byId.has(st.id)) continue;
  for (const inv of st.invoices) setCol("fin_invoices", inv.id, "paid", inv.paid);
  if (cancelled.has(o.key) || drafts.has(o.key)) continue;
  const all = st.lines.every((l) => (st.delivered.get(l.id) ?? 0) + 1e-9 >= l.qty);
  const any = o.trips.some((t) => t.status !== "dijadwalkan");
  const paid = st.invoices.length && st.invoices.every((i) => i.paid >= i.total) && st.lines.every((l) => (st.invoiced.get(l.id) ?? 0) + 1e-9 >= l.qty);
  setCol("ops_orders", st.id, "status", all ? (paid ? "selesai" : "terkirim") : any ? "dikirim_sebagian" : "dikonfirmasi");
}
for (const b of BILLS) setCol("fin_bills", b.id, "paid", b.paid);
for (const { inv } of OPEN_INV) setCol("fin_invoices", inv.id, "paid", inv.paid);

/* =================================================================== posisi GPS (7 hari terakhir) */

function haversine(a, b) {
  const R = 6371;
  const dl = ((b[0] - a[0]) * Math.PI) / 180;
  const dn = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dl / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const bearing = (a, b) => ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 360) % 360;
function path(points, startT, kmh, stepSec, until) {
  const out = [];
  let t = startT;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const km = haversine(a, b) * 1.15;
    const secs = (km / kmh) * 3600;
    const n = Math.max(1, Math.round(secs / stepSec));
    for (let k = 0; k < n; k++) {
      if (t > until) return { out, t };
      const f = k / n;
      out.push({ lat: a[0] + (b[0] - a[0]) * f + between(-0.0002, 0.0002), lng: a[1] + (b[1] - a[1]) * f + between(-0.0002, 0.0002), speed: Math.max(0, kmh * between(0.7, 1.25)), heading: bearing(a, b), at: Math.round(t) });
      t += secs / n;
    }
  }
  return { out, t };
}
const nowSec = epoch(TODAY, NOW_HOUR);
let positions = 0;
for (const o of ORDERS) {
  for (const t of o.trips) {
    if (!t.veh || !VEH[t.veh].gps || t.status === "dijadwalkan" || t.date < addDays(TODAY, -6)) continue;
    const area = AREAS[o.c.area];
    const pts = [HOME, ...area.via, area.ll];
    const until = t.date === TODAY ? nowSec : epoch(t.date, 23);
    const go = path(pts, epoch(t.date, t.depart), 34, 90, until);
    const stops = [];
    let tt = go.t;
    if (tt <= until) {
      // Bongkar di lokasi: posisi diam tiap 5 menit.
      const end = Math.min(until, tt + t.unload * 3600);
      for (; tt < end; tt += 300) stops.push({ lat: area.ll[0] + between(-0.0001, 0.0001), lng: area.ll[1] + between(-0.0001, 0.0001), speed: 0, heading: 0, at: Math.round(tt) });
    }
    const back = tt <= until ? path([...pts].reverse(), tt, 40, 120, until).out : [];
    for (const p of [...go.out, ...stops, ...back]) {
      put("ops_positions", { vehicle_id: `demo-vh-${t.veh.toLowerCase()}`, lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)), speed: Math.round(p.speed * 10) / 10, heading: Math.round(p.heading), accuracy: 8, at: p.at, received_at: p.at + 4, source: "gps", user_id: null });
      positions++;
    }
  }
}

/* =================================================================== tulis SQL */

const ORDER = [
  "fin_contacts", "ops_vehicles", "ops_drivers", "fin_items", "ops_orders", "ops_order_lines", "ops_deliveries", "ops_delivery_lines",
  "inv_productions", "inv_production_lines", "inv_adjustments", "inv_stock_moves", "fin_bills", "fin_bill_lines", "fin_payments", "fin_payment_allocations",
  "fin_invoices", "fin_invoice_lines", "fin_receipts", "fin_receipt_allocations", "fin_cash_txns", "fin_cash_lines", "fin_journals", "fin_journal_lines", "ops_positions",
];
const DEMO_GPS_KEY = "demo-istana-gps-2026";
const LOCK = lastDay(ym(addDays(`${ym(TODAY)}-01`, -40)));
const out = [];
out.push(`-- DATA CONTOH modul keuangan & operasional Istana Block, 1 Januari 2026 – ${TODAY}.
-- Dibuat oleh scripts/demo/generate.mjs --hari-ini ${TODAY}. Nama pelanggan, pemasok, kendaraan, dan sopir FIKTIF;
-- harga pokok, harga bahan, gaji, biaya, serta harga paving/kanstin/genteng adalah PERKIRAAN.
-- Semua id berawalan "demo-"; hapus dengan seed/demo-erp-hapus.sql.
--
-- Pengaman: berhenti bila sudah ada transaksi asli atau data contoh sudah pernah dimuat.
DROP TABLE IF EXISTS _demo_guard;
CREATE TABLE _demo_guard (n INTEGER CHECK (n = 0));
INSERT INTO _demo_guard SELECT count(*) FROM fin_journals WHERE id NOT LIKE 'demo-%';
INSERT INTO _demo_guard SELECT count(*) FROM ops_orders WHERE id NOT LIKE 'demo-%';
INSERT INTO _demo_guard SELECT count(*) FROM inv_stock_moves WHERE id NOT LIKE 'demo-%';
INSERT INTO _demo_guard SELECT count(*) FROM fin_journals WHERE id LIKE 'demo-%';
DROP TABLE _demo_guard;
`);
for (const name of ORDER) {
  const t = TABLES.get(name);
  if (!t) continue;
  const verb = name === "fin_items" ? "INSERT OR IGNORE INTO" : "INSERT INTO";
  const per = Math.max(1, Math.floor(60000 / (t.rows[0].join(",").length + 8)));
  for (let i = 0; i < t.rows.length; i += Math.min(per, 200)) {
    const chunk = t.rows.slice(i, i + Math.min(per, 200));
    out.push(`${verb} ${name} (${t.cols.join(", ")}) VALUES\n${chunk.map((r) => `(${r.join(", ")})`).join(",\n")};`);
  }
}
out.push(`-- Lanjutkan penomoran dokumen setelah nomor terakhir data contoh.
INSERT INTO sys_sequences (key, value) VALUES
${[...seq].map(([k, v]) => `(${lit(k)}, ${v})`).join(",\n")}
ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);`);
out.push(`-- Pengaturan contoh: kunci penerima GPS "${DEMO_GPS_KEY}" (untuk scripts/demo/simulasi-gps.mjs),
-- buku dikunci s.d. ${LOCK}, catatan faktur.
INSERT INTO settings (key, value) VALUES
('gps_ingest_key_hash', ${lit(createHash("sha256").update(DEMO_GPS_KEY).digest("hex"))}),
('gps_ingest_key_hint', ${lit(`…${DEMO_GPS_KEY.slice(-4)}`)}),
('fin_lock_date', ${lit(LOCK)}),
('fin_invoice_note', 'Barang yang sudah diterima dan ditandatangani di surat jalan tidak dapat dikembalikan, kecuali cacat produksi. Pembayaran ditransfer ke rekening atas nama perusahaan.')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;`);
writeFileSync(new URL("seed/demo-erp.sql", ROOT), `${out.join("\n\n")}\n`);

const NUMBERED = ["fin_invoices", "fin_receipts", "fin_bills", "fin_payments", "fin_cash_txns", "fin_journals", "ops_orders", "ops_deliveries", "inv_productions", "inv_adjustments"];
const RESEQ = ["DELETE FROM sys_sequences;", ...NUMBERED.map((t) => `INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM ${t} WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);`)].join("\n");
const DEMO_MASTER = ["fin_contacts", "ops_vehicles", "ops_drivers"];
const D = "'demo-%'";
const DEMO_JOURNALS = `SELECT id FROM fin_journals WHERE id LIKE ${D} OR coalesce(source_id, '') LIKE ${D}`;
writeFileSync(
  new URL("seed/demo-erp-hapus.sql", ROOT),
  `-- Menghapus SEMUA data contoh (id berawalan "demo-") beserta jurnal, stok, dan baris turunannya,
-- lalu menyusun ulang penomoran dari dokumen yang tersisa. Data asli tidak tersentuh.
--
-- Pengaman: berhenti bila ada transaksi BUKAN contoh yang memakai pelanggan, barang, pesanan, armada, atau faktur contoh
-- (mis. latihan yang dibuat di atas data contoh). Untuk kasus itu pakai seed/erp-mulai-bersih.sql.
DROP TABLE IF EXISTS _demo_guard;
CREATE TABLE _demo_guard (n INTEGER CHECK (n = 0));
INSERT INTO _demo_guard SELECT
  (SELECT count(*) FROM ops_orders WHERE id NOT LIKE ${D} AND contact_id LIKE ${D})
  + (SELECT count(*) FROM ops_order_lines WHERE order_id NOT LIKE ${D} AND item_id LIKE ${D})
  + (SELECT count(*) FROM ops_deliveries WHERE id NOT LIKE ${D} AND (order_id LIKE ${D} OR vehicle_id LIKE ${D} OR driver_id LIKE ${D}))
  + (SELECT count(*) FROM fin_invoices WHERE id NOT LIKE ${D} AND (contact_id LIKE ${D} OR order_id LIKE ${D}))
  + (SELECT count(*) FROM fin_invoice_lines WHERE invoice_id NOT LIKE ${D} AND (item_id LIKE ${D} OR order_line_id LIKE ${D}))
  + (SELECT count(*) FROM fin_receipts WHERE id NOT LIKE ${D} AND contact_id LIKE ${D})
  + (SELECT count(*) FROM fin_bills WHERE id NOT LIKE ${D} AND contact_id LIKE ${D})
  + (SELECT count(*) FROM fin_bill_lines WHERE bill_id NOT LIKE ${D} AND item_id LIKE ${D})
  + (SELECT count(*) FROM fin_payments WHERE id NOT LIKE ${D} AND contact_id LIKE ${D})
  + (SELECT count(*) FROM fin_cash_txns WHERE id NOT LIKE ${D} AND contact_id LIKE ${D})
  + (SELECT count(*) FROM fin_receipt_allocations WHERE receipt_id NOT LIKE ${D} AND invoice_id LIKE ${D})
  + (SELECT count(*) FROM fin_payment_allocations WHERE payment_id NOT LIKE ${D} AND bill_id LIKE ${D})
  + (SELECT count(*) FROM fin_journal_lines WHERE contact_id LIKE ${D} AND journal_id NOT IN (${DEMO_JOURNALS}))
  + (SELECT count(*) FROM inv_stock_moves WHERE item_id LIKE ${D} AND id NOT LIKE ${D} AND coalesce(source_id, '') NOT LIKE ${D});
DROP TABLE _demo_guard;
DELETE FROM fin_journal_lines WHERE journal_id IN (${DEMO_JOURNALS});
DELETE FROM fin_journals WHERE id IN (${DEMO_JOURNALS});
DELETE FROM inv_stock_moves WHERE id LIKE ${D} OR coalesce(source_id, '') LIKE ${D};
DELETE FROM fin_cash_lines WHERE id LIKE ${D} OR cash_id LIKE ${D};
DELETE FROM fin_cash_txns WHERE id LIKE ${D};
DELETE FROM fin_receipt_allocations WHERE id LIKE ${D} OR receipt_id LIKE ${D};
DELETE FROM fin_receipts WHERE id LIKE ${D};
DELETE FROM fin_invoice_lines WHERE id LIKE ${D} OR invoice_id LIKE ${D};
DELETE FROM fin_invoices WHERE id LIKE ${D};
DELETE FROM fin_payment_allocations WHERE id LIKE ${D} OR payment_id LIKE ${D};
DELETE FROM fin_payments WHERE id LIKE ${D};
DELETE FROM fin_bill_lines WHERE id LIKE ${D} OR bill_id LIKE ${D};
DELETE FROM fin_bills WHERE id LIKE ${D};
DELETE FROM inv_adjustments WHERE id LIKE ${D};
DELETE FROM inv_production_lines WHERE id LIKE ${D} OR production_id LIKE ${D};
DELETE FROM inv_productions WHERE id LIKE ${D};
DELETE FROM ops_delivery_lines WHERE id LIKE ${D} OR delivery_id LIKE ${D};
DELETE FROM ops_deliveries WHERE id LIKE ${D};
DELETE FROM ops_order_lines WHERE id LIKE ${D} OR order_id LIKE ${D};
DELETE FROM ops_orders WHERE id LIKE ${D};
DELETE FROM ops_positions WHERE vehicle_id LIKE ${D};
DELETE FROM settings WHERE key IN ('gps_ingest_key_hash', 'gps_ingest_key_hint') AND value IN (${lit(createHash("sha256").update(DEMO_GPS_KEY).digest("hex"))}, ${lit(`…${DEMO_GPS_KEY.slice(-4)}`)});
UPDATE users SET driver_id = NULL WHERE driver_id LIKE ${D};
${DEMO_MASTER.map((t) => `DELETE FROM ${t} WHERE id LIKE ${D};`).join("\n")}
DELETE FROM fin_items WHERE id LIKE ${D}
${["inv_stock_moves", "ops_order_lines", "inv_production_lines", "inv_adjustments", "fin_invoice_lines", "fin_bill_lines"].map((t) => `  AND NOT EXISTS (SELECT 1 FROM ${t} x WHERE x.item_id = fin_items.id)`).join("\n")};
${RESEQ}
`,
);
writeFileSync(
  new URL("seed/erp-mulai-bersih.sql", ROOT),
  `-- MULAI BERSIH: menghapus SEMUA transaksi keuangan & operasional (data contoh MAUPUN data latihan/asli):
-- jurnal, faktur, penerimaan, pembelian, pembayaran, kas, pesanan, surat jalan, produksi, penyesuaian, stok, penomoran,
-- dan riwayat posisi truk (lacak).
-- Yang tetap: bagan akun, barang & harga, pelanggan/pemasok, armada, sopir, pengguna, pengaturan.
-- Data master contoh (pelanggan, pemasok, armada, sopir, barang berawalan "demo-") ikut dihapus.
--
-- Hanya untuk dijalankan SEKALI sebelum mulai mencatat transaksi sungguhan. Cadangkan database dulu.
${ORDER.filter((t) => !DEMO_MASTER.includes(t) && t !== "fin_items" && t !== "ops_positions").reverse().map((t) => `DELETE FROM ${t};`).join("\n")}
DELETE FROM sys_sequences;
DELETE FROM ops_positions;
UPDATE users SET driver_id = NULL WHERE driver_id LIKE 'demo-%';
${DEMO_MASTER.map((t) => `DELETE FROM ${t} WHERE id LIKE 'demo-%';`).join("\n")}
DELETE FROM fin_items WHERE id LIKE 'demo-%';
`,
);

/* ---------- ringkasan */
const count = (t) => TABLES.get(t)?.rows.length ?? 0;
const jt = (n) => `${(n / 1e6).toFixed(1)} jt`;
console.log(`Data contoh 1 Jan – ${TODAY}: ${count("ops_orders")} pesanan, ${count("ops_deliveries")} surat jalan, ${count("inv_productions")} produksi, ${count("fin_invoices")} faktur, ${count("fin_receipts")} penerimaan, ${count("fin_bills")} pembelian, ${count("fin_payments")} pembayaran, ${count("fin_cash_txns")} kas, ${count("fin_journals")} jurnal (${count("fin_journal_lines")} baris), ${count("inv_stock_moves")} gerak stok, ${positions} posisi GPS.`);
console.log("Bulan    Pendapatan   HPP     Laba kotor  Beban     Lain    Laba bersih");
for (const [m, s] of [...monthly].sort()) {
  const gp = s.rev - s.hpp;
  console.log(`${m}  ${jt(s.rev).padStart(10)} ${jt(s.hpp).padStart(9)} ${jt(gp).padStart(9)} ${String(Math.round((gp / (s.rev || 1)) * 100)).padStart(3)}% ${jt(s.opex).padStart(9)} ${jt(s.other).padStart(7)} ${jt(gp - s.opex + s.other).padStart(9)}`);
}
console.log(`Saldo akhir: kas ${jt(bal(A.kas))}, bank ${jt(bal(A.bank))}, piutang ${jt(bal(A.piutang))}, hutang ${jt(-bal(A.hutang))}, hutang bank ${jt(-bal(A.hutBank))} (rekening koran ${jt(kmk)}), persediaan jadi ${jt(bal(A.persJadi))}, bahan ${jt(bal(A.persBahan))}, uang muka pelanggan ${jt(-bal(A.umJual))}`);
const low = [...ITEM.values()].filter((it) => lv(it.code).qty < it.min).map((it) => `${it.code} ${r3(lv(it.code).qty)}/${it.min}`);
console.log(`Di bawah minimum: ${low.join(", ") || "-"}`);
console.log(`Status hari ini: ${["berangkat", "dijadwalkan", "terkirim"].map((s) => `${s} ${ORDERS.flatMap((o) => o.trips).filter((t) => t.date === TODAY && t.status === s).length}`).join(", ")}; dijadwalkan ke depan ${ORDERS.flatMap((o) => o.trips).filter((t) => t.date > TODAY).length}; pesanan draf ${drafts.size}, batal ${cancelled.size}.`);
if (process.env.DEMO_DEBUG) {
  const back = ORDERS.filter((o) => !cancelled.has(o.key) && !drafts.has(o.key) && o.lines.some((l) => o.trips.reduce((a, t) => a + (t.load[l.code] ?? 0), 0) < l.qty - 1e-6));
  console.log(`Pesanan dengan sisa belum terjadwal: ${back.length}`);
  for (const o of back.slice(-15)) console.log(o.date, o.req, o.c.key, o.c.seg, AREAS[o.c.area].zone, o.self ? "ambil" : "", o.trips.length, o.trips.at(-1)?.date ?? "-");
  const util = {};
  for (const [d, v] of fleet) if (d >= addDays(TODAY, -30) && d <= TODAY) for (const [k, n] of Object.entries(v)) util[k] = (util[k] ?? 0) + n / slotsOf(d, k);
  console.log("pemakaian armada 30 hari:", util);
  const byDay = new Map();
  for (const o of ORDERS) for (const t of o.trips) if (t.date >= "2026-09-01" && t.date <= TODAY) byDay.set(t.date, (byDay.get(t.date) ?? 0) + 1);
  const line = [];
  for (let d = "2026-09-01"; d <= TODAY; d = addDays(d, 1)) if (isWorkday(d)) line.push(`${d.slice(5)}:${byDay.get(d) ?? 0}`);
  console.log(`rit per hari kerja sejak 1 Sep: ${line.join(" ")}`);
}
