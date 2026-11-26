// Disalin dari app.kirimistanablock (shared/uditch.ts): sumber dana, kategori, rekap Cashflow/Operational U-Ditch.
// Cashflow proyek U-Ditch (PIC: Lina, administrator kantor): uang masuk & keluar per sumber dana dan kategori.
// Juga pembaca file "Analisis Laporan U ditch Hamad.xlsx" (sheet SALDO KESELURUHAN LINA, TF LINA, CASH LINA,
// TF IB, CASH IB, TF KA HAMAD, BARANG DO) untuk menyalin data lama ke aplikasi.

/** Kelompok sumber dana: Lina (TF / Cash), IB (TF / Cash), uang pribadi Ka Hamad (Muhamad Abdullah), barang DO. */
export const UDITCH_FUNDS = [
  { key: "lina", label: "Lina" },
  { key: "ib", label: "IB (Istana Block)" },
  { key: "kontrabon", label: "Kontrabon dari IB (IB bayar pengeluaran Lina)" },
  { key: "hamad", label: "Ka Hamad – uang pribadi (Muhamad Abdullah)" },
  { key: "do", label: "Barang DO / tempo" },
] as const;
export type UditchFund = (typeof UDITCH_FUNDS)[number]["key"];

/** Sumber dana. "kas" punya saldo (rekening & kas laci Lina); "ib" = dibayar dana Istana Block (jadi pinjaman Uditch ke IB). */
export const UDITCH_ACCOUNTS = [
  { key: "tf_lina", fund: "lina", sub: "TF", label: "TF Lina", sheet: "TF LINA", kind: "kas", hint: "Transfer / m-banking rekening U-Ditch (Lina)" },
  { key: "cash_lina", fund: "lina", sub: "Cash", label: "Cash Lina", sheet: "CASH LINA", kind: "kas", hint: "Uang tunai di laci Lina (dari tarik tunai rekening)" },
  { key: "tf_ib", fund: "ib", sub: "TF", label: "TF IB", sheet: "TF IB", kind: "ib", hint: "Dibayar transfer oleh Istana Block (pinjaman Uditch ke IB)" },
  { key: "cash_ib", fund: "ib", sub: "Cash", label: "Cash IB", sheet: "CASH IB", kind: "ib", hint: "Dibayar tunai oleh Istana Block (pinjaman Uditch ke IB)" },
  { key: "kontrabon_ib", fund: "kontrabon", sub: "Kontrabon", label: "Kontrabon IB", sheet: "KONTRABON IB", kind: "ib", hint: "Pengeluaran Lina yang dibayar IB sebagai cicilan hutang kontrabon (mengurangi sisa hutang IB)" },
  { key: "tf_hamad", fund: "hamad", sub: "Pribadi", label: "Ka Hamad (pribadi)", sheet: "TF KA HAMAD", kind: "hamad", hint: "Dibayar dari uang pribadi Ka Hamad (Muhamad Abdullah), diinput manual" },
  { key: "do", fund: "do", sub: "DO", label: "Barang DO", sheet: "BARANG DO", kind: "tempo", hint: "Barang diambil dulu, dibayar belakangan (catatan, bukan uang keluar)" },
] as const;
export const accountsOfFund = (fund: UditchFund) => UDITCH_ACCOUNTS.filter(account => account.fund === fund);
/** PIC transfer = orang yang melakukan transfer, dibaca dari KETERANGAN ("TF LINA", "TF LENI", "TF KA HAMAD"). Tidak jelas → kosong. */
export function picOfNote(account: string, note: string | null | undefined): string | null {
  if (!account.startsWith("tf_")) return null;
  const text = (note ?? "").toUpperCase();
  if (/\bLENI\b/.test(text)) return "Leni";
  if (/^TF\s*LINA\b|^LINA\b/.test(text)) return "Lina";
  if (/\bKA+K?\s*HAMAD\b|MUHAMAD\s*A/.test(text)) return "Ka Hamad";
  if (/\bLUKMAN\b/.test(text)) return "Lukman";
  return null;
}
export const UDITCH_PICS = ["Lina", "Leni", "Ka Hamad", "Lukman"] as const;
export type UditchAccount = (typeof UDITCH_ACCOUNTS)[number]["key"];
export const UDITCH_ACCOUNT_KEYS = UDITCH_ACCOUNTS.map(account => account.key) as [UditchAccount, ...UditchAccount[]];
export const ACCOUNT_BY_KEY = Object.fromEntries(UDITCH_ACCOUNTS.map(account => [account.key, account])) as Record<UditchAccount, (typeof UDITCH_ACCOUNTS)[number]>;

export type UditchDirection = "masuk" | "keluar";

/**
 * Kategori sama dengan kolom KATEGORI di file analisis.
 * group: M = pemasukan, A = biaya proyek U-Ditch, B = proyek lain, C = mutasi dana & pinjaman (bukan biaya), X = tidak dihitung.
 * internal = perpindahan rekening → kas laci (bukan pemasukan / biaya baru).
 */
export const UDITCH_CATEGORIES = [
  { code: "M01", label: "Saldo Awal", group: "M" },
  { code: "M02", label: "Deposit Ka Hamad", group: "M" },
  { code: "M03", label: "Penjualan U-Ditch & Produk", group: "M" },
  { code: "M04", label: "Penjualan Aset, Material & Jasa", group: "M" },
  { code: "M05", label: "Pinjaman Masuk (Helmi, PV Baru, IB)", group: "M" },
  { code: "M06", label: "Pengembalian Pinjaman / Kontrabon dari IB", group: "M" },
  { code: "M07", label: "Dana Titipan (milik IB / pihak lain)", group: "M" },
  { code: "M08", label: "Pendapatan Lain (Bunga, Refund, Penggantian)", group: "M" },
  { code: "M09", label: "Tarik Tunai & Tukar Cash dari Rekening", group: "M", internal: true },
  { code: "M10", label: "Pendapatan Sewa (Alat, Kendaraan, Tempat)", group: "M" },
  { code: "A01", label: "Bahan Baku - Semen", group: "A" },
  { code: "A02", label: "Bahan Baku - Pasir", group: "A" },
  { code: "A03", label: "Bahan Baku - Split, Batu & Abu Batu", group: "A" },
  { code: "A04", label: "Bahan Baku - Wiremesh & Besi Beton", group: "A" },
  { code: "A05", label: "Bahan Baku - Aditive", group: "A" },
  { code: "A06", label: "Material Cetakan & Besi Konstruksi", group: "A" },
  { code: "A07", label: "Bahan Pendukung & Peralatan Kerja", group: "A" },
  { code: "A08", label: "Mesin, Sparepart & Service Alat", group: "A" },
  { code: "A09", label: "Upah Cetak Borongan (Sumitra)", group: "A" },
  { code: "A10", label: "Gaji, Upah & Kasbon Tenaga Kerja", group: "A" },
  { code: "A11", label: "Solar Operasional (Stok, Molen, Forklift, Beko)", group: "A" },
  { code: "A12", label: "Uang Jalan (Solar Mobil & Crane, UJ, Tol, Kawal)", group: "A" },
  { code: "A13", label: "Bongkar Muat & Ritasi", group: "A" },
  { code: "A14", label: "Pembelian Produk Jadi", group: "A" },
  { code: "A15", label: "Iklan & Pemasaran", group: "A" },
  { code: "A16", label: "Cicilan Forklift", group: "A" },
  { code: "A17", label: "Biaya Bank & Administrasi", group: "A" },
  { code: "A18", label: "Konsumsi & Lain-lain", group: "A" },
  { code: "A19", label: "Sewa (Alat, Kendaraan, Tempat)", group: "A" },
  { code: "B01", label: "Proyek Tanah Baru & Hoist", group: "B" },
  { code: "C01", label: "Dipinjam Istana Block / PV Baru", group: "C" },
  { code: "C02", label: "Dipinjam IBN (Helmi)", group: "C" },
  { code: "C03", label: "Pengembalian Pinjaman / Dana ke IB & Helmi", group: "C" },
  { code: "C04", label: "Diambil / Ditransfer ke Ka Hamad", group: "C" },
  { code: "C05", label: "Tarik Tunai & Tukar Cash ke Kas Laci", group: "C", internal: true },
  { code: "C06", label: "Pengembalian Dana & Koreksi Transfer", group: "C" },
  { code: "C08", label: "IB Ganti / Bayar Pinjaman ke Uditch", group: "C" },
  { code: "C09", label: "Kontrabon: Uang IB Diterima Uditch", group: "C" },
  { code: "X01", label: "Dobel Input (tidak dihitung)", group: "X" },
] as const satisfies readonly { code: string; label: string; group: "M" | "A" | "B" | "C" | "X"; internal?: boolean }[];
export type UditchCategory = (typeof UDITCH_CATEGORIES)[number];
export type UditchCategoryCode = UditchCategory["code"];
export const UDITCH_CATEGORY_CODES = UDITCH_CATEGORIES.map(category => category.code) as [UditchCategoryCode, ...UditchCategoryCode[]];
export const CATEGORY_BY_CODE = Object.fromEntries(UDITCH_CATEGORIES.map(category => [category.code, category])) as Record<UditchCategoryCode, UditchCategory>;
export const UDITCH_GROUPS = { M: "Pemasukan", A: "A. Biaya proyek U-Ditch", B: "B. Proyek lain", C: "C. Mutasi dana & pinjaman (bukan biaya)", X: "Tidak dihitung" } as const;
export const categoriesFor = (direction: UditchDirection) => UDITCH_CATEGORIES.filter(category => direction === "masuk" ? category.group === "M" : category.group !== "M");
export const categoryLabel = (code: string | null) => code && code in CATEGORY_BY_CODE ? CATEGORY_BY_CODE[code as UditchCategoryCode].label : "Belum dikategorikan";
const isInternal = (code: string | null) => Boolean(code && (CATEGORY_BY_CODE[code as UditchCategoryCode] as { internal?: boolean } | undefined)?.internal);

export type UditchEntryInput = {
  entryDate: string; account: UditchAccount; direction: UditchDirection; item: string; qty: number | null; party: string | null;
  price: number | null; total: number; category: UditchCategoryCode | null; note: string | null; remark: string | null;
  /** PIC transfer (yang mentransfer), mis. Lina / Leni. */
  pic?: string | null;
};
export type ImportedUditchEntry = UditchEntryInput & { sourceKey: string };

// ---------------------------------------------------------------------------
// Rekap (dipakai halaman & Excel)
// ---------------------------------------------------------------------------

type Entry = { account: string; direction: string; total: number; category: string | null; entryDate: string };
/** Baris yang dihitung: dobel input (X01) tidak ikut. */
export const counted = (entry: Entry) => entry.category !== "X01";

export function accountSummary(entries: Entry[]) {
  return UDITCH_ACCOUNTS.map(account => {
    const list = entries.filter(entry => entry.account === account.key && counted(entry));
    const masuk = list.filter(entry => entry.direction === "masuk").reduce((sum, entry) => sum + entry.total, 0);
    const keluar = list.filter(entry => entry.direction === "keluar").reduce((sum, entry) => sum + entry.total, 0);
    return { ...account, masuk, keluar, saldo: masuk - keluar, count: list.length };
  });
}

/** Angka utama: pemasukan (tanpa tarik tunai), biaya proyek (A), proyek lain (B), mutasi (C), saldo kas + bank, dana IB terpakai. */
export function headline(entries: Entry[]) {
  const list = entries.filter(counted);
  const sum = (filter: (entry: Entry) => boolean) => list.filter(filter).reduce((total, entry) => total + entry.total, 0);
  const group = (entry: Entry) => entry.category ? CATEGORY_BY_CODE[entry.category as UditchCategoryCode]?.group ?? null : null;
  const cash = (entry: Entry) => ACCOUNT_BY_KEY[entry.account as UditchAccount]?.kind === "kas";
  return {
    pemasukan: sum(entry => entry.direction === "masuk" && !isInternal(entry.category)),
    penjualan: sum(entry => entry.direction === "masuk" && (entry.category === "M03" || entry.category === "M04")),
    biayaProyek: sum(entry => entry.direction === "keluar" && entry.account !== "do" && group(entry) === "A"),
    proyekLain: sum(entry => entry.direction === "keluar" && entry.account !== "do" && group(entry) === "B"),
    mutasi: sum(entry => entry.direction === "keluar" && entry.account !== "do" && group(entry) === "C" && !isInternal(entry.category)),
    belumKategori: sum(entry => entry.direction === "keluar" && !entry.category),
    saldoKas: sum(entry => cash(entry) && entry.direction === "masuk") - sum(entry => cash(entry) && entry.direction === "keluar"),
    danaIb: sum(entry => entry.direction === "keluar" && ACCOUNT_BY_KEY[entry.account as UditchAccount]?.kind === "ib"),
    tempo: sum(entry => entry.direction === "keluar" && entry.account === "do"),
  };
}

/** Rekap per kategori: kolom per sumber dana (seperti sheet REKAP SALDO KESELURUHAN). */
export function categoryMatrix(entries: Entry[], direction: UditchDirection) {
  const list = entries.filter(entry => entry.direction === direction);
  const codes: (UditchCategoryCode | null)[] = [...categoriesFor(direction).map(category => category.code), null];
  return codes.map(code => {
    const rows = list.filter(entry => (entry.category ?? null) === code);
    const perAccount = UDITCH_ACCOUNTS.map(account => { const items = rows.filter(entry => entry.account === account.key); return { total: items.reduce((sum, entry) => sum + entry.total, 0), count: items.filter(entry => entry.total !== 0).length }; });
    return { code, label: categoryLabel(code), group: code ? CATEGORY_BY_CODE[code].group : "-", perAccount, total: perAccount.reduce((sum, item) => sum + item.total, 0), count: perAccount.reduce((sum, item) => sum + item.count, 0) };
  }).filter(row => row.count > 0 || row.total !== 0);
}

/** Per bulan: masuk, biaya proyek, total keluar, saldo kas berjalan. */
export function monthlySummary(entries: Entry[]) {
  const months = [...new Set(entries.map(entry => entry.entryDate.slice(0, 7)))].sort();
  return months.map(month => { const list = entries.filter(entry => entry.entryDate.startsWith(month)); return { month, ...headline(list) }; });
}

// ---------------------------------------------------------------------------
// Pembaca file Excel lama
// ---------------------------------------------------------------------------

type Sheet = { name: string; rows: unknown[][] };
const text = (value: unknown) => value === null || value === undefined ? "" : String(value).replace(/\s+/g, " ").trim();
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value.replace(/\./g, "").replace(",", "."))) ? Number(value.replace(/\./g, "").replace(",", ".")) : null;
const pad = (n: number) => String(n).padStart(2, "0");
/** Tanggal Excel: nomor seri (45911), Date, atau teks dd/mm/yyyy. */
export function sheetDay(value: unknown): string | null {
  if (typeof value === "number" && value > 30000 && value < 80000) { const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000); return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const match = text(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) { const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]); return `${year}-${pad(Number(match[2]))}-${pad(Number(match[1]))}`; }
  const iso = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}
const CODE_BY_LABEL = new Map(UDITCH_CATEGORIES.map(category => [category.label.toLowerCase(), category.code] as const));
const categoryOf = (value: unknown) => CODE_BY_LABEL.get(text(value).toLowerCase()) ?? null;

/** Kolom (mulai 0) dan baris data (nomor baris Excel) per sheet buku kas. */
const LEDGERS: { sheet: string; account: UditchAccount; first: number; last: number; cols: { date: number; item: number; qty: number; party: number; price: number; note: number; total: number; category?: number; remark?: number } }[] = [
  { sheet: "TF LINA", account: "tf_lina", first: 4, last: 636, cols: { date: 1, item: 2, qty: 3, party: 4, price: 5, note: 6, total: 7, category: 8, remark: 9 } },
  { sheet: "CASH LINA", account: "cash_lina", first: 4, last: 652, cols: { date: 1, item: 2, qty: 4, party: 5, price: 6, note: 7, total: 8, category: 9, remark: 10 } },
  { sheet: "TF IB", account: "tf_ib", first: 4, last: 78, cols: { date: 1, item: 2, qty: 4, party: 5, price: 6, note: 7, total: 8, category: 9, remark: 10 } },
  { sheet: "CASH IB", account: "cash_ib", first: 4, last: 626, cols: { date: 1, item: 2, qty: 4, party: 5, price: 6, note: 7, total: 8, category: 9 } },
  { sheet: "TF KA HAMAD", account: "tf_hamad", first: 4, last: 26, cols: { date: 1, item: 2, qty: 4, party: 5, price: 6, note: 7, total: 8 } },
  { sheet: "BARANG DO", account: "do", first: 4, last: 29, cols: { date: 1, item: 2, qty: 4, party: 5, price: 6, note: 7, total: 8 } },
];
const SALDO_SHEET = "SALDO KESELURUHAN LINA";
/** Sisi rekening (kiri) & kas laci (kanan) sheet SALDO: kolom tanggal = judul "TGL/BLN/TAHUN", lalu keterangan & uang masuk. */
function saldoSides(header: unknown[]) {
  const titles = header.map(value => text(value).toUpperCase());
  const dates = titles.flatMap((title, index) => title.startsWith("TGL") ? [index] : []);
  const [bank = 1, cash = 10] = dates;
  const categoryAfter = (start: number) => { const index = titles.findIndex((title, i) => i > start && i <= start + 6 && title === "KATEGORI"); return index < 0 ? -1 : index; };
  return [
    { account: "tf_lina" as const, date: bank, item: bank + 1, masuk: bank + 2, category: categoryAfter(bank) },
    { account: "cash_lina" as const, date: cash, item: cash + 1, masuk: cash + 2, category: categoryAfter(cash) },
  ];
}

export type UditchImportSummary = { sheet: string; account: UditchAccount; direction: UditchDirection; count: number; total: number };

/** Baca file analisis U-Ditch: uang masuk dari sheet SALDO, uang keluar dari buku kas per sumber dana. */
export function parseUditchWorkbook(sheets: Sheet[]) {
  const byName = new Map(sheets.map(sheet => [sheet.name.trim().toUpperCase(), sheet.rows]));
  const entries: ImportedUditchEntry[] = [];
  const missing: string[] = [];
  const summary: UditchImportSummary[] = [];
  const add = (sheet: string, account: UditchAccount, direction: UditchDirection, entry: ImportedUditchEntry) => {
    entries.push(entry);
    let item = summary.find(row => row.sheet === sheet && row.account === account && row.direction === direction);
    if (!item) { item = { sheet, account, direction, count: 0, total: 0 }; summary.push(item); }
    item.count += 1; item.total += entry.total;
  };

  const saldo = byName.get(SALDO_SHEET);
  if (!saldo) missing.push(SALDO_SHEET);
  // Kolom dicari dari judul baris 4 (file analisis punya kolom KATEGORI & BULAN, file asli tidak → kolom kas bergeser).
  else for (const side of saldoSides(saldo[3] ?? [])) {
    let day: string | null = null;
    for (let index = 4; index < saldo.length; index++) {
      const row = saldo[index] ?? [];
      day = sheetDay(row[side.date]) ?? day;
      const masuk = number(row[side.masuk]);
      if (!masuk || !day) continue;
      add(SALDO_SHEET, side.account, "masuk", { sourceKey: `${SALDO_SHEET}!${side.account}!${index + 1}`, entryDate: day, account: side.account, direction: "masuk", item: text(row[side.item]) || "Uang masuk", qty: null, party: null, price: null, total: masuk, category: categoryOf(row[side.category]), note: null, remark: null });
    }
  }

  for (const ledger of LEDGERS) {
    const rows = byName.get(ledger.sheet);
    if (!rows) { missing.push(ledger.sheet); continue; }
    let day: string | null = null;
    // Kolom KATEGORI / catatan hanya ada di file analisis; baris dibaca sampai akhir sheet (data baru terus bertambah).
    const header = (rows[ledger.first - 2] ?? []).map(value => text(value).toUpperCase());
    const cols = { ...ledger.cols, category: header[ledger.cols.category ?? -1] === "KATEGORI" ? ledger.cols.category : undefined, remark: header[ledger.cols.category ?? -1] === "KATEGORI" ? ledger.cols.remark : undefined };
    for (let index = ledger.first - 1; index < rows.length; index++) {
      const row = rows[index] ?? [];
      day = sheetDay(row[cols.date]) ?? day;
      const item = text(row[cols.item]);
      const total = number(row[cols.total]) ?? 0;
      if (!item && !total) continue;
      add(ledger.sheet, ledger.account, "keluar", {
        sourceKey: `${ledger.sheet}!${index + 1}`, entryDate: day ?? "2025-09-01", account: ledger.account, direction: "keluar", item: item || "(tanpa uraian)",
        qty: number(row[cols.qty]), party: text(row[cols.party]) || null, price: number(row[cols.price]), total,
        category: cols.category === undefined ? null : categoryOf(row[cols.category]), note: text(row[cols.note]) || null, pic: picOfNote(ledger.account, text(row[cols.note])),
        remark: cols.remark === undefined ? null : text(row[cols.remark]) || null,
      });
    }
  }
  return { entries, summary, missing };
}
