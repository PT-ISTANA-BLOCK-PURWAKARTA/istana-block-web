// Detail Permintaan Penawaran / Pesanan Pembelian: cetak (format Zahir), ubah status, teruskan ke PO / faktur pembelian.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { PrintButton } from "@/components/erp/PrintButton";
import { ZahirForm, zDate, zn } from "@/components/erp/report/ZahirForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { deletePurchaseOrder, rfqToPo, setPurchaseOrderStatus } from "@/app/akuntansi/actions/purchaseOrders";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { reportContext } from "@/lib/erp/reportctx";
import { formatQty } from "@/lib/erp/util";
import { PO_STATUS } from "@/lib/erp/masterData";

export const metadata = { title: "Pesanan Pembelian" };
export const dynamic = "force-dynamic";

export default async function PesananDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const { site } = await reportContext();
  const o = await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, id) });
  if (!o) notFound();
  const [lines, c, src] = await Promise.all([
    db.select().from(schema.purchaseOrderLines).where(eq(schema.purchaseOrderLines.orderId, id)).orderBy(schema.purchaseOrderLines.sort),
    db.query.contacts.findFirst({ where: eq(schema.contacts.id, o.contactId) }),
    db.get<{ id: string; number: string } | undefined>(sql`select id, number from fin_purchase_orders where id = ${o.sourceId ?? ""} or source_id = ${o.id} limit 1`),
  ]);
  const title = o.kind === "rfq" ? "Permintaan Penawaran" : "Pesanan Pembelian";
  const next = o.kind === "po" ? (["dikirim", "diterima", "selesai", "batal"] as const) : (["dikirim", "batal"] as const);
  return (
    <>
      <div className="no-print">
        <BackLink href={`/akuntansi/pesanan-pembelian${o.kind === "rfq" ? "?jenis=rfq" : ""}`}>{title}</BackLink>
        <PageHead title={o.number} sub={`${title} · ${c?.name ?? ""} · ${PO_STATUS[o.status]}`}>
          <Link href={`/akuntansi/pesanan-pembelian/baru?id=${o.id}`} className="btn btn-ghost btn-sm">Ubah</Link>
          {o.kind === "rfq" && o.status !== "selesai" && <ActionButton action={rfqToPo.bind(null, o.id)} label="Jadikan pesanan pembelian" className="btn btn-blue btn-sm" />}
          {o.kind === "po" && <Link href={`/akuntansi/pembelian/baru?kontak=${o.contactId}&po=${o.id}`} className="btn btn-blue btn-sm">Buat faktur pembelian</Link>}
          <PrintButton label="Cetak / PDF" />
          <ActionButton action={deletePurchaseOrder.bind(null, o.id)} label="Hapus" confirmText={`Hapus ${o.number}?`} className="btn btn-ghost btn-sm" />
        </PageHead>
        {sp.ok && <p className="alert alert-ok">Tersimpan: {sp.ok}</p>}
        <p className="small">
          Ubah status: {next.filter((s) => s !== o.status).map((s) => <ActionButton key={s} action={setPurchaseOrderStatus.bind(null, o.id, s)} label={PO_STATUS[s]} className="link-btn" />)}
          {src && <> · Terkait: <Link href={`/akuntansi/pesanan-pembelian/${src.id}`}>{src.number}</Link></>}
        </p>
      </div>
      <ZahirForm company={site.legal_name || site.company_name || "PT. Istana Block Purwakarta"} title={title} period={`No. ${o.number} · ${zDate(o.date)}`}>
        <dl className="kv" style={{ marginBottom: 12 }}>
          <dt>Kepada</dt><dd><b>{c?.name}</b>{c?.address ? <div className="small">{c.address}</div> : null}{c?.phone ? <div className="small">{c.phone}</div> : null}</dd>
          {o.expectedDate && <><dt>{o.kind === "rfq" ? "Penawaran ditunggu" : "Dikirim paling lambat"}</dt><dd>{zDate(o.expectedDate)}</dd></>}
          {o.memo && <><dt>Keterangan</dt><dd>{o.memo}</dd></>}
        </dl>
        <table className="zf-table">
          <thead><tr><th style={{ width: 36 }}>No</th><th>Nama Barang</th><th className="num">Jumlah</th><th>Satuan</th><th className="num">Harga</th><th className="num">Total</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={l.id}><td>{i + 1}</td><td>{l.description}</td><td className="num">{formatQty(l.qty)}</td><td>{l.unit}</td><td className="num">{zn(l.price)}</td><td className="num">{zn(l.amount)}</td></tr>)}</tbody>
          <tfoot>
            <tr className="zf-total"><td colSpan={5}>Subtotal</td><td className="num">{zn(o.subtotal, true)}</td></tr>
            {o.tax > 0 && <tr className="zf-total"><td colSpan={5}>PPN</td><td className="num">{zn(o.tax, true)}</td></tr>}
            <tr className="zf-total"><td colSpan={5}>TOTAL</td><td className="num">{zn(o.total, true)}</td></tr>
          </tfoot>
        </table>
        <div className="report-sign" style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
          <div><span>Dibuat oleh,</span><div className="sign-line" /><b>Bagian Pembelian</b></div>
          <div><span>Disetujui oleh,</span><div className="sign-line" /><b>Pimpinan</b></div>
        </div>
      </ZahirForm>
    </>
  );
}
