import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { tanggal } from "@/lib/format";

export const metadata = { title: "Ringkasan" };

export default async function Dashboard() {
  const me = await requireAdmin();
  const db = await getDb();
  const [[p], [pp], [a], [ap], [t], recent] = await Promise.all([
    db.select({ n: count() }).from(schema.products),
    db.select({ n: count() }).from(schema.products).where(eq(schema.products.published, true)),
    db.select({ n: count() }).from(schema.articles),
    db.select({ n: count() }).from(schema.articles).where(eq(schema.articles.published, true)),
    db.select({ n: count() }).from(schema.testimonials),
    db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).limit(5),
  ]);
  return (
    <>
      <div className="admin-head"><div><h1>Halo, {me.name}</h1><p className="muted">Kelola produk, harga, artikel, dan informasi situs dari sini.</p></div></div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat"><b>{p.n}</b>produk <span className="muted small">({pp.n} tayang)</span></div>
        <div className="stat"><b>{a.n}</b>artikel <span className="muted small">({ap.n} terbit)</span></div>
        <div className="stat"><b>{t.n}</b>testimoni</div>
      </div>
      <div className="duo" style={{ padding: 0 }}>
        <div className="admin-card stack" style={{ flex: "1 1 320px", gap: 12 }}>
          <h2 style={{ fontSize: 19 }}>Tindakan cepat</h2>
          <Link className="btn btn-primary" href="/situs/produk/baru">+ Tambah produk</Link>
          <Link className="btn btn-ghost" href="/situs/artikel/baru">+ Tulis artikel</Link>
          <Link className="btn btn-ghost" href="/situs/pengaturan">Ubah kontak &amp; teks beranda</Link>
        </div>
        <div className="admin-table" style={{ flex: "2 1 420px" }}>
          <table>
            <caption style={{ fontSize: 19 }}>Produk terakhir diubah</caption>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}><td><Link href={`/situs/produk/${r.id}`}>{r.name}</Link></td><td className="num muted">{tanggal(r.updatedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
