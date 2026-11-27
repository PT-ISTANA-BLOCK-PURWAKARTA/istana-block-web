// Surat Jalan (Keuangan): dibuat dari invoice; sopir & armada ditugaskan Operasional. Tab arsip = surat jalan manual app lama.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import { PageHead } from "@/components/erp/ui";
import { getDb } from "@/db";
import type { DeliveryStatus } from "@/db/erp";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Surat Jalan" };
export const dynamic = "force-dynamic";

type Row = { id: string; number: string; date: string; status: DeliveryStatus; po: string; customer: string | null; invoice: string | null; invoice_id: string | null; driver: string | null; plate: string | null; items: string | null };
type Note = { id: string; issuer: string; number: string; note_date: string; customer_name: string; po_number: string | null; driver_name: string | null; plate: string | null; pickup: number };

export default async function DaftarSuratJalan({ searchParams }: { searchParams: Promise<{ q?: string; bulan?: string; tab?: string; status?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const month = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : "";
  const term = `%${(sp.q ?? "").trim()}%`;
  const tab = sp.tab === "arsip" ? "arsip" : "sj";
  const rows = tab === "sj" ? await db.all<Row>(sql`
    select d.id, d.number, d.date, d.status, o.number po, c.name customer, si.number invoice, si.id invoice_id, dr.name driver, v.plate,
      (select group_concat(coalesce(i.name, ol.description) || ' ' || dl.qty || ' ' || ol.unit, ' · ') from ops_delivery_lines dl join ops_order_lines ol on ol.id = dl.order_line_id left join fin_items i on i.id = dl.item_id where dl.delivery_id = d.id) items
    from ops_deliveries d join ops_orders o on o.id = d.order_id left join fin_contacts c on c.id = o.contact_id
    left join ops_sales_invoices si on si.order_id = o.id left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
    where (${month} = '' or substr(d.date, 1, 7) = ${month}) and (${sp.status ?? ""} = '' or d.status = ${sp.status ?? ""})
      and (d.number like ${term} or o.number like ${term} or coalesce(c.name, '') like ${term} or coalesce(si.number, '') like ${term} or coalesce(o.external_ref, '') like ${term})
    order by d.date desc, d.number desc limit 500`) : [];
  const notes = tab === "arsip" ? await db.all<Note>(sql`
    select id, issuer, number, note_date, customer_name, po_number, driver_name, plate, pickup from ops_delivery_notes
    where issuer <> 'ibn' and (${month} = '' or substr(note_date, 1, 7) = ${month}) and (number like ${term} or customer_name like ${term} or coalesce(po_number, '') like ${term})
    order by note_date desc, seq desc limit 500`) : [];
  const waiting = rows.filter((r) => r.status === "dijadwalkan" && !r.driver).length;
  return (
    <>
      <PageHead title="Surat Jalan" sub="Alur: invoice → surat jalan (barang keluar per mobil) → penugasan sopir oleh Operasional">
        <Link href="/akuntansi/dokumen/invoice" className="btn btn-blue btn-sm">+ Dari invoice</Link>
      </PageHead>
      <nav className="zt-tabs">
        <Link href="/akuntansi/dokumen/surat-jalan" aria-current={tab === "sj" ? "page" : undefined}>Surat jalan</Link>
        <Link href="/akuntansi/dokumen/surat-jalan?tab=arsip" aria-current={tab === "arsip" ? "page" : undefined}>Arsip surat jalan manual (app lama)</Link>
      </nav>
      <form className="filter-bar" method="get">
        {tab === "arsip" && <input type="hidden" name="tab" value="arsip" />}
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor, pelanggan, invoice, PO" aria-label="Cari" />
        <input type="month" name="bulan" defaultValue={month} aria-label="Bulan" />
        {tab === "sj" && <select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Semua status</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        <button className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
      {tab === "sj" ? (
        <>
          {waiting > 0 && <p className="alert">{waiting} surat jalan menunggu penugasan sopir oleh Operasional.</p>}
          <div className="admin-table">
            <table>
              <thead><tr><th>No. surat jalan</th><th>Tanggal</th><th>Pelanggan</th><th>Invoice</th><th>Barang</th><th>Sopir / armada</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/akuntansi/dokumen/surat-jalan/${r.id}`}><b>{r.number}</b></Link><div className="small muted">{r.po}</div></td>
                    <td>{r.date}</td>
                    <td>{r.customer ?? "-"}</td>
                    <td>{r.invoice_id ? <Link href={`/akuntansi/dokumen/invoice/${r.invoice_id}`}>{r.invoice}</Link> : "-"}</td>
                    <td className="small">{r.items ?? "-"}</td>
                    <td>{r.driver ? `${r.driver}${r.plate ? ` · ${r.plate}` : ""}` : <span className="muted">Belum ditugaskan</span>}</td>
                    <td><span className={`badge badge-${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="muted">Belum ada surat jalan.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="admin-table">
          <table>
            <thead><tr><th>Nomor</th><th>Tanggal</th><th>Pelanggan</th><th>No. PO</th><th>Sopir / plat</th><th>Catatan</th></tr></thead>
            <tbody>
              {notes.map((n) => <tr key={n.id}><td><Link href={`/akuntansi/cetak/surat-jalan-manual/${n.id}`}>{n.number}</Link></td><td>{n.note_date}</td><td>{n.customer_name}</td><td>{n.po_number || "-"}</td><td>{[n.driver_name, n.plate].filter(Boolean).join(" · ") || "-"}</td><td>{n.pickup ? "diambil sendiri" : n.issuer === "polos" ? "tanpa kop" : "-"}</td></tr>)}
              {!notes.length && <tr><td colSpan={6} className="muted">Tidak ada surat jalan manual.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
