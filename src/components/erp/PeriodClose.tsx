"use client";

// Tombol & form tutup buku: unduh paket audit (Excel), tutup buku periode, buka kembali periode terakhir.
import { useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { closePeriod, getAuditLines, getAuditPackage, reopenPeriod } from "@/app/akuntansi/actions/periodClose";
import type { AuditLine } from "@/lib/erp/periodClose";
import { buildAuditWorkbook } from "@/lib/erp/auditWorkbook";
import { MIN_REASON } from "@/lib/erp/periodCloseCore";
import { loadXlsx } from "@/lib/ops/excel";

export function AuditPackageButton({ period, label, className = "btn btn-ghost btn-sm", text = "Unduh paket audit (Excel)" }: { period: string; label: string; className?: string; text?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState("");
  return (
    <span className="confirm-action">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          setErr(null);
          start(async () => {
            try {
              setStep("ringkasan");
              const r = await getAuditPackage(period);
              if ("error" in r) return setErr(r.error ?? "Gagal menyiapkan paket audit.");
              const lines: AuditLine[] = [];
              while (lines.length < r.data.lineCount) {
                setStep(`jurnal ${lines.length}/${r.data.lineCount}`);
                const page = await getAuditLines(period, lines.length);
                if ("error" in page) return setErr(page.error ?? "Gagal mengambil jurnal.");
                if (!page.lines.length) break;
                lines.push(...page.lines);
              }
              setStep("menyusun Excel");
              const XLSX = await loadXlsx();
              const wb = buildAuditWorkbook(XLSX, { ...r.data, lines }, { printedBy: r.printedBy, printedAt: r.printedAt });
              XLSX.writeFile(wb, `Paket Audit ${label} - PT Istana Block Purwakarta.xlsx`, { compression: true });
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Gagal menyiapkan paket audit.");
            }
          });
        }}
      >
        {pending ? `Menyiapkan${step ? ` (${step})` : ""}…` : text}
      </button>
      {err && <span className="small text-bahaya"> {err}</span>}
    </span>
  );
}

export function ClosePeriodForm({ period, label, to, masalah, perhatian }: { period: string; label: string; to: string; masalah: number; perhatian: number }) {
  const [note, setNote] = useState("");
  return (
    <ActionForm action={closePeriod} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="period" value={period} />
      <p className="small" style={{ margin: 0 }}>
        Setelah ditutup, semua transaksi bertanggal <b>s.d. {to}</b> (faktur, kas, jurnal, pengiriman, produksi, stok) tidak bisa dibuat, diubah, atau dihapus.
        Potret angka & hasil analisa disimpan untuk audit.
      </p>
      {masalah > 0 && (
        <label className="check">
          <input type="checkbox" name="ack" required /> Saya sudah meninjau <b>{masalah} masalah</b>{perhatian ? ` dan ${perhatian} perhatian` : ""} di atas dan tetap menutup buku.
        </label>
      )}
      <div className="field">
        <label htmlFor="pc-note">{masalah > 0 ? `Alasan tetap menutup (wajib, min. ${MIN_REASON} huruf)` : "Catatan (opsional)"}</label>
        <textarea id="pc-note" name="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} required={masalah > 0} minLength={masalah > 0 ? MIN_REASON : undefined} placeholder="mis. selisih persediaan menunggu opname 30 Nov; disetujui pimpinan" />
      </div>
      <label className="check">
        <input type="checkbox" required /> Saya yakin menutup buku <b>{label}</b> dan mengunci transaksi s.d. {to}.
      </label>
      <div className="form-actions"><SubmitButton className="btn btn-primary" pendingText="Menutup buku…">Tutup buku {label}</SubmitButton></div>
    </ActionForm>
  );
}

export function ReopenForm({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="link-btn text-bahaya" onClick={() => setOpen(true)}>Buka kembali…</button>;
  return (
    <ActionForm action={reopenPeriod} className="stack" style={{ gap: 8, minWidth: 280 }}>
      <input type="hidden" name="id" value={id} />
      <div className="field">
        <label htmlFor={`ro-${id}`}>Alasan membuka kembali {label} (wajib, min. {MIN_REASON} huruf)</label>
        <textarea id={`ro-${id}`} name="reason" rows={2} required minLength={MIN_REASON} placeholder="mis. faktur pembelian solar 28 Nov belum tercatat" />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Batal</button>
        <SubmitButton className="btn btn-sm btn-danger" pendingText="Membuka…">Buka kembali</SubmitButton>
      </div>
    </ActionForm>
  );
}
