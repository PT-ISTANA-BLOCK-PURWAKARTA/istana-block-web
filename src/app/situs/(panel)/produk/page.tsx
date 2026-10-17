import Link from "next/link";
import { asc } from "drizzle-orm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { imageUrl, priceLabel } from "@/lib/format";
import { deleteProduct } from "../../actions/products";

export const metadata = { title: "Produk" };

export default async function AdminProduk({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const { ok } = await searchParams;
  const db = await getDb();
  const rows = await db.select().from(schema.products).orderBy(asc(schema.products.sortOrder), asc(schema.products.name));
  return (
    <>
      <div className="admin-head">
        <h1>Produk &amp; harga</h1>
        <Link href="/situs/produk/baru" className="btn btn-primary">+ Tambah produk</Link>
      </div>
      {ok && <p className="alert alert-ok" role="status" style={{ marginBottom: 16 }}>“{ok}” tersimpan.</p>}
      <div className="admin-table">
        <table>
          <thead>
            <tr><th>Foto</th><th>Nama</th><th>Kategori</th><th>Harga</th><th>Status</th><th className="num">Aksi</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const img = imageUrl(p.imageKey);
              return (
                <tr key={p.id}>
                  <td>{img ? <img src={img} alt="" className="thumb" /> : <div className="thumb hexpat-light" />}</td>
                  <td><Link href={`/situs/produk/${p.id}`} style={{ fontWeight: 700 }}>{p.name}</Link><div className="small muted">/produk/{p.slug}</div></td>
                  <td>{p.category}</td>
                  <td className="tabular">{priceLabel(p)}<div className="small muted">{p.priceRows.length} baris harga</div></td>
                  <td>
                    <span className={`badge ${p.published ? "badge-on" : "badge-off"}`}>{p.published ? "Tayang" : "Draf"}</span>{" "}
                    {p.featured && <span className="badge" style={{ background: "var(--biru-muda)", color: "var(--biru-tua)" }}>Beranda</span>}
                  </td>
                  <td className="num">
                    <Link href={`/situs/produk/${p.id}`} style={{ marginRight: 8 }}>Ubah</Link>
                    <DeleteButton action={deleteProduct.bind(null, p.id)} confirmText={`Hapus produk "${p.name}"? Tindakan ini tidak bisa dibatalkan.`} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="muted">Belum ada produk.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
