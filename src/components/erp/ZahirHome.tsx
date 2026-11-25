// Beranda Keuangan gaya Zahir Accounting 6: modul dengan alur proses berikon (Penjualan, Pembelian, Kas & Bank,
// Persediaan, Buku Besar, Laporan) dan ringkasan 6 bulan dari Neraca & Laba Rugi (susunan Zahir).
import Link from "next/link";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { Icon, type IconName } from "@/components/panel/Icon";
import type { DB } from "@/lib/erp/server";
import type { Account } from "@/db/erp";
import { addMonths, BULAN_ID, monthCol, zahirBalanceSheet, zahirProfitLoss } from "@/lib/erp/zahirReports";

type Step = { label: string; href: string; icon: IconName };
type Module = { name: string; icon: IconName; tone: string; flow: Step[]; more: Step[] };

const MODULES: Module[] = [
  {
    name: "Penjualan", icon: "invoice", tone: "zh-orange",
    flow: [
      { label: "Penawaran", href: "/operasional/penawaran", icon: "doc" },
      { label: "Pesanan Penjualan", href: "/operasional/pesanan", icon: "clipboard" },
      { label: "Pengiriman Barang", href: "/operasional/pengiriman", icon: "truck" },
      { label: "Faktur Penjualan", href: "/akuntansi/penjualan", icon: "invoice" },
      { label: "Penerimaan Penjualan", href: "/akuntansi/penerimaan", icon: "receive" },
    ],
    more: [
      { label: "Data Pelanggan", href: "/akuntansi/kontak?jenis=pelanggan", icon: "users" },
      { label: "Umur Piutang", href: "/akuntansi/laporan/piutang", icon: "clock" },
      { label: "Laporan Penjualan", href: "/akuntansi/laporan/penjualan", icon: "chart" },
    ],
  },
  {
    name: "Pembelian", icon: "cart", tone: "zh-blue",
    flow: [
      { label: "Penerimaan Barang", href: "/operasional/barang-masuk", icon: "inbox" },
      { label: "Faktur Pembelian", href: "/akuntansi/pembelian", icon: "cart" },
      { label: "Pembayaran Pembelian", href: "/akuntansi/pembayaran", icon: "pay" },
    ],
    more: [
      { label: "Data Pemasok", href: "/akuntansi/kontak?jenis=pemasok", icon: "users" },
      { label: "Umur Hutang", href: "/akuntansi/laporan/hutang", icon: "clock" },
    ],
  },
  {
    name: "Kas & Bank", icon: "cash", tone: "zh-green",
    flow: [
      { label: "Kas Masuk", href: "/akuntansi/kas/baru?jenis=masuk", icon: "receive" },
      { label: "Kas Keluar", href: "/akuntansi/kas/baru?jenis=keluar", icon: "pay" },
      { label: "Transfer Kas", href: "/akuntansi/kas/baru?jenis=transfer", icon: "adjust" },
    ],
    more: [
      { label: "Daftar Kas & Bank", href: "/akuntansi/kas", icon: "cash" },
      { label: "Arus Kas", href: "/akuntansi/laporan/arus-kas", icon: "chart" },
    ],
  },
  {
    name: "Persediaan", icon: "stack", tone: "zh-violet",
    flow: [
      { label: "Data Produk", href: "/akuntansi/barang", icon: "box" },
      { label: "Hasil Produksi", href: "/operasional/produksi", icon: "factory" },
      { label: "Stok Barang", href: "/operasional/stok", icon: "stack" },
      { label: "Stok Opname", href: "/operasional/stok/opname", icon: "clipboard" },
    ],
    more: [
      { label: "Penyesuaian Persediaan", href: "/operasional/stok/penyesuaian", icon: "adjust" },
      { label: "Pemindahan Barang", href: "/operasional/transfer-stok", icon: "route" },
    ],
  },
  {
    name: "Buku Besar", icon: "book", tone: "zh-navy",
    flow: [
      { label: "Daftar Rekening Perkiraan", href: "/akuntansi/akun", icon: "list" },
      { label: "Jurnal Umum", href: "/akuntansi/jurnal", icon: "book" },
      { label: "Buku Besar", href: "/akuntansi/laporan/buku-besar", icon: "ledger" },
      { label: "Neraca Saldo", href: "/akuntansi/laporan/neraca-saldo", icon: "adjust" },
    ],
    more: [{ label: "Pengaturan & tutup buku", href: "/akuntansi/pengaturan", icon: "gear" }],
  },
  {
    name: "Laporan", icon: "chart", tone: "zh-teal",
    flow: [
      { label: "Neraca - 12 Bulan", href: "/akuntansi/laporan/neraca-12", icon: "ledger" },
      { label: "Laba Rugi - 12 Bulan", href: "/akuntansi/laporan/laba-rugi-12", icon: "report" },
    ],
    more: [
      { label: "Neraca", href: "/akuntansi/laporan/neraca", icon: "ledger" },
      { label: "Laba Rugi", href: "/akuntansi/laporan/laba-rugi", icon: "chart" },
      { label: "Semua laporan", href: "/akuntansi/laporan", icon: "list" },
    ],
  },
];

const n = (v: number) => (Math.round(v) || 0).toLocaleString("id-ID");

export async function ZahirHome({ db, accounts, nowYm, company }: { db: DB; accounts: Account[]; nowYm: string; company: string }) {
  // 6 bulan terakhir s.d. bulan ini (kolom seperti laporan 12 bulan Zahir).
  const months = Array.from({ length: 6 }, (_, i) => addMonths(nowYm, i - 5));
  const [pl, bs] = await Promise.all([zahirProfitLoss(db, accounts, months), zahirBalanceSheet(db, accounts, months)]);
  const lines: { label: string; values: number[]; strong?: boolean; href: string }[] = [
    { label: "Total Pendapatan", values: pl.revenue, href: "/akuntansi/laporan/laba-rugi-12" },
    { label: "Laba/Rugi Kotor", values: pl.kotor, href: "/akuntansi/laporan/laba-rugi-12" },
    { label: "Laba/Rugi Bersih", values: pl.bersih, strong: true, href: "/akuntansi/laporan/laba-rugi-12" },
    { label: "Kas & Bank", values: bs.kasBank, href: "/akuntansi/laporan/neraca-12" },
    { label: "Piutang Usaha", values: bs.piutang, href: "/akuntansi/laporan/neraca-12" },
    { label: "Persediaan", values: bs.persediaan, href: "/akuntansi/laporan/neraca-12" },
    { label: "Utang Usaha", values: bs.utangUsaha, href: "/akuntansi/laporan/neraca-12" },
    { label: "Total Harta", values: bs.harta, strong: true, href: "/akuntansi/laporan/neraca-12" },
  ];
  const empty = lines.every((l) => l.values.every((v) => !v));

  return (
    <div className="zh">
      <header className="zh-head">
        <div>
          <p className="zh-kicker">Beranda</p>
          <h1>{company}</h1>
          <p className="small muted">Modul seperti Zahir Accounting 6. Klik ikon untuk membuka; panah menunjukkan urutan kerja.</p>
        </div>
      </header>

      <div className="zh-modules">
        {MODULES.map((m) => (
          <section key={m.name} className={`zh-mod ${m.tone}`}>
            <h2><span className="zh-mod-icon"><Icon name={m.icon} size={18} /></span>{m.name}</h2>
            <ol className="zh-flow">
              {m.flow.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="zh-step"><span className="zh-step-icon"><Icon name={s.icon} size={22} /></span><span>{s.label}</span></Link>
                </li>
              ))}
            </ol>
            <div className="zh-more">
              {m.more.map((s) => <Link key={s.label} href={s.href}><Icon name={s.icon} size={14} /> {s.label}</Link>)}
            </div>
          </section>
        ))}
      </div>

      <section className="admin-card">
        <div className="card-head">
          <h2>Ringkasan Neraca &amp; Laba Rugi</h2>
          <span className="small"><Link href="/akuntansi/laporan/neraca-12">Neraca - 12 Bulan</Link> · <Link href="/akuntansi/laporan/laba-rugi-12">Laba Rugi - 12 Bulan</Link></span>
        </div>
        {empty ? (
          <p className="muted">Belum ada jurnal pada 6 bulan terakhir.</p>
        ) : (
          <>
            <div className="admin-table">
              <table className="compact zh-sum">
                <thead><tr><th>Nama Rekening</th>{months.map((m) => <th key={m} className="num">{monthCol(m)}</th>)}</tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.label} className={`${l.strong ? "zh-strong" : ""}${i === 3 ? " zh-split" : ""}`}>
                      <td><Link href={l.href}>{l.label}</Link></td>
                      {l.values.map((v, j) => <td key={j} className={`num${v < 0 ? " zr-neg" : ""}`}>{n(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ColumnChart
              label="Pendapatan dan laba bersih per bulan, 6 bulan terakhir"
              categories={months.map((m) => BULAN_ID[Number(m.slice(5, 7)) - 1].slice(0, 3))}
              series={[
                { name: "Total Pendapatan", color: "#3d63c4", values: pl.revenue },
                { name: "Laba/Rugi Bersih", color: "#1f6b72", values: pl.bersih },
              ]}
            />
          </>
        )}
      </section>
    </div>
  );
}
