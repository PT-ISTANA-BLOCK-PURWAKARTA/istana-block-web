import "server-only";
// Laporan "Neraca - 12 Bulan" & "Laba Rugi - 12 Bulan" dengan susunan Zahir Accounting 6
// (kelompok & judul sama dengan ekspor Zahir PT. Istana Block: Kas, Bank, Piutang Usaha, …, Laba/Rugi Kotor,
// Laba/Rugi Operasi, Laba/Rugi Bersih). Kelompok ditentukan dari 3 digit awal kode rekening Zahir;
// rekening tanpa kode Zahir memakai golongan akunnya.
import { sql } from "drizzle-orm";
import type { Account, AccountGroup } from "@/db/erp";
import type { DB } from "./server";

export const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "2026-06" → "6 - 2026" (judul kolom Zahir). */
export const monthCol = (ym: string) => `${Number(ym.slice(5, 7))} - ${ym.slice(0, 4)}`;
export const monthName = (ym: string) => `${BULAN_ID[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const addMonths = (ym: string, n: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const monthEnd = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);

type Place = { section: string; sub: string; order: number };
const P = (section: string, sub: string, order: number): Place => ({ section, sub, order });

/** Kelompok Laba Rugi menurut kode Zahir (urutan = urutan tampil). */
function plPlace(code: string, grp: AccountGroup): Place {
  const n = /^(\d{3})-/.test(code) ? Number(code.slice(0, 3)) : NaN;
  if (n >= 400 && n < 490) return P("Pendapatan", "Pendapatan Usaha", 10);
  if (n >= 490 && n < 500) return P("Pendapatan", "Pendapatan Lain", 20);
  if (n >= 500 && n < 520) return P("Beban Atas Pendapatan", "Beban atas Pendapatan", 30);
  if (n >= 520 && n < 530) return P("Beban Atas Pendapatan", "Beban Proyek", 31);
  if (n >= 530 && n < 540) return P("Beban Atas Pendapatan", "Beban Pengiriman", 32);
  if (n >= 540 && n < 600) return P("Beban Atas Pendapatan", "Beban Operasional Pabrik", 33);
  if (n >= 600 && n < 615) return P("Beban Operasional", "Beban Pemasaran Dan Penjualan", 40);
  if (n >= 615 && n < 620) return P("Beban Operasional", "Beban Gaji", 41);
  if (n === 620) return P("Beban Operasional", "Beban Tunjangan", 42);
  if (n >= 621 && n < 630) return P("Beban Operasional", "Beban Transportasi", 43);
  if (n >= 630 && n < 635) return P("Beban Operasional", "Beban Utility & Administrasi", 44);
  if (n >= 635 && n < 640) return P("Beban Operasional", "Beban Perbaikan Mesin Produksi", 45);
  if (n >= 640 && n < 650) return P("Beban Operasional", "Beban Perbaikan dan Pemeliharaan", 46);
  if (n >= 650 && n < 700) return P("Beban Operasional", "Beban Operasional Lain", 47);
  if (n >= 700 && n < 800) return P("Beban Non Operasional", "Beban Penyusutan", 50);
  if (n >= 800 && n < 900) return P("Pendapatan Lain", "Pendapatan Lain", 60);
  if (n >= 900 && n < 990) return P("Beban Lain", "Beban Luar Usaha", 70);
  if (n >= 990) return P("Beban Lain", "Beban Pajak", 71);
  // Tanpa kode Zahir: menurut golongan akun.
  if (grp === "pendapatan") return P("Pendapatan", "Pendapatan Usaha", 10);
  if (grp === "hpp") return P("Beban Atas Pendapatan", "Beban atas Pendapatan", 30);
  if (grp === "pendapatan_lain") return P("Pendapatan Lain", "Pendapatan Lain", 60);
  if (grp === "beban_lain") return P("Beban Lain", "Beban Luar Usaha", 70);
  return P("Beban Operasional", "Beban Operasional Lain", 47);
}

/** Kelompok Neraca menurut kode Zahir. */
function bsPlace(code: string, grp: AccountGroup): Place {
  const n = /^(\d{3})-/.test(code) ? Number(code.slice(0, 3)) : NaN;
  if (n >= 100 && n < 120) return P("Harta", "Kas", 10);
  if (n >= 120 && n < 130) return P("Harta", "Bank", 11);
  if (n >= 130 && n < 135) return P("Harta", "Piutang Usaha", 12);
  if (n >= 135 && n < 139) return P("Harta", "Piutang / Kasbon Karyawan", 13);
  if (n >= 139 && n < 140) return P("Harta", "Piutang Lain", 14);
  if (n >= 140 && n < 149) return P("Harta", "Persediaan Barang", 15);
  if (n >= 149 && n < 151) return P("Harta", "Persediaan Lain", 16);
  if (n === 151) return P("Harta", "Uang Muka Dibayar", 17);
  if (n === 152) return P("Harta", "Pajak Dibayar Dimuka", 18);
  if (n >= 153 && n < 170) return P("Harta", "Harta Lancar Lain", 19);
  if (n === 170) return P("Harta", "Harta Tetap Berwujud", 20);
  if (n >= 171 && n < 180) return P("Harta", "Akumulasi Penyusutan Harta Tetap", 21);
  if (n >= 180 && n < 200) return P("Harta", "Harta Lain", 22);
  if (n >= 200 && n < 219) return P("Kewajiban", "Utang Usaha", 30);
  if (n >= 219 && n < 221) return P("Kewajiban", "Utang Lain", 31);
  if (n >= 221 && n < 230) return P("Kewajiban", "Uang Muka Diterima", 32);
  if (n >= 230 && n < 250) return P("Kewajiban", "Utang Pajak", 33);
  if (n >= 250 && n < 300) return P("Kewajiban", "Utang Jangka Panjang", 34);
  if (n >= 300 && n < 320) return P("Modal", "Modal", 40);
  if (n >= 320 && n < 400) return P("Modal", "Laba", 41);
  // Tanpa kode Zahir: menurut golongan akun.
  const byGroup: Partial<Record<AccountGroup, Place>> = {
    kas_bank: P("Harta", "Kas", 10), piutang: P("Harta", "Piutang Usaha", 12), persediaan: P("Harta", "Persediaan Barang", 15),
    aset_lancar_lain: P("Harta", "Harta Lancar Lain", 19), aset_tetap: P("Harta", "Harta Tetap Berwujud", 20), akum_penyusutan: P("Harta", "Akumulasi Penyusutan Harta Tetap", 21),
    hutang_usaha: P("Kewajiban", "Utang Usaha", 30), hutang_lain: P("Kewajiban", "Utang Lain", 31),
  };
  return byGroup[grp] ?? P("Modal", "Modal", 40);
}

const PL_GROUPS = new Set<AccountGroup>(["pendapatan", "hpp", "beban", "pendapatan_lain", "beban_lain"]);
const CREDIT_SECTIONS = new Set(["Pendapatan", "Pendapatan Lain", "Kewajiban", "Modal"]);

export type ZRow = { code: string; name: string; accountId: string | null; values: number[] };
export type ZSub = { name: string; rows: ZRow[]; total: number[] };
export type ZSection = { name: string; subs: ZSub[]; total: number[] };
/** Baris laporan berurutan: kelompok utama atau baris hasil (Laba/Rugi …). */
export type ZBlock = { kind: "section"; section: ZSection; totalLabel: string } | { kind: "result"; label: string; values: number[] };

const zeros = (n: number) => Array.from({ length: n }, () => 0);
const addInto = (a: number[], b: number[], sign = 1) => a.map((v, i) => v + sign * (b[i] ?? 0));

/** Mutasi debit−kredit per akun per bulan (s.d. akhir bulan terakhir). */
async function monthlyNet(db: DB, last: string) {
  const rows = await db.all<{ accountId: string; ym: string; net: number }>(sql`
    select account_id accountId, substr(date, 1, 7) ym, coalesce(sum(debit), 0) - coalesce(sum(credit), 0) net
      from fin_journal_lines where date <= ${monthEnd(last)} group by account_id, ym`);
  const by = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const m = by.get(r.accountId) ?? new Map<string, number>();
    m.set(r.ym, Number(r.net));
    by.set(r.accountId, m);
  }
  return by;
}

/** Bulan pertama yang punya transaksi laba rugi (jurnal saldo awal di akhir bulan sebelumnya tidak dihitung). */
export async function firstJournalMonth(db: DB) {
  const r = await db.get<{ ym: string | null }>(sql`
    select substr(min(l.date), 1, 7) ym from fin_journal_lines l join fin_accounts a on a.id = l.account_id
     where a.grp in ('pendapatan','hpp','beban','pendapatan_lain','beban_lain')`);
  return r?.ym ?? null;
}

function build(accounts: Account[], net: Map<string, Map<string, number>>, months: string[], place: (a: Account) => Place, value: (a: Account, ym: string, credit: boolean) => number) {
  const sections = new Map<string, { order: number; subs: Map<string, { order: number; rows: ZRow[] }> }>();
  for (const a of accounts) {
    const p = place(a);
    const credit = CREDIT_SECTIONS.has(p.section);
    const values = months.map((ym) => value(a, ym, credit));
    if (!a.active && values.every((v) => v === 0) && !net.has(a.id)) continue;
    const sec = sections.get(p.section) ?? { order: p.order, subs: new Map() };
    sec.order = Math.min(sec.order, p.order);
    const sub = sec.subs.get(p.sub) ?? { order: p.order, rows: [] };
    sub.rows.push({ code: a.code, name: a.name, accountId: a.id, values });
    sec.subs.set(p.sub, sub);
    sections.set(p.section, sec);
  }
  const out = new Map<string, ZSection>();
  for (const [name, s] of sections) {
    const subs = [...s.subs.entries()]
      .sort((x, y) => x[1].order - y[1].order)
      .map(([subName, sub]) => {
        const rows = sub.rows.sort((x, y) => x.code.localeCompare(y.code));
        return { name: subName, rows, total: rows.reduce((t, r) => addInto(t, r.values), zeros(months.length)) };
      });
    out.set(name, { name, subs, total: subs.reduce((t, sb) => addInto(t, sb.total), zeros(months.length)) });
  }
  return out;
}

/** Laba Rugi - 12 Bulan: mutasi per bulan; pendapatan = kredit−debit, beban = debit−kredit. */
export async function zahirProfitLoss(db: DB, accounts: Account[], months: string[]) {
  const net = await monthlyNet(db, months[months.length - 1]);
  const pl = accounts.filter((a) => PL_GROUPS.has(a.group));
  const secs = build(pl, net, months, (a) => plPlace(a.code, a.group), (a, ym, credit) => {
    const v = net.get(a.id)?.get(ym) ?? 0;
    return credit ? -v : v;
  });
  const z = zeros(months.length);
  const t = (name: string) => secs.get(name)?.total ?? z;
  const kotor = addInto(t("Pendapatan"), t("Beban Atas Pendapatan"), -1);
  const operasi = addInto(kotor, t("Beban Operasional"), -1);
  const operasi2 = addInto(operasi, t("Beban Non Operasional"), -1);
  const bersih = addInto(addInto(operasi2, t("Pendapatan Lain")), t("Beban Lain"), -1);
  const blocks: ZBlock[] = [];
  const sec = (name: string, totalLabel: string) => { const s = secs.get(name); if (s) blocks.push({ kind: "section", section: s, totalLabel }); };
  sec("Pendapatan", "Total Pendapatan");
  sec("Beban Atas Pendapatan", "Total Beban Atas Pendapatan");
  blocks.push({ kind: "result", label: "Laba/Rugi Kotor", values: kotor });
  sec("Beban Operasional", "Total Beban Operasional");
  blocks.push({ kind: "result", label: "Laba/Rugi Operasi", values: operasi });
  if (secs.has("Beban Non Operasional")) {
    sec("Beban Non Operasional", "Total Beban Non Operasional");
    blocks.push({ kind: "result", label: "Laba/Rugi Operasi", values: operasi2 });
  }
  sec("Pendapatan Lain", "Total Pendapatan Lain");
  sec("Beban Lain", "Total Beban Lain");
  blocks.push({ kind: "result", label: "Laba/Rugi Bersih", values: bersih });
  return { blocks, revenue: t("Pendapatan"), kotor, bersih };
}

/** Neraca - 12 Bulan: saldo akhir tiap bulan. Laba Tahun Berjalan (320-20) ikut laba bersih kumulatif seperti Zahir. */
export async function zahirBalanceSheet(db: DB, accounts: Account[], months: string[]) {
  const net = await monthlyNet(db, months[months.length - 1]);
  const upTo = (id: string, ym: string) => {
    let s = 0;
    for (const [m, v] of net.get(id) ?? []) if (m <= ym) s += v;
    return s;
  };
  // Laba bersih kumulatif s.d. akhir bulan (semua akun laba rugi: kredit−debit).
  const pl = accounts.filter((a) => PL_GROUPS.has(a.group));
  const profitUpTo = months.map((ym) => -pl.reduce((s, a) => s + upTo(a.id, ym), 0));
  const bs = accounts.filter((a) => !PL_GROUPS.has(a.group));
  const earnings = bs.find((a) => a.code === "320-20") ?? null;
  const secs = build(bs, net, months, (a) => bsPlace(a.code, a.group), (a, ym, credit) => {
    const v = upTo(a.id, ym);
    return credit ? -v : v;
  });
  // Tambahkan laba kumulatif ke "Laba Tahun Berjalan" (atau baris baru bila rekeningnya tidak ada).
  const modal = secs.get("Modal") ?? { name: "Modal", subs: [], total: zeros(months.length) };
  let laba = modal.subs.find((s) => s.name === "Laba");
  if (!laba) { laba = { name: "Laba", rows: [], total: zeros(months.length) }; modal.subs.push(laba); }
  let row = laba.rows.find((r) => r.accountId === earnings?.id);
  if (!row) { row = { code: earnings?.code ?? "320-20", name: earnings?.name ?? "Laba Tahun Berjalan", accountId: earnings?.id ?? null, values: zeros(months.length) }; laba.rows.unshift(row); }
  row.values = addInto(row.values, profitUpTo);
  laba.total = addInto(laba.total, profitUpTo);
  modal.total = addInto(modal.total, profitUpTo);
  secs.set("Modal", modal);
  const z = zeros(months.length);
  const harta = secs.get("Harta") ?? { name: "Harta", subs: [], total: z };
  const kewajiban = secs.get("Kewajiban") ?? { name: "Kewajiban", subs: [], total: z };
  const blocks: ZBlock[] = [
    { kind: "section", section: harta, totalLabel: "Total Harta" },
    { kind: "section", section: kewajiban, totalLabel: "Total Kewajiban" },
    { kind: "section", section: modal, totalLabel: "Total Modal" },
    { kind: "result", label: "Total Kewajiban dan Modal", values: addInto(kewajiban.total, modal.total) },
  ];
  const sub = (s: ZSection, name: string) => s.subs.find((x) => x.name === name)?.total ?? z;
  return {
    blocks,
    harta: harta.total,
    balanced: harta.total.every((v, i) => Math.round(v) === Math.round(kewajiban.total[i] + modal.total[i])),
    kasBank: addInto(sub(harta, "Kas"), sub(harta, "Bank")),
    piutang: sub(harta, "Piutang Usaha"),
    persediaan: addInto(sub(harta, "Persediaan Barang"), sub(harta, "Persediaan Lain")),
    utangUsaha: sub(kewajiban, "Utang Usaha"),
  };
}

/** 12 bulan mulai `start` (yyyy-mm). */
export const twelveMonths = (start: string) => Array.from({ length: 12 }, (_, i) => addMonths(start, i));

/** Bulan awal bawaan: bulan pertama berjurnal, tetapi paling lama 11 bulan sebelum bulan ini. */
export async function defaultStart(db: DB, nowYm: string) {
  const first = await firstJournalMonth(db);
  const min = addMonths(nowYm, -11);
  return first && first > min ? first : min;
}
