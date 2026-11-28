// Buku Besar gaya Zahir (permintaan pemilik 28/11): tabel histori transaksi satu akun di atas, ringkasan saldo,
// "Grafik Buku Besar Saldo Berjalan" setengah layar di bawah. Grafik hanya untuk tampilan awal (bulan berjalan,
// tanpa pencarian); filter tanggal atau pencarian → grafik disembunyikan. Tampilan lama (kartu angka + tabel laporan)
// diganti; cetak format Zahir ada di Buku Besar - Mutasi, unduhan CSV tetap.
import { BukuBesarView, type BukuBesarRow } from "@/components/erp/BukuBesarView";
import { GROUP_LABEL, isDebitNormal } from "@/lib/erp/accounting";
import { sourceHref, txType } from "@/lib/erp/links";
import { reportContext } from "@/lib/erp/reportctx";
import { ledger } from "@/lib/erp/reports";
import { isDate, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Buku besar" };

/** Saldo akhir per hari dari saldo awal + baris buku besar (tanggal tanpa transaksi = saldo hari sebelumnya). */
function dailyBalances(from: string, to: string, opening: number, rows: { date: string; balance: number }[]) {
  const end = new Map<string, number>();
  for (const r of rows) end.set(r.date, r.balance);
  const out: { date: string; balance: number }[] = [];
  let bal = opening;
  const d = new Date(`${from}T00:00:00Z`), last = new Date(`${to}T00:00:00Z`);
  // Periode sangat panjang: batasi 400 hari terakhir agar grafik tetap terbaca.
  if ((last.getTime() - d.getTime()) / 864e5 > 400) d.setTime(last.getTime() - 400 * 864e5);
  for (const r of rows) if (r.date < d.toISOString().slice(0, 10)) bal = r.balance;
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (end.has(key)) bal = end.get(key)!;
    out.push({ date: key, balance: bal });
  }
  return out;
}

export default async function BukuBesar({ searchParams }: { searchParams: Promise<{ akun?: string; from?: string; to?: string; q?: string }> }) {
  const { db, acc } = await reportContext();
  const sp = await searchParams;
  const now = today();
  const to = isDate(sp.to) ? sp.to : now;
  const from = isDate(sp.from) && sp.from <= to ? sp.from : monthStart(to);
  const account = acc.byId.get(sp.akun ?? "") ?? acc.byId.get(acc.sys("kas"));
  if (!account) return null;
  const q = (sp.q ?? "").trim();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const lg = await ledger(db, account, from, to);
  const rows: BukuBesarRow[] = lg.rows
    .map((r, i) => ({
      key: `${r.journalId}:${i}`,
      date: r.date,
      tp: txType(r.source, r.number),
      number: r.number,
      // Seperti kolom Catatan Zahir: catatan transaksi; catatan baris (bila beda) ikut di tooltip.
      memo: r.memo || r.lineMemo,
      note: r.lineMemo && r.lineMemo !== r.memo ? r.lineMemo : "",
      contact: r.contactName ?? "",
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
      job: r.projectCode ?? "",
      href: sourceHref(r.source, r.sourceId, r.journalId),
    }))
    .filter((r) => !words.length || words.every((w) => `${r.tp} ${r.number} ${r.memo} ${r.note} ${r.contact} ${r.job}`.toLowerCase().includes(w)));
  // Tampilan awal = bulan berjalan s.d. hari ini tanpa pencarian (pilihan "Bulan ini" di Filter juga dianggap awal).
  const filtered = words.length > 0 || from !== monthStart(now) || to !== now;
  const accounts = [...acc.rows].sort((a, b) => a.code.localeCompare(b.code)).map((a) => ({ id: a.id, cells: [a.code, a.name, GROUP_LABEL[a.group]] }));
  return (
    <BukuBesarView
      key={`${account.id}|${from}|${to}|${q}`}
      account={{ id: account.id, code: account.code, name: account.name }}
      accounts={accounts}
      rows={rows}
      opening={lg.opening}
      closing={lg.closing}
      debitUp={isDebitNormal(account.group)}
      from={from}
      to={to}
      q={q}
      filtered={filtered}
      points={dailyBalances(from, to, lg.opening, lg.rows)}
    />
  );
}
