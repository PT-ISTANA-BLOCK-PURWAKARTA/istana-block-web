import { redirect } from "next/navigation";
import { PrintDoc } from "@/components/erp/PrintDoc";
import { CHECK_STATUS_LABELS, LAYERS, LAYER_LABELS, dayLong, materialText, periodText, qnum } from "@/components/ops/qc/labels";
import { SignBlock } from "@/components/ops/qc/SignBlock";
import "@/components/ops/qc/qc.css";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { isDate } from "@/lib/erp/util";
import { listMixLogs } from "@/lib/ops/qc";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak mix desain", robots: { index: false } };

// Form "Pengimplementasian Mix Desain" per rentang tanggal; satu halaman (A4 landscape) per lapisan. ?from&to[&layer]
export default async function CetakMixDesain({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; layer?: string }> }) {
  await requirePerm("qc", "setujui_qc", "ttd_pimpinan");
  const sp = await searchParams;
  if (!isDate(sp.from) || !isDate(sp.to) || sp.to < sp.from) redirect("/operasional/qc?tab=harian");
  const { from, to } = sp;
  const only = LAYERS.find((l) => l === sp.layer);
  const back = `/operasional/qc?tab=harian&from=${from}&to=${to}`;
  const db = await getDb();
  const [site, logs] = await Promise.all([getSettings(), listMixLogs(db, from, to, only)]);
  const layers = LAYERS.filter((l) => logs.some((x) => x.layer === l));

  return (
    <>
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      {layers.length === 0 && (
        <div className="qc-doc qc-landscape">
          <PrintDoc site={site} title="MIX DESAIN HARIAN" subtitle={`Periode : ${periodText(from, to)}`} back={back}>
            <p>Tidak ada data mix desain pada periode ini.</p>
          </PrintDoc>
        </div>
      )}
      {layers.map((layer) => {
        const rows = logs.filter((x) => x.layer === layer);
        const showReject = layer !== "kepalaan";
        // Satu periode di-ACC oleh satu pemeriksa: pakai ACC terakhir; tanda tangan hanya tampil bila semua baris sudah di-ACC.
        const allApproved = rows.every((x) => x.reviewStatus === "disetujui");
        const approver = rows.filter((x) => x.managerSignedAt).sort((a, b) => b.managerSignedAt!.getTime() - a.managerSignedAt!.getTime())[0];
        return (
          <div className="qc-doc qc-landscape" key={layer}>
            <PrintDoc site={site} title={`PENGIMPLEMENTASIAN MIX DESAIN ${LAYER_LABELS[layer].toUpperCase()} PAVING`} subtitle={`Periode : ${periodText(from, to)}`} back={back}>
              <table className="qc-grid">
                <thead>
                  <tr>
                    <th rowSpan={2}>NO</th><th rowSpan={2}>HARI / TANGGAL</th><th rowSpan={2}>ITEM PEKERJAAN</th><th rowSpan={2}>MIX DESAIN DISETUJUI</th><th rowSpan={2}>MIX DESAIN ACTUAL</th><th rowSpan={2}>MIXING</th>
                    <th colSpan={showReject ? 3 : 2}>HASIL PRODUKSI</th><th rowSpan={2}>STATUS</th><th>TANDA TANGAN</th>
                  </tr>
                  <tr><th>PAPAN</th><th>METER PERSEGI</th>{showReject && <th>REJECT</th>}<th>QC</th></tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id}>
                      <td className="c">{i + 1}</td>
                      <td>{dayLong(row.workDate)}</td>
                      <td>{row.product}</td>
                      <td>{materialText(row.approvedMaterials)}</td>
                      <td>{materialText(row.actualMaterials)}</td>
                      <td className="c">{qnum(row.mixingCount)}</td>
                      <td className="r">{qnum(row.boards)}</td>
                      <td className="r">{qnum(row.squareMeters)}</td>
                      {showReject && <td className="r">{qnum(row.rejects)}</td>}
                      <td>{CHECK_STATUS_LABELS[row.status]}{row.notes && <><br /><small>{row.notes}</small></>}</td>
                      <td>{row.createdByName ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="qc-signs">
                <SignBlock
                  label={"DIPERIKSA OLEH :\nManager"}
                  name={allApproved ? approver?.managerSignedByName : null}
                  at={approver?.managerSignedAt}
                  imageKey={approver?.managerSignatureKey}
                  emptyNote={allApproved ? undefined : "(belum di-ACC semua)"}
                />
              </div>
              <p className="qc-legend">
                <b>Item</b>: nama pekerjaan / bagian yang diperiksa · <b>Desain</b>: spesifikasi yang sudah disetujui · <b>Hasil</b>: kondisi aktual di lapangan · <b>Status</b>: Sesuai, Tidak sesuai, Perlu perbaikan · <b>Catatan</b>: temuan, kendala, revisi.
              </p>
            </PrintDoc>
          </div>
        );
      })}
    </>
  );
}
