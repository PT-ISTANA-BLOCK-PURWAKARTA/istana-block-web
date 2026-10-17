import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { Icon, type IconName } from "@/components/panel/Icon";
import { getDb } from "@/db";
import { requireModule } from "@/lib/auth";
import { periodLabel } from "@/lib/erp/periods";
import { aging, balanceSheet, cashBalances, profitLoss, salesSummary } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { formatAmount, monthStart, today } from "@/lib/erp/util";

export const metadata = { title: "Laporan" };

type Card = { href: string; q: string; name: string; icon: IconName; value?: string; sub?: string; tone?: "warn" | "bad" };

export default async function Laporan() {
  await requireModule("keuangan");
  const db = await getDb();
  const acc = await loadAccounts(db);
  const t = today();
  const ms = monthStart(t);
  const [pl, bs, ar, ap, sales, cash] = await Promise.all([
    profitLoss(db, acc.rows, ms, t),
    balanceSheet(db, acc.rows, t),
    aging(db, "piutang", t),
    aging(db, "hutang", t),
    salesSummary(db, ms, t),
    cashBalances(db, acc.rows, t),
  ]);
  const month = periodLabel(ms, t);
  const arLate = ar.grand - ar.totals[0];
  const apLate = ap.grand - ap.totals[0];
  const top = sales.byItem[0];
  const main: Card[] = [
    { href: "/akuntansi/laporan/laba-rugi", q: "Untung atau rugi?", name: "Laba rugi", icon: "chart", value: formatAmount(pl.net), sub: `${pl.net < 0 ? "rugi" : "laba"} bersih ${month}`, tone: pl.net < 0 ? "bad" : undefined },
    { href: "/akuntansi/laporan/arus-kas", q: "Uang dari mana, untuk apa?", name: "Arus kas", icon: "cash", value: formatAmount(cash.reduce((a, r) => a + r.balance, 0)), sub: "saldo kas & bank hari ini" },
    { href: "/akuntansi/laporan/piutang", q: "Siapa yang belum bayar?", name: "Umur piutang", icon: "receive", value: formatAmount(ar.grand), sub: arLate ? `${formatAmount(arLate)} sudah lewat jatuh tempo` : "semua belum jatuh tempo", tone: arLate ? "warn" : undefined },
    { href: "/akuntansi/laporan/hutang", q: "Tagihan pemasok yang harus dibayar?", name: "Umur hutang", icon: "pay", value: formatAmount(ap.grand), sub: apLate ? `${formatAmount(apLate)} sudah lewat jatuh tempo` : "tidak ada yang terlambat", tone: apLate ? "warn" : undefined },
    { href: "/akuntansi/laporan/penjualan", q: "Apa yang paling laku?", name: "Penjualan", icon: "invoice", value: formatAmount(sales.byCustomer.reduce((a, r) => a + r.amount, 0)), sub: top ? `terlaris: ${top.name}` : `penjualan ${month}` },
    { href: "/akuntansi/laporan/neraca", q: "Berapa kekayaan dan hutang usaha?", name: "Neraca", icon: "ledger", value: formatAmount(bs.assetTotal), sub: "total aset hari ini" },
  ];
  const detail: Card[] = [
    { href: "/akuntansi/laporan/buku-besar", q: "Rincian transaksi satu akun", name: "Buku besar", icon: "book" },
    { href: "/akuntansi/laporan/neraca-saldo", q: "Cek keseimbangan pembukuan", name: "Neraca saldo", icon: "list" },
    { href: "/akuntansi/jurnal", q: "Semua jurnal, termasuk yang otomatis", name: "Jurnal umum", icon: "doc" },
  ];
  return (
    <>
      <PageHead title="Laporan" sub="Pilih pertanyaan yang ingin dijawab. Semua laporan bisa dicetak dengan kop perusahaan, disimpan PDF, atau diunduh untuk Excel." />
      <div className="report-hub">
        {main.map((c) => (
          <Link key={c.href} href={c.href} className={`hub-card${c.tone ? ` is-${c.tone}` : ""}`}>
            <span className="hub-icon" aria-hidden="true"><Icon name={c.icon} size={22} /></span>
            <span className="hub-q">{c.q}</span>
            <span className="hub-name">{c.name}</span>
            {c.value && <span className="hub-value tabular">{c.value}</span>}
            {c.sub && <span className="hub-sub">{c.sub}</span>}
          </Link>
        ))}
      </div>
      <h2 className="hub-h2">Untuk pemeriksaan akuntansi</h2>
      <div className="report-hub is-small">
        {detail.map((c) => (
          <Link key={c.href} href={c.href} className="hub-card">
            <span className="hub-icon" aria-hidden="true"><Icon name={c.icon} size={20} /></span>
            <span className="hub-name">{c.name}</span>
            <span className="hub-sub">{c.q}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
