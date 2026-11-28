// Cetak surat jalan dari invoice (pengiriman ops_deliveries) format Zahir: Lembar Asli + Copy, tanpa harga.
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SuratJalanSheet } from "@/components/erp/SuratJalanSheet";
import { getDb, schema } from "@/db";
import { requireAnyModule } from "@/lib/auth";
import { can } from "@/lib/roles";
import { kopOf } from "@/lib/erp/deliveryNote";
import { deliveryItems } from "@/lib/erp/ops";
import { imageUrl } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak surat jalan", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CetakSuratJalan({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAnyModule("keuangan", "anak");
  const { id } = await params;
  const db = await getDb();
  const d = await db.query.deliveries.findFirst({ where: eq(schema.deliveries.id, id) });
  if (!d) notFound();
  // Surat jalan U-Ditch (SJ-UD/…) boleh dicetak PIC U-Ditch; surat jalan IB hanya Keuangan.
  const ud = d.number.startsWith("SJ-UD/");
  if (!can(me.roles, "keuangan") && !(ud && can(me.roles, "uditch"))) notFound();
  const order = await db.query.orders.findFirst({ where: eq(schema.orders.id, d.orderId) });
  const [site, contact, vehicle, driver, items, inv] = await Promise.all([
    getSettings(),
    order ? db.query.contacts.findFirst({ where: eq(schema.contacts.id, order.contactId) }) : undefined,
    d.vehicleId ? db.query.vehicles.findFirst({ where: eq(schema.vehicles.id, d.vehicleId) }) : undefined,
    d.driverId ? db.query.drivers.findFirst({ where: eq(schema.drivers.id, d.driverId) }) : undefined,
    deliveryItems(db, [id]),
    db.get<{ number: string; issuer: string; status: string; paid_amount: number | null; payment_method: string | null; signer_id: number | null; signer_name: string | null }>(sql`select number, issuer, status, paid_amount, payment_method, signer_id, signer_name from ops_sales_invoices where order_id = ${d.orderId} limit 1`),
  ]);
  const signer = inv?.signer_id ? await db.query.users.findFirst({ where: eq(schema.users.id, inv.signer_id) }) : undefined;
  const terms = !inv ? null : !inv.paid_amount ? "Belum bayar" : /tunai/i.test(inv.payment_method ?? "") ? "Cash/Tunai" : /transfer/i.test(inv.payment_method ?? "") ? "Transfer" : inv.status === "lunas" ? "Lunas" : "DP";
  return (
    <SuratJalanSheet
      kop={kopOf(inv?.issuer ?? "ib", site)}
      back={ud ? "/anak-usaha/surat-jalan-uditch" : `/akuntansi/dokumen/surat-jalan/${d.id}`}
      printedBy={me.name}
      data={{
        issuer: inv?.issuer ?? "ib", number: d.number, poNumber: order?.customerRef || order?.number || null, date: d.date, terms,
        reference: inv ? { label: "No Faktur", value: inv.number } : null,
        recipient: [contact?.company || contact?.name, order?.siteContact || contact?.phone, order?.address || contact?.address],
        note: [d.status === "batal" ? "DIBATALKAN — dokumen ini tidak berlaku." : null, order ? `PO kirim: ${order.number}` : null, d.note || null].filter(Boolean).join("\n"),
        lines: (items.get(id) ?? []).map((l) => ({ quantity: l.qty, unit: l.unit, name: l.name })),
        driverName: driver?.name ?? null, plateNumber: vehicle?.plate ?? null, signerName: inv?.signer_name ?? null, signatureUrl: imageUrl(signer?.signatureKey), isInternal: order?.isInternal, paid: inv?.status === "lunas",
      }}
    />
  );
}
