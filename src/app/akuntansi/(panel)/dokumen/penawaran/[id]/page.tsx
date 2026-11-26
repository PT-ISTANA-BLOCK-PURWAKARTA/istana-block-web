// Detail surat penawaran: ringkasan, ubah status, ubah / salin / cetak / hapus (draft), buat invoice dari penawaran.
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/erp/ActionButton";
import { BackLink, PageHead } from "@/components/erp/ui";
import { deleteQuotation, setQuotationStatus } from "@/app/akuntansi/actions/documents";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { QUOTATION_STATUS_LABEL } from "@/lib/erp/quotation";

export const metadata = { title: "Surat Penawaran" };
export const dynamic = "force-dynamic";

type Item = { name: string; size?: string | null; note?: string | null; unit: string; price: number; quantity?: number | null };
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;

export default async function PenawaranDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  await requireModule("keuangan");
  const { id } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const q = await db.query.quotations.findFirst({ where: eq(schema.quotations.id, id) });
  if (!q) notFound();
  const invoices = await db.all<{ id: string; number: string }>(sql`select id, number from ops_sales_invoices where quotation_id = ${q.id} order by seq`);
  const items = (q.items ?? []) as unknown as Item[];
  const total = items.reduce((s, i) => s + (i.quantity ?? 0) * i.price, 0);
  const date = q.quoteDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <>
      <BackLink href="/akuntansi/dokumen/penawaran">Surat Penawaran</BackLink>
      <PageHead title={q.number} sub={`${q.customerName} · ${date} · ${QUOTATION_STATUS_LABEL[q.status] ?? q.status}`}>
        <Link href={`/akuntansi/cetak/penawaran/${q.id}`} className="btn btn-blue btn-sm">Cetak / PDF</Link>
        <Link href={`/akuntansi/dokumen/penawaran/baru?id=${q.id}`} className="btn btn-ghost btn-sm">Ubah</Link>
        <Link href={`/akuntansi/dokumen/penawaran/baru?salin=${q.id}`} className="btn btn-ghost btn-sm">Salin jadi surat baru</Link>
        <Link href={`/akuntansi/dokumen/invoice/baru?penawaran=${q.id}`} className="btn btn-ghost btn-sm">Buat invoice</Link>
        {q.status === "draft" && <ActionButton action={deleteQuotation.bind(null, q.id)} label="Hapus" confirmText={`Hapus surat ${q.number}?`} className="btn btn-ghost btn-sm" />}
      </PageHead>
      {sp.ok && <p className="alert alert-ok">Surat tersimpan.</p>}
      <p className="small">
        Ubah status: {Object.entries(QUOTATION_STATUS_LABEL).filter(([k]) => k !== q.status).map(([k, l]) => <ActionButton key={k} action={setQuotationStatus.bind(null, q.id, k)} label={l} className="link-btn" />)}
        {invoices.length > 0 && <> · Invoice: {invoices.map((i) => <Link key={i.id} href={`/akuntansi/dokumen/invoice/${i.id}`} style={{ marginRight: 6 }}>{i.number}</Link>)}</>}
      </p>
      <dl className="kv">
        {q.projectName && <><dt>Nama proyek</dt><dd>{q.projectName}{q.projectCity ? ` · ${q.projectCity}` : ""}</dd></>}
        <dt>Kepada</dt><dd><b>{q.customerName}</b>{q.customerAddress && <div className="small">{q.customerAddress}</div>}{q.customerPhone && <div className="small">{q.customerPhone}</div>}</dd>
        {q.attnName && <><dt>U.p. (PIC)</dt><dd>{q.attnName}{q.attnPhone ? ` · ${q.attnPhone}` : ""}</dd></>}
        {q.work && <><dt>Pekerjaan</dt><dd>{q.work}</dd></>}
        {q.location && <><dt>Lokasi</dt><dd>{q.location}</dd></>}
        <dt>Rekening</dt><dd>{[q.bankName, q.bankAccount].filter(Boolean).join(" · ") || "-"}</dd>
        <dt>Penanda tangan</dt><dd>{q.signerName || "-"}{q.signerTitle ? ` (${q.signerTitle})` : ""}</dd>
        <dt>Dibuat oleh</dt><dd>{q.createdByName || "-"}</dd>
      </dl>
      <div className="admin-table">
        <table>
          <thead><tr><th>No</th><th>Jenis barang / pekerjaan</th><th className="num">Volume</th><th>Satuan</th><th className="num">Harga</th><th className="num">Jumlah</th></tr></thead>
          <tbody>{items.map((it, i) => <tr key={i}><td>{i + 1}</td><td><b>{it.name}</b>{it.size && <div className="small">Uk : {it.size}</div>}{it.note && <div className="small muted"><i>{it.note}</i></div>}</td><td className="num">{it.quantity ? it.quantity.toLocaleString("id-ID") : "-"}</td><td>{it.unit}</td><td className="num">{rp(it.price)}</td><td className="num">{it.quantity ? rp(it.quantity * it.price) : "-"}</td></tr>)}</tbody>
          {total > 0 && <tfoot><tr><td colSpan={5} className="num"><b>TOTAL</b></td><td className="num"><b>{rp(total)}</b></td></tr></tfoot>}
        </table>
      </div>
    </>
  );
}
