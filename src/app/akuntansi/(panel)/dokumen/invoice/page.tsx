// Invoice penjualan (Keuangan): daftar per bulan + cari + status + penerbit. Dibuat hanya di Keuangan; Operasional melihat saja.
import Link from "next/link";
import { and, desc, eq, gte, like, lt, or } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { INVOICE_ISSUERS, INVOICE_STATUS_LABEL, invoiceTotals, type InvoiceLine } from "@/lib/erp/salesInvoice";

export const metadata = { title: "Invoice Penjualan" };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const tanggal = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });

export default async function DaftarInvoice({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; penerbit?: string; bulan?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const term = sp.q?.trim();
  const month = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : "";
  const from = month ? new Date(`${month}-01T00:00:00+07:00`) : undefined;
  const to = month ? new Date(`${Number(month.slice(5)) === 12 ? `${Number(month.slice(0, 4)) + 1}-01` : `${month.slice(0, 4)}-${String(Number(month.slice(5)) + 1).padStart(2, "0")}`}-01T00:00:00+07:00`) : undefined;
  const all = await db.select().from(schema.salesInvoices).where(and(
    term ? or(like(schema.salesInvoices.number, `%${term}%`), like(schema.salesInvoices.customerName, `%${term}%`), like(schema.salesInvoices.poNumber, `%${term}%`), like(schema.salesInvoices.customerPhone, `%${term}%`)) : undefined,
    from ? gte(schema.salesInvoices.invoiceDate, from) : undefined, to ? lt(schema.salesInvoices.invoiceDate, to) : undefined,
    sp.penerbit ? eq(schema.salesInvoices.issuer, sp.penerbit) : undefined,
  )).orderBy(desc(schema.salesInvoices.invoiceDate), desc(schema.salesInvoices.seq)).limit(1000);
  const rows = (sp.status ? all.filter((r) => r.status === sp.status) : all).map((r) => ({ ...r, t: invoiceTotals(r.items as unknown as InvoiceLine[], r.ppnPercent, r.downPaymentPercent, r.downPaymentAmount) }));
  const sum = rows.filter((r) => r.status !== "batal").reduce((a, r) => ({ grand: a.grand + r.t.grandTotal, paid: a.paid + (r.paidAmount ?? 0) }), { grand: 0, paid: 0 });
  return (
    <>
      <PageHead title="Invoice Penjualan" sub="Nomor otomatis melanjutkan IN-IB-0001256 · bisa diisi dari surat penawaran · cetak Utama + Copy">
        <Link href="/akuntansi/dokumen/invoice/baru" className="btn btn-blue btn-sm">+ Invoice baru</Link>
      </PageHead>
      <form className="filter-bar" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor, pelanggan, no. PO, telp" aria-label="Cari" />
        <input type="month" name="bulan" defaultValue={month} aria-label="Bulan" />
        <select name="penerbit" defaultValue={sp.penerbit ?? ""} aria-label="Penerbit"><option value="">Semua penerbit</option>{INVOICE_ISSUERS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Semua status</option>{Object.entries(INVOICE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
      <div className="kpis">
        <div className="kpi"><span>Invoice</span><b>{rows.length}</b></div>
        <div className="kpi"><span>Grand total (tanpa batal)</span><b>{rp(sum.grand)}</b></div>
        <div className="kpi"><span>Sudah dibayar</span><b>{rp(sum.paid)}</b></div>
        <div className="kpi"><span>Belum dibayar</span><b>{rp(sum.grand - sum.paid)}</b></div>
      </div>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>No. PO</th><th className="num">Grand total</th><th className="num">Dibayar</th><th className="num">Sisa</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/akuntansi/dokumen/invoice/${r.id}`}><b>{r.number}</b></Link></td>
                <td>{tanggal(r.invoiceDate)}</td>
                <td>{r.customerName}</td>
                <td>{r.poNumber || "-"}</td>
                <td className="num">{rp(r.t.grandTotal)}</td>
                <td className="num">{r.paidAmount ? rp(r.paidAmount) : "-"}</td>
                <td className="num">{r.status === "batal" ? "-" : rp(Math.max(0, r.t.grandTotal - (r.paidAmount ?? 0)))}</td>
                <td><span className={`badge badge-${r.status}`}>{INVOICE_STATUS_LABEL[r.status] ?? r.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Belum ada invoice.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
