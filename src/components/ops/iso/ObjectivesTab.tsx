import Link from "next/link";
import type { ReactNode } from "react";
import { OBJECTIVE_GROUPS } from "@/lib/ops/shared/isoObjectives";
import { formatNumber, monthLabel, objectiveRows, objectiveSummary, type DayRange, type IsoOverview } from "@/lib/ops/shared/isoRecap";
import { Chip } from "./Chip";
import { isoUrl } from "./url";

/** Tab Sasaran Mutu (F-IB-16): 30 sasaran, angka otomatis dari data aplikasi, sisanya isian manual per bulan. */
export function ObjectivesTab({ overview, range, canEdit, defaultMonth, editor }: { overview: IsoOverview; range: DayRange; canEdit: boolean; defaultMonth: string; editor: ReactNode }) {
  const rows = objectiveRows(overview);
  const summary = objectiveSummary(rows);
  return (
    <div className="stack" style={{ gap: 16 }}>
      {editor}
      <div className="iso-chips">
        <span><b className="text-sukses">{summary.reached}</b> dari 30 sasaran <Chip text="TERCAPAI" /></span>
        <span><b className="text-bahaya">{summary.missed}</b> <Chip text="BELUM TERCAPAI" /></span>
        <span><b>{summary.empty}</b> <Chip text="BELUM DIISI" /></span>
      </div>
      <p className="small muted">
        <b>{rows.filter((row) => row.auto).length} sasaran</b> dihitung otomatis dari data aplikasi. Sisanya (chat WA, survei, ulasan Google, dimensi, dll.) diisi angkanya per bulan
        {canEdit ? " dengan tautan “Isi”" : " oleh QC / kantor"}; rentang beberapa bulan menjumlahkan angka bulanannya.
      </p>
      {OBJECTIVE_GROUPS.map((group) => (
        <div key={group.id} className="admin-table">
          <table style={{ minWidth: 760 }}>
            <caption style={{ textAlign: "left", fontSize: 13, letterSpacing: ".03em", fontWeight: 700, color: "var(--biru-tua)" }}>{group.title}</caption>
            <thead>
              <tr><th>No</th><th>Sasaran mutu</th><th className="num">Target</th><th className="num">Total</th><th className="num">Tercapai</th><th className="num">%</th><th>Status</th><th>Sumber</th></tr>
            </thead>
            <tbody>
              {rows.filter((row) => row.group === group.id).map((row) => (
                <tr key={row.no} style={{ verticalAlign: "top" }}>
                  <td className="muted"><b>{row.no}</b></td>
                  <td style={{ minWidth: 280 }}>
                    <b>{row.text}</b>
                    <span className="small muted" style={{ display: "block" }}>{row.basis} · {row.period} · PJ {row.pic}</span>
                  </td>
                  <td className="num">{row.targetLabel}</td>
                  <td className="num">{row.total === null ? "-" : formatNumber(row.total)}</td>
                  <td className="num">{row.achieved === null ? "-" : formatNumber(row.achieved)}</td>
                  <td className="num"><b>{formatNumber(row.percent, "percent")}</b></td>
                  <td><Chip text={row.status} /></td>
                  <td className="small" style={{ minWidth: 200 }}>
                    {row.auto ? (
                      <span className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
                        <span><b className="text-sukses">Otomatis</b> · <span className="muted">{row.dataSource}</span></span>
                        {row.manualAchieved && row.months.length > 0 && <span className="muted">Tercapai manual: {row.months.map(monthLabel).join(", ")}</span>}
                        {row.manualAchieved && canEdit && <Link href={isoUrl({ range, tab: "sasaran" }, { isi: String(row.no), bulan: defaultMonth })} className="btn btn-ghost btn-sm">Isi tercapai</Link>}
                      </span>
                    ) : (
                      <span className="stack" style={{ gap: 4, alignItems: "flex-start" }}>
                        <span className="muted">{row.months.length ? `Manual: ${row.months.map(monthLabel).join(", ")}` : "Manual (belum diisi)"}</span>
                        {canEdit && <Link href={isoUrl({ range, tab: "sasaran" }, { isi: String(row.no), bulan: defaultMonth })} className="btn btn-ghost btn-sm">Isi</Link>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
