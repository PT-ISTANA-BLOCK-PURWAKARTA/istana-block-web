import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { TestimonialForm } from "../TestimonialForm";

export const metadata = { title: "Ubah testimoni" };

export default async function EditTestimonial({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const t = await db.query.testimonials.findFirst({ where: eq(schema.testimonials.id, id) });
  if (!t) notFound();
  return (
    <>
      <div className="admin-head"><div><Link href="/admin/testimoni" className="small">← Testimoni</Link><h1>{t.name}</h1></div></div>
      <TestimonialForm t={t} />
    </>
  );
}
