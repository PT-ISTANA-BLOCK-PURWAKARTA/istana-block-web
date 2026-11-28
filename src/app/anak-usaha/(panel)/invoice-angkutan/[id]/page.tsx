// Detail invoice angkutan (Ekspedisi Istana Block): baris per mobil, status, pembayaran, cetak.
import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { SalesInvoicePaymentForm } from "@/components/erp/SalesInvoiceForm";
import { deleteSalesInvoice, setSalesInvoiceStatus } from "@/app/akuntansi/actions/documents";
import { getDb, schema } from "@/db";
import { requireAnak } from "@/lib/auth";
import { INVOICE_STATUS_LABEL, invoiceTotals, wibDay, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { today } from "@/lib/erp/util";
import { can } from "@/lib/roles";
import { ZahirPage } from "@/components/erp/ZahirPage";

export const metadata = { title: "Invoice Angkutan" };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;

export default async function InvoiceAngkutanDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const user = await requireAnak("ekspedisi", "keuangan");
  const canEdit = can(user.roles, "keuangan") || can(user.roles, "ekspedisi");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const inv = await db.query.salesInvoices.findFirst({ where: eq(schema.salesInvoices.id, id) });
  if (!inv || inv.issuer !== "eib") notFound();
  const items = inv.items as unknown as InvoiceLine[];
  const t = invoiceTotals(items, inv.ppnPercent, inv.downPaymentPercent, inv.downPaymentAmount);
  return (
    <ZahirPage title={inv.number} sub={`Ekspedisi Istana Block · ${inv.customerName} · ${wibDay(inv.invoiceDate)} · ${INVOICE_STATUS_LABEL[inv.status] ?? inv.status}`} hub="/anak-usaha/invoice-angkutan" actions={<>
        <Link href={`/akuntansi/cetak/invoice/${inv.id}`} className="btn btn-blue btn-sm">Cetak / PDF</Link>
        {canEdit && <Link href={`/anak-usaha/invoice-angkutan/baru?id=${inv.id}`} className="btn btn-ghost btn-sm">Ubah</Link>}
        {canEdit && inv.status === "draft" && <ActionButton action={deleteSalesInvoice.bind(null, inv.id)} label="Hapus" confirmText={`Hapus invoice ${inv.number}?`} className="btn btn-ghost btn-sm" />}
      </>}>
      {sp.ok && <p className="alert alert-ok">{sp.ok === "bayar" ? "Pembayaran tersimpan." : "Invoice tersimpan."}</p>}
      {canEdit && <p className="small">Ubah status: {Object.entries(INVOICE_STATUS_LABEL).filter(([k]) => k !== inv.status).map(([k, l]) => <ActionButton key={k} action={setSalesInvoiceStatus.bind(null, inv.id, k)} label={l} className="link-btn" />)}</p>}
      <dl className="kv">
        <dt>Kepada</dt><dd><b>{inv.customerName}</b>{inv.customerAddress && <div className="small pre">{inv.customerAddress}</div>}{inv.customerPhone && <div className="small">{inv.customerPhone}</div>}</dd>
        {inv.route && <><dt>Rute</dt><dd>{inv.route}{inv.shipDate ? ` · kirim ${inv.shipDate}` : ""}</dd></>}
        <dt>Rekening</dt><dd>{inv.bankName} · {inv.bankAccount}</dd>
        <dt>Penanda tangan</dt><dd>{inv.signerName || "-"}</dd>
        {inv.note && <><dt>Catatan</dt><dd className="pre">{inv.note}</dd></>}
      </dl>
      <div className="admin-table">
        <table>
          <thead><tr><th className="num">Banyaknya</th><th>Satuan</th><th>Mobil / sopir</th><th>Uraian jasa</th><th>Barang dibawa</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
          <tbody>{items.map((it, i) => <tr key={i}><td className="num">{Number(it.quantity).toLocaleString("id-ID")}</td><td>{it.unit}</td><td>{[it.plateNumber, it.driverName].filter(Boolean).join(" · ") || "-"}</td><td>{it.name}</td><td>{it.cargo ?? "-"}</td><td className="num">{rp(it.price)}</td><td className="num">{rp(it.quantity * it.price)}</td></tr>)}</tbody>
          <tfoot>
            <tr><td colSpan={6} className="num"><b>Grand total</b></td><td className="num"><b>{rp(t.grandTotal)}</b></td></tr>
            {t.downPayment !== null && <tr><td colSpan={6} className="num">Uang muka / sisa</td><td className="num">{rp(t.downPayment)} / {rp(t.remaining ?? 0)}</td></tr>}
          </tfoot>
        </table>
      </div>
      <h2 className="form-sub">Pembayaran diterima</h2>
      <p className="small muted">{inv.paidAmount ? `Tercatat ${rp(inv.paidAmount)}${inv.paidAt ? ` pada ${wibDay(inv.paidAt)}` : ""}${inv.paidByName ? ` · oleh ${inv.paidByName}` : ""}. Sisa ${rp(Math.max(0, t.grandTotal - inv.paidAmount))}.` : "Belum ada pembayaran tercatat."}</p>
      {canEdit && <SalesInvoicePaymentForm id={inv.id} grandTotal={t.grandTotal} value={{ amount: inv.paidAmount, paidAt: inv.paidAt ? wibDay(inv.paidAt) : today(), method: inv.paymentMethod ?? "Transfer BCA Cepi", note: inv.paymentNote }} />}
    </ZahirPage>
  );
}
