import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { PAGE_KIND_LABEL } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { deletePage } from "../../actions/pages";

export const metadata = { title: "Halaman" };

export default async function AdminHalaman({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.pages).orderBy(asc(schema.pages.kind), desc(schema.pages.updatedAt));
  return (
    <>
      <div className="admin-head">
        <div>
          <h1>Halaman</h1>
          <p className="muted">Halaman statis di alamat /slug, misalnya halaman area pengiriman per kota.</p>
        </div>
        <Link href="/situs/halaman/baru" className="btn btn-primary">+ Buat halaman</Link>
      </div>
      {ok && <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>“{ok}” tersimpan.</p>}
      <div className="admin-table">
        <table>
          <thead><tr><th>Judul</th><th>Jenis</th><th>Status</th><th>Diubah</th><th className="num">Aksi</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/situs/halaman/${p.id}`} style={{ fontWeight: 700 }}>{p.title}</Link><div className="small muted">/{p.slug}</div></td>
                <td>{PAGE_KIND_LABEL[p.kind] ?? p.kind}</td>
                <td><span className={`badge ${p.published ? "badge-on" : "badge-off"}`}>{p.published ? "Terbit" : "Draf"}</span></td>
                <td>{tanggal(p.updatedAt)}</td>
                <td className="num">
                  <Link href={`/situs/halaman/${p.id}`} style={{ marginRight: 8 }}>Ubah</Link>
                  <DeleteButton action={deletePage.bind(null, p.id)} confirmText={`Hapus halaman "${p.title}"?`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada halaman.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
