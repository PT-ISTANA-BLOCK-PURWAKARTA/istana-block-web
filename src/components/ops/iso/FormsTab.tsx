import Link from "next/link";
import type { ReactNode } from "react";
import { deleteIsoRecordAction } from "@/app/operasional/actions/iso";
import { ConfirmAction } from "@/components/erp/ConfirmAction";
import { PAGE_SIZE, type IsoRow, type IsoSuggestion } from "@/lib/ops/iso-core";
import type { IsoCode, IsoColumn, IsoForm } from "@/lib/ops/shared/isoForms";
import { cellText, rangeText } from "@/lib/ops/shared/isoRecap";
import { Chip } from "./Chip";
import { ExportFormButton } from "./IsoExportButtons";
import { isoUrl, type IsoView } from "./url";

/** Halaman sumber data otomatis tiap form di aplikasi web (label disesuaikan dengan menu web). */
const SOURCE: Partial<Record<IsoCode, { href: string; label: string }>> = {
  "F-IB-01": { href: "/operasional/pesanan", label: "Pesanan (PO)" },
  "F-IB-02": { href: "/operasional/produksi", label: "Hasil produksi" },
  "F-IB-03": { href: "/operasional/qc", label: "QC → Mix desain" },
  "F-IB-04": { href: "/operasional/qc", label: "QC → Uji kuat tekan" },
  "F-IB-08": { href: "/operasional/bahan-baku", label: "Bahan baku & supplier" },
  "F-IB-09": { href: "/operasional/barang-masuk", label: "Barang masuk" },
};

const columnsOf = (form: IsoForm): IsoColumn[] => [...form.columns.filter((c) => !c.extra), ...form.columns.filter((c) => c.extra)];

type Props = {
  view: IsoView;
  forms: IsoForm[];
  counts: Record<IsoCode, number>;
  form: IsoForm;
  rows: IsoRow[];
  nextOffset: number | null;
  canInput: boolean;
  isOffice: boolean;
  userId: number;
  userName: string;
  today: string;
  suggestions: IsoSuggestion[];
  /** Formulir tambah/ubah/lengkapi yang sedang terbuka (atau null). */
  editor: ReactNode;
};

/** Tab Form F-IB: pilih form, saran pengisian, formulir isi, dan tabel baris (300 per halaman). */
export function FormsTab({ view, forms, counts, form, rows, nextOffset, canInput, isOffice, userId, userName, today, suggestions, editor }: Props) {
  const columns = columnsOf(form);
  const supplementable = form.columns.some((c) => c.supplement);
  const here = isoUrl(view);
  const source = SOURCE[form.code];
  const tableWidth = Math.max(720, 120 + columns.length * 120);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <nav className="iso-forms" aria-label="Pilih form">
        {forms.map((item) => (
          <Link key={item.code} href={isoUrl({ range: view.range, tab: "form", code: item.code })} aria-current={item.code === form.code ? "page" : undefined}>
            <span className="code">{item.code}<span className="cnt">{counts[item.code]}</span></span>
            <b>{item.short}</b>
            <span className="kind">{item.app && item.manual ? "Aplikasi + isi di sini" : item.app ? "Otomatis dari aplikasi" : "Isi di sini"}</span>
          </Link>
        ))}
      </nav>

      <div className="admin-card stack" style={{ gap: 12 }}>
        <div className="card-head" style={{ marginBottom: 0, alignItems: "flex-start" }}>
          <div>
            <p className="small muted"><b>{form.code}</b> · Klausul {form.clause}</p>
            <h2 style={{ fontSize: 19 }}>{form.title}</h2>
            <p className="small muted">Prosedur {form.procedure} · menggantikan {form.replaces}</p>
          </div>
          <div className="head-actions">
            {form.manual && canInput && <Link href={isoUrl(view, { aksi: "tambah" })} className="btn btn-primary btn-sm">+ Tambah baris</Link>}
            <ExportFormButton code={form.code} range={view.range} printedBy={userName} />
          </div>
        </div>
        <div className="iso-notes">
          {form.app && (
            <p className="flag flag-info">
              <span>
                <b>Otomatis dari aplikasi</b>{source ? <> · <Link href={source.href}>{source.label}</Link></> : null}
                <span className="small" style={{ display: "block" }}>{form.app.note}{supplementable && canInput ? " Kolom yang belum ada di aplikasi bisa dilengkapi dengan tautan “Lengkapi”." : ""}</span>
              </span>
            </p>
          )}
          {form.manual && (
            <p className="flag flag-warn">
              <span><b>Diisi langsung di sini</b><span className="small" style={{ display: "block" }}>{form.manual.hint}</span></span>
            </p>
          )}
        </div>
        <p className="small muted">Kolom abu-abu = terhitung otomatis (rumus sama dengan file Excel form). Unduhan memakai nama file &amp; sheet yang sama dengan file form, jadi bisa langsung mengganti file di folder audit (pilih “Tahun ini” untuk rekap setahun).</p>
      </div>

      {editor}

      {canInput && suggestions.length > 0 && (
        <div className="flag flag-info" style={{ flexDirection: "column" }}>
          <b>Saran dari data aplikasi — belum dicatat di {form.code}</b>
          <div className="iso-alerts" style={{ marginTop: 6 }}>
            {suggestions.map((item) => (
              <Link key={item.from} href={isoUrl(view, { aksi: "tambah", saran: item.from })} className="iso-suggest">
                <b>{item.label}</b>
                <span className="small muted">{cellText(form.columns.find((c) => c.key === form.dateKey)!, item.values[form.dateKey])} · klik untuk mencatat</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="admin-table iso-table">
        <table style={{ minWidth: tableWidth }}>
          <thead>
            <tr>
              <th className="iso-sticky">{form.numberLabel}</th>
              {columns.map((c) => <th key={c.key} className={c.auto ? "iso-auto" : undefined} title={c.auto ? "Terhitung otomatis" : undefined}>{c.label}</th>)}
              <th aria-label="Aksi" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const canEdit = canInput && (row.source === "manual" || supplementable);
              const canDelete = row.source === "manual" && (isOffice || row.createdBy === userId);
              return (
                <tr key={row.key}>
                  <td className="iso-sticky">
                    <b className="muted">{row.number ?? view.offset + index + 1}</b>
                    {row.source === "app" && <span className="iso-dot" title="Dari data aplikasi" />}
                  </td>
                  {columns.map((c) => {
                    const text = cellText(c, row.values[c.key]);
                    const wide = (c.width ?? 0) >= 24;
                    return (
                      <td key={c.key} className={`${c.auto ? "iso-auto " : ""}${c.type === "number" ? "num" : wide ? "wrap" : ""}`} title={text.length > 40 ? text : undefined}>
                        <Chip text={text} />
                      </td>
                    );
                  })}
                  <td>
                    <div className="iso-actions">
                    {canEdit && form.master && row.source === "manual" && row.values.terakhir !== today && (
                      <Link href={isoUrl(view, { aksi: "ubah", id: row.recordId ?? undefined, selesai: "1" })} title="Sudah dikalibrasi/diservis hari ini">Sudah dikerjakan</Link>
                    )}
                    {canEdit && (
                      row.source === "manual"
                        ? <Link href={isoUrl(view, { aksi: "ubah", id: row.recordId ?? undefined })}>Ubah</Link>
                        : <Link href={isoUrl(view, { aksi: "lengkapi", key: row.key })}>Lengkapi</Link>
                    )}
                    {canDelete && row.recordId && (
                      <ConfirmAction
                        action={deleteIsoRecordAction.bind(null, row.recordId, here)}
                        label="Hapus"
                        confirmText={`Hapus baris ${row.number ?? view.offset + index + 1} dari ${form.code}?`}
                      />
                    )}
                    {row.history && row.history.length > 0 && (
                      <details className="iso-history">
                        <summary>{row.history.length} riwayat</summary>
                        <ul>
                          {row.history.map((h, i) => (
                            <li key={i}>{cellText(form.columns.find((c) => c.key === "terakhir")!, h.values.terakhir)} · {h.by}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="muted" style={{ padding: 24 }}>
                  {form.master ? "Belum ada alat/mesin di daftar." : `Belum ada rekaman ${form.code} pada ${rangeText(view.range)}.`}
                  {source && <> Data diambil dari <Link href={source.href}>{source.label}</Link>.</>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(view.offset > 0 || nextOffset !== null) && (
        <p className="iso-paging small">
          <span className="muted">Baris {view.offset + 1}–{view.offset + rows.length}</span>
          {view.offset > 0 && <Link href={isoUrl({ ...view, offset: Math.max(0, view.offset - PAGE_SIZE) })}>← {PAGE_SIZE} baris sebelumnya</Link>}
          {nextOffset !== null && <Link href={isoUrl({ ...view, offset: nextOffset })}>Muat {PAGE_SIZE} baris berikutnya →</Link>}
        </p>
      )}
    </div>
  );
}
