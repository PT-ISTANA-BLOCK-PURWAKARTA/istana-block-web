// Tab halaman QC Beton (server): template & catatan mix beton, waktu terbuang, dan pekerjaan paving (hanya lihat).
import Link from "next/link";
import { deleteDowntime } from "@/app/operasional/actions/downtime";
import { approveMixLogs, deleteMixLog, markMixDesignFailed, requestMixLogRevision, reviewMixDesign, setMixDesignActive } from "@/app/operasional/actions/qc";
import { downtimeByReason, durationText, type DowntimeRow, canEditDowntime } from "@/lib/ops/downtime";
import { isInUse, isPendingDesign, qcCan, type MixDesignRow, type MixLogRow } from "@/lib/ops/qc";
import type { Role } from "@/lib/roles";
import { CHECK_STATUS_LABELS, dayShort, LAYER_LABELS, materialText, REVIEW_LABELS } from "./labels";
import { QcActionButton } from "./QcActionButton";
import { RangeBar } from "./RangeBar";
import "./qc.css";

type Me = { id: number; roles: readonly Role[] };
const BASE = "/operasional/qc-beton";

const DESIGN_LABEL: Record<string, string> = { disetujui: "Disetujui", diajukan: "Menunggu persetujuan", ditolak: "Ditolak", gagal: "Gagal" };
const designBadge = (status: string, active: boolean) =>
  status === "disetujui" ? (active ? "badge-on" : "badge-off") : status === "diajukan" ? "badge-info" : "badge-danger";

/** Template mix beton (diajukan QC Beton, disetujui kantor) + catatan mix beton harian dengan ACC. */
export function BetonMixTab({ me, from, to, now, designs, logs }: { me: Me; from: string; to: string; now: string; designs: MixDesignRow[]; logs: MixLogRow[] }) {
  const c = qcCan(me.roles, "beton");
  const waiting = logs.filter((l) => l.reviewStatus === "menunggu").map((l) => l.id);
  const rows = [...logs].reverse();
  return (
    <>
      <section className="admin-card">
        <div className="qc-bar">
          <div>
            <h3 style={{ margin: 0 }}>Template mix desain beton</h3>
            <p className="small muted" style={{ margin: 0 }}>U-Ditch, Buis Beton vibrasi, Kanstin. Diajukan QC Beton, disetujui kantor.</p>
          </div>
          {c.input && <Link href={`${BASE}/template/baru`} className="btn btn-ghost btn-sm">{c.approve ? "+ Buat template" : "+ Ajukan template"}</Link>}
        </div>
        {!designs.length ? (
          <p className="muted">Belum ada template mix beton.</p>
        ) : (
          <div className="qc-tests">
            {designs.map((d) => (
              <article key={d.id} className="admin-card qc-test">
                <div className="qc-test-head">
                  <div>
                    <h3>{d.name}</h3>
                    <div className="small muted">{d.product} · oleh {d.createdByName ?? "-"}</div>
                  </div>
                  <span className={`badge ${designBadge(d.status, d.active)}`}>{d.status === "disetujui" && !d.active ? "Tidak dipakai" : DESIGN_LABEL[d.status] ?? d.status}</span>
                </div>
                <p className="small">{materialText(d.materials)}</p>
                {d.reviewNote && <p className="small qc-revise">Catatan: {d.reviewNote}</p>}
                {c.approve && (
                  <div className="qc-row-actions">
                    {isPendingDesign(d) && (
                      <>
                        <QcActionButton className="btn btn-blue btn-sm" label="Setujui & pakai" action={reviewMixDesign.bind(null, d.id, true)} />
                        <QcActionButton className="btn btn-ghost btn-sm text-bahaya" label="Tolak" promptText="Alasan penolakan (opsional)" action={reviewMixDesign.bind(null, d.id, false)} />
                      </>
                    )}
                    {isInUse(d) && (
                      <>
                        <QcActionButton label="Tidak dipakai lagi" promptText={`"${d.name}" tidak dipakai lagi?\nAlasan (opsional):`} action={setMixDesignActive.bind(null, d.id, false)} />
                        <QcActionButton className="btn btn-ghost btn-sm text-bahaya" label="Tandai gagal" promptText={`Tandai "${d.name}" GAGAL.\nTulis alasannya (wajib):`} promptRequired action={markMixDesignFailed.bind(null, d.id)} />
                      </>
                    )}
                    {d.status === "disetujui" && !d.active && <QcActionButton label="Pakai lagi" confirmText={`Pakai lagi "${d.name}"?`} action={setMixDesignActive.bind(null, d.id, true)} />}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="qc-bar">
          <RangeBar tab="mix" from={from} to={to} now={now} base={BASE} />
          <div className="qc-tools no-print">
            {c.input && <Link href={`${BASE}/mix/baru`} className="btn btn-primary btn-sm">+ Isi mix desain</Link>}
          </div>
        </div>
        {c.approve && waiting.length > 0 && (
          <div className="flag flag-info qc-note">
            <span><b>{waiting.length}</b> data mix beton menunggu ACC.</span>
            <QcActionButton className="btn btn-blue btn-sm" label={`ACC semua (${Math.min(waiting.length, 200)})`} confirmText={`ACC & tanda tangani ${Math.min(waiting.length, 200)} data sebagai "Diperiksa oleh"?`} action={approveMixLogs.bind(null, waiting.slice(0, 200))} />
          </div>
        )}
        {!rows.length ? (
          <div className="admin-card muted">Belum ada catatan mix beton pada periode ini.</div>
        ) : (
          <div className="admin-table">
            <table className="compact">
              <thead><tr><th>Tanggal</th><th>Produk</th><th>Disetujui</th><th>Actual</th><th className="num">Mixing</th><th>Status</th><th>Oleh / ACC</th><th /></tr></thead>
              <tbody>
                {rows.map((log) => {
                  const canEdit = c.input && log.reviewStatus !== "disetujui" && (c.editAny || log.createdBy === me.id);
                  return (
                    <tr key={log.id}>
                      <td>{dayShort(log.workDate)}</td>
                      <td>{log.product}{log.leader && <div className="small muted">Leader: {log.leader}</div>}</td>
                      <td className="small muted">{materialText(log.approvedMaterials)}</td>
                      <td className={`small ${log.status === "sesuai" ? "" : "text-bahaya"}`}>{materialText(log.actualMaterials)}</td>
                      <td className="num">{log.mixingCount ?? "-"}</td>
                      <td>
                        <span className={`badge ${log.status === "sesuai" ? "badge-on" : "badge-warn"}`}>{CHECK_STATUS_LABELS[log.status]}</span>
                        {log.notes && <div className="small muted">{log.notes}</div>}
                      </td>
                      <td className="small">
                        {log.createdByName ?? "-"}
                        <div className={log.reviewStatus === "disetujui" ? "qc-ok" : log.reviewStatus === "revisi" ? "qc-revise" : "qc-wait"}>
                          {REVIEW_LABELS[log.reviewStatus]}{log.reviewStatus === "disetujui" && log.managerSignedByName ? `: ${log.managerSignedByName}` : ""}{log.reviewStatus === "revisi" && log.reviewNote ? `: ${log.reviewNote}` : ""}
                        </div>
                      </td>
                      <td>
                        <div className="qc-row-actions">
                          {c.approve && log.reviewStatus !== "disetujui" && <QcActionButton className="btn btn-blue btn-sm" label="ACC" action={approveMixLogs.bind(null, [log.id])} />}
                          {c.approve && log.reviewStatus === "menunggu" && <QcActionButton label="Revisi" promptText="Catatan revisi untuk QC Beton (apa yang harus diperbaiki?)" promptRequired action={requestMixLogRevision.bind(null, log.id)} />}
                          {canEdit && <Link href={`${BASE}/mix/${log.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>}
                          {canEdit && <QcActionButton className="link-btn" label="Hapus" confirmText="Hapus data ini?" action={deleteMixLog.bind(null, log.id)} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** Waktu produksi terbuang: total, penyebab terbesar, dan daftar catatan. */
export function DowntimeTab({ me, from, to, now, rows, canWrite }: { me: Me; from: string; to: string; now: string; rows: DowntimeRow[]; canWrite: boolean }) {
  const total = rows.reduce((s, r) => s + r.minutes, 0);
  const reasons = downtimeByReason(rows);
  const days = new Set(rows.map((r) => r.workDate)).size;
  const max = reasons[0]?.[1] ?? 0;
  return (
    <>
      <div className="qc-bar">
        <RangeBar tab="terbuang" from={from} to={to} now={now} base={BASE} />
        <div className="qc-tools no-print">{canWrite && <Link href={`${BASE}/waktu-terbuang/baru`} className="btn btn-primary btn-sm">+ Catat waktu terbuang</Link>}</div>
      </div>
      <div className="qc-tests">
        <article className="admin-card">
          <div className="small muted">TOTAL WAKTU TERBUANG</div>
          <div style={{ fontSize: 28, fontWeight: 700 }} className="text-bahaya">{total ? durationText(total) : "0 mnt"}</div>
          <div className="small muted">{rows.length} catatan · {days} hari</div>
        </article>
        <article className="admin-card">
          <div className="small muted">PENYEBAB TERBESAR</div>
          {!reasons.length ? (
            <p className="small muted">Belum ada catatan pada periode ini.</p>
          ) : (
            reasons.map(([reason, mins]) => (
              <div key={reason} style={{ display: "grid", gridTemplateColumns: "150px 1fr 80px", gap: 8, alignItems: "center", fontSize: 13 }}>
                <span>{reason}</span>
                <span style={{ background: "#fde2e2", borderRadius: 4, height: 8 }}><span style={{ display: "block", height: 8, borderRadius: 4, background: "#dc2626", width: `${max ? Math.round((mins / max) * 100) : 0}%` }} /></span>
                <span className="num">{durationText(mins)}</span>
              </div>
            ))
          )}
        </article>
      </div>
      {!rows.length ? (
        <div className="admin-card muted">Belum ada waktu terbuang yang dicatat.{canWrite ? " Tekan Catat waktu terbuang bila produksi terhenti." : ""}</div>
      ) : (
        <div className="admin-table">
          <table className="compact">
            <thead><tr><th>Tanggal</th><th>Area</th><th>Alasan</th><th>Keterangan</th><th className="num">Lama</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dayShort(r.workDate)}</td>
                  <td>{r.area ?? "-"}</td>
                  <td>{r.reasons.map((x) => <span key={x} className="badge badge-danger" style={{ marginRight: 4 }}>{x}</span>)}</td>
                  <td className="small">
                    {[r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : null, r.workersShort ? `${r.workersShort} pekerja kurang` : null, r.note || null].filter(Boolean).join(" · ") || "-"}
                    <div className="muted">dicatat {r.createdByName ?? "-"}</div>
                  </td>
                  <td className="num"><b>{durationText(r.minutes)}</b></td>
                  <td>
                    {canWrite && canEditDowntime(me, r) && (
                      <div className="qc-row-actions">
                        <Link href={`${BASE}/waktu-terbuang/${r.id}/ubah`} className="btn btn-ghost btn-sm">Ubah</Link>
                        <QcActionButton className="link-btn" label="Hapus" confirmText="Hapus catatan ini?" action={deleteDowntime.bind(null, r.id)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Mix desain harian paving (Team Leader Paving) — hanya dilihat dari akun QC Beton. */
export function PavingMixView({ logs }: { logs: MixLogRow[] }) {
  const rows = [...logs].reverse();
  return !rows.length ? (
    <div className="admin-card muted">Belum ada data mix desain paving pada periode ini.</div>
  ) : (
    <div className="admin-table">
      <table className="compact">
        <thead><tr><th>Tanggal</th><th>Lapisan</th><th>Produk</th><th>Komposisi dipakai</th><th className="num">Papan</th><th className="num">m²</th><th>Status</th><th>Oleh</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{dayShort(l.workDate)}</td>
              <td>{LAYER_LABELS[l.layer]}</td>
              <td>{l.product}</td>
              <td className="small muted">{materialText(l.actualMaterials)}</td>
              <td className="num">{l.boards ?? "-"}</td>
              <td className="num">{l.squareMeters ?? "-"}</td>
              <td className="small">{CHECK_STATUS_LABELS[l.status]} · {REVIEW_LABELS[l.reviewStatus]}</td>
              <td className="small muted">{l.createdByName ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
