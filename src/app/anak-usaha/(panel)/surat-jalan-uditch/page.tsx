// Surat Jalan U-Ditch (SJ-UD/…, PT. Istana Block · U-Ditch): dibuat dari Invoice U-Ditch, penugasan sopir di Operasional,
// stok U-Ditch keluar dari gudang tanpa jurnal IB. Tidak tampil di daftar surat jalan Keuangan IB.
import Link from "next/link";
import { sql } from "drizzle-orm";
import { ZahirPage } from "@/components/erp/ZahirPage";
import { STATUS_LABEL } from "@/components/ops/delivery/status";
import type { DeliveryStatus } from "@/db/erp";
import { getDb } from "@/db";
import { requireAnak } from "@/lib/auth";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Surat Jalan U-Ditch" };
export const dynamic = "force-dynamic";

type Row = { id: string; number: string; date: string; status: string; invoice: string | null; invoice_id: string | null; customer: string | null; driver: string | null; plate: string | null; items: string | null };

export default async function SuratJalanUditch({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string }> }) {
  await requireAnak("uditch", "keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const term = `%${(sp.q ?? "").trim()}%`;
  const rows = await db.all<Row>(sql`
    select d.id, d.number, d.date, d.status, si.number invoice, si.id invoice_id, c.name customer, dr.name driver, v.plate,
      (select group_concat(coalesce(i.name, ol.description) || ' ' || dl.qty || ' ' || ol.unit, ' · ') from ops_delivery_lines dl join ops_order_lines ol on ol.id = dl.order_line_id left join fin_items i on i.id = dl.item_id where dl.delivery_id = d.id) items
    from ops_deliveries d join ops_orders o on o.id = d.order_id left join fin_contacts c on c.id = o.contact_id
    left join ops_sales_invoices si on si.order_id = o.id left join ops_drivers dr on dr.id = d.driver_id left join ops_vehicles v on v.id = d.vehicle_id
    where d.number like 'SJ-UD/%' and (d.number like ${term} or coalesce(c.name, '') like ${term} or coalesce(si.number, '') like ${term})
    order by d.date desc, d.number desc limit 500`);
  return (
    <ZahirPage
      title="Surat Jalan U-Ditch"
      sub="PT. Istana Block · U-Ditch — dibuat dari Invoice U-Ditch (tombol Buat surat jalan). Penugasan sopir & armada di Operasional; stok keluar saat truk berangkat, tanpa jurnal IB."
      hub="/anak-usaha/menu/uditch"
      actions={<Link href="/anak-usaha/invoice-uditch" className="btn btn-blue btn-sm">Invoice U-Ditch</Link>}
    >
      {sp.ok && <p className="alert alert-ok">Surat jalan {sp.ok} dibuat dan masuk ke Operasional untuk penugasan sopir.</p>}
      <form method="get" className="filter-bar">
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor SJ, pelanggan, invoice" aria-label="Cari" />
        <button className="btn btn-blue btn-sm" type="submit">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>No. SJ</th><th>Tanggal</th><th>Invoice</th><th>Pelanggan</th><th>Barang</th><th>Sopir / plat</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><b>{r.number}</b></td>
                <td className="nowrap">{tgl(r.date)}</td>
                <td>{r.invoice_id ? <Link href={`/anak-usaha/invoice-uditch/${r.invoice_id}`}>{r.invoice}</Link> : "-"}</td>
                <td>{r.customer ?? "-"}</td>
                <td className="small">{r.items ?? "-"}</td>
                <td className="small">{[r.driver, r.plate].filter(Boolean).join(" · ") || "belum ditugaskan"}</td>
                <td>{STATUS_LABEL[r.status as DeliveryStatus] ?? r.status}</td>
                <td><Link href={`/akuntansi/cetak/surat-jalan/${r.id}`} target="_blank">Cetak</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Belum ada surat jalan U-Ditch. Buat dari halaman Invoice U-Ditch.</td></tr>}
          </tbody>
        </table>
      </div>
    </ZahirPage>
  );
}
