import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { PageForm } from "../PageForm";

export const metadata = { title: "Ubah halaman" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const p = await db.query.pages.findFirst({ where: eq(schema.pages.id, id) });
  if (!p) notFound();
  return (
    <>
      <div className="admin-head"><div><Link href="/admin/halaman" className="small">← Halaman</Link><h1>{p.title}</h1></div></div>
      <PageForm page={p} coverSrc={imageUrl(p.coverKey)} />
    </>
  );
}
