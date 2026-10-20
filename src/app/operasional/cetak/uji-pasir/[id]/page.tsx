import { notFound } from "next/navigation";
import { PrintButton } from "@/components/erp/PrintButton";
import { berkasUrl } from "@/components/ops/receipts/util";
import { testerName } from "@/components/ops/sand/util";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getSandTest } from "@/lib/ops/sand";
import { fmt } from "@/lib/ops/shared/format";
import { DECISION_LABELS, siltVerdict } from "@/lib/ops/shared/sand";
import { getSettings } from "@/lib/settings";
import "./label.css";

export const metadata = { title: "Cetak label uji lumpur", robots: { index: false } };

/** Label A5 seperti kartu "LABORATORIUM BETON" yang ditempel di depan gelas ukur. */
export default async function CetakUjiPasir({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("lihat_uji_pasir", "uji_pasir");
  const { id } = await params;
  const db = await getDb();
  const [row, site] = await Promise.all([getSandTest(db, id), getSettings()]);
  if (!row) notFound();

  const tools = (
    <div className="print-tools no-print">
      <a href="/operasional/uji-pasir" className="btn btn-ghost btn-sm">← Kembali</a>
      {row.status === "selesai" && <PrintButton label="Cetak label (A5)" />}
    </div>
  );
  if (row.status !== "selesai" || row.siltPercent === null) {
    return (
      <div className="print-wrap">
        {tools}
        <p className="alert alert-warn" style={{ maxWidth: 560, margin: "16px auto" }}>Uji belum selesai — label bisa dicetak setelah hasil diisi.</p>
      </div>
    );
  }

  const day = new Date(row.testedAt).toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });
  const date = new Date(row.testedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  const verdict = siltVerdict({ siltPercent: row.siltPercent, maxSiltPercent: row.maxSiltPercent });
  const photos = [row.startPhotoKey, row.photoKey].filter((key): key is string => Boolean(key));
  const company = (site.legal_name || site.company_name || "PT. ISTANA BLOCK PURWAKARTA").toUpperCase();
  const rows: [string, string][] = [
    ["HARI / TANGGAL", `${day} / ${date}`],
    ["MATERIAL", row.sandType],
    ["SUPPLIER", row.supplier || "-"],
    ["QUARRY", row.quarry || "-"],
    ["HASIL PENGUJIAN", `${fmt(row.siltPercent)} %`],
  ];

  return (
    <div className="print-wrap">
      <style>{"@page { size: A5 portrait; margin: 10mm; }"}</style>
      {tools}
      <article className="sand-label">
        <table className="sand-label-table">
          <tbody>
            <tr>
              <td className="sl-logo" rowSpan={2}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/logo-istana-block.webp" alt="" height={62} />
              </td>
              <td className="sl-head">LABORATORIUM BETON</td>
            </tr>
            <tr><td className="sl-head">{company}</td></tr>
            {rows.map(([key, value]) => (
              <tr key={key}>
                <td className="sl-key">{key}<span>:</span></td>
                <td className="sl-val">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={`sl-verdict sl-${verdict.level}`}>
          {verdict.text}
          {row.decision ? ` · Keputusan: ${DECISION_LABELS[row.decision]}` : ""}
        </p>
        <p className="sl-meta">
          Pembacaan: endapan pasir {fmt(row.sandHeight)} {row.readingUnit} · endapan lumpur {fmt(row.siltHeight)} {row.readingUnit}
          {row.vehiclePlate ? ` · Truk ${row.vehiclePlate}` : ""} · Diuji oleh {testerName(row)}
        </p>
        {photos.length > 0 && (
          <div className="sl-photos">
            {photos.map((key) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={key} src={berkasUrl(key)} alt="" />
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
