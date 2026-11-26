import "server-only";
// Laporan bersekat per bulan: Laba Rugi per bulan (mutasi bulan) dan Neraca per akhir bulan, plus pilihan periode bulan.
import type { Account } from "@/db/erp";
import { balanceSheet, profitLoss, type Row } from "./reports";
import type { DB } from "./server";
import { today } from "./util";

export const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const isYm = (s?: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const ymAdd = (ym: string, n: number) => { const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
export const ymEnd = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).toISOString().slice(0, 10);
export const ymLabel = (ym: string) => `${BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const ymShort = (ym: string) => `${BLN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

export type Month = { ym: string; from: string; to: string; label: string; short: string; partial: boolean };

/** Daftar bulan dari..sampai (maks. 12); bulan berjalan dihitung sampai hari ini. */
export function monthRange(dari: string, sampai: string): Month[] {
  const t = today();
  const out: Month[] = [];
  let m = dari <= sampai ? dari : sampai;
  const end = dari <= sampai ? sampai : dari;
  while (m <= end && out.length < 12) {
    const e = ymEnd(m);
    const to = e > t ? t : e;
    out.push({ ym: m, from: `${m}-01`, to, label: ymLabel(m), short: ymShort(m), partial: to < e });
    m = ymAdd(m, 1);
  }
  return out;
}

/** Baca parameter periode bulan (dengan dukungan tautan lama ?from=&to= tanggal). */
export function readMonths(sp: { dari?: string; sampai?: string; from?: string; to?: string }, defaultSpan = 6) {
  const now = today().slice(0, 7);
  const sampai = isYm(sp.sampai) ? sp.sampai : sp.to && /^\d{4}-\d{2}/.test(sp.to) ? sp.to.slice(0, 7) : now;
  const dari = isYm(sp.dari) ? sp.dari : sp.from && /^\d{4}-\d{2}/.test(sp.from) ? sp.from.slice(0, 7) : ymAdd(sampai, -(defaultSpan - 1));
  return { dari: dari > sampai ? sampai : dari, sampai };
}

export type PLMonth = Awaited<ReturnType<typeof profitLoss>>;

/** Laba rugi tiap bulan + baris per akun (nilai per bulan). */
export async function monthlyPL(db: DB, accounts: Account[], months: Month[]) {
  const per = await Promise.all(months.map((m) => profitLoss(db, accounts, m.from, m.to)));
  const byAcc = new Map<string, { account: Account; values: number[] }>();
  per.forEach((p, i) => {
    for (const r of p.rows) {
      const e = byAcc.get(r.account.id) ?? { account: r.account, values: months.map(() => 0) };
      e.values[i] = r.balance;
      byAcc.set(r.account.id, e);
    }
  });
  const rows = [...byAcc.values()].sort((a, b) => a.account.code.localeCompare(b.account.code));
  return { per, rows };
}

/** Neraca per akhir tiap bulan + baris per akun. Akumulasi penyusutan ditampilkan negatif. */
export async function monthlyBS(db: DB, accounts: Account[], months: Month[]) {
  const per = await Promise.all(months.map((m) => balanceSheet(db, accounts, m.to)));
  const shown = (r: Row) => (r.account.group === "akum_penyusutan" ? -r.balance : r.balance);
  const collect = (pick: (b: (typeof per)[number]) => Row[]) => {
    const map = new Map<string, { account: Account; values: number[] }>();
    per.forEach((b, i) => {
      for (const r of pick(b)) {
        const e = map.get(r.account.id) ?? { account: r.account, values: months.map(() => 0) };
        e.values[i] = shown(r);
        map.set(r.account.id, e);
      }
    });
    return [...map.values()].sort((a, b) => a.account.code.localeCompare(b.account.code));
  };
  return { per, assets: collect((b) => b.assets), liabilities: collect((b) => b.liabilities), equity: collect((b) => b.equity) };
}
