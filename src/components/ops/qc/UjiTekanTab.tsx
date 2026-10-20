import Link from "next/link";
import { approveStrengthTest, deleteStrengthTest, requestStrengthRevision, signStrengthAsLeader } from "@/app/operasional/actions/qc";
import { tglPanjang } from "@/lib/erp/util";
import { qcCan, type StrengthTestRow } from "@/lib/ops/qc";
import type { Role } from "@/lib/roles";
import { qnum } from "./labels";
import { QcActionButton } from "./QcActionButton";
import { QcExcelButton, type QcSheet } from "./QcExcel";
import { RangeBar } from "./RangeBar";
import "./qc.css";

const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

function excelSheet(tests: StrengthTestRow[]): QcSheet {
  return {
    name: "Uji Kuat Tekan",
    columns: [
      { key: "report", header: "Tanggal laporan", width: 14 }, { key: "company", header: "Nama perusahaan", width: 24 }, { key: "grade", header: "Mutu beton", width: 10 },
      { key: "no", header: "No", width: 5 }, { key: "sample", header: "Benda uji", width: 24 }, { key: "made", header: "Tanggal pembuatan", width: 14 },
      { key: "tested", header: "Tanggal ditest", width: 14 }, { key: "age", header: "Umur (hari)", width: 10 }, { key: "weight", header: "Berat (kg)", width: 10 },
      { key: "area", header: "Luas bidang (cm²)", width: 14 }, { key: "load", header: "Tekanan maks (kN)", width: 14 }, { key: "strength", header: "Kekuatan (kg/cm²)", width: 15 },
      { key: "target", header: "Target umur (kg/cm²)", width: 16 }, { key: "result", header: "Hasil", width: 16 }, { key: "lab", header: "Diperiksa lab", width: 18 }, { key: "leader", header: "Mengetahui pimpinan", width: 18 },
    ],
    rows: tests.flatMap((t) =>
      t.samples.map((s, i) => ({
        report: t.reportDate, company: t.companyName, grade: t.concreteGrade, no: i + 1, sample: s.sampleName, made: s.madeAt, tested: s.testedAt, age: s.ageDays,
        weight: s.weightKg, area: s.areaCm2, load: s.maxLoadKn, strength: round2(s.strength), target: round2(s.target),
        result: s.passed === null ? "" : s.passed ? "Memenuhi" : "Belum memenuhi", lab: t.labSignedByName ?? "", leader: t.leaderSignedByName ?? "",
      })),
    ),
  };
}

export function UjiTekanTab({ me, from, to, now, tests }: { me: { id: number; roles: readonly Role[] }; from: string; to: string; now: string; tests: StrengthTestRow[] }) {
  const c = qcCan(me.roles);
  return (
    <>
      <div className="qc-bar">
        <RangeBar tab="uji-tekan" from={from} to={to} now={now} />
        <div className="qc-tools no-print">
          <QcExcelButton fileName={`Uji-Kuat-Tekan_${from}_sd_${to}.xlsx`} sheets={[excelSheet(tests)]} dateKeys={["report", "made", "tested"]} />
          {c.input && <Link href="/operasional/qc/uji-tekan/baru" className="btn btn-primary btn-sm">+ Laporan uji tekan</Link>}
        </div>
      </div>

      {tests.length === 0 && <div className="admin-card muted">Belum ada laporan uji kuat tekan pada periode ini.</div>}
      <div className="qc-tests">
        {tests.map((t) => {
          const passed = t.samples.filter((s) => s.passed === true).length;
          const failed = t.samples.filter((s) => s.passed === false).length;
          const canEdit = c.input && t.reviewStatus !== "disetujui" && (c.editAny || t.createdBy === me.id);
          return (
            <article className="admin-card qc-test" key={t.id}>
              <div className="qc-test-head">
                <div>
                  <div className="qc-eyebrow">{tglPanjang(t.reportDate)} · {t.concreteGrade}</div>
                  <h3>{t.companyName || "Uji internal"}</h3>
                  <div className="small muted">Oleh {t.createdByName ?? "-"}</div>
                </div>
                <div className="qc-row-actions">
                  {passed > 0 && <span className="badge badge-on">{passed} memenuhi</span>}
                  {failed > 0 && <span className="badge badge-danger">{failed} belum</span>}
                </div>
              </div>
              <div className="admin-table" style={{ border: 0 }}>
                <table className="compact">
                  <thead><tr><th>Benda uji</th><th>Umur</th><th className="num">kN</th><th className="num">kg/cm²</th><th className="num">Target</th></tr></thead>
                  <tbody>
                    {t.samples.map((s) => (
                      <tr key={s.id}>
                        <td>{s.sampleName}</td>
                        <td>{s.ageDays ?? "-"} hr</td>
                        <td className="num">{qnum(s.maxLoadKn) || "-"}</td>
                        <td className={`num ${s.passed === null ? "" : s.passed ? "text-sukses" : "text-bahaya"}`}><b>{qnum(s.strength) || "-"}</b></td>
                        <td className="num muted">{qnum(s.target) || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="small">
                {t.reviewStatus === "disetujui" && <div className="qc-ok">✓ Diperiksa Lab: {t.labSignedByName ?? ""}</div>}
                {t.reviewStatus === "revisi" && <div className="qc-revise"><b>Perlu revisi</b>{t.reviewNote ? `: ${t.reviewNote}` : ""}</div>}
                {t.reviewStatus === "menunggu" && <div className="qc-wait">⏳ Menunggu ACC</div>}
                {t.reviewStatus === "disetujui" && (t.leaderSignedByName ? <div className="qc-ok">✓ Mengetahui Pimpinan: {t.leaderSignedByName}</div> : <div className="qc-wait">⏳ Menunggu tanda tangan Pimpinan</div>)}
              </div>
              <div className="qc-row-actions">
                <Link href={`/operasional/cetak/qc/uji-tekan/${t.id}`} target="_blank" className="btn btn-ghost btn-sm">Cetak</Link>
                {c.approve && t.reviewStatus !== "disetujui" && <QcActionButton className="btn btn-blue btn-sm" label="ACC (Diperiksa Lab)" action={approveStrengthTest.bind(null, t.id)} />}
                {c.approve && t.reviewStatus === "menunggu" && <QcActionButton label="Revisi" promptText="Catatan revisi untuk QC (apa yang harus diperbaiki?)" promptRequired action={requestStrengthRevision.bind(null, t.id)} />}
                {c.sign && t.reviewStatus === "disetujui" && !t.leaderSignedAt && <QcActionButton className="btn btn-blue btn-sm" label="TTD Pimpinan" confirmText="Tanda tangani laporan ini sebagai Mengetahui Pimpinan?" action={signStrengthAsLeader.bind(null, t.id)} />}
                {canEdit && <Link href={`/operasional/qc/uji-tekan/${t.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
                {canEdit && <QcActionButton className="link-btn" label="Hapus" confirmText="Hapus laporan ini?" action={deleteStrengthTest.bind(null, t.id)} />}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
