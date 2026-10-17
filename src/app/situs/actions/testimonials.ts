"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormState } from "@/components/admin/FormMessage";
import { requireAdmin } from "@/lib/auth";

const Input = z.object({
  name: z.string().trim().min(2, "Nama wajib diisi.").max(80),
  context: z.string().trim().max(120),
  quote: z.string().trim().min(10, "Kutipan minimal 10 huruf.").max(600),
  rating: z.coerce.number().int().min(1).max(5),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export async function saveTestimonial(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(form.get("id")) || null;
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const values = { ...parsed.data, published: form.get("published") === "on", updatedAt: new Date() };
  const db = await getDb();
  if (id) await db.update(schema.testimonials).set(values).where(eq(schema.testimonials.id, id));
  else await db.insert(schema.testimonials).values(values);
  revalidatePath("/", "layout");
  redirect(`/situs/testimoni?ok=${encodeURIComponent(parsed.data.name)}`);
}

export async function deleteTestimonial(id: number) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id));
  revalidatePath("/", "layout");
}
