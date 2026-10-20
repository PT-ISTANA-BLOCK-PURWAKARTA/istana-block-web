import Link from "next/link";
import { approveMixLogs, deleteMixLog, requestMixLogRevision } from "@/app/operasional/actions/qc";
import { Kpis } from "@/components/erp/ui";
import type { MaterialLine } from "@/db/erp";
import { fmt } from "@/lib/ops/shared/format";
import type { Role } from "@/lib/roles";
import { isInUse, missingMixDays, qcCan, type MixDesignRow, type MixLogRow } from "@/lib/ops/qc";
import { CHECK_STATUS_LABELS, LAYERS, LAYER_LABELS, REVIEW_LABELS, dayLong, dayShort, materialText, periodText } from "./labels";
import { QcActionButton } from "./QcActionButton";
import { QcExcelButton, type QcSheet } from "./QcExcel";
import { RangeBar } from "./RangeBar";
import { TodayPanel, type TodayLayer } from "./TodayPanel";
import "./qc.css";

const TONE = { sesuai: "badge-on", tidak_sesuai: "badge-danger", perlu_perbaikan: "badge-warn" } as const;

function Review({ log }: { log: MixLogRow }) {
  if (log.reviewStatus === "disetujui") return <div className="qc-ok">✓ ACC {log.managerSignedByName ?? ""}</div>;
  if (log.reviewStatus === "revisi") return <div className="qc-revise"><b>Perlu revisi</b>{log.reviewNote ? `: ${log.reviewNote}` : ""}</div>;
  return <div className="qc-wait">⏳ {REVIEW_LABELS.menunggu}</div>;
}

const differs = (log: MixLogRow) =>
  log.actualMaterials.some((a: MaterialLine) => {
    const ap = log.approvedMaterials.find((m) => m.name === a.name);
    return a.qty !== null && ap?.qty !== null && ap?.qty !== undefined && a.qty !== ap.qty;
  });

/** Sheet Excel per lapisan, kolom seperti berkas aplikasi lama. */
function excelSheets(logs: MixLogRow[], from: string, to: string): QcSheet[] {
  return LAYERS.map((layer) => ({
    name: LAYER_LABELS[layer].toUpperCase(),
    title: `ISTANA BLOCK PURWAKARTA · PENGIMPLEMENTASIAN MIX DESAIN ${LAYER_LABELS[layer].toUpperCase()} PAVING · Periode : ${periodText(from, to)}`,
    columns: [
      { key: "no", header: "NO", width: 5 }, { key: "date", header: "HARI / TANGGAL", width: 22 }, { key: "product", header: "ITEM PEKERJAAN", width: 24 },
      { key: "approved", header: "MIX DESAIN DISETUJUI", width: 45 }, { key: "actual", header: "MIX DESAIN ACTUAL", width: 45 }, { key: "mixing", header: "MIXING", width: 8 },
      { key: "boards", header: "PAPAN", width: 8 }, { key: "m2", header: "METER PERSEGI", width: 12 }, { key: "reject", header: "REJECT", width: 8 },
      { key: "status", header: "STATUS", width: 15 }, { key: "notes", header: "CATATAN", width: 30 }, { key: "qc", header: "QC", width: 16 },
      { key: "acc", header: "ACC", width: 16 }, { key: "checker", header: "DIPERIKSA OLEH", width: 16 },
    ],
    rows: logs.filter((l) => l.layer === layer).map((l, i) => ({
      no: i + 1, date: l.workDate, product: l.product, approved: materialText(l.approvedMaterials), actual: materialText(l.actualMaterials),
      mixing: l.mixingCount, boards: l.boards, m2: l.squareMeters, reject: l.rejects, status: CHECK_STATUS_LABELS[l.status], notes: l.notes,
      qc: l.createdByName ?? "", acc: REVIEW_LABELS[l.reviewStatus], checker: l.managerSignedByName ?? "",
    })),
  }));
}

export function HarianTab({
  me, from, to, now, logs, designs, todayCounts,
}: {
  me: { id: number; roles: readonly Role[] };
  from: string;
  to: string;
  now: string;
  logs: MixLogRow[];
  designs: MixDesignRow[];
  /** Jumlah catatan hari ini per lapisan (hanya untuk pemegang izin qc). */
  todayCounts: Record<string, number>;
}) {
  const c = qcCan(me.roles);
  const totals = {
    boards: logs.reduce((s, l) => s + (l.boards ?? 0), 0),
    m2: logs.filter((l) => l.layer !== "kepalaan").reduce((s, l) => s + (l.squareMeters ?? 0), 0),
    rejects: logs.reduce((s, l) => s + (l.rejects ?? 0), 0),
    notOk: logs.filter((l) => l.status !== "sesuai").length,
  };
  const waiting = logs.filter((l) => l.reviewStatus === "menunggu").map((l) => l.id);
  const gaps = missingMixDays(logs, from, to);
  const todayLayers: TodayLayer[] = (["badan", "kepalaan"] as const).map((layer) => ({
    layer,
    label: LAYER_LABELS[layer],
    done: todayCounts[layer] ?? 0,
    designs: designs.filter((d) => d.layer === layer && isInUse(d)).map((d) => ({ id: d.id, name: d.name, product: d.product, text: materialText(d.materials) })),
  }));
  const todayTitle = new Date(`${now}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const printHref = `/operasional/cetak/qc/mix?from=${from}&to=${to}`;
  const layersWithLogs = LAYERS.filter((layer) => logs.some((l) => l.layer === layer));

  return (
    <>
      {c.input && <TodayPanel title={todayTitle} layers={todayLayers} />}
      <div className="qc-bar">
        <RangeBar tab="harian" from={from} to={to} now={now} />
        <div className="qc-tools no-print">
          <Link href={printHref} target="_blank" className="btn btn-ghost btn-sm">Cetak form</Link>
          <QcExcelButton fileName={`Mix-Desain_${from}_sd_${to}.xlsx`} sheets={excelSheets(logs, from, to)} dateKeys={["date"]} dateNF="dddd, dd/mm/yyyy" />
          {c.input && <Link href="/operasional/qc/harian/baru" className="btn btn-primary btn-sm">+ Isi mix desain</Link>}
        </div>
      </div>

      <Kpis
        items={[
          { label: "Total papan", value: fmt(totals.boards) },
          { label: "Total m² (badan)", value: fmt(totals.m2) },
          { label: "Total reject", value: fmt(totals.rejects) },
          { label: "Tidak sesuai / perlu perbaikan", value: totals.notOk, tone: totals.notOk ? "warn" : undefined },
        ]}
      />

      {gaps.length > 0 && (
        <p className="flag flag-warn qc-note">
          <span><b>Hari tanpa catatan mix desain</b> (abaikan bila tidak ada produksi): {gaps.map((g) => `${dayShort(g.date)} (${g.layers.map((l) => LAYER_LABELS[l].toLowerCase()).join(" & ")})`).join(" · ")}</span>
        </p>
      )}

      {c.approve && waiting.length > 0 && (
        <div className="flag flag-info qc-note" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <span><b>{waiting.length}</b> data mix desain periode ini menunggu ACC Anda.{waiting.length > 200 && " (maksimal 200 data sekali ACC)"}</span>
          <QcActionButton className="btn btn-blue btn-sm" label={`ACC semua (${Math.min(waiting.length, 200)})`} confirmText={`ACC & tanda tangani ${Math.min(waiting.length, 200)} data sebagai "Diperiksa oleh"?`} action={approveMixLogs.bind(null, waiting.slice(0, 200))} />
        </div>
      )}

      {layersWithLogs.length === 0 && (
        <div className="admin-card muted">Belum ada data mix desain pada periode ini.</div>
      )}
      {layersWithLogs.map((layer) => {
        const rows = logs.filter((l) => l.layer === layer);
        const showReject = layer !== "kepalaan";
        return (
          <div className="admin-table" key={layer} style={{ marginBottom: 16 }}>
            <table className="qc-table">
              <caption>Mix desain {LAYER_LABELS[layer].toLowerCase()} paving</caption>
              <thead>
                <tr>
                  <th>Hari / tanggal</th><th>Item pekerjaan</th><th>Disetujui</th><th>Actual</th><th className="num">Mixing</th><th className="num">Papan</th><th className="num">m²</th>
                  {showReject && <th className="num">Reject</th>}
                  <th>Status</th><th>QC / TTD</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((log) => {
                  const mine = log.createdBy === me.id;
                  const canEdit = c.input && log.reviewStatus !== "disetujui" && (c.editAny || mine);
                  return (
                    <tr key={log.id}>
                      <td data-label="Hari / tanggal"><b>{dayLong(log.workDate)}</b></td>
                      <td data-label="Item pekerjaan">{log.product}</td>
                      <td data-label="Disetujui" className="qc-mat-text">{materialText(log.approvedMaterials) || "-"}</td>
                      <td data-label="Actual" className={differs(log) ? "qc-diff qc-mat-text" : "qc-mat-text"}>{materialText(log.actualMaterials) || "-"}</td>
                      <td data-label="Mixing" className="num">{fmt(log.mixingCount)}</td>
                      <td data-label="Papan" className="num">{fmt(log.boards)}</td>
                      <td data-label="m²" className="num">{fmt(log.squareMeters)}</td>
                      {showReject && <td data-label="Reject" className="num">{fmt(log.rejects)}</td>}
                      <td data-label="Status">
                        <span className={`badge ${TONE[log.status]}`}>{CHECK_STATUS_LABELS[log.status]}</span>
                        {log.notes && <div className="small muted">{log.notes}</div>}
                      </td>
                      <td data-label="QC / TTD" className="small">{log.createdByName ?? "-"}<Review log={log} /></td>
                      <td>
                        <div className="qc-row-actions">
                          {c.approve && log.reviewStatus !== "disetujui" && (
                            <QcActionButton className="btn btn-blue btn-sm" label="ACC" action={approveMixLogs.bind(null, [log.id])} />
                          )}
                          {c.approve && log.reviewStatus === "menunggu" && (
                            <QcActionButton label="Revisi" promptText="Catatan revisi untuk QC (apa yang harus diperbaiki?)" promptRequired action={requestMixLogRevision.bind(null, log.id)} />
                          )}
                          {canEdit && <Link href={`/operasional/qc/harian/${log.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
                          {canEdit && <QcActionButton className="link-btn" label="Hapus" confirmText="Hapus data ini?" action={deleteMixLog.bind(null, log.id)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
