import Link from "next/link";
import { markMixDesignFailed, reviewMixDesign, setMixDesignActive } from "@/app/operasional/actions/qc";
import { tgl } from "@/lib/erp/util";
import { fmt } from "@/lib/ops/shared/format";
import { isInUse, isPendingDesign, qcCan, type MixDesignRow } from "@/lib/ops/qc";
import type { Role } from "@/lib/roles";
import { LAYERS, LAYER_LABELS, materialText } from "./labels";
import { QcActionButton } from "./QcActionButton";
import { QcExcelButton, type QcSheet } from "./QcExcel";
import "./qc.css";

const archiveLabel = (d: MixDesignRow) => (d.status === "gagal" ? "Gagal" : d.status === "ditolak" ? "Ditolak" : d.status === "diajukan" ? "Pengajuan dibatalkan" : "Tidak dipakai lagi");
const archiveTone = (d: MixDesignRow) => (d.status === "gagal" || d.status === "ditolak" ? "badge-danger" : "badge-off");
const day = (v: string | null | undefined) => (v ? tgl(v) : "-");
const usageText = (d: MixDesignRow) =>
  d.usage ? `Dipakai ${d.usage.logs}× produksi · ${day(d.usage.firstUsed)} – ${day(d.usage.lastUsed)} · ${fmt(d.usage.boards)} papan${d.usage.rejects ? ` · reject ${fmt(d.usage.rejects)}` : ""}` : "Belum pernah dipakai di catatan produksi";
const retiredDay = (d: MixDesignRow) => (d.retiredAt ? tgl(new Date(d.retiredAt.getTime() + 7 * 3600_000).toISOString().slice(0, 10)) : "");

function excelSheets(designs: MixDesignRow[]): QcSheet[] {
  const columns = [
    { key: "no", header: "No", width: 5 }, { key: "name", header: "Nama template", width: 26 }, { key: "layer", header: "Lapisan", width: 10 }, { key: "product", header: "Produk", width: 24 },
    { key: "mats", header: "Komposisi", width: 45 }, { key: "status", header: "Status", width: 20 }, { key: "reason", header: "Alasan", width: 30 }, { key: "logs", header: "Dipakai (catatan)", width: 12 },
    { key: "first", header: "Pertama dipakai", width: 14 }, { key: "last", header: "Terakhir dipakai", width: 14 }, { key: "boards", header: "Papan", width: 10 }, { key: "m2", header: "m²", width: 10 },
    { key: "rejects", header: "Reject", width: 10 }, { key: "notOk", header: "Tidak sesuai", width: 12 }, { key: "by", header: "Diajukan oleh", width: 18 }, { key: "approvedBy", header: "Disetujui oleh", width: 18 },
    { key: "retiredBy", header: "Dipindah ke rekapan oleh", width: 22 }, { key: "retiredAt", header: "Tanggal dipindah", width: 16 },
  ];
  const row = (d: MixDesignRow, i: number) => ({
    no: i + 1, name: d.name, layer: LAYER_LABELS[d.layer], product: d.product, mats: materialText(d.materials),
    status: isInUse(d) ? "Sedang dipakai" : isPendingDesign(d) ? "Menunggu persetujuan" : archiveLabel(d),
    reason: d.retiredReason ?? (d.status === "ditolak" ? d.reviewNote ?? "" : ""), logs: d.usage?.logs ?? 0, first: d.usage?.firstUsed ?? "", last: d.usage?.lastUsed ?? "",
    boards: d.usage?.boards ?? 0, m2: d.usage?.squareMeters ?? 0, rejects: d.usage?.rejects ?? 0, notOk: d.usage?.notOk ?? 0, by: d.createdByName ?? "", approvedBy: d.approvedByName ?? "",
    retiredBy: d.retiredByName ?? "", retiredAt: d.retiredAt ? new Date(d.retiredAt.getTime() + 7 * 3600_000).toISOString().slice(0, 10) : "",
  });
  return [
    { name: "Sedang dipakai", title: "Mix desain sedang dipakai", columns, rows: designs.filter(isInUse).map(row) },
    { name: "Menunggu persetujuan", title: "Menunggu persetujuan", columns, rows: designs.filter(isPendingDesign).map(row) },
    { name: "Rekapan", title: "Rekapan (tidak dipakai / gagal / ditolak)", columns, rows: designs.filter((d) => !isInUse(d) && !isPendingDesign(d)).map(row) },
  ];
}

export function TemplateTab({ me, designs }: { me: { id: number; roles: readonly Role[] }; designs: MixDesignRow[] }) {
  const c = qcCan(me.roles);
  const inUse = designs.filter(isInUse);
  const pending = designs.filter(isPendingDesign);
  const archived = designs.filter((d) => !isInUse(d) && !isPendingDesign(d));
  const layers = LAYERS.filter((l) => inUse.some((d) => d.layer === l));

  return (
    <>
      <div className="qc-bar">
        <p className="small muted" style={{ maxWidth: 680 }}>
          Template bertanda <b>SEDANG DIPAKAI</b> menjadi pilihan &quot;Mix desain disetujui&quot; saat QC mengisi data harian. Template yang tidak dipakai lagi, gagal, atau ditolak dipindah ke <b>rekapan</b> di bawah.
          {!c.approve && " Template yang Anda ajukan menunggu persetujuan manajer QC / pemilik."}
        </p>
        <div className="qc-tools no-print">
          <QcExcelButton fileName={`Template-Mix-Desain.xlsx`} sheets={excelSheets(designs)} dateKeys={["first", "last", "retiredAt"]} empty="Belum ada template." />
          {c.input && <Link href="/operasional/qc/template/baru" className="btn btn-primary btn-sm">{c.approve ? "Buat template" : "Ajukan template"}</Link>}
        </div>
      </div>

      {!inUse.length && <div className="admin-card muted">Belum ada mix desain yang sedang dipakai.</div>}
      {layers.map((layer) => (
        <div key={layer}>
          <h2 className="qc-section">Lapisan {LAYER_LABELS[layer].toLowerCase()}</h2>
          <div className="qc-design-grid">
            {inUse.filter((d) => d.layer === layer).map((d) => (
              <article className="admin-card qc-design" key={d.id}>
                <div className="qc-design-top"><span>✓ Sedang dipakai</span><span>{LAYER_LABELS[d.layer]}</span></div>
                <div className="qc-design-body">
                  <div><b style={{ fontSize: 16.5 }}>{d.name}</b><div className="small muted">{d.product}</div></div>
                  <p className="qc-design-mats">{materialText(d.materials)}</p>
                  {d.notes && <p className="small muted">{d.notes}</p>}
                  <p className="small muted">{usageText(d)}</p>
                  <p className="small muted">Diajukan {d.createdByName ?? "-"}{d.approvedByName && ` · disetujui ${d.approvedByName}`}</p>
                  {c.approve && (
                    <div className="qc-row-actions">
                      <QcActionButton label="Tidak dipakai lagi" promptText={`"${d.name}" tidak dipakai lagi?\nAlasan (opsional), mis. diganti template baru:`} action={setMixDesignActive.bind(null, d.id, false)} />
                      <QcActionButton className="btn btn-ghost btn-sm text-bahaya" label="Tandai gagal" promptText={`Tandai "${d.name}" GAGAL.\nTulis alasannya (wajib), mis. hasil uji tekan tidak tercapai:`} promptRequired action={markMixDesignFailed.bind(null, d.id)} />
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}

      {pending.length > 0 && (
        <>
          <h2 className="qc-section">Menunggu persetujuan ({pending.length})</h2>
          <div className="qc-design-grid">
            {pending.map((d) => (
              <article className="admin-card qc-pending-card" key={d.id}>
                <div className="qc-test-head">
                  <div><b>{d.name}</b><div className="small muted">{LAYER_LABELS[d.layer]} · {d.product}</div></div>
                  <span className="badge badge-warn">Menunggu persetujuan</span>
                </div>
                <p className="qc-readonly">{materialText(d.materials)}</p>
                {d.notes && <p className="small muted">{d.notes}</p>}
                <p className="small muted">Diajukan {d.createdByName ?? "-"}</p>
                {c.approve && (
                  <div className="qc-row-actions">
                    <QcActionButton className="btn btn-blue btn-sm" label="Setujui & pakai" action={reviewMixDesign.bind(null, d.id, true)} />
                    <QcActionButton className="btn btn-ghost btn-sm text-bahaya" label="Tolak" promptText="Alasan penolakan (opsional)" action={reviewMixDesign.bind(null, d.id, false)} />
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      <details className="admin-card qc-archive" style={{ marginTop: 20 }} open={false}>
        <summary>Rekapan mix desain ({archived.length}) <span className="small muted" style={{ fontWeight: 400 }}>· tidak dipakai lagi, gagal, atau ditolak; tidak muncul sebagai pilihan produksi</span></summary>
        {archived.length === 0 ? (
          <p className="small muted">Belum ada.</p>
        ) : (
          <div className="admin-table" style={{ border: 0, marginTop: 8 }}>
            <table className="qc-table">
              <thead><tr><th>Template</th><th>Status</th><th>Alasan</th><th>Pemakaian</th><th>Dipindah</th><th /></tr></thead>
              <tbody>
                {archived.map((d) => (
                  <tr key={d.id}>
                    <td data-label="Template"><b>{d.name}</b><div className="small muted">{LAYER_LABELS[d.layer]} · {d.product}</div><div className="qc-mat-text">{materialText(d.materials)}</div></td>
                    <td data-label="Status"><span className={`badge ${archiveTone(d)}`}>{archiveLabel(d)}</span></td>
                    <td data-label="Alasan" className="small">{d.retiredReason ?? (d.status === "ditolak" ? d.reviewNote : null) ?? "-"}</td>
                    <td data-label="Pemakaian" className="small">{usageText(d)}</td>
                    <td data-label="Dipindah" className="small">{d.retiredAt ? `${retiredDay(d)}${d.retiredByName ? ` · ${d.retiredByName}` : ""}` : d.status === "ditolak" ? `ditolak ${d.approvedByName ?? ""}` : "-"}</td>
                    <td>
                      {c.approve &&
                        (d.status === "ditolak" || d.status === "diajukan" ? (
                          <QcActionButton label="Setujui & pakai" confirmText={`Setujui & pakai "${d.name}"?`} action={reviewMixDesign.bind(null, d.id, true)} />
                        ) : (
                          <QcActionButton label="Pakai lagi" confirmText={`Pakai lagi "${d.name}"?`} action={setMixDesignActive.bind(null, d.id, true)} />
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </>
  );
}
