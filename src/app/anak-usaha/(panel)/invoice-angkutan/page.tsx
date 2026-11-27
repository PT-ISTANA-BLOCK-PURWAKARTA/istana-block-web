// Invoice angkutan Ekspedisi Istana Block (PIC Kendaraan / Cepi): daftar per bulan, ringkasan tagihan, buat baru.
import Link from "next/link";
import { and, desc, eq, gte, like, lt, or } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { INVOICE_STATUS_LABEL, invoiceTotals, type InvoiceLine } from "@/lib/erp/salesInvoice";
import { can } from "@/lib/roles";

export const metadata = { title: "Invoice Angkutan" };
export const dynamic = "force-dynamic";

const rp = (v: number) => `Rp ${Math.round(v).toLocaleString("id-ID")}`;
const tanggal = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const nextMonth = (m: string) => (Number(m.slice(5)) === 12 ? `${Number(m.slice(0, 4)) + 1}-01` : `${m.slice(0, 4)}-${String(Number(m.slice(5)) + 1).padStart(2, "0")}`);

export default async function InvoiceAngkutan({ searchParams }: { searchParams: Promise<{ q?: string; bulan?: string; status?: string }> }) {
  const user = await requireModule("anak");
  const canEdit = can(user.roles, "keuangan") || can(user.roles, "ekspedisi");
  const sp = await searchParams;
  const db = await getDb();
  const term = sp.q?.trim();
  const month = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : "";
  const all = await db.select().from(schema.salesInvoices).where(and(
    eq(schema.salesInvoices.issuer, "eib"),
    term ? or(like(schema.salesInvoices.number, `%${term}%`), like(schema.salesInvoices.customerName, `%${term}%`), like(schema.salesInvoices.route, `%${term}%`)) : undefined,
    month ? gte(schema.salesInvoices.invoiceDate, new Date(`${month}-01T00:00:00+07:00`)) : undefined,
    month ? lt(schema.salesInvoices.invoiceDate, new Date(`${nextMonth(month)}-01T00:00:00+07:00`)) : undefined,
  )).orderBy(desc(schema.salesInvoices.invoiceDate), desc(schema.salesInvoices.seq)).limit(1000);
  const rows = (sp.status ? all.filter((r) => r.status === sp.status) : all).map((r) => ({ ...r, t: invoiceTotals(r.items as unknown as InvoiceLine[], r.ppnPercent, r.downPaymentPercent, r.downPaymentAmount) }));
  const live = rows.filter((r) => r.status !== "batal");
  const grand = live.reduce((s, r) => s + r.t.grandTotal, 0), paid = live.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
  return (
    <>
      <PageHead title="Invoice Angkutan" sub="Ekspedisi Istana Block · IN-EIB-… · rekening BCA Cepi · TTD PIC Kendaraan">
        {canEdit && <Link href="/anak-usaha/invoice-angkutan/baru" className="btn btn-blue btn-sm">+ Invoice angkutan</Link>}
      </PageHead>
      <form className="filter-bar" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor, pelanggan, rute" aria-label="Cari" />
        <input type="month" name="bulan" defaultValue={month} aria-label="Bulan" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Semua status</option>{Object.entries(INVOICE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
      <div className="kpis">
        <div className="kpi"><span>Invoice</span><b>{rows.length}</b></div>
        <div className="kpi"><span>Tagihan (tanpa batal)</span><b>{rp(grand)}</b></div>
        <div className="kpi"><span>Sudah dibayar</span><b>{rp(paid)}</b></div>
        <div className="kpi"><span>Belum dibayar</span><b>{rp(grand - paid)}</b></div>
      </div>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>Rute / mobil</th><th className="num">Total</th><th className="num">Dibayar</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const cars = [...new Set((r.items as unknown as InvoiceLine[]).map((i) => i.plateNumber).filter(Boolean))];
              return (
                <tr key={r.id}>
                  <td><Link href={`/anak-usaha/invoice-angkutan/${r.id}`}><b>{r.number}</b></Link></td>
                  <td>{tanggal(r.invoiceDate)}</td>
                  <td>{r.customerName}</td>
                  <td className="small">{[r.route, cars.join(", ") || r.plate].filter(Boolean).join(" · ") || "-"}</td>
                  <td className="num">{rp(r.t.grandTotal)}</td>
                  <td className="num">{r.paidAmount ? rp(r.paidAmount) : "-"}</td>
                  <td><span className={`badge badge-${r.status}`}>{INVOICE_STATUS_LABEL[r.status] ?? r.status}</span></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="muted">Belum ada invoice angkutan.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
