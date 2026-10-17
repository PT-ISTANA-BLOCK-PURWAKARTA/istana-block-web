import Link from "next/link";
import { PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Laporan" };

const REPORTS = [
  { href: "/keuangan/laporan/laba-rugi", title: "Laba rugi", desc: "Pendapatan, HPP, beban, dan laba bersih per periode." },
  { href: "/keuangan/laporan/neraca", title: "Neraca", desc: "Aset, kewajiban, dan modal per tanggal." },
  { href: "/keuangan/laporan/neraca-saldo", title: "Neraca saldo", desc: "Saldo debit/kredit semua akun; cek keseimbangan pembukuan." },
  { href: "/keuangan/laporan/buku-besar", title: "Buku besar", desc: "Mutasi dan saldo berjalan per akun, termasuk kas & bank." },
  { href: "/keuangan/laporan/piutang", title: "Umur piutang", desc: "Tagihan pelanggan yang belum dibayar, dikelompokkan per lama jatuh tempo." },
  { href: "/keuangan/laporan/hutang", title: "Umur hutang", desc: "Kewajiban ke pemasok yang belum dibayar." },
  { href: "/keuangan/laporan/penjualan", title: "Penjualan", desc: "Rekap penjualan per barang dan per pelanggan." },
];

export default async function Laporan() {
  await requireModule("keuangan");
  return (
    <>
      <PageHead title="Laporan" sub="Semua laporan bisa dicetak atau diunduh sebagai CSV (buka di Excel)." />
      <div className="report-grid">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="admin-card report-card">
            <b>{r.title}</b>
            <span className="muted small">{r.desc}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
