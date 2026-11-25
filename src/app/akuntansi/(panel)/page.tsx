// Dashboard Keuangan gaya Zahir Online: kartu angka (kas & bank, piutang, hutang, penjualan, laba), grafik 12 bulan,
// rasio keuangan, komposisi beban, umur piutang, saldo per rekening, tagihan & hutang jatuh tempo, siap difaktur,
// dan transaksi terakhir. Angka neraca & laba rugi memakai susunan rekening Zahir (sama dengan laporan 12 bulan).
import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { ColumnChart } from "@/components/erp/ColumnChart";
import { Ok, payStatus, Rp, Status } from "@/components/erp/ui";
import { Icon, type IconName } from "@/components/panel/Icon";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { unbilledOrders } from "@/lib/erp/insights";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { aging, cashBalances } from "@/lib/erp/reports";
import { loadAccounts } from "@/lib/erp/server";
import { addDays, formatAmount, tgl, today } from "@/lib/erp/util";
import { addMonths, BULAN_ID, monthName, zahirBalanceSheet, zahirProfitLoss, type ZBlock } from "@/lib/erp/zahirReports";

export const metadata = { title: "Dashboard" };

const sumSubs = (blocks: ZBlock[], section: string, exclude: string[] = []) => {
  const b = blocks.find((x) => x.kind === "section" && x.section.name === section);
  if (!b || b.kind !== "section") return [] as number[];
  const subs = b.section.subs.filter((s) => !exclude.includes(s.name));
  return b.section.total.map((_, i) => subs.reduce((t, s) => t + (s.total[i] ?? 0), 0));
};
const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toLocaleString("id-ID")}%` : "-");
const rp = (v: number) => `Rp ${formatAmount(v)}`;
const ratio = (a: number, b: number) => (b ? `${(Math.round((a / b) * 100) / 100).toLocaleString("id-ID")}×` : "-");

export default async function KeuanganDashboard({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const now = today();
  const nowYm = now.slice(0, 7);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(nowYm, i - 11));
  const acc = await loadAccounts(db);
  const [pl, bs, cash, ar, dueSoon, overdueList, recent, unbilled] = await Promise.all([
    zahirProfitLoss(db, acc.rows, months),
    zahirBalanceSheet(db, acc.rows, months),
    cashBalances(db, acc.rows, now),
    aging(db, "piutang", now),
    db.all<{ id: string; number: string; dueDate: string; total: number; paid: number; name: string }>(sql`
      select b.id, b.number, b.due_date as dueDate, b.total, b.paid, c.name from fin_bills b join fin_contacts c on c.id = b.contact_id
      where b.void = 0 and b.paid < b.total and b.due_date <= ${addDays(now, 14)} order by b.due_date limit 6`),
    db.all<{ id: string; number: string; dueDate: string; total: number; paid: number; name: string }>(sql`
      select i.id, i.number, i.due_date as dueDate, i.total, i.paid, c.name from fin_invoices i join fin_contacts c on c.id = i.contact_id
      where i.void = 0 and i.paid < i.total order by i.due_date limit 6`),
    db.select().from(schema.journals).orderBy(desc(schema.journals.date), desc(schema.journals.createdAt)).limit(6),
    unbilledOrders(db),
  ]);

  // Bulan terakhir yang sudah ada transaksi laba rugi (data Zahir diimpor per bulan).
  const li = Math.max(0, pl.revenue.reduce((last, v, i) => (v || pl.bersih[i] ? i : last), -1));
  const prev = Math.max(0, li - 1);
  const lastLabel = monthName(months[li]);
  const at = (arr: number[], i: number) => arr[i] ?? 0;
  const salesChange = pl.revenue[prev] ? Math.round(((pl.revenue[li] - pl.revenue[prev]) / Math.abs(pl.revenue[prev])) * 100) : null;

  // Rasio dari neraca bulan terakhir berisi data.
  const hartaLancar = at(sumSubs(bs.blocks, "Harta", ["Harta Tetap Berwujud", "Akumulasi Penyusutan Harta Tetap", "Harta Lain"]), li);
  const kewajibanLancar = at(sumSubs(bs.blocks, "Kewajiban", ["Utang Jangka Panjang"]), li);
  const kewajiban = at(sumSubs(bs.blocks, "Kewajiban"), li);
  const modal = at(sumSubs(bs.blocks, "Modal"), li);
  const rev3 = pl.revenue.slice(Math.max(0, li - 2), li + 1).reduce((a, b) => a + b, 0);
  const dso = rev3 > 0 ? Math.round(at(bs.piutang, li) / (rev3 / 90)) : null;
  const rev12 = pl.revenue.reduce((a, b) => a + b, 0);
  const net12 = pl.bersih.reduce((a, b) => a + b, 0);
  const kotor12 = pl.kotor.reduce((a, b) => a + b, 0);

  // Komposisi beban 3 bulan terakhir berisi data (per kelompok rekening Zahir).
  const costSubs = pl.blocks
    .flatMap((b) => (b.kind === "section" && b.section.name !== "Pendapatan" && b.section.name !== "Pendapatan Lain" ? b.section.subs : []))
    .map((s) => ({ name: s.name, value: s.total.slice(Math.max(0, li - 2), li + 1).reduce((a, v) => a + v, 0) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const costMax = Math.max(1, ...costSubs.map((s) => s.value));
  const agingLabels = ["Belum jatuh tempo", "1–30 hari", "31–60 hari", "61–90 hari", "> 90 hari"];
  const agingMax = Math.max(1, ...ar.totals);

  const kpis: { label: string; value: string; sub: React.ReactNode; icon: IconName; tone: string; href: string }[] = [
    { label: "Kas & Bank", value: rp(at(bs.kasBank, li)), sub: `${cash.filter((c) => c.balance).length} rekening · akhir ${lastLabel}`, icon: "cash", tone: "ico-blue", href: "/akuntansi/kas" },
    { label: "Piutang Usaha", value: rp(at(bs.piutang, li)), sub: dso != null ? `± ${dso} hari sampai tertagih` : `akhir ${lastLabel}`, icon: "receive", tone: "ico-amber", href: "/akuntansi/laporan/piutang" },
    { label: "Utang Usaha", value: rp(at(bs.utangUsaha, li)), sub: `akhir ${lastLabel}`, icon: "pay", tone: "ico-red", href: "/akuntansi/laporan/hutang" },
    {
      label: `Penjualan ${lastLabel}`,
      value: rp(pl.revenue[li]),
      sub: salesChange == null ? "Total Pendapatan" : <span className={salesChange >= 0 ? "zd-up" : "zd-down"}>{salesChange >= 0 ? "▲" : "▼"} {Math.abs(salesChange)}% dari bulan sebelumnya</span>,
      icon: "invoice",
      tone: "ico-green",
      href: "/akuntansi/laporan/laba-rugi-12",
    },
    { label: `Laba Bersih ${lastLabel}`, value: rp(pl.bersih[li]), sub: `margin ${pct(pl.bersih[li], pl.revenue[li])}`, icon: "chart", tone: "ico-violet", href: "/akuntansi/laporan/laba-rugi-12" },
  ];

  return (
    <div className="zd">
      <Ok ok={sp.ok} />
      <div className="zd-hello">
        <div>
          <h1>Selamat datang, {user.name.split(" ")[0]}</h1>
          <p>Ringkasan keuangan PT. Istana Block Purwakarta · data terakhir {lastLabel} · {tgl(now)}</p>
        </div>
        <div className="zd-quick">
          <Link href="/akuntansi/penjualan/baru" className="btn btn-primary btn-sm">+ Faktur Penjualan</Link>
          <Link href="/akuntansi/penerimaan/baru" className="btn btn-blue btn-sm">+ Penerimaan</Link>
          <Link href="/akuntansi/kas/baru?jenis=keluar" className="btn btn-ghost btn-sm">+ Kas Keluar</Link>
          <Link href="/akuntansi/pembelian/baru" className="btn btn-ghost btn-sm">+ Faktur Pembelian</Link>
        </div>
      </div>

      <div className="zd-kpis">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="zd-kpi">
            <span className="zd-kpi-top"><span className={`zd-kpi-ico ${k.tone}`}><Icon name={k.icon} size={16} /></span>{k.label}</span>
            <b>{k.value}</b>
            <small>{k.sub}</small>
          </Link>
        ))}
      </div>

      <div className="zd-grid">
        <section className="zd-card">
          <h2>Penjualan &amp; laba 12 bulan <Link href="/akuntansi/laporan/laba-rugi-12">Laba Rugi - 12 Bulan</Link></h2>
          <ColumnChart
            label="Total pendapatan, laba kotor, dan laba bersih per bulan, 12 bulan terakhir"
            categories={months.map((m) => BULAN_ID[Number(m.slice(5, 7)) - 1].slice(0, 3))}
            series={[
              { name: "Total Pendapatan", color: "#1565c0", values: pl.revenue },
              { name: "Laba/Rugi Kotor", color: "#64b5f6", values: pl.kotor },
              { name: "Laba/Rugi Bersih", color: "#16a34a", values: pl.bersih },
            ]}
          />
        </section>
        <section className="zd-card">
          <h2>Rasio keuangan <span className="small muted">{lastLabel}</span></h2>
          <div className="zd-ratios">
            <div className="zd-ratio"><span>Rasio lancar</span><b>{ratio(hartaLancar, kewajibanLancar)}</b><small>harta lancar ÷ kewajiban lancar</small></div>
            <div className="zd-ratio"><span>Utang ÷ modal</span><b>{ratio(kewajiban, modal)}</b><small>makin kecil makin aman</small></div>
            <div className="zd-ratio"><span>Margin kotor 12 bln</span><b>{pct(kotor12, rev12)}</b><small>laba kotor ÷ pendapatan</small></div>
            <div className="zd-ratio"><span>Margin bersih 12 bln</span><b>{pct(net12, rev12)}</b><small>laba bersih ÷ pendapatan</small></div>
            <div className="zd-ratio"><span>Rata-rata hari tagih</span><b>{dso != null ? `${dso} hari` : "-"}</b><small>piutang ÷ penjualan harian (3 bln)</small></div>
            <div className="zd-ratio"><span>Persediaan</span><b>{rp(at(bs.persediaan, li))}</b><small>barang jadi &amp; bahan</small></div>
          </div>
        </section>
      </div>

      <div className="zd-grid">
        <section className="zd-card">
          <h2>Komposisi beban 3 bulan terakhir <Link href="/akuntansi/laporan/laba-rugi-12">Rincian</Link></h2>
          {costSubs.length ? (
            <div className="zd-bars">
              {costSubs.map((c) => (
                <div key={c.name} className="zd-bar"><span title={c.name}>{c.name}</span><i style={{ width: `${(c.value / costMax) * 100}%` }} /><b className="small">{formatAmount(c.value)}</b></div>
              ))}
            </div>
          ) : <p className="zd-empty">Belum ada beban tercatat.</p>}
        </section>
        <section className="zd-card">
          <h2>Saldo kas &amp; bank <Link href="/akuntansi/kas">Mutasi</Link></h2>
          <ul className="zd-list">
            {cash.filter((c) => c.balance).map((r) => (
              <li key={r.account.id}><Link href={`/akuntansi/laporan/buku-besar?akun=${r.account.id}`}>{r.account.name}<small>{r.account.code}</small></Link><Rp n={r.balance} /></li>
            ))}
            {!cash.some((c) => c.balance) && <li className="zd-empty">Belum ada saldo kas & bank.</li>}
          </ul>
        </section>
      </div>

      <div className="zd-grid">
        <section className="zd-card">
          <h2>Umur piutang per faktur <Link href="/akuntansi/laporan/piutang">Umur Piutang</Link></h2>
          {ar.grand > 0 ? (
            <div className="zd-bars">
              {ar.totals.map((v, i) => <div key={i} className="zd-bar"><span>{agingLabels[i]}</span><i style={{ width: `${(v / agingMax) * 100}%`, background: i >= 3 ? "#dc2626" : i >= 1 ? "#f59e0b" : "#1565c0" }} /><b className="small">{formatAmount(v)}</b></div>)}
            </div>
          ) : (
            <p className="zd-empty">Belum ada faktur penjualan terbuka di aplikasi ini. Piutang dari Zahir masih berupa saldo total ({rp(at(bs.piutang, li))}); rincian per faktur menyusul saat impor posisi 30 November.</p>
          )}
        </section>
        <section className="zd-card">
          <h2>Tagihan ke pelanggan <Link href="/akuntansi/penjualan?status=terbuka">Semua</Link></h2>
          <ul className="zd-list">
            {overdueList.map((d) => (
              <li key={d.id}><Link href={`/akuntansi/penjualan/${d.id}`}>{d.number}<small>{d.name} · jatuh tempo {tgl(d.dueDate)}</small></Link><span><Rp n={d.total - d.paid} /> <Status s={payStatus({ total: d.total, paid: d.paid, dueDate: d.dueDate })} /></span></li>
            ))}
            {!overdueList.length && <li className="zd-empty">Tidak ada tagihan terbuka.</li>}
          </ul>
        </section>
      </div>

      <div className="zd-grid">
        <section className="zd-card">
          <h2>Siap difaktur <span className="small muted">surat jalan sudah terkirim</span></h2>
          <ul className="zd-list">
            {unbilled.slice(0, 6).map((o) => (
              <li key={o.id}><Link href={`/operasional/pesanan/${o.id}`}>{o.number}<small>{o.contactName} · terkirim {tgl(o.last)}</small></Link><span><Rp n={o.unbilled} /> <Link href={`/akuntansi/penjualan/baru?pesanan=${o.id}`} className="small">Buat faktur</Link></span></li>
            ))}
            {!unbilled.length && <li className="zd-empty">Semua barang terkirim sudah difaktur.</li>}
          </ul>
        </section>
        <section className="zd-card">
          <h2>Hutang jatuh tempo 14 hari <Link href="/akuntansi/laporan/hutang">Umur Hutang</Link></h2>
          <ul className="zd-list">
            {dueSoon.map((b) => (
              <li key={b.id}><Link href={`/akuntansi/pembelian/${b.id}`}>{b.number}<small>{b.name} · {b.dueDate < now ? "lewat" : "jatuh tempo"} {tgl(b.dueDate)}</small></Link><Rp n={b.total - b.paid} /></li>
            ))}
            {!dueSoon.length && <li className="zd-empty">Tidak ada hutang jatuh tempo dalam 14 hari.</li>}
          </ul>
        </section>
      </div>

      <section className="zd-card">
        <h2>Transaksi terakhir <Link href="/akuntansi/jurnal?semua=1">Semua jurnal</Link></h2>
        <ul className="zd-list">
          {recent.map((j) => (
            <li key={j.id}><Link href={sourceHref(j.source, j.sourceId, j.id)}>{j.number}<small>{tgl(j.date)} · {SOURCE_LABEL[j.source]}</small></Link><span className="small muted" style={{ textAlign: "right" }}>{j.memo}</span></li>
          ))}
          {!recent.length && <li className="zd-empty">Belum ada transaksi.</li>}
        </ul>
      </section>
    </div>
  );
}
