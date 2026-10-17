#!/usr/bin/env node
/**
 * Generator DATA CONTOH modul keuangan & operasional (1 Agustus – 19 Oktober 2026).
 *
 * Menulis:
 *   seed/demo-erp.sql        → muat dengan  npm run demo:local   (atau demo:remote)
 *   seed/demo-erp-hapus.sql  → hapus dengan npm run demo:hapus:local (atau :remote)
 *
 * Semua baris memakai id berawalan "demo-" sehingga bisa dihapus bersih. Jurnal, stok, dan harga pokok
 * dihitung dengan aturan yang sama dengan aplikasi (src/app/keuangan/actions, src/app/operasional/actions):
 * faktur → Dr Piutang/Cr Penjualan+Ongkir+PPN; surat jalan berangkat → Dr HPP/Cr Persediaan (rata-rata bergerak);
 * hasil produksi → Dr Persediaan jadi/Cr Persediaan bahan + Upah produksi; dst.
 *
 * Nama pelanggan, pemasok, armada, dan sopir adalah FIKTIF. Harga produk diambil dari daftar harga website;
 * yang di website masih "hubungi" (paving, kanstin) dan seluruh harga pokok/bahan baku adalah ANGKA CONTOH.
 *
 *   node scripts/demo/generate.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);
const TODAY = "2026-10-17"; // "hari ini" dalam cerita data contoh
const START = "2026-08-01";

/* =================================================================== util */

let seed = 20261017;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round = (n) => Math.round(n);
const r3 = (n) => Math.round(n * 1000) / 1000;

function addDays(d, n) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
const dow = (d) => new Date(`${d}T00:00:00Z`).getUTCDay(); // 0 = Minggu
const HOLIDAYS = new Set(["2026-08-17"]);
const isWorkday = (d) => dow(d) !== 0 && !HOLIDAYS.has(d);
function nextWorkday(d) {
  let x = addDays(d, 1);
  while (!isWorkday(x)) x = addDays(x, 1);
  return x;
}
/** Detik epoch untuk jam WIB tertentu. */
const epoch = (d, hh = 9, mm = 0) => Math.floor(Date.parse(`${d}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`) / 1000);

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
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(r3(v));
  return `'${String(v).replace(/'/g, "''")}'`;
};
const TABLES = new Map();
function put(table, row) {
  if (!TABLES.has(table)) TABLES.set(table, { cols: Object.keys(row), rows: [] });
  const t = TABLES.get(table);
  t.rows.push(t.cols.map((c) => lit(row[c])));
}
let idn = 0;
const id = (p) => `demo-${p}-${String(++idn).padStart(5, "0")}`;

/* =================================================================== akun (id dari drizzle/0003_coa.sql) */

const A = {
  kas: "acc_1-1100", bank: "acc_1-1300", piutang: "acc_1-2100", persJadi: "acc_1-3100", persBahan: "acc_1-3200",
  ppnMasukan: "acc_1-4100", umBeli: "acc_1-4200", mesin: "acc_1-5300", kendaraan: "acc_1-5400", peralatan: "acc_1-5500",
  akum: "acc_1-6100", hutang: "acc_2-1100", ppnKeluaran: "acc_2-2100", umJual: "acc_2-2200", hutPajak: "acc_2-2400",
  modal: "acc_3-1000", saldoAwal: "acc_3-3000", penjualan: "acc_4-1100", ongkir: "acc_4-1300", potongan: "acc_4-1900",
  hpp: "acc_5-1100", selisih: "acc_5-1200", upah: "acc_6-1100", gaji: "acc_6-1200", bbm: "acc_6-2100",
  rawatKend: "acc_6-2200", uangJalan: "acc_6-2300", listrik: "acc_6-3100", rawatMesin: "acc_6-3200", telp: "acc_6-4200",
  atk: "acc_6-4300", iklan: "acc_6-4400", susut: "acc_6-5100", bunga: "acc_7-1100", adminBank: "acc_8-1100",
};
const balance = new Map(); // saldo debit-kredit per akun (untuk menjaga kas tidak minus)
const bal = (a) => balance.get(a) ?? 0;

/* =================================================================== penomoran */

const seq = new Map();
function nextNumber(prefix, date) {
  const key = `${prefix}/${date.slice(2, 4)}${date.slice(5, 7)}`;
  const n = (seq.get(key) ?? 0) + 1;
  seq.set(key, n);
  return `${key}/${String(n).padStart(4, "0")}`;
}

/* =================================================================== jurnal */

/** Sama dengan journalOps di aplikasi: angka negatif dipindah sisi, baris nol dibuang, wajib seimbang. */
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
  });
  return jid;
}

/* =================================================================== barang */

// Produk & baris harga persis seperti di website (seed/seed.sql), kode sama dengan "Ambil dari daftar harga website".
const seedSql = readFileSync(new URL("seed/seed.sql", ROOT), "utf8");
const PRODUCTS = [];
for (const m of seedSql.matchAll(/INSERT INTO products \(slug, name, category, summary, description, price_from, price_to, unit, image_key, specs, price_rows,[^)]*\) VALUES \('([^']+)', '([^']+)', '([^']+)', '(?:[^']|'')*', '(?:[^']|'')*', (NULL|\d+), (NULL|\d+), '([^']*)', '[^']*', '(?:[^']|'')*', '((?:[^']|'')*)'/g)) {
  PRODUCTS.push({ slug: m[1], name: m[2], category: m[3], priceFrom: m[4] === "NULL" ? null : Number(m[4]), unit: m[6], rows: JSON.parse(m[7].replace(/''/g, "'")) });
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
 * Barang yang dipakai cerita ini. price = harga jual (website bila ada, selain itu contoh); std = harga pokok standar (contoh);
 * w = berat kg per satuan (untuk resep bahan); cast = "press" (paving/kanstin) atau "basah" (U-Ditch, buis, cover);
 * steel = batang besi Ø6 per satuan; labor = upah borongan per satuan; batch = ukuran sekali produksi; fam = jalur produksi.
 */
const FG = {
  "PVG-0101": { price: 85000, std: 51000, min: 150, w: 105, cast: "press", labor: 7000, batch: 110, fam: "paving" },
  "PVG-0102": { price: 88000, std: 54000, min: 80, w: 140, cast: "press", labor: 8000, batch: 100, fam: "paving", pigment: 0.25 },
  "PVG-0105": { price: 78000, std: 47000, min: 60, w: 100, cast: "press", labor: 7500, batch: 120, fam: "paving" },
  "KST-0402": { price: 15000, std: 8800, min: 300, w: 17, cast: "press", labor: 1200, batch: 250, fam: "kanstin" },
  "KST-0403": { price: 22000, std: 12800, min: 80, w: 24, cast: "press", labor: 1500, batch: 150, fam: "kanstin" },
  "UDT-0201": { std: 158000, min: 10, w: 163.3, cast: "basah", steel: 1.5, labor: 18000, batch: 20, fam: "udit" },
  "UDT-0203": { std: 214000, min: 12, w: 248.6, cast: "basah", steel: 2, labor: 22000, batch: 20, fam: "udit" },
  "UDT-0206": { std: 272000, min: 8, w: 373.8, cast: "basah", steel: 3, labor: 30000, batch: 15, fam: "udit" },
  "UDT-0209": { std: 375000, min: 4, w: 472, cast: "basah", steel: 3.5, labor: 38000, batch: 12, fam: "udit" },
  "UDT-0214": { std: 96000, min: 8, w: 62, cast: "basah", steel: 1, labor: 10000, batch: 20, fam: "udit" },
  "UDT-0215": { std: 148000, min: 8, w: 78, cast: "basah", steel: 1.5, labor: 12000, batch: 20, fam: "udit" },
  "BUS-0301": { std: 37000, min: 30, w: 50, cast: "basah", labor: 4000, batch: 60, fam: "buis" },
  "BUS-0302": { std: 49000, min: 40, w: 96, cast: "basah", labor: 5000, batch: 50, fam: "buis" },
  "BUS-0303": { std: 61000, min: 20, w: 116.5, cast: "basah", labor: 6000, batch: 40, fam: "buis" },
  "BUS-0305": { std: 139000, min: 15, w: 211, cast: "basah", labor: 12000, batch: 30, fam: "buis" },
  "BUS-0307": { std: 151000, min: 8, w: 230, cast: "basah", labor: 13000, batch: 20, fam: "buis" },
  "BUS-0310": { std: 640000, min: 4, w: 592, cast: "basah", steel: 4, labor: 45000, batch: 12, fam: "buis" },
  "BUS-0311": { std: 154000, min: 4, w: 140, cast: "basah", steel: 0.5, labor: 10000, batch: 10, fam: "buis" },
};
const RM = {
  "BB-SMN": { name: "Semen PCC 50 kg", unit: "sak", price: 58500, min: 120, batch: 240, tax: true, sup: "S1" },
  "BB-PSR": { name: "Pasir beton", unit: "m³", price: 255000, min: 8, batch: 14, tax: false, sup: "S2" },
  "BB-ABU": { name: "Abu batu", unit: "m³", price: 215000, min: 10, batch: 21, tax: false, sup: "S2" },
  "BB-SPL": { name: "Split 1–2 cm", unit: "m³", price: 295000, min: 8, batch: 14, tax: false, sup: "S2" },
  "BB-BSI": { name: "Besi beton polos Ø6 mm × 12 m", unit: "batang", price: 27500, min: 150, batch: 400, tax: true, sup: "S3" },
  "BB-PGM": { name: "Pigmen oksida merah", unit: "kg", price: 38000, min: 25, batch: 50, tax: true, sup: "S3" },
};
const ITEM = new Map();
for (const [code, f] of Object.entries(FG)) {
  const s = SITE.get(code);
  if (!s) throw new Error(`Kode ${code} tidak ada di daftar harga website.`);
  ITEM.set(code, { code, name: s.name, unit: s.unit, kind: "barang_jadi", price: s.price || f.price, std: f.std, min: f.min, slug: s.slug, note: s.price ? s.detail : `${s.detail ? `${s.detail}. ` : ""}Harga jual contoh, isi harga resmi.`, ...f });
}
for (const [code, r] of Object.entries(RM)) ITEM.set(code, { code, kind: "bahan_baku", std: r.price, ...r, note: "Harga contoh." });
const iref = (code) => new Raw(`(SELECT id FROM fin_items WHERE code = ${lit(code)})`);
const invAcc = (code) => (ITEM.get(code).kind === "bahan_baku" ? A.persBahan : A.persJadi);

/** Resep bahan per satuan barang jadi (perkiraan campuran; angka contoh). */
function recipe(code, qty) {
  const it = ITEM.get(code);
  const vol = (it.w / 2350) * qty; // m³ beton
  const out = {};
  if (it.cast === "press") {
    out["BB-SMN"] = (vol * 330) / 50;
    out["BB-ABU"] = vol * 0.75;
    out["BB-PSR"] = vol * 0.32;
  } else {
    out["BB-SMN"] = (vol * 380) / 50;
    out["BB-PSR"] = vol * 0.45;
    out["BB-SPL"] = vol * 0.72;
  }
  if (it.steel) out["BB-BSI"] = it.steel * qty;
  if (it.pigment) out["BB-PGM"] = it.pigment * qty;
  for (const k of Object.keys(out)) out[k] = Math.ceil(out[k] * 10) / 10;
  return out;
}

/* =================================================================== persediaan */

const stock = new Map(); // code → {qty, value}
const lv = (code) => stock.get(code) ?? { qty: 0, value: 0 };
const unitCost = (code) => {
  const l = lv(code);
  return l.qty > 0.0005 && l.value > 0 ? l.value / l.qty : ITEM.get(code).std;
};
function move(code, date, qty, value, source, sourceId, note) {
  const l = lv(code);
  const n = { qty: r3(l.qty + qty), value: l.value + value };
  if (n.qty < -1e-6) throw new Error(`Stok ${code} minus pada ${date} (${n.qty}) — ${note}`);
  stock.set(code, n);
  const ts = epoch(date, 8, Math.floor(rnd() * 59));
  put("inv_stock_moves", { id: id("sm"), item_id: iref(code), date, qty: r3(qty), value, source, source_id: sourceId, note, created_at: ts, updated_at: ts });
}

/* =================================================================== kontak, armada, sopir */

const CONTACTS = {
  C1: { name: "PT Graha Asri Sentosa", company: "PT Graha Asri Sentosa", kind: "pelanggan", term: 30, phone: "0811 0000 2101", email: "", address: "Ruko Sudirman Blok B-7, Jl. Jend. Sudirman, Purwakarta", note: "Developer perumahan Griya Asri. Penagihan ke bagian keuangan, lampirkan surat jalan bertanda tangan." },
  C2: { name: "CV Karya Mandiri Konstruksi", company: "CV Karya Mandiri Konstruksi", kind: "pelanggan", term: 30, phone: "0811 0000 2102", email: "", address: "Jl. Tuparev No. 41, Karawang", note: "Kontraktor drainase & jalan. Kirim penawaran lewat email pengadaan." },
  C3: { name: "Toko Bangunan Sinar Jaya", company: "Toko Bangunan Sinar Jaya", kind: "pelanggan", term: 14, phone: "0811 0000 2103", email: "", address: "Jl. Raya Cikampek–Purwakarta, Cikampek, Karawang", note: "Reseller. Ambil rutin buis kecil & kanstin." },
  C4: { name: "CV Bumi Parahyangan Teknik", company: "CV Bumi Parahyangan Teknik", kind: "pelanggan", term: 30, phone: "0811 0000 2104", email: "", address: "Jl. Otto Iskandardinata, Subang", note: "Pekerjaan gorong-gorong & saluran desa." },
  C5: { name: "PT Mitra Gudang Nusantara", company: "PT Mitra Gudang Nusantara", kind: "pelanggan", term: 45, phone: "0811 0000 2105", email: "", address: "Kawasan industri, Kec. Bungursari, Purwakarta", note: "Area parkir & drainase gudang. Pembayaran termin 45 hari setelah faktur." },
  C6: { name: "Panitia Pembangunan Masjid Al-Hidayah", company: "", kind: "pelanggan", term: 0, phone: "0811 0000 2106", email: "", address: "Kp. Sukamulya, Kec. Sukatani, Purwakarta", note: "DP 50% saat pesan, pelunasan setelah barang lengkap." },
  C7: { name: "H. Dedi Supriatna", company: "", kind: "pelanggan", term: 0, phone: "0811 0000 2107", email: "", address: "Plered, Purwakarta", note: "Perorangan." },
  C8: { name: "Ibu Nining Kurniasih", company: "", kind: "pelanggan", term: 0, phone: "0811 0000 2108", email: "", address: "Jl. Veteran gang Melati, Purwakarta", note: "Perorangan." },
  C9: { name: "CV Sarana Bangun Persada", company: "CV Sarana Bangun Persada", kind: "pelanggan", term: 30, phone: "0811 0000 2109", email: "", address: "Cibatu, Purwakarta", note: "" },
  C10: { name: "Rudi Hartono", company: "", kind: "pelanggan", term: 0, phone: "0811 0000 2110", email: "", address: "Cibatu, Purwakarta", note: "Perorangan, pesan lewat WhatsApp." },
  S1: { name: "Toko Bangunan Sumber Rezeki", company: "Toko Bangunan Sumber Rezeki", kind: "pemasok", term: 14, phone: "0811 0000 3101", email: "", address: "Jl. Ipik Gandamanah, Purwakarta", note: "Distributor semen. Faktur pajak tersedia." },
  S2: { name: "UD Pasir Citarum Jaya", company: "UD Pasir Citarum Jaya", kind: "pemasok", term: 7, phone: "0811 0000 3102", email: "", address: "Kec. Plered, Purwakarta", note: "Pasir, abu batu, split per rit dump truck (± 7 m³)." },
  S3: { name: "CV Baja Prima Karawang", company: "CV Baja Prima Karawang", kind: "pemasok", term: 30, phone: "0811 0000 3103", email: "", address: "Jl. Raya Klari, Karawang", note: "Besi beton, kawat, pigmen." },
  S4: { name: "Bengkel Las & Cetakan Mandiri", company: "", kind: "pemasok", term: 0, phone: "0811 0000 3104", email: "", address: "Jatiluhur, Purwakarta", note: "Servis mesin press & cetakan." },
};
const CID = {};
for (const [k, c] of Object.entries(CONTACTS)) {
  CID[k] = `demo-ct-${k.toLowerCase()}`;
  const ts = epoch("2026-07-28", 10);
  put("fin_contacts", { id: CID[k], kind: c.kind, name: c.name, company: c.company, phone: c.phone, email: c.email, address: c.address, npwp: "", term_days: c.term, note: c.note, active: 1, created_at: ts, updated_at: ts });
}
const VEH = {
  V1: { plate: "T 8417 BD", name: "Truk engkel bak kayu", capacity: "± 6 ton (70 m² paving / 20 U-Ditch 40×40)" },
  V2: { plate: "T 9125 AB", name: "Colt diesel bak", capacity: "± 4 ton (45 m² paving)" },
  V3: { plate: "T 8862 CA", name: "Pickup bak", capacity: "± 1 ton" },
};
const DRV = {
  D1: { name: "Asep Saepudin", phone: "0811 0000 4101", note: "SIM B1" },
  D2: { name: "Ujang Kurnia", phone: "0811 0000 4102", note: "SIM B1" },
  D3: { name: "Cecep Hidayat", phone: "0811 0000 4103", note: "SIM A, pickup" },
};
for (const [k, v] of Object.entries(VEH)) put("ops_vehicles", { id: `demo-vh-${k.toLowerCase()}`, plate: v.plate, name: v.name, capacity: v.capacity, active: 1, note: "", created_at: epoch("2026-07-28"), updated_at: epoch("2026-07-28") });
for (const [k, v] of Object.entries(DRV)) put("ops_drivers", { id: `demo-dr-${k.toLowerCase()}`, name: v.name, phone: v.phone, active: 1, note: v.note, created_at: epoch("2026-07-28"), updated_at: epoch("2026-07-28") });

// Barang: INSERT OR IGNORE (kalau barang dengan kode sama sudah diimpor, barang itu yang dipakai).
for (const it of ITEM.values()) {
  put("fin_items", {
    id: `demo-it-${it.code}`, code: it.code, name: it.name, kind: it.kind, unit: it.unit, sell_price: it.kind === "bahan_baku" ? 0 : it.price, buy_price: it.std,
    track_stock: 1, min_stock: it.min, product_id: it.slug ? new Raw(`(SELECT id FROM products WHERE slug = ${lit(it.slug)})`) : null, revenue_account_id: null, active: 1, note: it.note ?? "",
    created_at: epoch("2026-07-28"), updated_at: epoch("2026-07-28"),
  });
}

/* =================================================================== cerita: pesanan & pengiriman */

const T = (date, veh, drv, load, extra = {}) => ({ date, veh, drv, load, ...extra });
const ORDERS = [
  {
    key: "O1", date: "2026-08-03", c: "C1", ref: "GAS/PO/VIII/2026/014", project: "Griya Asri Bungursari tahap 2, blok A–C", address: "Perumahan Griya Asri, Jl. Raya Bungursari, Purwakarta", site: "Pak Udin (mandor) 0811 0000 2201", req: "2026-08-05", tax: true,
    lines: [["PVG-0101", 840, 82000], ["KST-0402", 600, 14000]],
    trips: ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", "2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"].map((d, i) => T(d, i % 3 === 2 ? "V2" : "V1", i % 3 === 2 ? "D2" : "D1", { "PVG-0101": 70, "KST-0402": 50 }, { recv: "Pak Udin" })),
    invoices: [{ date: "2026-08-14" }, { date: "2026-08-31" }],
    receipts: [{ date: "2026-09-14", inv: 0, acc: "bank" }, { date: "2026-09-30", inv: 1, acc: "bank" }],
    close: true,
  },
  {
    key: "O2", date: "2026-08-06", c: "C2", ref: "KMK-PO-2608-031", project: "Saluran Jl. Ahmad Yani, Karawang", address: "Jl. Ahmad Yani (depan pasar), Karawang", site: "Bapak Sutisna 0811 0000 2202", req: "2026-08-10", tax: true,
    lines: [["UDT-0203", 120, 355000], ["UDT-0214", 40, 165000]],
    trips: [T("2026-08-10", "V1", "D1", { "UDT-0203": 20 }), T("2026-08-13", "V1", "D2", { "UDT-0203": 20 }), T("2026-08-19", "V1", "D1", { "UDT-0203": 20 }), T("2026-08-22", "V1", "D1", { "UDT-0203": 20, "UDT-0214": 10 }), T("2026-08-24", "V1", "D2", { "UDT-0203": 20, "UDT-0214": 15 }), T("2026-08-27", "V1", "D1", { "UDT-0203": 20, "UDT-0214": 15 })].map((t) => ({ ...t, recv: "Pak Sutisna" })),
    deposits: [{ date: "2026-08-07", amount: 15000000, acc: "bank", memo: "DP 30% U-Ditch Jl. Ahmad Yani" }],
    invoices: [{ date: "2026-08-31" }],
    receipts: [{ date: "2026-09-02", inv: 0, acc: "deposit" }, { date: "2026-10-02", inv: 0, acc: "bank", memo: "Pelunasan" }],
  },
  {
    key: "O3", date: "2026-08-08", c: "C3", ref: "", project: "", address: "Toko Bangunan Sinar Jaya, Cikampek", site: "Bu Sri (toko) 0811 0000 2203", req: "2026-08-10", tax: false,
    lines: [["BUS-0302", 60, 85000], ["BUS-0303", 40, 105000], ["KST-0402", 200, 15000]],
    trips: [T("2026-08-10", "V2", "D2", { "BUS-0302": 60, "BUS-0303": 40, "KST-0402": 200 }, { recv: "Bu Sri" })],
    invoices: [{ date: "2026-08-10" }],
    receipts: [{ date: "2026-08-22", inv: 0, acc: "bank" }],
    close: true,
  },
  {
    key: "O4", date: "2026-08-12", c: "C7", ref: "", project: "Halaman rumah", address: "Plered, Purwakarta (masuk gang, mobil engkel bisa)", site: "H. Dedi 0811 0000 2107", req: "2026-08-14", tax: false, ongkir: 350000,
    lines: [["PVG-0102", 120, 88000]],
    trips: [T("2026-08-14", "V2", "D2", { "PVG-0102": 45 }), T("2026-08-14", "V2", "D2", { "PVG-0102": 45 }), T("2026-08-15", "V3", "D3", { "PVG-0102": 30 })].map((t) => ({ ...t, recv: "H. Dedi" })),
    deposits: [{ date: "2026-08-12", amount: 5500000, acc: "kas", memo: "DP paving hexagon halaman" }],
    invoices: [{ date: "2026-08-15" }],
    receipts: [{ date: "2026-08-15", inv: 0, acc: "deposit" }, { date: "2026-08-15", inv: 0, acc: "kas", memo: "Pelunasan tunai" }],
    close: true,
  },
  {
    key: "O5", date: "2026-08-19", c: "C4", ref: "BPT/023/VIII/26", project: "Gorong-gorong jalan desa, Kalijati", address: "Kalijati, Subang (titik bongkar di balai desa)", site: "Pak Engkos 0811 0000 2204", req: "2026-08-24", tax: true,
    lines: [["BUS-0310", 24, 1100000], ["BUS-0305", 30, 240000]],
    trips: [T("2026-08-24", "V1", "D1", { "BUS-0310": 8, "BUS-0305": 10 }), T("2026-08-26", "V1", "D1", { "BUS-0310": 8, "BUS-0305": 10 }), T("2026-08-28", "V1", "D2", { "BUS-0310": 8, "BUS-0305": 10 })].map((t) => ({ ...t, recv: "Pak Engkos" })),
    invoices: [{ date: "2026-08-31" }],
    receipts: [{ date: "2026-09-30", inv: 0, acc: "bank", pct: 0.5, memo: "Pembayaran termin 1" }],
  },
  {
    key: "O6", date: "2026-08-24", c: "C6", ref: "", project: "Halaman & jalan masuk Masjid Al-Hidayah", address: "Kp. Sukamulya, Sukatani, Purwakarta", site: "Ust. Hasan (ketua panitia) 0811 0000 2206", req: "2026-08-31", tax: false, ongkir: 600000,
    lines: [["PVG-0101", 300, 85000], ["KST-0403", 160, 22000]],
    trips: [T("2026-08-31", "V1", "D1", { "PVG-0101": 70, "KST-0403": 40 }), T("2026-09-01", "V1", "D1", { "PVG-0101": 70, "KST-0403": 40 }), T("2026-09-02", "V1", "D2", { "PVG-0101": 70, "KST-0403": 40 }), T("2026-09-03", "V2", "D2", { "PVG-0101": 45, "KST-0403": 40 }), T("2026-09-03", "V2", "D2", { "PVG-0101": 45 })].map((t) => ({ ...t, recv: "Ust. Hasan" })),
    deposits: [{ date: "2026-08-24", amount: 14800000, acc: "kas", memo: "DP 50% paving masjid" }],
    invoices: [{ date: "2026-09-03" }],
    receipts: [{ date: "2026-09-04", inv: 0, acc: "deposit" }, { date: "2026-09-12", inv: 0, acc: "bank", memo: "Pelunasan dari panitia" }],
    close: true,
  },
  {
    key: "O7", date: "2026-09-01", c: "C5", ref: "MGN/PO/2026/0912", project: "Parkir truk & drainase gudang B", address: "Kawasan industri, Bungursari, Purwakarta (pos satpam gerbang 2)", site: "Pak Wahyu (site engineer) 0811 0000 2205", req: "2026-09-07", tax: true,
    lines: [["PVG-0105", 450, 76000], ["UDT-0206", 60, 455000], ["UDT-0215", 30, 255000]],
    trips: [
      T("2026-09-07", "V1", "D1", { "UDT-0206": 12 }), T("2026-09-08", "V1", "D1", { "UDT-0206": 12, "UDT-0215": 10 }), T("2026-09-10", "V1", "D2", { "UDT-0206": 12, "UDT-0215": 10 }),
      T("2026-09-11", "V1", "D1", { "PVG-0105": 70 }), T("2026-09-14", "V1", "D1", { "PVG-0105": 70 }), T("2026-09-17", "V1", "D2", { "UDT-0206": 12, "UDT-0215": 10 }),
      T("2026-09-21", "V1", "D1", { "PVG-0105": 70 }), T("2026-09-22", "V1", "D1", { "PVG-0105": 80 }), T("2026-09-24", "V1", "D2", { "UDT-0206": 12, "PVG-0105": 80 }), T("2026-09-25", "V2", "D2", { "PVG-0105": 80 }),
    ].map((t) => ({ ...t, recv: "Pak Wahyu" })),
    invoices: [{ date: "2026-09-15" }, { date: "2026-09-30" }],
    receipts: [],
  },
  {
    key: "O8", date: "2026-09-03", c: "C3", ref: "", project: "", address: "Toko Bangunan Sinar Jaya, Cikampek", site: "Bu Sri (toko) 0811 0000 2203", req: "2026-09-04", tax: false,
    lines: [["BUS-0301", 80, 65000], ["BUS-0302", 60, 85000], ["BUS-0303", 40, 105000], ["KST-0402", 300, 15000]],
    trips: [T("2026-09-04", "V1", "D2", { "BUS-0301": 80, "BUS-0302": 60, "BUS-0303": 40 }, { recv: "Bu Sri" }), T("2026-09-04", "V2", "D3", { "KST-0402": 300 }, { recv: "Bu Sri" })],
    invoices: [{ date: "2026-09-04" }],
    receipts: [{ date: "2026-10-01", inv: 0, acc: "bank" }],
  },
  {
    key: "O9", date: "2026-09-09", c: "C1", ref: "GAS/PO/IX/2026/022", project: "Griya Asri Bungursari tahap 2, blok D", address: "Perumahan Griya Asri, Jl. Raya Bungursari, Purwakarta", site: "Pak Udin (mandor) 0811 0000 2201", req: "2026-09-14", tax: true,
    lines: [["PVG-0101", 560, 82000], ["KST-0402", 400, 14000]],
    trips: ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-18", "2026-09-19", "2026-09-23", "2026-09-25", "2026-09-26"].map((d, i) => T(d, i % 4 === 3 ? "V2" : "V1", i % 4 === 3 ? "D2" : "D1", { "PVG-0101": 70, "KST-0402": 50 }, { recv: "Pak Udin" })),
    invoices: [{ date: "2026-09-30" }],
    receipts: [],
  },
  {
    key: "O10", date: "2026-09-15", c: "C8", ref: "", project: "Sumur resapan rumah", address: "Jl. Veteran gang Melati, Purwakarta", site: "Ibu Nining 0811 0000 2108", req: "2026-09-16", tax: false, ongkir: 150000,
    lines: [["BUS-0307", 6, 260000], ["BUS-0311", 2, 270000]],
    trips: [T("2026-09-16", "V3", "D3", { "BUS-0307": 6, "BUS-0311": 2 }, { recv: "Ibu Nining" })],
    invoices: [{ date: "2026-09-16" }],
    receipts: [{ date: "2026-09-16", inv: 0, acc: "kas", memo: "Bayar tunai saat barang tiba" }],
    close: true,
  },
  {
    key: "O11", date: "2026-09-18", c: "C2", ref: "KMK-PO-2609-047", project: "Saluran perumahan Telukjambe", address: "Telukjambe Timur, Karawang", site: "Bapak Sutisna 0811 0000 2202", req: "2026-09-22", tax: true,
    lines: [["UDT-0201", 80, 265000], ["UDT-0203", 40, 355000]],
    trips: [T("2026-09-22", "V1", "D1", { "UDT-0201": 20 }), T("2026-09-24", "V2", "D1", { "UDT-0201": 12 }), T("2026-09-28", "V1", "D1", { "UDT-0201": 20 }), T("2026-09-29", "V1", "D2", { "UDT-0201": 28 }), T("2026-10-01", "V1", "D1", { "UDT-0203": 20 }), T("2026-10-02", "V1", "D2", { "UDT-0203": 20 })].map((t) => ({ ...t, recv: "Pak Sutisna" })),
    deposits: [{ date: "2026-09-18", amount: 7000000, acc: "bank", memo: "DP U-Ditch Telukjambe" }],
    invoices: [{ date: "2026-10-02" }],
    receipts: [{ date: "2026-10-05", inv: 0, acc: "deposit" }],
  },
  {
    key: "O12", date: "2026-09-25", c: "C4", ref: "BPT/031/IX/26", project: "Saluran irigasi tersier, Pagaden", address: "Pagaden, Subang", site: "Pak Engkos 0811 0000 2204", req: "2026-09-30", tax: true,
    lines: [["BUS-0305", 50, 240000], ["BUS-0307", 20, 255000]],
    trips: [T("2026-09-30", "V1", "D1", { "BUS-0305": 25, "BUS-0307": 10 }), T("2026-10-01", "V1", "D2", { "BUS-0305": 25, "BUS-0307": 10 })].map((t) => ({ ...t, recv: "Pak Engkos" })),
    invoices: [{ date: "2026-10-01" }],
    receipts: [],
  },
  {
    key: "O13", date: "2026-10-01", c: "C3", ref: "", project: "", address: "Toko Bangunan Sinar Jaya, Cikampek", site: "Bu Sri (toko) 0811 0000 2203", req: "2026-10-02", tax: false,
    lines: [["BUS-0302", 60, 85000], ["KST-0402", 300, 15000], ["KST-0403", 100, 22000]],
    trips: [T("2026-10-02", "V2", "D2", { "BUS-0302": 60 }, { recv: "Bu Sri" }), T("2026-10-02", "V1", "D1", { "KST-0402": 300, "KST-0403": 100 }, { recv: "Bu Sri" })],
    invoices: [{ date: "2026-10-02" }],
    receipts: [],
  },
  {
    key: "O14", date: "2026-10-05", c: "C1", ref: "GAS/PO/X/2026/030", project: "Griya Asri, fasum taman & jogging track", address: "Perumahan Griya Asri, Jl. Raya Bungursari, Purwakarta", site: "Pak Udin (mandor) 0811 0000 2201", req: "2026-10-08", tax: true,
    lines: [["PVG-0102", 280, 86000], ["KST-0403", 200, 21000]],
    trips: [T("2026-10-08", "V1", "D1", { "PVG-0102": 70, "KST-0403": 50 }), T("2026-10-09", "V1", "D1", { "PVG-0102": 70, "KST-0403": 50 }), T("2026-10-12", "V1", "D2", { "PVG-0102": 70, "KST-0403": 50 }), T("2026-10-13", "V1", "D1", { "PVG-0102": 70, "KST-0403": 50 })].map((t) => ({ ...t, recv: "Pak Udin" })),
    invoices: [],
    receipts: [],
  },
  {
    key: "O15", date: "2026-10-07", c: "C5", ref: "MGN/PO/2026/1007", project: "Drainase tambahan gudang C", address: "Kawasan industri, Bungursari, Purwakarta (pos satpam gerbang 2)", site: "Pak Wahyu (site engineer) 0811 0000 2205", req: "2026-10-14", tax: true,
    lines: [["UDT-0209", 24, 630000], ["UDT-0215", 24, 255000]],
    trips: [T("2026-10-14", "V1", "D1", { "UDT-0209": 12, "UDT-0215": 12 }, { recv: "Pak Wahyu" }), T("2026-10-17", "V1", "D1", { "UDT-0209": 12, "UDT-0215": 12 }, { status: "berangkat" })],
    invoices: [],
    receipts: [],
  },
  {
    key: "O16", date: "2026-10-12", c: "C2", ref: "KMK-PO-2610-052", project: "Jalan lingkungan Klari", address: "Klari, Karawang", site: "Bapak Sutisna 0811 0000 2202", req: "2026-10-15", tax: true,
    lines: [["PVG-0101", 420, 82000], ["KST-0402", 300, 14000]],
    trips: [T("2026-10-15", "V1", "D1", { "PVG-0101": 70, "KST-0402": 50 }, { recv: "Pak Sutisna" }), T("2026-10-16", "V1", "D2", { "PVG-0101": 70, "KST-0402": 50 }, { recv: "Pak Sutisna" }), T("2026-10-17", "V2", "D2", { "PVG-0101": 45, "KST-0402": 50 }, { status: "dijadwalkan" }), T("2026-10-19", "V1", "D1", { "PVG-0101": 70, "KST-0402": 50 }, { status: "dijadwalkan" })],
    invoices: [],
    receipts: [],
  },
  {
    key: "O17", date: "2026-10-15", c: "C3", ref: "", project: "", address: "Toko Bangunan Sinar Jaya, Cikampek", site: "Bu Sri (toko) 0811 0000 2203", req: "2026-10-19", tax: false,
    lines: [["BUS-0301", 100, 65000], ["BUS-0303", 40, 105000]],
    trips: [T("2026-10-19", "V2", "D3", { "BUS-0301": 100, "BUS-0303": 40 }, { status: "dijadwalkan" })],
    invoices: [],
    receipts: [],
  },
  { key: "O18", date: "2026-09-10", c: "C9", ref: "SBP-0910", project: "Saluran ruko Cibatu", address: "Cibatu, Purwakarta", site: "", req: "2026-09-21", tax: true, lines: [["UDT-0201", 30, 270000]], trips: [], invoices: [], receipts: [], status: "batal", note: "Dibatalkan pelanggan: proyek ditunda pemilik ruko." },
  { key: "O19", date: "2026-10-16", c: "C10", ref: "", project: "Carport rumah", address: "Cibatu, Purwakarta", site: "Pak Rudi 0811 0000 2110", req: "2026-10-23", tax: false, ongkir: 250000, lines: [["PVG-0102", 60, 88000]], trips: [], invoices: [], receipts: [], status: "draft", note: "Menunggu DP 50% sebelum dikonfirmasi." },
];

/* =================================================================== rencana produksi otomatis */

// Kebutuhan kirim per tanggal (dipakai untuk merencanakan produksi 1–2 minggu sebelum kirim).
const demand = new Map(); // code → [{date, qty}]
for (const o of ORDERS) for (const t of o.trips) for (const [code, q] of Object.entries(t.load)) {
  if (!demand.has(code)) demand.set(code, []);
  demand.get(code).push({ date: t.date, qty: q });
}
const OPENING_FG = {
  "PVG-0101": 380, "PVG-0102": 160, "PVG-0105": 90, "KST-0402": 450, "KST-0403": 120,
  "UDT-0201": 24, "UDT-0203": 36, "UDT-0206": 12, "UDT-0209": 6, "UDT-0214": 12, "UDT-0215": 10,
  "BUS-0301": 60, "BUS-0302": 70, "BUS-0303": 40, "BUS-0305": 30, "BUS-0307": 14, "BUS-0310": 4, "BUS-0311": 10,
};
const OPENING_RM = { "BB-SMN": 240, "BB-PSR": 14, "BB-ABU": 18, "BB-SPL": 12, "BB-BSI": 300, "BB-PGM": 60 };
const FAMILY_DAYS = { paving: [1, 3, 5], kanstin: [2, 4], udit: [2, 4], buis: [3, 5] }; // Senin=1
const FAMILY_NOTE = { paving: "Mesin press paving, shift pagi", kanstin: "Mesin press kanstin", udit: "Cetak basah U-Ditch & cover", buis: "Cetak buis beton" };

// Simulasi proyeksi: produksi bila stok proyeksi 10 hari ke depan turun di bawah batas minimum.
const projected = new Map(Object.entries(OPENING_FG));
const PLAN = []; // {date, fam, items: {code: qty}}
for (let d = "2026-08-03"; d <= "2026-10-16"; d = addDays(d, 1)) {
  if (!isWorkday(d)) continue;
  const runs = {};
  for (const [code, f] of Object.entries(FG)) {
    if (!FAMILY_DAYS[f.fam].includes(dow(d))) continue;
    const ahead = (demand.get(code) ?? []).filter((x) => x.date >= d && x.date <= addDays(d, 10)).reduce((a, x) => a + x.qty, 0);
    const already = (demand.get(code) ?? []).filter((x) => x.date < d).reduce((a, x) => a + x.qty, 0);
    const produced = PLAN.reduce((a, p) => a + (p.items[code] ?? 0), 0);
    const now = (OPENING_FG[code] ?? 0) + produced - already;
    // Paving & kanstin dibuat rutin; barang cetak basah hanya bila perlu.
    const target = ahead + f.min;
    if (now < target) {
      const n = Math.max(1, Math.ceil((target - now) / f.batch));
      runs[code] = Math.min(n, f.fam === "paving" ? 2 : 3) * f.batch;
    }
  }
  if (Object.keys(runs).length) {
    for (const fam of Object.keys(FAMILY_DAYS)) {
      const items = Object.fromEntries(Object.entries(runs).filter(([c]) => FG[c].fam === fam));
      if (Object.keys(items).length) PLAN.push({ date: d, fam, items });
    }
  }
}

/* =================================================================== mesin peristiwa */

const EVENTS = [];
let evn = 0;
const at = (date, prio, fn) => EVENTS.push({ date, prio, n: ++evn, fn });

/* ---------- saldo awal (31 Juli) */
at("2026-07-31", 0, () => {
  const jid = id("ju");
  const number = nextNumber("JU", "2026-07-31");
  journal({
    number, date: "2026-07-31", memo: "Saldo awal per 31 Juli 2026 (sebelum memakai sistem)", source: "manual", sourceId: jid, hour: 9,
    lines: [
      { account: A.kas, debit: 12500000, memo: "Kas kantor" },
      { account: A.bank, debit: 285000000, memo: "Rekening operasional" },
      { account: A.mesin, debit: 465000000, memo: "Mesin press paving, mixer, cetakan U-Ditch & buis" },
      { account: A.kendaraan, debit: 520000000, memo: "Truk engkel, colt diesel, pickup" },
      { account: A.peralatan, debit: 28500000, memo: "Komputer, printer, meja" },
      { account: A.akum, credit: 312000000, memo: "Akumulasi penyusutan s.d. Juli 2026" },
      { account: A.modal, credit: 750000000 },
      { account: A.saldoAwal, credit: 249000000, memo: "Selisih saldo awal" },
    ],
  });
  for (const [code, q] of [...Object.entries(OPENING_FG), ...Object.entries(OPENING_RM)]) {
    const it = ITEM.get(code);
    const aid = id("adj");
    const num = nextNumber("ADJ", "2026-07-31");
    const value = round(q * it.std);
    const ts = epoch("2026-07-31", 10);
    put("inv_adjustments", { id: aid, number: num, date: "2026-07-31", item_id: iref(code), qty: q, unit_cost: it.std, reason: "Saldo awal hasil stok opname 31 Juli", created_by: null, created_at: ts, updated_at: ts });
    move(code, "2026-07-31", q, value, "saldo_awal", aid, num);
    const memo = `Saldo awal stok ${it.name} · Saldo awal hasil stok opname 31 Juli`;
    journal({ number: num, date: "2026-07-31", memo, source: "penyesuaian", sourceId: aid, hour: 10, lines: [{ account: invAcc(code), debit: value, memo }, { account: A.saldoAwal, credit: value, memo }] });
  }
});

/* ---------- pembelian bahan (otomatis saat stok di bawah minimum) + pembayaran */
const BILLS = [];
const pendingBuy = new Set();
function buyMaterials(date, codes) {
  const bySup = new Map();
  for (const code of codes) {
    const r = ITEM.get(code);
    if (!bySup.has(r.sup)) bySup.set(r.sup, []);
    bySup.get(r.sup).push(code);
  }
  for (const [sup, list] of bySup) {
    const c = CONTACTS[sup];
    const bid = id("pb");
    const number = nextNumber("PBL", date);
    const lines = list.map((code, sort) => {
      const it = ITEM.get(code);
      const price = round(it.price * (0.98 + rnd() * 0.05));
      const qty = it.batch;
      return { code, qty, price, amount: round(qty * price), sort };
    });
    const subtotal = lines.reduce((a, l) => a + l.amount, 0);
    const taxable = list.some((code) => ITEM.get(code).tax);
    const tax = taxable ? round((subtotal * 11) / 100) : 0;
    const total = subtotal + tax;
    const due = addDays(date, c.term);
    const ref = sup === "S1" ? `SR/${date.slice(5, 7)}${date.slice(8)}/${100 + Math.floor(rnd() * 800)}` : sup === "S2" ? `NOTA ${300 + Math.floor(rnd() * 600)}` : `BPK-${date.replace(/-/g, "").slice(2)}`;
    const ts = epoch(date, 9);
    put("fin_bills", { id: bid, number, supplier_ref: ref, date, due_date: due, contact_id: CID[sup], subtotal, discount: 0, taxable, tax_rate: taxable ? 11 : 0, tax, total, paid: 0, note: sup === "S2" ? "Dikirim per rit dump truck." : "", void: 0, created_by: null, created_at: ts, updated_at: ts });
    for (const l of lines) {
      const it = ITEM.get(l.code);
      put("fin_bill_lines", { id: id("pbl"), bill_id: bid, item_id: iref(l.code), account_id: A.persBahan, description: it.name, qty: l.qty, unit: it.unit, price: l.price, amount: l.amount, sort: l.sort });
      move(l.code, date, l.qty, l.amount, "pembelian", bid, `${number} ${c.name}`);
    }
    journal({
      number, date, memo: `Pembelian ${number} — ${c.name}`, source: "pembelian", sourceId: bid, hour: 9,
      lines: [{ account: A.persBahan, debit: subtotal, contact: CID[sup] }, { account: A.ppnMasukan, debit: tax, contact: CID[sup] }, { account: A.hutang, credit: total, contact: CID[sup], memo: c.name }],
    });
    const bill = { id: bid, number, date, due, sup, total, paid: 0 };
    BILLS.push(bill);
    // Pemasok pasir dibayar tunai saat nota jatuh tempo; semen & besi lewat transfer pada jatuh tempo.
    const payDate = due > "2026-10-16" ? null : isWorkday(due) ? due : nextWorkday(due);
    if (payDate) at(payDate, 6, () => payBill(bill, payDate, sup === "S2" ? "kas" : "bank"));
  }
}
const PAYMENTS = [];
function payBill(bill, date, accKey) {
  if (bill.paid >= bill.total) return;
  const c = CONTACTS[bill.sup];
  const account = accKey === "kas" ? A.kas : A.bank;
  if (accKey === "kas") ensureCash(date, bill.total);
  const pid = id("byr");
  const number = nextNumber("BYR", date);
  const amount = bill.total - bill.paid;
  const ts = epoch(date, 14);
  put("fin_payments", { id: pid, number, date, contact_id: CID[bill.sup], account_id: account, amount, memo: accKey === "kas" ? "Bayar tunai ke sopir dump truck" : `Transfer pelunasan ${bill.number}`, created_by: null, created_at: ts, updated_at: ts });
  put("fin_payment_allocations", { id: id("byra"), payment_id: pid, bill_id: bill.id, amount });
  bill.paid += amount;
  journal({ number, date, memo: `Pembayaran ${number} — ${c.name}`, source: "pembayaran", sourceId: pid, hour: 14, lines: [{ account: A.hutang, debit: amount, contact: CID[bill.sup] }, { account, credit: amount, contact: CID[bill.sup] }] });
}

/* ---------- produksi */
const weekLabor = new Map(); // tanggal Sabtu → upah
function saturdayOf(d) {
  let x = d;
  while (dow(x) !== 6) x = addDays(x, 1);
  return x;
}
for (const p of PLAN) {
  at(p.date, 2, () => {
    // Beli bahan dulu bila tidak cukup atau di bawah minimum. Besi & pigmen sengaja tidak diisi lagi sejak 21 Sep
    // kecuali benar-benar kurang, supaya ringkasan keuangan menampilkan "bahan baku perlu dibeli".
    const need = {};
    for (const [code, q] of Object.entries(p.items)) for (const [m, mq] of Object.entries(recipe(code, q))) need[m] = (need[m] ?? 0) + mq;
    const toBuy = Object.keys(need).filter((m) => lv(m).qty - need[m] < ITEM.get(m).min && !pendingBuy.has(`${m}${p.date}`));
    const late = p.date >= "2026-09-21";
    const buyNow = toBuy.filter((m) => !(late && (m === "BB-BSI" || m === "BB-PGM")) || lv(m).qty < need[m]);
    if (buyNow.length) buyMaterials(p.date, buyNow);

    const pid = id("prd");
    const number = nextNumber("PRD", p.date);
    const out = Object.entries(p.items);
    const used = Object.entries(need).map(([m, q]) => [m, Math.round(q * 10) / 10]);
    const usedValues = used.map(([m, q]) => round(q * unitCost(m)));
    const materials = usedValues.reduce((a, v) => a + v, 0);
    const labor = out.reduce((a, [code, q]) => a + q * ITEM.get(code).labor, 0);
    const total = materials + labor;
    const standard = out.reduce((a, [code, q]) => a + round(q * ITEM.get(code).std), 0);
    const weights = out.map(([code, q]) => q * (standard > 0 ? ITEM.get(code).std : 1));
    const wsum = weights.reduce((a, w) => a + w, 0) || 1;
    const outValues = out.map((_, i) => round((total * weights[i]) / wsum));
    outValues[outValues.length - 1] += total - outValues.reduce((a, v) => a + v, 0);
    const note = `${FAMILY_NOTE[p.fam]}${p.fam === "paving" && p.items["PVG-0102"] && rnd() < 0.5 ? ", sebagian warna merah" : ""}`;
    const ts = epoch(p.date, 15);
    put("inv_productions", { id: pid, number, date: p.date, labor_cost: labor, note, created_by: null, created_at: ts, updated_at: ts });
    out.forEach(([code, q], i) => {
      put("inv_production_lines", { id: id("pl"), production_id: pid, role: "hasil", item_id: iref(code), qty: q });
      move(code, p.date, q, outValues[i], "produksi", pid, number);
    });
    used.forEach(([m, q], i) => {
      put("inv_production_lines", { id: id("pl"), production_id: pid, role: "bahan", item_id: iref(m), qty: q });
      move(m, p.date, -q, -usedValues[i], "produksi", pid, number);
    });
    journal({
      number, date: p.date, memo: `Hasil produksi ${number} · ${note}`, source: "produksi", sourceId: pid, hour: 15,
      lines: [
        ...out.map(([code], i) => ({ account: A.persJadi, debit: outValues[i], memo: ITEM.get(code).name })),
        ...used.map(([m], i) => ({ account: A.persBahan, credit: usedValues[i], memo: ITEM.get(m).name })),
        { account: A.upah, credit: labor, memo: "Biaya produksi diserap ke persediaan" },
      ],
    });
    const sat = saturdayOf(p.date);
    weekLabor.set(sat, (weekLabor.get(sat) ?? 0) + labor);
  });
}

/* ---------- pesanan, surat jalan, faktur, penerimaan */
const SHIP = new Map(); // order key → state
const tripCount = new Map(); // tanggal → jumlah trip (untuk BBM & uang jalan)
const RECEIPTS = [];

function deposit(o, dep) {
  const account = dep.acc === "kas" ? A.kas : A.bank;
  const rid = id("trm");
  const number = nextNumber("TRM", dep.date);
  const c = CONTACTS[o.c];
  const ts = epoch(dep.date, 11);
  put("fin_receipts", { id: rid, number, date: dep.date, contact_id: CID[o.c], account_id: account, amount: dep.amount, memo: dep.memo, created_by: null, created_at: ts, updated_at: ts });
  journal({
    number, date: dep.date, memo: `Penerimaan ${number} — ${c.name}`, source: "penerimaan", sourceId: rid, hour: 11,
    lines: [{ account, debit: dep.amount, contact: CID[o.c] }, { account: A.umJual, credit: dep.amount, contact: CID[o.c], memo: "Uang muka / titipan pelanggan" }],
  });
  SHIP.get(o.key).deposit += dep.amount;
}

for (const o of ORDERS) {
  const st = { order: o, id: `demo-po-${o.key.toLowerCase()}`, lines: [], delivered: new Map(), invoiced: new Map(), invoices: [], deposit: 0, number: "" };
  SHIP.set(o.key, st);
  at(o.date, 1, () => {
    st.number = nextNumber("PO", o.date);
    const ts = epoch(o.date, 10, 15);
    st.lines = o.lines.map(([code, qty, price], sort) => ({ id: `${st.id}-l${sort + 1}`, code, qty, price, sort }));
    put("ops_orders", {
      id: st.id, number: st.number, date: o.date, contact_id: CID[o.c], customer_ref: o.ref, project: o.project, address: o.address, maps_url: "", site_contact: o.site, requested_date: o.req,
      status: "dikonfirmasi", ongkir: o.ongkir ?? 0, discount: 0, taxable: o.tax, note: o.note ?? "", created_by: null, created_at: ts, updated_at: ts,
    });
    for (const l of st.lines) put("ops_order_lines", { id: l.id, order_id: st.id, item_id: iref(l.code), description: "", qty: l.qty, unit: ITEM.get(l.code).unit, price: l.price, sort: l.sort });
  });
  for (const dep of o.deposits ?? []) at(dep.date, 1.5, () => deposit(o, dep));
  o.trips.forEach((t, ti) => {
    at(t.date, 3, () => {
      const did = `${st.id}-sj${ti + 1}`;
      const number = nextNumber("SJ", t.date);
      const status = t.status ?? "terkirim";
      const dep = epoch(t.date, 7 + (ti % 3), 10 + Math.floor(rnd() * 40));
      const arr = dep + 3600 * (1 + Math.floor(rnd() * 3)) + Math.floor(rnd() * 1800);
      const ts = epoch(addDays(t.date, status === "terkirim" ? -1 : -1), 15);
      put("ops_deliveries", {
        id: did, number, order_id: st.id, date: t.date, vehicle_id: `demo-vh-${t.veh.toLowerCase()}`, driver_id: `demo-dr-${t.drv.toLowerCase()}`, status,
        departed_at: status === "dijadwalkan" ? null : dep, delivered_at: status === "terkirim" ? arr : null, received_by: status === "terkirim" ? t.recv ?? "" : "", proof_key: null,
        note: t.note ?? "", created_by: null, created_at: ts, updated_at: status === "terkirim" ? arr : ts,
      });
      const jl = [];
      for (const [code, qty] of Object.entries(t.load)) {
        const line = st.lines.find((l) => l.code === code);
        put("ops_delivery_lines", { id: `${did}-${code}`, delivery_id: did, order_line_id: line.id, item_id: iref(code), qty });
        if (status === "dijadwalkan") continue;
        const it = ITEM.get(code);
        const value = round(qty * unitCost(code));
        move(code, t.date, -qty, -value, "pengiriman", did, number);
        jl.push({ account: A.hpp, debit: value, memo: it.name, contact: CID[o.c] }, { account: invAcc(code), credit: value, memo: it.name });
        if (status === "terkirim") st.delivered.set(line.id, (st.delivered.get(line.id) ?? 0) + qty);
      }
      if (jl.length) journal({ number, date: t.date, memo: `HPP surat jalan ${number} · ${st.number}`, source: "pengiriman", sourceId: did, hour: 8, lines: jl });
      if (status !== "dijadwalkan") tripCount.set(t.date, (tripCount.get(t.date) ?? 0) + 1);
    });
  });
  o.invoices.forEach((inv, ii) => {
    at(inv.date, 4, () => {
      const c = CONTACTS[o.c];
      const lines = st.lines
        .map((l) => ({ l, qty: r3((st.delivered.get(l.id) ?? 0) - (st.invoiced.get(l.id) ?? 0)) }))
        .filter((x) => x.qty > 0);
      if (!lines.length) return;
      const iid = `${st.id}-inv${ii + 1}`;
      const number = nextNumber("INV", inv.date);
      const first = st.invoices.length === 0;
      const rows = lines.map(({ l, qty }, sort) => ({ l, qty, amount: round(qty * l.price), sort }));
      const subtotal = rows.reduce((a, r) => a + r.amount, 0);
      const ongkir = first ? o.ongkir ?? 0 : 0;
      const dpp = subtotal + ongkir;
      const tax = o.tax ? round((dpp * 11) / 100) : 0;
      const total = dpp + tax;
      const due = addDays(inv.date, c.term || 14);
      const ts = epoch(inv.date, 16, 20);
      put("fin_invoices", {
        id: iid, number, date: inv.date, due_date: due, contact_id: CID[o.c], order_id: st.id, subtotal, discount: 0, ongkir, taxable: o.tax, tax_rate: o.tax ? 11 : 0, tax, total, paid: 0,
        note: o.ref ? `PO ${o.ref}` : "", void: 0, created_by: null, created_at: ts, updated_at: ts,
      });
      for (const r of rows) {
        put("fin_invoice_lines", { id: `${iid}-${r.l.code}`, invoice_id: iid, item_id: iref(r.l.code), order_line_id: r.l.id, account_id: A.penjualan, description: ITEM.get(r.l.code).name, qty: r.qty, unit: ITEM.get(r.l.code).unit, price: r.l.price, amount: r.amount, sort: r.sort });
        st.invoiced.set(r.l.id, (st.invoiced.get(r.l.id) ?? 0) + r.qty);
      }
      journal({
        number, date: inv.date, memo: `Faktur ${number} — ${c.name}`, source: "faktur", sourceId: iid, hour: 16,
        lines: [
          { account: A.piutang, debit: total, contact: CID[o.c], memo: c.name },
          { account: A.penjualan, credit: subtotal, contact: CID[o.c] },
          { account: A.ongkir, credit: ongkir, contact: CID[o.c] },
          { account: A.ppnKeluaran, credit: tax, contact: CID[o.c] },
        ],
      });
      st.invoices.push({ id: iid, number, total, paid: 0, due });
    });
  });
  for (const rc of o.receipts) {
    at(rc.date, 5, () => {
      const c = CONTACTS[o.c];
      const inv = st.invoices[rc.inv];
      if (!inv) throw new Error(`${o.key}: faktur ke-${rc.inv} belum ada saat penerimaan ${rc.date}`);
      const open = inv.total - inv.paid;
      const useDeposit = rc.acc === "deposit";
      let amount = useDeposit ? Math.min(st.deposit, open) : rc.pct ? round(open * rc.pct / 1000) * 1000 : open;
      if (amount <= 0) return;
      const account = useDeposit ? A.umJual : rc.acc === "kas" ? A.kas : A.bank;
      const rid = id("trm");
      const number = nextNumber("TRM", rc.date);
      const ts = epoch(rc.date, 13);
      put("fin_receipts", { id: rid, number, date: rc.date, contact_id: CID[o.c], account_id: account, amount, memo: rc.memo ?? (useDeposit ? "Pemakaian uang muka" : `Pembayaran ${inv.number}`), created_by: null, created_at: ts, updated_at: ts });
      put("fin_receipt_allocations", { id: id("trma"), receipt_id: rid, invoice_id: inv.id, amount });
      inv.paid += amount;
      if (useDeposit) st.deposit -= amount;
      journal({ number, date: rc.date, memo: `Penerimaan ${number} — ${c.name}`, source: "penerimaan", sourceId: rid, hour: 13, lines: [{ account, debit: amount, contact: CID[o.c] }, { account: A.piutang, credit: amount, contact: CID[o.c] }] });
    });
  }
}

/* ---------- kas & bank harian */
const CASH = [];
function cashTxn(date, kind, accountKey, lines, memo, contact = null, toKey = null, hour = 15) {
  const account = accountKey === "kas" ? A.kas : A.bank;
  const amount = kind === "transfer" ? lines : lines.reduce((a, l) => a + l.amount, 0);
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
  if (bal(A.kas) >= need + 1500000) return;
  const amt = Math.ceil((need + 10000000 - bal(A.kas)) / 5000000) * 5000000;
  cashTxn(date, "transfer", "bank", amt, "Tarik tunai untuk kas kantor", null, "kas", 8);
}

for (let d = START; d <= "2026-10-16"; d = addDays(d, 1)) {
  const day = d;
  // Senin pagi: isi kas kantor kalau tinggal sedikit.
  if (dow(day) === 1) at(day, 0.5, () => { if (bal(A.kas) < 10000000) cashTxn(day, "transfer", "bank", 15000000, "Tarik tunai untuk kas kantor", null, "kas", 8); });
  // Sabtu: upah borongan produksi, BBM & uang jalan sopir minggu ini.
  if (dow(day) === 6) {
    at(day, 7, () => {
      const labor = weekLabor.get(day) ?? 0;
      let trips = 0;
      for (let k = 0; k < 7; k++) trips += tripCount.get(addDays(day, -k)) ?? 0;
      const fuel = round((850000 + trips * 165000) / 1000) * 1000;
      const allowance = trips * 75000;
      const lines = [
        ...(labor ? [{ account: A.upah, amount: labor, memo: "Upah borongan produksi minggu ini" }] : []),
        ...(trips ? [{ account: A.bbm, amount: fuel, memo: `Solar & tol armada (${trips} rit)` }, { account: A.uangJalan, amount: allowance, memo: `Uang jalan sopir ${trips} rit` }] : []),
      ];
      if (!lines.length) return;
      ensureCash(day, lines.reduce((a, l) => a + l.amount, 0));
      cashTxn(day, "keluar", "kas", lines, "Pembayaran mingguan: upah produksi, solar, uang jalan", null, null, 16);
    });
  }
  // Tanggal tertentu tiap bulan.
  const dd = Number(day.slice(8));
  if (dd === 5 || (dd === 6 && dow(addDays(day, -1)) === 0)) {
    if (isWorkday(day)) at(day, 7, () => cashTxn(day, "keluar", "bank", [{ account: A.listrik, amount: { "08": 7840000, "09": 8215000, "10": 8032000 }[day.slice(5, 7)] ?? 8000000, memo: "Tagihan PLN pabrik (golongan I-2)" }, { account: A.listrik, amount: 385000, memo: "PDAM kantor" }], "Listrik & air bulan lalu", null, null, 10));
  }
  if (dd === 10 && isWorkday(day)) at(day, 7, () => cashTxn(day, "keluar", "bank", [{ account: A.telp, amount: 465000, memo: "Internet kantor & pulsa admin" }], "Telepon & internet", null, null, 10));
  if (dd === 25 || (dd === 26 && !isWorkday(addDays(day, -1)))) {
    if (isWorkday(day)) at(day, 7, () => cashTxn(day, "keluar", "bank", [{ account: A.gaji, amount: 41500000, memo: "Gaji 11 karyawan tetap (admin, gudang, sopir, operator)" }], `Gaji karyawan ${{ "08": "Agustus", "09": "September", "10": "Oktober" }[day.slice(5, 7)]}`, null, null, 9));
  }
}
const ONE_OFF = [
  ["2026-08-15", () => cashTxn("2026-08-15", "keluar", "bank", [{ account: A.iklan, amount: 1500000, memo: "Iklan pencarian & marketplace Agustus" }], "Biaya iklan")],
  ["2026-08-21", () => { ensureCash("2026-08-21", 2400000); cashTxn("2026-08-21", "keluar", "kas", [{ account: A.rawatKend, amount: 2400000, memo: "Ganti 2 ban belakang truk engkel T 8417 BD" }], "Perawatan kendaraan"); }],
  ["2026-09-08", () => cashTxn("2026-09-08", "keluar", "bank", [{ account: A.rawatMesin, amount: 3750000, memo: "Perbaikan hidrolik mesin press paving" }], "Servis mesin press", CID.S4)],
  ["2026-09-26", () => { ensureCash("2026-09-26", 1150000); cashTxn("2026-09-26", "keluar", "kas", [{ account: A.rawatKend, amount: 1150000, memo: "Servis berkala colt diesel T 9125 AB" }], "Perawatan kendaraan"); }],
  ["2026-10-01", () => cashTxn("2026-10-01", "keluar", "bank", [{ account: A.iklan, amount: 1500000, memo: "Iklan pencarian & marketplace Oktober" }], "Biaya iklan")],
  ["2026-08-11", () => { ensureCash("2026-08-11", 412000); cashTxn("2026-08-11", "keluar", "kas", [{ account: A.atk, amount: 412000, memo: "Kertas, tinta printer, buku surat jalan rangkap 3" }], "Alat tulis kantor"); }],
  ["2026-09-09", () => { ensureCash("2026-09-09", 287000); cashTxn("2026-09-09", "keluar", "kas", [{ account: A.atk, amount: 287000, memo: "Map, materai, kertas" }], "Alat tulis kantor"); }],
  ["2026-10-07", () => { ensureCash("2026-10-07", 356000); cashTxn("2026-10-07", "keluar", "kas", [{ account: A.atk, amount: 356000, memo: "Tinta printer & buku surat jalan" }], "Alat tulis kantor"); }],
];
for (const [d, fn] of ONE_OFF) at(d, 7, fn);

/* ---------- akhir bulan: bunga & admin bank, penyusutan; setor PPN bulan lalu */
for (const me of ["2026-08-31", "2026-09-30"]) {
  at(me, 8, () => {
    cashTxn(me, "masuk", "bank", [{ account: A.bunga, amount: me === "2026-08-31" ? 118420 : 104355, memo: "Jasa giro" }], "Jasa giro bulan ini", null, null, 17);
    cashTxn(me, "keluar", "bank", [{ account: A.adminBank, amount: 27500, memo: "Biaya administrasi rekening" }], "Biaya administrasi bank", null, null, 17);
    const jid = id("ju");
    journal({
      number: nextNumber("JU", me), date: me, memo: `Penyusutan aset tetap ${me.slice(5, 7) === "08" ? "Agustus" : "September"} 2026`, source: "manual", sourceId: jid, hour: 17,
      lines: [
        { account: A.susut, debit: 9900000, memo: "Mesin 5.250.000; kendaraan 4.300.000; peralatan 350.000" },
        { account: A.akum, credit: 9900000 },
      ],
    });
  });
}
// PPN: kompensasi masukan & keluaran bulan lalu, lalu setor selisihnya (tanggal 14).
const ppnBefore = new Map(); // bulan → {out, in}
for (const [month, settle] of [["08", "2026-09-14"], ["09", "2026-10-14"]]) {
  at(settle, 7.5, () => {
    // Hitung dari baris jurnal bulan itu (PPN keluaran kredit, PPN masukan debit).
    const t = TABLES.get("fin_journal_lines");
    const jt = TABLES.get("fin_journals");
    const monthJournals = new Set(jt.rows.filter((r) => r[2].slice(1, 8) === `2026-${month}`).map((r) => r[0]));
    let out = 0;
    let inn = 0;
    for (const r of t.rows) {
      if (!monthJournals.has(r[1])) continue;
      if (r[3] === lit(A.ppnKeluaran)) out += Number(r[5]) - Number(r[4]);
      if (r[3] === lit(A.ppnMasukan)) inn += Number(r[4]) - Number(r[5]);
    }
    ppnBefore.set(month, { out, inn });
    const net = out - inn;
    const jid = id("ju");
    const name = month === "08" ? "Agustus" : "September";
    // Kurang bayar → hutang pajak lalu disetor. Lebih bayar → hanya dikompensasikan sebesar PPN keluaran;
    // sisa PPN masukan tetap di akunnya (aset) untuk masa berikutnya, bukan hutang pajak bersaldo minus.
    journal({
      number: nextNumber("JU", settle), date: settle, memo: `Kompensasi PPN masa ${name} 2026`, source: "manual", sourceId: jid, hour: 10,
      lines:
        net >= 0
          ? [{ account: A.ppnKeluaran, debit: out, memo: "PPN keluaran masa ini" }, { account: A.ppnMasukan, credit: inn, memo: "PPN masukan masa ini" }, { account: A.hutPajak, credit: net, memo: "PPN kurang bayar" }]
          : [{ account: A.ppnKeluaran, debit: out, memo: "PPN keluaran masa ini" }, { account: A.ppnMasukan, credit: out, memo: "Dikompensasi; lebih bayar dibawa ke masa berikutnya" }],
    });
    if (net > 0) cashTxn(settle, "keluar", "bank", [{ account: A.hutPajak, amount: net, memo: `Setor PPN masa ${name} 2026` }], `Setoran PPN masa ${name} 2026`, null, null, 11);
  });
}

/* ---------- stok opname akhir September */
at("2026-09-30", 7.8, () => {
  for (const [code, qty, reason] of [["PVG-0101", -12, "Stok opname 30 Sep: 12 m² pecah saat bongkar muat"], ["KST-0402", -35, "Stok opname 30 Sep: kanstin retak di tumpukan lama"], ["BUS-0302", -3, "Stok opname 30 Sep: 3 buis retak"], ["BB-SMN", -4, "Stok opname 30 Sep: 4 sak semen mengeras (bocor)"]]) {
    const it = ITEM.get(code);
    const aid = id("adj");
    const number = nextNumber("ADJ", "2026-09-30");
    const cost = round(unitCost(code));
    const value = round(qty * cost);
    const ts = epoch("2026-09-30", 16);
    put("inv_adjustments", { id: aid, number, date: "2026-09-30", item_id: iref(code), qty, unit_cost: cost, reason, created_by: null, created_at: ts, updated_at: ts });
    move(code, "2026-09-30", qty, value, "penyesuaian", aid, number);
    const memo = `Penyesuaian stok ${it.name} · ${reason}`;
    journal({ number, date: "2026-09-30", memo, source: "penyesuaian", sourceId: aid, hour: 16, lines: [{ account: A.selisih, debit: -value, memo }, { account: invAcc(code), credit: -value, memo }] });
  }
});

/* =================================================================== jalankan */

EVENTS.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio || a.n - b.n);
for (let i = 0; i < EVENTS.length; i++) {
  const e = EVENTS[i];
  const before = EVENTS.length;
  e.fn();
  if (EVENTS.length > before) {
    // Peristiwa baru (mis. pembayaran tagihan) disisipkan sesuai tanggal.
    const rest = EVENTS.splice(i + 1).concat();
    rest.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio || a.n - b.n);
    EVENTS.push(...rest);
  }
}

// Kas & bank tidak boleh minus di akhir.
if (bal(A.kas) < 0 || bal(A.bank) < 0) throw new Error(`Saldo minus: kas ${bal(A.kas)}, bank ${bal(A.bank)}`);

/* ---------- status & nilai turunan */
for (const st of SHIP.values()) {
  const o = st.order;
  let status = o.status ?? "dikonfirmasi";
  if (!o.status) {
    const all = st.lines.every((l) => (st.delivered.get(l.id) ?? 0) + 1e-9 >= l.qty);
    const any = o.trips.some((t) => (t.status ?? "terkirim") !== "dijadwalkan");
    status = all ? (o.close ? "selesai" : "terkirim") : any ? "dikirim_sebagian" : "dikonfirmasi";
  }
  const t = TABLES.get("ops_orders");
  const row = t.rows.find((r) => r[0] === lit(st.id));
  row[t.cols.indexOf("status")] = lit(status);
  const invT = TABLES.get("fin_invoices");
  for (const inv of st.invoices) {
    const r = invT.rows.find((x) => x[0] === lit(inv.id));
    r[invT.cols.indexOf("paid")] = lit(inv.paid);
  }
}
const billT = TABLES.get("fin_bills");
for (const b of BILLS) billT.rows.find((r) => r[0] === lit(b.id))[billT.cols.indexOf("paid")] = lit(b.paid);

/* =================================================================== tulis SQL */

const ORDER = [
  "fin_contacts", "ops_vehicles", "ops_drivers", "fin_items", "ops_orders", "ops_order_lines", "ops_deliveries", "ops_delivery_lines",
  "inv_productions", "inv_production_lines", "inv_adjustments", "inv_stock_moves", "fin_bills", "fin_bill_lines", "fin_payments", "fin_payment_allocations",
  "fin_invoices", "fin_invoice_lines", "fin_receipts", "fin_receipt_allocations", "fin_cash_txns", "fin_cash_lines", "fin_journals", "fin_journal_lines",
];
const out = [];
out.push(`-- DATA CONTOH modul keuangan & operasional Istana Block (Agustus – Oktober 2026).
-- Dibuat oleh scripts/demo/generate.mjs. Nama pelanggan, pemasok, armada, dan sopir FIKTIF;
-- harga pokok, harga bahan, dan harga paving/kanstin adalah ANGKA CONTOH.
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
writeFileSync(new URL("seed/demo-erp.sql", ROOT), `${out.join("\n\n")}\n`);

const NUMBERED = ["fin_invoices", "fin_receipts", "fin_bills", "fin_payments", "fin_cash_txns", "fin_journals", "ops_orders", "ops_deliveries", "inv_productions", "inv_adjustments"];
// Satu INSERT per tabel: SQLite di D1 membatasi jumlah suku UNION dalam satu SELECT.
const RESEQ = ["DELETE FROM sys_sequences;", ...NUMBERED.map((t) => `INSERT INTO sys_sequences (key, value)
  SELECT substr(number, 1, length(number) - 5), max(CAST(substr(number, -4) AS INTEGER)) FROM ${t} WHERE number LIKE '%/____/____' GROUP BY 1
  ON CONFLICT(key) DO UPDATE SET value = max(value, excluded.value);`)].join("\n");
const DEMO_MASTER = ["fin_contacts", "ops_vehicles", "ops_drivers"];
// Hapus berdasarkan induk, bukan hanya awalan id: dokumen contoh yang sempat diubah/diposting ulang
// lewat aplikasi mendapat jurnal, pergerakan stok, dan baris baru ber-id acak yang tetap menunjuk ke dokumen contoh.
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
${ORDER.filter((t) => !DEMO_MASTER.includes(t) && t !== "fin_items").reverse().map((t) => `DELETE FROM ${t};`).join("\n")}
DELETE FROM sys_sequences;
DELETE FROM ops_positions;
UPDATE users SET driver_id = NULL WHERE driver_id LIKE 'demo-%';
${DEMO_MASTER.map((t) => `DELETE FROM ${t} WHERE id LIKE 'demo-%';`).join("\n")}
DELETE FROM fin_items WHERE id LIKE 'demo-%';
`,
);

/* ---------- ringkasan */
const count = (t) => TABLES.get(t)?.rows.length ?? 0;
console.log(`Data contoh dibuat: ${count("ops_orders")} pesanan, ${count("ops_deliveries")} surat jalan, ${count("inv_productions")} produksi, ${count("fin_invoices")} faktur, ${count("fin_receipts")} penerimaan, ${count("fin_bills")} pembelian, ${count("fin_payments")} pembayaran, ${count("fin_cash_txns")} transaksi kas, ${count("fin_journals")} jurnal (${count("fin_journal_lines")} baris), ${count("inv_stock_moves")} pergerakan stok.`);
console.log(`Saldo akhir: kas ${bal(A.kas).toLocaleString("id-ID")}, bank ${bal(A.bank).toLocaleString("id-ID")}, persediaan jadi ${bal(A.persJadi).toLocaleString("id-ID")}, bahan ${bal(A.persBahan).toLocaleString("id-ID")}, piutang ${bal(A.piutang).toLocaleString("id-ID")}, hutang ${(-bal(A.hutang)).toLocaleString("id-ID")}`);
const stockLow = [...ITEM.values()].filter((it) => lv(it.code).qty < it.min).map((it) => `${it.code} ${r3(lv(it.code).qty)}/${it.min}`);
console.log(`Di bawah minimum: ${stockLow.join(", ") || "-"}`);
if (process.env.DEMO_DEBUG) for (const it of ITEM.values()) console.log(it.code.padEnd(9), String(r3(lv(it.code).qty)).padStart(8), "min", it.min, "avg", round(unitCost(it.code)), "std", it.std);
