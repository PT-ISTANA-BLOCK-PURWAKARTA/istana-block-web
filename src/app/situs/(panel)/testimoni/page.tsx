import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { deleteTestimonial } from "../../actions/testimonials";

export const metadata = { title: "Testimoni" };

export default async function AdminTestimoni({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.testimonials).orderBy(asc(schema.testimonials.sortOrder), desc(schema.testimonials.id));
  return (
    <>
      <div className="admin-head">
        <h1>Testimoni</h1>
        <Link href="/situs/testimoni/baru" className="btn btn-primary">+ Tambah testimoni</Link>
      </div>
      {ok && <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>Testimoni “{ok}” tersimpan.</p>}
      <div className="admin-table">
        <table>
          <thead><tr><th>Nama</th><th>Kutipan</th><th>Rating</th><th>Status</th><th className="num">Aksi</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/situs/testimoni/${t.id}`} style={{ fontWeight: 700 }}>{t.name}</Link><div className="small muted">{t.context}</div></td>
                <td style={{ maxWidth: 420 }}>{t.quote.length > 120 ? t.quote.slice(0, 120) + "…" : t.quote}</td>
                <td>{t.rating} ★</td>
                <td><span className={`badge ${t.published ? "badge-on" : "badge-off"}`}>{t.published ? "Tayang" : "Disembunyikan"}</span></td>
                <td className="num">
                  <Link href={`/situs/testimoni/${t.id}`} style={{ marginRight: 8 }}>Ubah</Link>
                  <DeleteButton action={deleteTestimonial.bind(null, t.id)} confirmText={`Hapus testimoni dari ${t.name}?`} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">Belum ada testimoni. Bagian ulasan di beranda disembunyikan sampai ada minimal satu.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
