import Link from "next/link";
import { sql } from "drizzle-orm";
import { Ok, PageHead, Rp, Status } from "@/components/erp/ui";
import { getDb } from "@/db";
import { opsAccess } from "@/lib/erp/ops";
import { tgl } from "@/lib/erp/util";

export const metadata = { title: "Pesanan" };

const TABS = [
  { key: "", label: "Aktif" },
  { key: "draft", label: "Draf" },
  { key: "terkirim", label: "Terkirim" },
  { key: "selesai", label: "Selesai" },
  { key: "batal", label: "Batal" },
  { key: "semua", label: "Semua" },
];

type Row = { id: string; number: string; date: string; status: string; customerRef: string; project: string; requestedDate: string | null; contactName: string; gross: number; value: number; deliveredValue: number; invoiced: number };

export default async function Pesanan({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; ok?: string }> }) {
  const { canEdit, canFinance } = await opsAccess();
  const sp = await searchParams;
  const status = TABS.some((t) => t.key === sp.status) ? (sp.status as string) : "";
  const q = (sp.q ?? "").trim();
  const db = await getDb();
  const statusSql =
    status === "" ? sql`o.status in ('dikonfirmasi','dikirim_sebagian')` : status === "semua" ? sql`1 = 1` : sql`o.status = ${status}`;
  const like = `%${q}%`;
  const rows = await db.all<Row>(sql`
    select o.id, o.number, o.date, o.status, o.customer_ref customerRef, o.project, o.requested_date requestedDate, c.name contactName,
      coalesce((select sum(round(qty * price)) from ops_order_lines where order_id = o.id),0) gross,
      coalesce((select sum(round(qty * price)) from ops_order_lines where order_id = o.id),0) - o.discount + o.ongkir value,
      coalesce((select sum(dl.qty * ol.price) from ops_delivery_lines dl join ops_deliveries d on d.id = dl.delivery_id join ops_order_lines ol on ol.id = dl.order_line_id
        where d.order_id = o.id and d.status = 'terkirim'),0) deliveredValue,
      coalesce((select sum(total) from fin_invoices where order_id = o.id and void = 0),0) invoiced
    from ops_orders o join fin_contacts c on c.id = o.contact_id
    where ${statusSql} ${q ? sql`and (o.number like ${like} or c.name like ${like} or c.company like ${like} or o.customer_ref like ${like} or o.project like ${like})` : sql``}
    order by o.date desc, o.number desc limit 300`);
  return (
    <>
      <PageHead title="Pesanan (PO)" sub="Pesanan pelanggan → jadwal kirim → surat jalan → faktur.">
        {canEdit && <Link href="/operasional/pesanan/baru" className="btn btn-primary btn-sm">+ Pesanan</Link>}
      </PageHead>
      <Ok ok={sp.ok} />
      <form className="filter-bar" method="get">
        <nav className="seg" aria-label="Status pesanan">
          {TABS.map((t) => (
            <Link key={t.key} href={`/operasional/pesanan${t.key ? `?status=${t.key}` : ""}`} aria-current={t.key === status ? "page" : undefined}>{t.label}</Link>
          ))}
        </nav>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="field grow"><label htmlFor="q">Cari</label><input id="q" name="q" defaultValue={q} placeholder="nomor, pelanggan, PO pelanggan, proyek" /></div>
        <button type="submit" className="btn btn-blue btn-sm">Cari</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Minta kirim</th><th>Status</th><th className="num">Nilai</th><th className="num">Terkirim</th>{canFinance && <th className="num">Difaktur</th>}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.gross > 0 ? Math.min(100, Math.round((Number(r.deliveredValue) / Number(r.gross)) * 100)) : 0;
              return (
                <tr key={r.id} className={r.status === "batal" ? "row-muted" : undefined}>
                  <td><Link href={`/operasional/pesanan/${r.id}`}><b>{r.number}</b></Link><div className="small muted">{tgl(r.date)}{r.customerRef ? ` · PO ${r.customerRef}` : ""}</div></td>
                  <td><b>{r.contactName}</b>{r.project && <div className="small muted clamp-2">{r.project}</div>}</td>
                  <td className="small">{r.requestedDate ? tgl(r.requestedDate) : "—"}</td>
                  <td><Status s={r.status} /></td>
                  <td className="num"><Rp n={Number(r.value)} /></td>
                  <td className="num"><span className="progress" aria-label={`${pct}% terkirim`}><span style={{ width: `${pct}%` }} /></span><div className="small muted">{pct}%</div></td>
                  {canFinance && <td className="num small">{Number(r.invoiced) ? <Rp n={Number(r.invoiced)} /> : <span className="muted">—</span>}</td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="muted" style={{ padding: 24 }}>{q ? "Tidak ada pesanan yang cocok." : "Belum ada pesanan di kelompok ini."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
