// Detail Invoice U-Ditch (PT. Istana Block · U-Ditch): barang, status, pembayaran, cetak. Pembayaran otomatis tercatat
// di Operational U-Ditch (M03 Penjualan U-Ditch) → saldo TF Lina / Cash Lina bertambah. Tidak masuk keuangan IB.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import type { DeliveryStatus } from "@/db/erp";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { SalesInvoicePaymentForm } from "@/components/erp/SalesInvoiceForm";
import { deleteSalesInvoice, setSalesInvoiceStatus } from "@/app/akuntansi/actions/documents";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { INVOICE_STATUS_LABEL, invoiceTotals, UDITCH_PAYMENT_METHODS, wibDay, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { tgl, today } from "@/lib/erp/util";
import { ACCOUNT_BY_KEY, type UditchAccount } from "@/lib/ops/uditch";
import { can } from "@/lib/roles";
import { ZahirPage } from "@/components/erp/ZahirPage";

export const metadata = { title: "Invoice U-Ditch" };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;

export default async function InvoiceUditchDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireAnak("uditch", "keuangan");
  const canEdit = can(user.roles, "keuangan") || can(user.roles, "uditch");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv || inv.issuer !== "ud") notFound();
  const sj = inv.orderId ? await db.all<{ id: string; number: string; date: string; status: string; driver: string | null; plate: string | null }>(sql`select d.id, d.number, d.date, d.status, dr.name driver, v.plate from ops_deliveries d left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id where d.order_id = ${inv.orderId} order by d.date, d.number`) : [];
  const entry = await db.query.uditchEntries.findFirst({ where: eq(schema.uditchEntries.sourceKey, `invoice:${inv.id}`) });
  const items = inv.items as unknown as InvoiceLine[];
  const t = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
  return (
    <ZahirPage title={inv.number} sub={`PT. Istana Block · Invoice U-Ditch · ${inv.customerName} · ${tgl(wibDay(inv.invoiceDate))} · ${INVOICE_STATUS_LABEL[inv.status] ?? inv.status}`} hub="/anak-usaha/invoice-uditch" actions={<>
        <Link href={`/akuntansi/cetak/invoice/${inv.id}`} className="btn btn-blue btn-sm">Cetak / PDF</Link>
        {canEdit && inv.status !== "batal" && <Link href={`/anak-usaha/invoice-uditch/${inv.id}/kirim`} className="btn btn-blue btn-sm">Buat surat jalan</Link>}
        {canEdit && <Link href={`/anak-usaha/invoice-uditch/baru?id=${inv.id}`} className="btn btn-ghost btn-sm">Ubah</Link>}
        {canEdit && inv.status === "draft" && <ActionButton action={deleteSalesInvoice.bind(null, inv.id)} label="Hapus" confirmText={`Hapus invoice ${inv.number}?`} className="btn btn-ghost btn-sm" />}
      </>}>
      {sp.ok && <p className="alert alert-ok">{sp.ok === "bayar" ? "Pembayaran tersimpan dan tercatat di Operational U-Ditch." : "Invoice tersimpan."}</p>}
      {canEdit && <p className="small">Ubah status: {Object.entries(INVOICE_STATUS_LABEL).filter(([k]) => k !== inv.status).map(([k, l]) => <ActionButton key={k} action={setSalesInvoiceStatus.bind(null, inv.id, k)} label={l} className="link-btn" />)}</p>}
      <dl className="kv">
        <dt>Kepada</dt><dd><b>{inv.customerName}</b>{inv.customerAddress && <div className="small pre">{inv.customerAddress}</div>}{inv.customerPhone && <div className="small">{inv.customerPhone}</div>}</dd>
        {inv.poNumber && <><dt>No. PO</dt><dd>{inv.poNumber}</dd></>}
        <dt>Rekening</dt><dd>{[inv.bankName, inv.bankAccount].filter(Boolean).join(" · ") || "-"}</dd>
        <dt>Penanda tangan</dt><dd>{inv.signerName || "-"}</dd>
        {inv.note && <><dt>Catatan</dt><dd className="pre">{inv.note}</dd></>}
      </dl>
      <div className="admin-table">
        <table>
          <thead><tr><th className="num">Banyaknya</th><th>Satuan</th><th>Nama barang</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
          <tbody>{items.map((it, i) => <tr key={i}><td className="num">{Number(it.quantity).toLocaleString("id-ID")}</td><td>{it.unit}</td><td>{it.name}</td><td className="num">{rp(it.price)}</td><td className="num">{rp(it.quantity * it.price)}</td></tr>)}</tbody>
          <tfoot>
            {t.ppn > 0 && <tr><td colSpan={4} className="num">Total / PPN {inv.ppnPercent}%</td><td className="num">{rp(t.total)} / {rp(t.ppn)}</td></tr>}
            <tr><td colSpan={4} className="num"><b>Grand total</b></td><td className="num"><b>{rp(t.grandTotal)}</b></td></tr>
            {t.downPayment !== null && <tr><td colSpan={4} className="num">Uang muka / sisa</td><td className="num">{rp(t.downPayment)} / {rp(t.remaining ?? 0)}</td></tr>}
          </tfoot>
        </table>
      </div>
      <h2 className="form-sub">Surat jalan U-Ditch</h2>
      {sj.length ? (
        <div className="admin-table"><table><thead><tr><th>No. SJ</th><th>Tanggal</th><th>Sopir / plat</th><th>Status</th><th /></tr></thead><tbody>
          {sj.map((d) => <tr key={d.id}><td><b>{d.number}</b></td><td>{tgl(d.date)}</td><td>{[d.driver, d.plate].filter(Boolean).join(" · ") || "belum ditugaskan"}</td><td>{STATUS_LABEL[d.status as DeliveryStatus] ?? d.status}</td><td><Link href={`/akuntansi/cetak/surat-jalan/${d.id}`} target="_blank">Cetak</Link></td></tr>)}
        </tbody></table></div>
      ) : <p className="small muted">Belum ada surat jalan. Tekan <b>Buat surat jalan</b> untuk mengirim barang invoice ini.</p>}
      <h2 className="form-sub">Pembayaran diterima</h2>
      <p className="small muted">
        {inv.paidAmount ? `Tercatat ${rp(inv.paidAmount)}${inv.paidAt ? ` pada ${tgl(wibDay(inv.paidAt))}` : ""}${inv.paymentMethod ? ` · ${inv.paymentMethod}` : ""}${inv.paidByName ? ` · oleh ${inv.paidByName}` : ""}. Sisa ${rp(Math.max(0, t.grandTotal - inv.paidAmount))}.` : "Belum ada pembayaran tercatat."}
      </p>
      <p className="small">
        {entry ? (
          <>Masuk Operational U-Ditch: <b>{ACCOUNT_BY_KEY[entry.account as UditchAccount]?.label ?? entry.account}</b> {rp(entry.total)} tanggal {tgl(entry.entryDate)} (M03 Penjualan U-Ditch) · </>
        ) : (
          <>Pembayaran akan otomatis masuk Operational U-Ditch (tunai → Cash Lina, transfer → TF Lina) · </>
        )}
        <Link href="/anak-usaha/uditch">Buka Operational U-Ditch</Link>
      </p>
      {canEdit && <SalesInvoicePaymentForm id={inv.id} grandTotal={t.grandTotal} methods={UDITCH_PAYMENT_METHODS} value={{ amount: inv.paidAmount, paidAt: inv.paidAt ? wibDay(inv.paidAt) : today(), method: inv.paymentMethod ?? UDITCH_PAYMENT_METHODS[0], note: inv.paymentNote }} />}
    </ZahirPage>
  );
}
