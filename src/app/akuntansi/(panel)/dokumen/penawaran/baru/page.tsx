// Surat penawaran baru / ubah (?id=) / salin (?salin=).
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { QuotationForm } from "@/components/erp/QuotationForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { getDb, schema } from "@/db";
import { requireModule } from "@/lib/auth";
import { emptyQuotation, LAST_MANUAL_QUOTATION_SEQ, quotationFormOf, quotationNumber } from "@/lib/erp/quotation";
import { documentSigners, productNames } from "@/lib/erp/signers";
import { today } from "@/lib/erp/util";

export const metadata = { title: "Surat Penawaran" };
export const dynamic = "force-dynamic";

export default async function PenawaranBaru({ searchParams }: { searchParams: Promise<{ id?: string; salin?: string }> }) {
  await requireModule("keuangan");
  const sp = await searchParams;
  const db = await getDb();
  const srcId = sp.id || sp.salin;
  const src = srcId ? await db.query.quotations.findFirst({ where: eq(schema.quotations.id, srcId) }) : undefined;
  if (srcId && !src) notFound();
  const [signers, products, m] = await Promise.all([documentSigners(db), productNames(db), db.get<{ s: number }>(sql`select coalesce(max(seq), 0) s from ops_quotations`)]);
  const day = today();
  const initial = src ? quotationFormOf(src, !sp.id, day) : emptyQuotation(day);
  const next = quotationNumber(Math.max(LAST_MANUAL_QUOTATION_SEQ, Number(m?.s ?? 0)) + 1, day);
  return (
    <>
      <BackLink href={sp.id ? `/akuntansi/dokumen/penawaran/${sp.id}` : "/akuntansi/dokumen/penawaran"}>Surat Penawaran</BackLink>
      <PageHead title={sp.id ? `Ubah ${src?.number}` : sp.salin ? `Salin dari ${src?.number}` : "Surat penawaran baru"} />
      <QuotationForm initial={initial} signers={signers} products={products} nextNumber={next} />
    </>
  );
}
