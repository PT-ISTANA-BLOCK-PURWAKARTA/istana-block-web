"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import type { FormState } from "@/components/admin/FormMessage";
import { getDb, schema } from "@/db";
import { productionMethods, type ProductLine } from "@/db/erp";
import { requirePerm } from "@/lib/auth";
import { guard, parseRows, UserError } from "@/lib/erp/server";
import { parseQty } from "@/lib/erp/util";
import { logActivity } from "@/lib/ops/activity";
import { SPEC_LINES } from "@/lib/ops/production-lines";

/** Simpan spesifikasi produk (berat per buah + atribut nama-nilai bebas) satu ukuran/tipe. Buis: varian = metode. */
export async function saveSpec(_prev: FormState, form: FormData): Promise<FormState> {
  const me = await requirePerm("spesifikasi_produk");
  const res = await guard(async () => {
    const db = await getDb();
    const id = String(form.get("id") ?? "");
    const existing = id ? await db.query.productSpecs.findFirst({ where: eq(schema.productSpecs.id, id) }) : undefined;
    if (id && !existing) throw new UserError("Spesifikasi tidak ditemukan.");
    const line = String(form.get("line") ?? "") as ProductLine;
    if (!SPEC_LINES.includes(line)) throw new UserError("Pilih kategori produk.");
    const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
    if (name.length < 1 || name.length > 80) throw new UserError("Isi ukuran / tipe (maks 80 huruf).");
    let variant = String(form.get("variant") ?? "").trim().slice(0, 60) || null;
    if (line === "buis" && variant && !(productionMethods as readonly string[]).includes(variant)) throw new UserError("Metode Buis harus Tumbuk, Cor, atau Tulangan.");
    const w = String(form.get("weightKg") ?? "").trim();
    const weightKg = w ? parseQty(w) : null;
    if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > 100_000)) throw new UserError("Berat per buah tidak valid.");
    const specs: Record<string, string> = {};
    for (const r of parseRows(form.get("specs"))) {
      const k = String(r.k ?? "").trim().slice(0, 30);
      const v = String(r.v ?? "").trim().slice(0, 60);
      if (!k && !v) continue;
      if (!k || !v) throw new UserError("Spesifikasi lain: isi nama dan nilainya.");
      specs[k] = v;
    }
    if (Object.keys(specs).length > 12) throw new UserError("Spesifikasi lain maksimal 12 baris.");
    const notes = String(form.get("notes") ?? "").trim().slice(0, 500);
    const itemId = String(form.get("itemId") ?? "").trim() || null;
    if (itemId && !(await db.query.items.findFirst({ where: eq(schema.items.id, itemId) }))) throw new UserError("Barang tidak ditemukan.");
    const dup = await db.select({ id: schema.productSpecs.id, variant: schema.productSpecs.variant }).from(schema.productSpecs).where(and(eq(schema.productSpecs.line, line), eq(schema.productSpecs.name, name), id ? ne(schema.productSpecs.id, id) : undefined));
    if (dup.some((d) => (d.variant ?? null) === variant)) throw new UserError("Ukuran / tipe dengan varian yang sama sudah ada di kategori ini.");
    const active = form.get("active") === "on";
    const values = { line, name, variant, weightKg, specs, notes, active, itemId, updatedAt: new Date() };
    if (existing) await db.update(schema.productSpecs).set(values).where(eq(schema.productSpecs.id, existing.id));
    else await db.insert(schema.productSpecs).values({ ...values, createdBy: me.id });
    await logActivity(me, { action: existing ? "spesifikasi.ubah" : "spesifikasi.tambah", label: existing ? "Mengubah spesifikasi produk" : "Menambah spesifikasi produk", summary: `${line} · ${name}` });
    return { edited: !!existing };
  });
  if ("error" in res) return res;
  redirect(`/operasional/spesifikasi-produk?ok=${encodeURIComponent(res.edited ? "~Spesifikasi diperbarui." : "~Spesifikasi ditambahkan.")}`);
}

export async function deleteSpec(id: string): Promise<FormState> {
  const me = await requirePerm("spesifikasi_produk");
  const res = await guard(async () => {
    const db = await getDb();
    const s = await db.query.productSpecs.findFirst({ where: eq(schema.productSpecs.id, id) });
    if (!s) return { ok: "" };
    await db.delete(schema.productSpecs).where(eq(schema.productSpecs.id, id));
    await logActivity(me, { action: "spesifikasi.hapus", label: "Menghapus spesifikasi produk", summary: `${s.line} · ${s.name}` });
    return { ok: "deleted" };
  });
  if ("error" in res) return res;
  redirect(`/operasional/spesifikasi-produk?ok=${encodeURIComponent("~Spesifikasi dihapus.")}`);
}
