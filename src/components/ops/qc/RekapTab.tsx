import { PrintButton } from "@/components/erp/PrintButton";
import { fmt } from "@/lib/ops/shared/format";
import type { QcRecap } from "@/lib/ops/qc";
import { CHECK_STATUS_LABELS, LAYER_LABELS, periodText } from "./labels";
import { QcExcelButton, type QcSheet } from "./QcExcel";
import { RangeBar } from "./RangeBar";
import "./qc.css";

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : null);
const pctText = (part: number, total: number) => (total ? `${pct(part, total)}%` : "-");
const round = (v: number | null, digits = 2) => (v === null ? "" : Math.round(v * 10 ** digits) / 10 ** digits);

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="kpi"><span className="k-label">{label}</span><span className="k-value">{value}</span>{hint && <span className="k-sub">{hint}</span>}</div>
  );
}

function sheets(recap: QcRecap): QcSheet[] {
  const mixCols = [
    { key: "days", header: "Hari produksi" }, { key: "logs", header: "Catatan" }, { key: "boards", header: "Papan" }, { key: "m2", header: "m² (badan)" }, { key: "rejects", header: "Reject" },
    { key: "ok", header: "Sesuai" }, { key: "notOk", header: "Tidak sesuai / perbaikan" }, { key: "okPct", header: "% sesuai" }, { key: "approved", header: "Sudah ACC" }, { key: "waiting", header: "Menunggu ACC" }, { key: "revision", header: "Revisi" },
  ];
  const mixRow = (s: QcRecap["mix"]) => ({ days: s.days, logs: s.logs, boards: s.boards, m2: s.m2, rejects: s.rejects, ok: s.ok, notOk: s.notOk, okPct: pct(s.ok, s.logs) ?? "", approved: s.approved, waiting: s.waiting, revision: s.revision });
  return [
    { name: "Mix desain per bulan", title: "Mix desain per bulan", columns: [{ key: "month", header: "Bulan", width: 20 }, ...mixCols], rows: recap.mixMonths.map((m) => ({ month: m.label, ...mixRow(m) })) },
    {
      name: "Mix desain per template", title: "Mix desain per template",
      columns: [{ key: "name", header: "Template", width: 26 }, { key: "layer", header: "Lapisan" }, { key: "product", header: "Produk", width: 24 }, { key: "status", header: "Status template", width: 18 }, ...mixCols],
      rows: recap.mixTemplates.map((t) => ({ name: t.name, layer: LAYER_LABELS[t.layer], product: t.product, status: t.status, ...mixRow(t) })),
    },
    {
      name: "Uji tekan per bulan", title: "Uji kuat tekan per bulan",
      columns: [
        { key: "month", header: "Bulan", width: 20 }, { key: "reports", header: "Laporan" }, { key: "samples", header: "Benda uji" }, { key: "passed", header: "Memenuhi" }, { key: "failed", header: "Belum memenuhi" },
        { key: "pct", header: "% memenuhi" }, { key: "avg", header: "Rata-rata kekuatan (kg/cm²)", width: 24 }, { key: "lab", header: "Diperiksa Lab" }, { key: "leader", header: "TTD Pimpinan" },
      ],
      rows: recap.strengthMonths.map((m) => ({ month: m.label, reports: m.reports, samples: m.samples, passed: m.passed, failed: m.failed, pct: pct(m.passed, m.passed + m.failed) ?? "", avg: round(m.avgStrength), lab: m.labSigned, leader: m.leaderSigned })),
    },
    {
      name: "Uji tekan per produk", title: "Uji kuat tekan per mutu & benda uji",
      columns: [
        { key: "grade", header: "Mutu" }, { key: "name", header: "Benda uji", width: 26 }, { key: "count", header: "Jumlah" }, { key: "passed", header: "Memenuhi" }, { key: "failed", header: "Belum memenuhi" }, { key: "pct", header: "% memenuhi" },
        { key: "age", header: "Rata-rata umur (hari)", width: 20 }, { key: "avg", header: "Rata-rata kekuatan", width: 18 }, { key: "target", header: "Rata-rata target", width: 16 }, { key: "min", header: "Terendah" }, { key: "max", header: "Tertinggi" },
      ],
      rows: recap.strengthProducts.map((p) => ({ grade: p.grade, name: p.name, count: p.count, passed: p.passed, failed: p.failed, pct: pct(p.passed, p.passed + p.failed) ?? "", age: round(p.avgAge, 0), avg: round(p.avgStrength), target: round(p.avgTarget), min: round(p.min), max: round(p.max) })),
    },
    {
      name: "Bulan tanpa uji", title: "Bulan tanpa uji kuat tekan (jadwal sebulan sekali)",
      columns: [{ key: "month", header: "Bulan", width: 20 }, { key: "note", header: "Keterangan", width: 40 }],
      rows: recap.missingStrengthMonths.map((m) => ({ month: m, note: "Belum ada laporan uji kuat tekan" })),
    },
  ];
}

export function RekapTab({ recap, from, to, now }: { recap: QcRecap; from: string; to: string; now: string }) {
  const { mix, strength } = recap;
  return (
    <>
      <div className="qc-bar">
        <RangeBar tab="rekap" kind="rekap" from={from} to={to} now={now} />
        <div className="qc-tools no-print">
          <PrintButton label="Cetak rekap" />
          <QcExcelButton fileName={`Rekap-QC_${from}_sd_${to}.xlsx`} sheets={sheets(recap)} empty="Belum ada data pada periode ini." />
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 8 }}>Periode : {periodText(from, to)}</p>

      <h2 className="qc-stat-title" style={{ marginTop: 0 }}>Rekap mix desain harian</h2>
      <div className="kpis">
        <Stat label="Hari produksi" value={String(mix.days)} hint={`${mix.logs} catatan mix desain`} />
        <Stat label="Hasil produksi" value={`${fmt(mix.boards)} papan`} hint={`${fmt(mix.m2)} m² badan`} />
        <Stat label="Reject" value={fmt(mix.rejects)} hint={mix.boards ? `${fmt((mix.rejects / mix.boards) * 100)}% dari papan` : undefined} />
        <Stat label="Sesuai mix desain" value={pctText(mix.ok, mix.logs)} hint={`${mix.approved} sudah ACC · ${mix.waiting} menunggu${mix.revision ? ` · ${mix.revision} revisi` : ""}`} />
      </div>
      <div className="admin-card stack" style={{ gap: 18, marginBottom: 8 }}>
        <div>
          <b>Per bulan</b>
          {recap.mixMonths.length ? (
            <div className="admin-table" style={{ border: 0, marginTop: 6 }}>
              <table className="qc-table compact">
                <thead><tr><th>Bulan</th><th className="num">Hari produksi</th><th className="num">Catatan</th><th className="num">Papan</th><th className="num">m²</th><th className="num">Reject</th><th className="num">% sesuai</th><th className="num">Sudah ACC</th></tr></thead>
                <tbody>
                  {recap.mixMonths.map((m) => (
                    <tr key={m.key}>
                      <td data-label="Bulan"><b>{m.label}</b></td>
                      <td data-label="Hari produksi" className="num">{m.days}</td><td data-label="Catatan" className="num">{m.logs}</td>
                      <td data-label="Papan" className="num">{fmt(m.boards)}</td><td data-label="m²" className="num">{fmt(m.m2)}</td><td data-label="Reject" className="num">{fmt(m.rejects)}</td>
                      <td data-label="% sesuai" className={`num ${m.notOk ? "text-warn" : "text-sukses"}`}>{pctText(m.ok, m.logs)}{m.notOk ? <div className="small">{m.notOk} {CHECK_STATUS_LABELS.tidak_sesuai.toLowerCase()} / perbaikan</div> : null}</td>
                      <td data-label="Sudah ACC" className="num">{m.approved}/{m.logs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">Belum ada catatan mix desain.</p>
          )}
        </div>
        {recap.mixTemplates.length > 0 && (
          <div>
            <b>Per template mix desain</b>
            <div className="admin-table" style={{ border: 0, marginTop: 6 }}>
              <table className="qc-table compact">
                <thead><tr><th>Template</th><th>Status</th><th className="num">Hari produksi</th><th className="num">Papan</th><th className="num">m²</th><th className="num">Reject</th><th className="num">% sesuai</th></tr></thead>
                <tbody>
                  {recap.mixTemplates.map((t) => (
                    <tr key={t.key}>
                      <td data-label="Template"><b>{t.name}</b><div className="small muted">{LAYER_LABELS[t.layer]} · {t.product}</div></td>
                      <td data-label="Status"><span className={`badge ${t.status === "Sedang dipakai" ? "badge-info" : t.status.startsWith("Gagal") ? "badge-danger" : "badge-off"}`}>{t.status}</span></td>
                      <td data-label="Hari produksi" className="num">{t.days}</td><td data-label="Papan" className="num">{fmt(t.boards)}</td><td data-label="m²" className="num">{fmt(t.m2)}</td>
                      <td data-label="Reject" className="num">{fmt(t.rejects)}</td><td data-label="% sesuai" className="num">{pctText(t.ok, t.logs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <h2 className="qc-stat-title">Rekap uji kuat tekan</h2>
      <div className="kpis">
        <Stat label="Laporan" value={String(strength.reports)} hint={`${strength.samples} benda uji`} />
        <Stat label="Memenuhi target" value={pctText(strength.passed, strength.passed + strength.failed)} hint={`${strength.passed} memenuhi · ${strength.failed} belum`} />
        <Stat label="Rata-rata kekuatan" value={strength.avgStrength === null ? "-" : fmt(strength.avgStrength)} hint="kg/cm²" />
        <Stat label="Tanda tangan" value={`${strength.leaderSigned}/${strength.reports}`} hint={`${strength.labSigned} diperiksa Lab · ${strength.leaderSigned} TTD Pimpinan`} />
      </div>
      {recap.missingStrengthMonths.length > 0 && (
        <p className="flag flag-warn qc-note"><span><b>Bulan tanpa uji kuat tekan</b> (jadwal sebulan sekali): {recap.missingStrengthMonths.join(", ")}</span></p>
      )}
      <div className="admin-card stack" style={{ gap: 18 }}>
        <div>
          <b>Per bulan</b>
          {recap.strengthMonths.length ? (
            <div className="admin-table" style={{ border: 0, marginTop: 6 }}>
              <table className="qc-table compact">
                <thead><tr><th>Bulan</th><th className="num">Laporan</th><th className="num">Benda uji</th><th className="num">Memenuhi</th><th className="num">Belum</th><th className="num">Rata² kekuatan</th><th className="num">Diperiksa Lab</th><th className="num">TTD Pimpinan</th></tr></thead>
                <tbody>
                  {recap.strengthMonths.map((m) => (
                    <tr key={m.key}>
                      <td data-label="Bulan"><b>{m.label}</b></td><td data-label="Laporan" className="num">{m.reports}</td><td data-label="Benda uji" className="num">{m.samples}</td>
                      <td data-label="Memenuhi" className="num text-sukses">{m.passed}</td><td data-label="Belum" className={`num ${m.failed ? "text-bahaya" : "muted"}`}>{m.failed}</td>
                      <td data-label="Rata² kekuatan" className="num">{fmt(m.avgStrength)}</td><td data-label="Diperiksa Lab" className="num">{m.labSigned}/{m.reports}</td><td data-label="TTD Pimpinan" className="num">{m.leaderSigned}/{m.reports}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="small muted">Belum ada laporan uji kuat tekan.</p>
          )}
        </div>
        {recap.strengthProducts.length > 0 && (
          <div>
            <b>Per mutu &amp; benda uji</b>
            <div className="admin-table" style={{ border: 0, marginTop: 6 }}>
              <table className="qc-table compact">
                <thead><tr><th>Mutu</th><th>Benda uji</th><th className="num">Jumlah</th><th className="num">Memenuhi</th><th className="num">Rata² umur</th><th className="num">Rata² kekuatan</th><th className="num">Rata² target</th><th className="num">Terendah – tertinggi</th></tr></thead>
                <tbody>
                  {recap.strengthProducts.map((p) => (
                    <tr key={p.key}>
                      <td data-label="Mutu"><b>{p.grade}</b></td><td data-label="Benda uji">{p.name}</td><td data-label="Jumlah" className="num">{p.count}</td>
                      <td data-label="Memenuhi" className={`num ${p.failed ? "text-warn" : "text-sukses"}`}>{pctText(p.passed, p.passed + p.failed)}</td>
                      <td data-label="Rata² umur" className="num">{fmt(p.avgAge, 0)} hari</td><td data-label="Rata² kekuatan" className="num">{fmt(p.avgStrength)}</td><td data-label="Rata² target" className="num">{fmt(p.avgTarget)}</td>
                      <td data-label="Terendah – tertinggi" className="num">{fmt(p.min)} – {fmt(p.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
