import { notFound } from "next/navigation";
import { PrintButton } from "@/components/erp/PrintButton";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { buildPayslipA5Html, getPayslipByIdWithMeta, PAYSLIP_A5_STYLE } from "@/lib/ops/payslip";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak slip gaji (A5)", robots: { index: false } };

export default async function CetakSlipGaji({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("keuangan");
  const { id } = await params;
  const db = await getDb();
  const [slip, site] = await Promise.all([getPayslipByIdWithMeta(db, id), getSettings()]);
  if (!slip) notFound();

  const html = buildPayslipA5Html([slip], site);

  return (
    <div className="print-wrap">
      <style>{PAYSLIP_A5_STYLE}</style>
      <div className="print-tools no-print" style={{ maxWidth: "148mm" }}>
        <a href="/operasional/gaji" className="btn btn-ghost btn-sm">
          ← Kembali ke Gaji
        </a>
        <PrintButton label="Cetak / Simpan PDF (A5)" />
      </div>
      <div className="ps-sheet-list" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
