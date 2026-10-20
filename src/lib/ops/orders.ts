import "server-only";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@/db";
import { chunk, type DB } from "@/lib/erp/server";

/* ------------------------------------------------------------------ nomor HP */

/** Nomor HP: hanya angka, awalan 62 jadi 0 (sama dengan cleanPhone di shared/zahirInvoice). */
export function normPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits ? digits.replace(/^62/, "0") : "";
}

/** Ekspresi SQL: nomor HP kontak tanpa spasi/tanda baca, untuk dibandingkan dengan akhiran nomor. */
const PHONE_SQL = sql.raw("replace(replace(replace(replace(replace(replace(c.phone, ' ', ''), '-', ''), '+', ''), '.', ''), '(', ''), ')', '')");
const tail = (phone: string) => phone.slice(-8);

/* ------------------------------------------------------------------ anti-dobel impor Zahir */

export type InvoiceOrderHit = { id: string; number: string; status: string; externalRef: string };
export type PhoneOrderHit = { id: string; number: string; status: string; externalRef: string | null; phone: string };

/** PO bukan-batal yang `external_ref`-nya sama dengan salah satu nomor dokumen Zahir. */
export async function findInvoiceOrders(db: DB, refs: string[]): Promise<InvoiceOrderHit[]> {
  const list = Array.from(new Set(refs.map((r) => r.trim()).filter(Boolean)));
  if (!list.length) return [];
  const parts = await Promise.all(
    chunk(list).map((part) =>
      db
        .select({ id: schema.orders.id, number: schema.orders.number, status: schema.orders.status, externalRef: schema.orders.externalRef })
        .from(schema.orders)
        .where(inArray(schema.orders.externalRef, part)),
    ),
  );
  return parts
    .flat()
    .filter((r) => !!r.externalRef && r.status !== "batal")
    .map((r) => ({ id: r.id, number: r.number, status: r.status as string, externalRef: r.externalRef as string }));
}

/** PO aktif (draf, dikonfirmasi, dikirim sebagian) milik pelanggan dengan nomor HP yang sama. */
export async function findActiveOrdersByPhone(db: DB, phones: string[]): Promise<PhoneOrderHit[]> {
  const list = Array.from(new Set(phones.map(normPhone).filter((p) => p.length >= 5)));
  const out: PhoneOrderHit[] = [];
  for (const part of chunk(list, 30)) {
    const like = sql.join(part.map((p) => sql`${PHONE_SQL} like ${`%${tail(p)}`}`), sql` or `);
    const rows = await db.all<{ id: string; number: string; status: string; externalRef: string | null; phone: string }>(sql`
      select o.id, o.number, o.status, o.external_ref externalRef, c.phone
      from ops_orders o join fin_contacts c on c.id = o.contact_id
      where o.status in ('draft','dikonfirmasi','dikirim_sebagian') and (${like})
      order by o.date desc limit 200`);
    for (const r of rows) {
      const p = normPhone(r.phone);
      if (part.includes(p)) out.push({ ...r, phone: p });
    }
  }
  return out;
}

/** Pelanggan (bukan pemasok murni) dengan nomor HP yang sama persis setelah normalisasi. */
export async function findCustomerByPhone(db: DB, phone: string) {
  const p = normPhone(phone);
  if (p.length < 5) return undefined;
  const rows = await db.all<{ id: string; name: string; phone: string; kind: string }>(sql`
    select c.id, c.name, c.phone, c.kind from fin_contacts c
    where c.active = 1 and c.kind <> 'pemasok' and ${PHONE_SQL} like ${`%${tail(p)}`}
    order by c.created_at limit 20`);
  return rows.find((r) => normPhone(r.phone) === p);
}

/* ------------------------------------------------------------------ riwayat hapus PO */

export type OrderDeletionRow = { id: string; number: string; customerName: string; customerPhone: string; reason: string; deletedAt: number; deletedBy: string | null; summary: string };

/** 50 PO terakhir yang dihapus (jejak audit), terbaru dulu. */
export async function recentOrderDeletions(db: DB, limit = 50): Promise<OrderDeletionRow[]> {
  const rows = await db
    .select({ d: schema.orderDeletions, user: schema.users.name })
    .from(schema.orderDeletions)
    .leftJoin(schema.users, eq(schema.users.id, schema.orderDeletions.deletedBy))
    .orderBy(desc(schema.orderDeletions.deletedAt))
    .limit(limit);
  return rows.map(({ d, user }) => {
    const lines = Array.isArray(d.snapshot?.lines) ? (d.snapshot.lines as { name?: string; qty?: number; unit?: string }[]) : [];
    return {
      id: d.id,
      number: d.number,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      reason: d.reason,
      deletedAt: d.deletedAt instanceof Date ? Math.floor(d.deletedAt.getTime() / 1000) : Number(d.deletedAt),
      deletedBy: user,
      summary: lines.map((l) => `${l.qty ?? ""} ${l.unit ?? ""} ${l.name ?? ""}`.trim()).join("; "),
    };
  });
}
