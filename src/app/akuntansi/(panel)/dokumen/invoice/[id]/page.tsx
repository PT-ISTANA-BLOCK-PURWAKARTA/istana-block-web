// Detail invoice penjualan: ringkasan, status, catat pembayaran (DP / lunas), ubah / cetak / hapus (draft).
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import type { DeliveryStatus } from "@/db/erp";
import { notFound, redirect } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { SalesInvoicePaymentForm } from "@/components/erp/SalesInvoiceForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { deleteSalesInvoice, setSalesInvoiceStatus } from "@/app/akuntansi/actions/documents";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { INVOICE_STATUS_LABEL, invoiceTotals, issuerOf, wibDay, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Invoice Penjualan" };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const pct = (v: number) => `${v.toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;

export default async function InvoiceDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv) notFound();
  // Invoice U-Ditch terpisah dari keuangan IB: dibuka di Anak Perusahaan.
  if (inv.issuer === "ud") redirect(`/anak-usaha/invoice-uditch/${inv.id}`);
  if (inv.issuer === "eib") redirect(`/anak-usaha/invoice-angkutan/${inv.id}`);
  const q = inv.quotationId ? await db.query.quotations.findFirst({ where: eq(schema.quotations.id, inv.quotationId) }) : undefined;
  const deliveries = inv.orderId ? await db.all<{ id: string; number: string; date: string; status: string; driver: string | null; plate: string | null }>(sql`
    select d.id, d.number, d.date, d.status, dr.name driver, v.plate from ops_deliveries d left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
    where d.order_id = ${inv.orderId} order by d.date, d.number`) : [];
  const items = inv.items as unknown as InvoiceLine[];
  const t = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
  const date = inv.invoiceDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <>
      <BackLink href="/akuntansi/dokumen/invoice">Invoice Penjualan</BackLink>
      <PageHead title={inv.number} sub={`${issuerOf(inv.issuer).label} · ${inv.customerName} · ${date} · ${INVOICE_STATUS_LABEL[inv.status] ?? inv.status}`}>
        <Link href={`/akuntansi/cetak/invoice/${inv.id}`} className="btn btn-blue btn-sm">Cetak / PDF</Link>
        {inv.status !== "batal" && <Link href={`/akuntansi/dokumen/invoice/${inv.id}/kirim`} className="btn btn-blue btn-sm">Buat surat jalan</Link>}
        <Link href={`/akuntansi/dokumen/invoice/baru?id=${inv.id}`} className="btn btn-ghost btn-sm">Ubah</Link>
        {inv.status === "draft" && <ActionButton action={deleteSalesInvoice.bind(null, inv.id)} label="Hapus" confirmText={`Hapus invoice ${inv.number}?`} className="btn btn-ghost btn-sm" />}
      </PageHead>
      {sp.ok && <p className="alert alert-ok">{sp.ok === "bayar" ? "Pembayaran tersimpan." : "Invoice tersimpan."}</p>}
      <p className="small">
        Ubah status: {Object.entries(INVOICE_STATUS_LABEL).filter(([k]) => k !== inv.status).map(([k, l]) => <ActionButton key={k} action={setSalesInvoiceStatus.bind(null, inv.id, k)} label={l} className="link-btn" />)}
        {q && <> · Dari penawaran <Link href={`/akuntansi/dokumen/penawaran/${q.id}`}>{q.number}</Link></>}
        {inv.orderPoNumber && <> · PO pengiriman {inv.orderPoNumber}</>}
      </p>
      <dl className="kv">
        <dt>Kepada</dt><dd><b>{inv.customerName}</b>{inv.customerAddress && <div className="small pre">{inv.customerAddress}</div>}{inv.customerPhone && <div className="small">{inv.customerPhone}</div>}</dd>
        {inv.poNumber && <><dt>No. PO pelanggan</dt><dd>{inv.poNumber}</dd></>}
        <dt>Rekening</dt><dd>{[inv.bankName, inv.bankAccount].filter(Boolean).join(" · ") || "-"}</dd>
        <dt>Penanda tangan</dt><dd>{inv.signerName || "-"}</dd>
        {inv.note && <><dt>Catatan</dt><dd className="pre">{inv.note}</dd></>}
        <dt>Dibuat oleh</dt><dd>{inv.createdByName || "-"}</dd>
      </dl>
      <div className="admin-table">
        <table>
          <thead><tr><th className="num">Banyaknya</th><th>Satuan</th><th>Nama barang</th><th className="num">Harga satuan</th><th className="num">Jumlah</th></tr></thead>
          <tbody>{items.map((it, i) => <tr key={i}><td className="num">{Number(it.quantity).toLocaleString("id-ID")}</td><td>{it.unit}</td><td>{it.name}</td><td className="num">{rp(it.price)}</td><td className="num">{rp(it.quantity * it.price)}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={4} className="num">Total</td><td className="num">{rp(t.total)}</td></tr>
            {inv.ppnPercent > 0 && <tr><td colSpan={4} className="num">PPN {pct(inv.ppnPercent)}</td><td className="num">{rp(t.ppn)}</td></tr>}
            <tr><td colSpan={4} className="num"><b>Grand total</b></td><td className="num"><b>{rp(t.grandTotal)}</b></td></tr>
            {t.downPayment !== null && <><tr><td colSpan={4} className="num">{inv.downPaymentPercent && !inv.downPaymentAmount ? `Uang muka ${pct(inv.downPaymentPercent)}` : "Uang muka"}</td><td className="num">{rp(t.downPayment)}</td></tr><tr><td colSpan={4} className="num"><b>Sisa</b></td><td className="num"><b>{rp(t.remaining ?? 0)}</b></td></tr></>}
          </tfoot>
        </table>
      </div>
      <h2 className="form-sub">Surat jalan</h2>
      {deliveries.length ? (
        <div className="admin-table">
          <table>
            <thead><tr><th>No. surat jalan</th><th>Tanggal</th><th>Sopir / armada</th><th>Status</th></tr></thead>
            <tbody>{deliveries.map((d) => <tr key={d.id}><td><Link href={`/akuntansi/dokumen/surat-jalan/${d.id}`}><b>{d.number}</b></Link></td><td>{d.date}</td><td>{d.driver ? `${d.driver}${d.plate ? ` · ${d.plate}` : ""}` : <span className="muted">Belum ditugaskan</span>}</td><td>{STATUS_LABEL[d.status as DeliveryStatus] ?? d.status}</td></tr>)}</tbody>
          </table>
        </div>
      ) : <p className="small muted">Belum ada surat jalan. Alur: invoice → surat jalan (barang keluar) → penugasan sopir di Operasional.</p>}
      <h2 className="form-sub">Pembayaran diterima</h2>
      <p className="small muted">{inv.paidAmount ? `Tercatat ${rp(inv.paidAmount)}${inv.paidAt ? ` pada ${wibDay(inv.paidAt)}` : ""}${inv.paymentMethod ? ` · ${inv.paymentMethod}` : ""}${inv.paidByName ? ` · oleh ${inv.paidByName}` : ""}. Sisa ${rp(Math.max(0, t.grandTotal - inv.paidAmount))}.` : "Belum ada pembayaran tercatat."} Status otomatis DP / Lunas.</p>
      <SalesInvoicePaymentForm id={inv.id} grandTotal={t.grandTotal} value={{ amount: inv.paidAmount, paidAt: inv.paidAt ? wibDay(inv.paidAt) : today(), method: inv.paymentMethod, note: inv.paymentNote }} />
    </>
  );
}
