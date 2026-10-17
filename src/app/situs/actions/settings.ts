"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import type { FormState } from "@/components/admin/FormMessage";
import { requireAdmin } from "@/lib/auth";
import { SETTING_FIELDS, isMapsEmbedUrl } from "@/lib/settings";

/** Admin boleh menempel seluruh kode <iframe> dari Google Maps; ambil isi src-nya saja. */
function embedSrc(v: string) {
  const m = v.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
  return (m ? m[1] : v).replace(/&amp;/g, "&").trim();
}

export async function saveSettings(_prev: FormState, form: FormData): Promise<FormState> {
  await requireAdmin();
  const db = await getDb();
  const rows = SETTING_FIELDS.map((f) => {
    let value = String(form.get(f.key) ?? "").trim().slice(0, f.type === "textarea" || f.type === "faq" ? 8000 : 2000);
    if (f.key === "maps_embed_url" && value) value = embedSrc(value);
    return { key: f.key, value };
  });
  const val = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  if (val("maps_url") && !/^https:\/\//.test(val("maps_url"))) return { error: "Tautan Google Maps harus diawali https://" };
  if (val("catalog_url") && !/^(https:\/\/|\/)/.test(val("catalog_url"))) return { error: "Tautan katalog harus diawali https://" };
  if (val("maps_embed_url") && !isMapsEmbedUrl(val("maps_embed_url")))
    return { error: "URL embed Google Maps harus diawali https://www.google.com/maps/embed (Bagikan → Sematkan peta)." };
  const [first, ...rest] = rows.map((r) =>
    db.insert(schema.settings).values(r).onConflictDoUpdate({ target: schema.settings.key, set: { value: r.value } }),
  );
  await db.batch([first, ...rest]);
  revalidatePath("/", "layout");
  return { ok: "Informasi situs tersimpan." };
}
