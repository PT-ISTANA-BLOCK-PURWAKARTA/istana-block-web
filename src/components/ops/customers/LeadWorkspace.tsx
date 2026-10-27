"use client";

import { useState } from "react";
import { deleteLeadAction, exportLeadsAction } from "@/app/operasional/actions/customer-leads";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { downloadWorkbook } from "@/lib/ops/excel";
import {
  LEAD_STATUS_LABEL, REASON_LABEL, leadDateText, leadSheets, type LeadChip, type LeadRow,
} from "@/lib/ops/customer-leads-core";
import { ImportDialog } from "./ImportDialog";
import { LeadForm } from "./LeadForm";
import { Modal } from "./Modal";
import { RateForm } from "./RateForm";

type Dialog = { kind: "form"; lead?: LeadRow } | { kind: "rate"; lead: LeadRow } | { kind: "import" } | null;

const rp = (n: number) => n.toLocaleString("id-ID");

function Stars({ n }: { n: number | null }) {
  if (n === null) return <span className="muted">-</span>;
  return <span className="rp-star-s" aria-label={`${n} dari 5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

/** Tombol aksi baris Penilaian: "Nilai" (belum diisi), "Get back" (komplain belum ada hasil), atau "Ubah nilai". */
function rateLabel(r: LeadRow) {
  if (r.feedback === null && ratingEmpty(r)) return "Nilai";
  if (r.feedback === "komplain" && !r.getbackResult) return "Get back";
  return "Ubah nilai";
}
const ratingEmpty = (r: LeadRow) => r.ratingService === null && r.ratingQuality === null && r.ratingSpeed === null;

function Feedback({ r }: { r: LeadRow }) {
  if (r.status !== "membeli") return <span className="muted">-</span>;
  if (r.feedback === "puas") return <span className="badge rp-st-membeli">Puas</span>;
  if (r.feedback === "komplain") {
    return (
      <span className="stack" style={{ gap: 3, alignItems: "flex-start" }}>
        <span className="badge badge-danger">Komplain</span>
        {r.complaintNote && <span className="small">{r.complaintNote}</span>}
        {r.getbackDate ? (
          <span className="small muted">Get back {leadDateText(r.getbackDate)}{r.getbackByName ? ` · ${r.getbackByName}` : ""}</span>
        ) : (
          <span className="badge badge-warn">Belum di-get back</span>
        )}
        {r.getbackResult === "puas" && <span className="badge badge-on">Puas setelah get back</span>}
        {r.getbackResult === "tidak_puas" && <span className="badge badge-danger">Tetap tidak puas</span>}
      </span>
    );
  }
  return <span className="muted small">belum ada</span>;
}

export function LeadWorkspace({ rows, totalFiltered, maxRows, exportArgs, today }: {
  rows: LeadRow[];
  totalFiltered: number;
  maxRows: number;
  exportArgs: { from: string; to: string; chip: LeadChip; q: string };
  today: string;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const done = (m: string) => {
    setDialog(null);
    setErr(null);
    setMsg(m);
  };

  async function exportExcel() {
    setExporting(true);
    setErr(null);
    try {
      const r = await exportLeadsAction(exportArgs);
      if ("error" in r) throw new Error(r.error);
      await downloadWorkbook(`Rekap-Pelanggan_${exportArgs.from}_sd_${exportArgs.to}.xlsx`, leadSheets(r.rows, r.monthly), { dateNF: "dd/mm/yyyy" });
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Gagal membuat Excel");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {msg && <p className="alert alert-ok" role="status" style={{ marginBottom: 12 }}>{msg}</p>}
      {err && <p className="alert alert-error" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <div className="rp-bar">
        <span className="rp-count small muted">{totalFiltered} konsumen</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: "import" })}>Impor Excel</button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!totalFiltered || exporting} onClick={exportExcel}>{exporting ? "Menyiapkan…" : "Excel"}</button>
        <button type="button" className="btn btn-blue btn-sm" onClick={() => setDialog({ kind: "form" })}>Tambah konsumen</button>
      </div>

      <div className="admin-table">
        <table className="rp-table">
          <thead>
            <tr>
              <th>Tanggal</th><th>Pelanggan</th><th>Produk</th><th>Status</th><th className="num">Nilai</th>
              <th>Layanan</th><th>Kualitas</th><th>Kecepatan</th><th>Keterangan</th><th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} className="muted" style={{ padding: 24 }}>Belum ada data konsumen pada periode ini.</td></tr>
            )}
            {rows.map((r) => {
              const buyer = r.status === "membeli";
              return (
                <tr key={r.id}>
                  <td>{leadDateText(r.contactDate)}<span className="rp-sub">{r.source}</span></td>
                  <td>
                    <b>{r.name}</b>
                    {(r.phone || r.address) && <span className="rp-sub">{[r.phone, r.address].filter(Boolean).join(" · ")}</span>}
                    {r.contactId && <span className="rp-link">Tertaut ke pelanggan</span>}
                  </td>
                  <td>{r.product ?? "-"}{r.notes && <span className="rp-sub">{r.notes}</span>}</td>
                  <td>
                    <span className={`badge rp-st-${r.status}`}>{LEAD_STATUS_LABEL[r.status]}</span>
                    {r.reasons.length > 0 && <span className="rp-reasons">{r.reasons.map((c) => REASON_LABEL[c]).join(", ")}</span>}
                  </td>
                  <td className="num">{buyer && r.saleValue ? rp(r.saleValue) : "-"}</td>
                  <td>{buyer ? <Stars n={r.ratingService} /> : <span className="muted">-</span>}</td>
                  <td>{buyer ? <Stars n={r.ratingQuality} /> : <span className="muted">-</span>}</td>
                  <td>{buyer ? <Stars n={r.ratingSpeed} /> : <span className="muted">-</span>}</td>
                  <td><Feedback r={r} /></td>
                  <td>
                    <div className="rp-actions">
                      {buyer && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog({ kind: "rate", lead: r })}>{rateLabel(r)}</button>}
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Ubah ${r.name}`} onClick={() => setDialog({ kind: "form", lead: r })}>Ubah</button>
                      <ConfirmAction action={() => deleteLeadAction(r.id)} label="Hapus" confirmText={`Hapus ${r.name}?`} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalFiltered > maxRows && (
        <p className="small muted" style={{ marginTop: 8 }}>Menampilkan {maxRows} dari {totalFiltered} — persempit tanggal atau cari nama. Excel berisi semua.</p>
      )}

      {dialog?.kind === "form" && (
        <Modal key={dialog.lead?.id ?? "baru"} title={dialog.lead ? "Ubah konsumen" : "Tambah konsumen"} desc="Konsumen yang bertanya / membeli. Penilaian layanan, kualitas, dan kecepatan diisi setelah membeli." onClose={() => setDialog(null)}>
          <LeadForm lead={dialog.lead} today={today} onDone={done} />
        </Modal>
      )}
      {dialog?.kind === "rate" && (
        <Modal key={dialog.lead.id} title="Penilaian pembeli" desc={[dialog.lead.name, dialog.lead.product].filter(Boolean).join(" · ")} onClose={() => setDialog(null)}>
          <RateForm lead={dialog.lead} today={today} onDone={done} />
        </Modal>
      )}
      {dialog?.kind === "import" && (
        <Modal title="Impor file penilaian konsumen" desc={'Format file "TABEL PENILAIAN KONSUMEN GOOGLE ADS" (satu sheet per bulan). Data yang sudah pernah diimpor tidak dobel dan penilaiannya tidak tertimpa.'} onClose={() => setDialog(null)}>
          <ImportDialog onDone={done} />
        </Modal>
      )}
    </>
  );
}
