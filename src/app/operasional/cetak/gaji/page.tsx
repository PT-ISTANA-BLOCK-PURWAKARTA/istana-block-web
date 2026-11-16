import { PrintButton } from "@/components/erp/PrintButton";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { buildPayslipA5Html, getPayslipsWithMeta, PAYSLIP_A5_STYLE, periodText } from "@/lib/ops/payslip";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak semua slip gaji (A5)", robots: { index: false } };

export default async function CetakSemuaGaji({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; month?: string; search?: string }>;
}) {
  await requirePerm("keuangan");
  const { from, to, month, search } = await searchParams;
  const db = await getDb();
  const [slips, site] = await Promise.all([
    getPayslipsWithMeta(db, { from, to, month, search }),
    getSettings(),
  ]);

  const ordered = [...slips].reverse();
  const html = buildPayslipA5Html(ordered, site);
  const subtitle = month
    ? `Bulan ${month}`
    : from || to
      ? periodText(from, to)
      : `${ordered.length} slip`;

  return (
    <div className="print-wrap">
      <style>{PAYSLIP_A5_STYLE}</style>
      <div className="print-tools no-print" style={{ maxWidth: "148mm" }}>
        <a href="/operasional/gaji" className="btn btn-ghost btn-sm">
          ← Kembali ke Gaji
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="small muted">{ordered.length} slip · {subtitle}</span>
          {ordered.length > 0 && <PrintButton label="Cetak / Simpan PDF (A5)" />}
        </div>
      </div>
      {ordered.length === 0 ? (
        <p className="alert alert-warn" style={{ maxWidth: "148mm", margin: "16px auto" }}>
          Tidak ada slip gaji yang cocok dengan filter cetak ini.
        </p>
      ) : (
        <div className="ps-sheet-list" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
