import Link from "next/link";
import { desc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { tanggal } from "@/lib/format";
import { deleteArticle } from "../../actions/articles";

export const metadata = { title: "Artikel" };

export default async function AdminArtikel({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.articles).orderBy(desc(schema.articles.updatedAt));
  return (
    <>
      <div className="admin-head">
        <h1>Artikel</h1>
        <Link href="/situs/artikel/baru" className="btn btn-primary">+ Tulis artikel</Link>
      </div>
      {ok && <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>“{ok}” tersimpan.</p>}
      <div className="admin-table">
        <table>
          <thead><tr><th>Judul</th><th>Status</th><th>Terbit</th><th>Diubah</th><th className="num">Aksi</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><Link href={`/situs/artikel/${a.id}`} style={{ fontWeight: 700 }}>{a.title}</Link><div className="small muted">/artikel/{a.slug}</div></td>
                <td><span className={`badge ${a.published ? "badge-on" : "badge-off"}`}>{a.published ? "Terbit" : "Draf"}</span></td>
                <td>{tanggal(a.publishedAt)}</td>
                <td>{tanggal(a.updatedAt)}</td>
                <td className="num">
                  <Link href={`/situs/artikel/${a.id}`} style={{ marginRight: 8 }}>Ubah</Link>
                  <DeleteButton action={deleteArticle.bind(null, a.id)} confirmText={`Hapus artikel "${a.title}"?`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada artikel.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
