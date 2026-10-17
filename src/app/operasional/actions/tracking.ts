"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/auth";
import { rotateGpsKey } from "@/lib/erp/tracking";

/** Pemilik membuat kunci baru penerima data GPS. Kunci lama langsung tidak berlaku. */
export async function newGpsKey(_prev: FormState, _form: FormData): Promise<FormState & { key?: string }> {
  await requireOwner();
  const db = await getDb();
  const key = await rotateGpsKey(db);
  revalidatePath("/operasional/lacak/pengaturan");
  return { ok: "Kunci baru dibuat. Salin sekarang: kunci ini hanya ditampilkan sekali.", key };
}
