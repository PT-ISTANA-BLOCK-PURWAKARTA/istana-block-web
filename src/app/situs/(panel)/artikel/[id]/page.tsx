import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { imageUrl } from "@/lib/format";
import { ArticleForm } from "../ArticleForm";

export const metadata = { title: "Ubah artikel" };

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const a = await db.query.articles.findFirst({ where: eq(schema.articles.id, id) });
  if (!a) notFound();
  return (
    <>
      <div className="admin-head"><div><Link href="/situs/artikel" className="small">← Artikel</Link><h1>{a.title}</h1></div></div>
      <ArticleForm article={a} coverSrc={imageUrl(a.coverKey)} />
    </>
  );
}
