"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { opsAccess } from "@/lib/erp/ops";

/** "Paving Bata 6cm|19|pcs|85000" per baris -> baris items */
function items(teks: string) {
  return teks
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, qty, unit, price] = l.split("|").map((x) => x.trim());
      const q = Number(qty) || 0, p = Number(price) || 0;
      return { name: name || "-", qty: q, unit: unit || "", price: p, total: q * p };
    });
}

async function boleh() {
  const { user, canShip } = await opsAccess();
  if (!canShip) throw new Error("Tidak berhak membuat surat jalan.");
  return user;
}

export async function buatSuratJalan(fd: FormData) {
  const user = await boleh();
  const pelanggan = String(fd.get("pelanggan") || "").trim();
  const tanggal = String(fd.get("tanggal") || "").trim();
  const baris = items(String(fd.get("items") || ""));
  if (!pelanggan || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !baris.length)
    throw new Error("Pelanggan, tanggal, dan minimal satu barang wajib diisi.");
  const db = await getDb();
  const n = await db.all<{ n: number }>(sql`select count(*) n from ops_delivery_notes where issuer = 'ib'`);
  const seq = (n[0]?.n ?? 0) + 1;
  await db.insert(schema.deliveryNotes).values({
    issuer: "ib",
    seq,
    number: String(seq).padStart(3, "0"),
    noteDate: tanggal,
    customerName: pelanggan,
    customerPhone: String(fd.get("telepon") || "").trim() || null,
    address: String(fd.get("alamat") || "").trim() || null,
    poNumber: String(fd.get("po") || "").trim() || null,
    driverName: String(fd.get("sopir") || "").trim() || null,
    plate: String(fd.get("plat") || "").trim() || null,
    terms: String(fd.get("termin") || "").trim() || null,
    items: baris,
    signerName: String(fd.get("penandaTangan") || "").trim() || null,
    createdBy: user.id,
    createdByName: user.name,
  });
  revalidatePath("/operasional/surat-jalan");
}

export async function hapusSuratJalan(fd: FormData) {
  await boleh();
  const id = String(fd.get("id") || "");
  if (!id) return;
  const db = await getDb();
  await db.delete(schema.deliveryNotes).where(eq(schema.deliveryNotes.id, id));
  revalidatePath("/operasional/surat-jalan");
}
