// Uang Muka Penjualan / Pembelian (Zahir: Uang Muka, Daftar Uang Muka, Pengembalian Kelebihan / Penerimaan Kembalian).
// Uang muka tercatat otomatis: penerimaan/pembayaran yang tidak dialokasikan ke faktur menjadi saldo uang muka kontak,
// lalu dipakai dengan memilih rekening "Uang Muka" saat penerimaan/pembayaran faktur.
import Link from "next/link";
import { asc } from "drizzle-orm";
import { RefundForm } from "@/components/erp/RefundForm";
import { Kpis, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { SOURCE_LABEL, sourceHref } from "@/lib/erp/links";
import { depositBalances, depositMoves } from "@/lib/erp/returnsGiro";
import { contactsOfKind, loadAccounts } from "@/lib/erp/server";
import { formatAmount, tgl, today } from "@/lib/erp/util";

export const metadata = { title: "Uang Muka" };
export const dynamic = "force-dynamic";

export default async function UangMuka({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const kind = sp.jenis === "pembelian" ? "pembelian" : "penjualan";
  const db = await getDb();
  const acc = await loadAccounts(db);
  const account = acc.byId.get(acc.sys(kind === "penjualan" ? "uang_muka_pelanggan" : "uang_muka_pembelian"))!;
  const [balances, moves, contacts] = await Promise.all([
    depositBalances(db, kind, account.id),
    depositMoves(db, account.id, kind),
    db.select().from(schema.contacts).where(contactsOfKind(kind === "penjualan" ? "pelanggan" : "pemasok")).orderBy(asc(schema.contacts.name)),
  ]);
  const named = balances.filter((b) => b.contactId);
  const unnamed = balances.find((b) => !b.contactId);
  const total = balances.reduce((s, b) => s + b.saldo, 0);
  const who = kind === "penjualan" ? "Pelanggan" : "Pemasok";
  const cash = acc.rows.filter((a) => a.group === "kas_bank" && a.active).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` }));
  const withBalance = named.filter((b) => b.saldo > 0).map((b) => ({ value: b.contactId!, label: `${b.name} (saldo ${formatAmount(b.saldo)})` }));
  return (
    <>
      <PageHead title={kind === "penjualan" ? "Uang Muka Penjualan" : "Uang Muka Pembelian"} sub={kind === "penjualan" ? "DP / titipan pelanggan. Terima lewat Penerimaan tanpa memilih faktur; pakai dengan memilih rekening Uang Muka Penjualan saat menerima pembayaran faktur." : "DP ke pemasok. Bayar lewat Pembayaran tanpa memilih faktur; pakai dengan memilih rekening Uang Muka Pembelian saat membayar tagihan."}>
        <Link href={`/akuntansi/${kind === "penjualan" ? "penerimaan" : "pembayaran"}/baru`} className="btn btn-primary btn-sm">{kind === "penjualan" ? "+ Terima uang muka" : "+ Bayar uang muka"}</Link>
      </PageHead>
      <nav className="zt-tabs">
        <Link href="/akuntansi/uang-muka" aria-current={kind === "penjualan" ? "page" : undefined}>Uang Muka Penjualan</Link>
        <Link href="/akuntansi/uang-muka?jenis=pembelian" aria-current={kind === "pembelian" ? "page" : undefined}>Uang Muka Pembelian</Link>
      </nav>
      <Kpis items={[
        { label: `Saldo ${account.code} ${account.name}`, value: formatAmount(total), sub: `per ${tgl(today())}` },
        { label: `${who} dengan saldo`, value: String(named.filter((b) => b.saldo > 0).length) },
        { label: "Saldo dari Zahir (tanpa rincian kontak)", value: formatAmount(unnamed?.saldo ?? 0), sub: "jurnal impor tidak menyimpan kontak" },
      ]} />
      <section className="zd-card">
        <h2>Daftar Uang Muka {kind === "penjualan" ? "Penjualan" : "Pembelian"} per {who.toLowerCase()}</h2>
        {named.length ? (
          <div className="admin-table"><table className="compact">
            <thead><tr><th>{who}</th><th className="num">Masuk</th><th className="num">Dipakai / dikembalikan</th><th className="num">Saldo</th><th>Terakhir</th><th /></tr></thead>
            <tbody>{named.map((b) => (
              <tr key={b.contactId}>
                <td><Link href={`/akuntansi/kontak/${b.contactId}`}>{b.name}</Link></td>
                <td className="num">{formatAmount(b.masuk)}</td><td className="num">{formatAmount(b.pakai)}</td>
                <td className={`num${b.saldo < 0 ? " text-bahaya" : ""}`}><b>{formatAmount(b.saldo)}</b></td>
                <td className="small">{tgl(b.last)}</td>
                <td className="small">{b.saldo > 0 && <Link href={`/akuntansi/${kind === "penjualan" ? "penerimaan" : "pembayaran"}/baru?kontak=${b.contactId}`}>Pakai untuk faktur</Link>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="zd-empty">Belum ada uang muka yang tercatat per {who.toLowerCase()} di web.</p>}
      </section>
      <section className="zd-card" id="kembali" style={{ marginTop: 16 }}>
        <h2>{kind === "penjualan" ? "Pengembalian Kelebihan (Kredit)" : "Penerimaan Kembalian (Debit)"}</h2>
        <p className="small muted">{kind === "penjualan" ? "Kembalikan sisa uang muka ke pelanggan (kas keluar)." : "Pemasok mengembalikan sisa uang muka (kas masuk)."}</p>
        {withBalance.length ? <RefundForm kind={kind} contacts={withBalance} cash={cash} date={today()} /> : <p className="zd-empty">Tidak ada {who.toLowerCase()} dengan saldo uang muka.</p>}
        <p className="small muted" style={{ marginTop: 6 }}>{contacts.length} {who.toLowerCase()} terdaftar.</p>
      </section>
      <section className="zd-card" style={{ marginTop: 16 }}>
        <h2>Mutasi uang muka terbaru</h2>
        {moves.length ? (
          <div className="admin-table"><table className="compact">
            <thead><tr><th>Tanggal</th><th>Nomor</th><th>{who}</th><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th></tr></thead>
            <tbody>{moves.map((m, i) => (
              <tr key={i}><td className="nowrap">{tgl(m.date)}</td><td><Link href={sourceHref(m.source, m.sourceId, m.journalId)}>{m.number}</Link><div className="small muted">{SOURCE_LABEL[m.source] ?? m.source}</div></td><td>{m.name ?? "-"}</td><td className="small">{m.memo}</td><td className="num">{m.amount > 0 ? formatAmount(m.amount) : ""}</td><td className="num">{m.amount < 0 ? formatAmount(-m.amount) : ""}</td></tr>
            ))}</tbody>
          </table></div>
        ) : <p className="zd-empty">Belum ada mutasi.</p>}
      </section>
    </>
  );
}
