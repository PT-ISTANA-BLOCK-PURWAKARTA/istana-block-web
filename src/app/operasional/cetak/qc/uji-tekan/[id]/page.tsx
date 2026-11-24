import { notFound } from "next/navigation";
import { PrintDoc } from "@/components/erp/PrintDoc";
import { dateShort, qnum } from "@/components/ops/qc/labels";
import { SignBlock } from "@/components/ops/qc/SignBlock";
import "@/components/ops/qc/qc.css";
import { getDb } from "@/db";
import { requirePerm } from "@/lib/auth";
import { getStrengthTest } from "@/lib/ops/qc";
import { batchAverages, standardTable, STANDARD_AREA_CM2 } from "@/lib/ops/shared/strength";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Cetak uji kuat tekan", robots: { index: false } };

// Form "Hasil Uji Kuat Tekan Beton" + tabel standarisasi 3/14/21/28 hari + tanda tangan bergambar (Lab & Pimpinan).
export default async function CetakUjiTekan({ params }: { params: Promise<{ id: string }> }) {
  await requirePerm("qc", "qc_beton", "setujui_qc", "ttd_pimpinan");
  const { id } = await params;
  const db = await getDb();
  const [site, test] = await Promise.all([getSettings(), getStrengthTest(db, id)]);
  if (!test) notFound();
  const area = test.samples.find((s) => s.areaCm2)?.areaCm2 ?? STANDARD_AREA_CM2;
  const standard = standardTable(test.concreteGrade, area);
  const batches = batchAverages(test.concreteGrade, test.samples);

  return (
    <div className="qc-portrait">
      <PrintDoc site={site} title="HASIL UJI KUAT TEKAN BETON" subtitle="Lab. Istana Block Purwakarta" back="/operasional/qc?tab=uji-tekan">
        <table className="qc-meta">
          <tbody><tr><td>Tanggal laporan</td><td>: {dateShort(test.reportDate)}</td></tr></tbody>
        </table>
        <table className="qc-grid">
          <thead>
            <tr>
              <th rowSpan={2}>NO</th><th rowSpan={2}>BENDA UJI</th><th colSpan={2}>TANGGAL</th><th rowSpan={2}>UMUR HARI</th><th rowSpan={2}>BERAT ( KG )</th><th rowSpan={2}>LUAS BIDANG (cm²)</th>
              <th>TEKANAN</th><th>KEKUATAN</th><th rowSpan={2}>TARGET UMUR (kg/cm²)</th><th rowSpan={2}>HASIL</th>
            </tr>
            <tr><th>PEMBUATAN</th><th>DITEST</th><th>MAKSIMUM (Kn)</th><th>(KG /Cm2)</th></tr>
          </thead>
          <tbody>
            {test.samples.map((s, i) => (
              <tr key={s.id}>
                <td className="c">{i + 1}</td>
                <td>
                  {s.sampleName}
                  {s.batchCode && <div style={{ fontSize: 10, color: "#555" }}>Batch: {s.batchCode}</div>}
                </td>
                <td className="c">{dateShort(s.madeAt)}</td>
                <td className="c">{dateShort(s.testedAt)}</td>
                <td className="c">{s.ageDays ?? ""}</td>
                <td className="r">{qnum(s.weightKg)}</td>
                <td className="r">{qnum(s.areaCm2)}</td>
                <td className="r">{qnum(s.maxLoadKn)}</td>
                <td className="r"><b>{qnum(s.strength)}</b></td>
                <td className="r">{qnum(s.target)}</td>
                <td className={`c ${s.passed === null ? "" : s.passed ? "pass" : "fail"}`}>{s.passed === null ? "-" : s.passed ? "MEMENUHI" : "BELUM"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {batches.length > 0 && (
          <table className="qc-grid">
            <thead>
              <tr><th colSpan={7}>RATA-RATA PER BATCH &amp; FASE UMUR (≥ 2 SAMPEL)</th></tr>
              <tr><th>BATCH / BENDA UJI</th><th>SAMPEL</th><th>TGL TEST</th><th>UMUR</th><th>TEKANAN RATA² (Kn)</th><th>KEKUATAN RATA² (kg/cm²)</th><th>HASIL</th></tr>
            </thead>
            <tbody>
              {batches.map((b, idx) => (
                <tr key={idx}>
                  <td>{b.batch || b.name}</td>
                  <td className="c">{b.count}</td>
                  <td className="c">{dateShort(b.testedAt instanceof Date ? b.testedAt.toISOString().slice(0, 10) : (b.testedAt ?? null))}</td>
                  <td className="c">{b.ageDays ?? "-"} HARI</td>
                  <td className="r">{qnum(b.maxLoadKn)}</td>
                  <td className="r"><b>{qnum(b.strength)}</b>{b.target ? ` (target ${qnum(b.target)})` : ""}</td>
                  <td className={`c ${b.passed === null ? "" : b.passed ? "pass" : "fail"}`}>{b.passed === null ? "-" : b.passed ? "MEMENUHI" : "BELUM"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ margin: 0 }}>hasil uji tekan beton berdasarkan sample yang dikirim ke Lab.Istana Block Purwakarta</p>
        <div className="qc-two">
          <div className="stack" style={{ gap: 8 }}>
            <table className="qc-meta">
              <tbody>
                <tr><td>Nama Perusahaan</td><td>: {test.companyName}</td></tr>
                <tr><td>Alamat</td><td>: {test.address}</td></tr>
                <tr><td>Mutu Beton</td><td>: {test.concreteGrade}</td></tr>
                <tr><td>Tertuju</td><td>: {test.addressedTo}</td></tr>
              </tbody>
            </table>
            {test.composition.length > 0 && (
              <table className="qc-grid" style={{ width: "auto" }}>
                <thead><tr><th>CATATAN</th><th>JUMLAH</th></tr></thead>
                <tbody>
                  {test.composition.map((m, i) => (
                    <tr key={i}><td>{m.name.toUpperCase()}</td><td className="r">{qnum(m.qty)} {m.unit}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {test.notes && <p style={{ margin: 0 }}><b>Note:</b> {test.notes}</p>}
          </div>
          <table className="qc-grid">
            <thead>
              <tr><th colSpan={3}>STANDARISASI ({test.concreteGrade})</th></tr>
              <tr><th>UMUR</th><th>TEKANAN MAKSIMUM (Kn)</th><th>KEKUATAN (KG/Cm2)</th></tr>
            </thead>
            <tbody>
              {standard.map((row) => (
                <tr key={row.days}><td className="c">{row.days} HARI</td><td className="r">{qnum(row.maxLoadKn)}</td><td className="r">{qnum(row.strength)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="qc-signs">
          <SignBlock label="Diperiksa Lab Pengujian" name={test.labSignedByName} at={test.labSignedAt} imageKey={test.labSignatureKey} />
          <SignBlock label="Mengetahui Pimpinan" name={test.leaderSignedByName} at={test.leaderSignedAt} imageKey={test.leaderSignatureKey} />
        </div>
      </PrintDoc>
    </div>
  );
}
