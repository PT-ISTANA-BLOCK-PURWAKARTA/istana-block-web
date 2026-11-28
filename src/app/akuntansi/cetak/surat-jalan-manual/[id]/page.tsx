// Cetak surat jalan manual (IBN / arsip app lama) format Zahir: Lembar Asli + Copy.
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { SuratJalanSheet } from "@/components/erp/SuratJalanSheet";
import { getDb, schema } from "@/db";
import { requireAnyModule } from "@/lib/auth";
import { kopOf, noteLines } from "@/lib/erp/deliveryNote";
import { imageUrl } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { can } from "@/lib/roles";

export const metadata = { title: "Cetak surat jalan", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CetakSuratJalanManual({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAnyModule("keuangan", "anak");
  const { id } = await params;
  const db = await getDb();
  const n = await db.query.deliveryNotes.findFirst({ where: eq(schema.deliveryNotes.id, id) });
  if (!n) notFound();
  // Surat Jalan IBN (U-Ditch): Keuangan atau PIC U-Ditch; surat jalan IB: hanya Keuangan.
  if (!can(me.roles, "keuangan") && !(n.issuer === "ibn" && can(me.roles, "uditch"))) notFound();
  const [site, signer] = await Promise.all([getSettings(), n.signerId ? db.query.users.findFirst({ where: eq(schema.users.id, n.signerId) }) : undefined]);
  return (
    <SuratJalanSheet
      kop={kopOf(n.issuer, site)}
      back={n.issuer === "ibn" ? "/anak-usaha/surat-jalan-ibn" : "/akuntansi/dokumen/surat-jalan?tab=arsip"}
      printedBy={me.name}
      data={{
        issuer: n.issuer, number: n.number, poNumber: n.poNumber, date: n.noteDate, terms: n.terms, reference: null,
        recipient: [n.customerName, n.customerPhone, n.address], note: n.note, lines: noteLines(n.items),
        driverName: n.driverName, plateNumber: n.plate, signerName: n.signerName, signatureUrl: imageUrl(signer?.signatureKey), isInternal: n.isInternal, paid: /lunas/i.test(n.terms ?? ""),
      }}
    />
  );
}
