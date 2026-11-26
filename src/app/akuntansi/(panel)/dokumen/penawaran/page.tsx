// Surat Penawaran (Keuangan): daftar + cari + status. Pembuatan surat hanya di Keuangan; Operasional melihat saja.
import Link from "next/link";
import { desc, like, or } from "drizzle-orm";
import { PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { QUOTATION_STATUS_LABEL } from "@/lib/erp/quotation";

export const metadata = { title: "Surat Penawaran" };
export const dynamic = "force-dynamic";

const tanggal = (d: Date) => d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
type Item = { price: number; quantity?: number | null };

export default async function DaftarPenawaran({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const term = sp.q?.trim();
  const all = await db.select().from(schema.quotations)
    .where(term ? or(like(schema.quotations.number, `%${term}%`), like(schema.quotations.customerName, `%${term}%`), like(schema.quotations.projectName, `%${term}%`), like(schema.quotations.location, `%${term}%`)) : undefined)
    .orderBy(desc(schema.quotations.seq), desc(schema.quotations.quoteDate)).limit(500);
  const rows = sp.status ? all.filter((r) => r.status === sp.status) : all;
  const count = (s: string) => all.filter((r) => r.status === s).length;
  return (
    <>
      <PageHead title="Surat Penawaran" sub="Nomor otomatis melanjutkan 01.xxx/IBP · harga diisi manual · cetak dengan TTD otomatis">
        <Link href="/akuntansi/dokumen/penawaran/baru" className="btn btn-blue btn-sm">+ Surat penawaran baru</Link>
      </PageHead>
      <form className="filter-bar" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Cari nomor, pelanggan, proyek, lokasi" aria-label="Cari" />
        <select name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Semua status ({all.length})</option>
          {Object.entries(QUOTATION_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l} ({count(k)})</option>)}
        </select>
        <button className="btn btn-ghost btn-sm">Tampilkan</button>
      </form>
      <div className="admin-table">
        <table>
          <thead><tr><th>Nomor</th><th>Tanggal</th><th>Kepada</th><th>Proyek / pekerjaan</th><th className="num">Barang</th><th className="num">Total (bila ada volume)</th><th>Status</th><th>Penanda tangan</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const items = (r.items ?? []) as unknown as Item[];
              const total = items.reduce((s, i) => s + (i.quantity ?? 0) * i.price, 0);
              return (
                <tr key={r.id}>
                  <td><Link href={`/akuntansi/dokumen/penawaran/${r.id}`}><b>{r.number}</b></Link></td>
                  <td>{tanggal(r.quoteDate)}</td>
                  <td>{r.customerName}{r.attnName && <div className="small muted">U.p. {r.attnName}</div>}</td>
                  <td>{r.projectName || "-"}{r.work && <div className="small muted">{r.work}</div>}</td>
                  <td className="num">{items.length}</td>
                  <td className="num">{total ? `Rp ${Math.round(total).toLocaleString("id-ID")}` : "-"}</td>
                  <td><span className={`badge badge-${r.status}`}>{QUOTATION_STATUS_LABEL[r.status] ?? r.status}</span></td>
                  <td>{r.signerName || "-"}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={8} className="muted">Belum ada surat penawaran.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
