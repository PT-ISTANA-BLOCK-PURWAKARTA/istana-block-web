import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Ubah produk" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const p = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
  if (!p) notFound();
  return (
    <>
      <div className="admin-head">
        <div><Link href="/admin/produk" className="small">← Produk</Link><h1>{p.name}</h1></div>
      </div>
      <ProductForm product={p} imageSrc={imageUrl(p.imageKey)} />
    </>
  );
}
