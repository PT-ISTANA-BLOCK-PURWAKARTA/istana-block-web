"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveIsoRecordAction, saveIsoSupplementAction, uploadIsoPhoto } from "@/app/operasional/actions/iso";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DateField, Select } from "@/components/ui";
import { computeIsoValues, FORM_BY_CODE, inputColumns, isSignColumn, type IsoCode, type IsoColumn, type IsoValues } from "@/lib/ops/shared/isoForms";
import { cellText } from "@/lib/ops/shared/isoRecap";

/** Isian awal yang wajar per form (masih bisa diubah). */
const DEFAULTS: Partial<Record<IsoCode, IsoValues>> = {
  "F-IB-04": { jenisUji: "Serapan Air", lab: "Internal" },
  "F-IB-07": { jenis: "Pemeriksaan Rutin", kondisi: "Baik" },
  "F-IB-08": { kategori: "Jasa Maintenance/IT" },
  "F-IB-10": { jenis: "Bahan Baku", status: "Pending" },
  "F-IB-11": { kegiatan: "Pengecekan" },
  "F-IB-12": { shift: "Pagi" },
  "F-IB-13": { status: "Diajukan" },
  "F-IB-14": { jenis: "Mingguan", status: "Open" },
  "F-IB-15": { status: "Open" },
  "F-IB-18": { status: "Open" },
};

const toText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type IsoFormMode = "tambah" | "ubah" | "lengkapi";

type Props = {
  code: IsoCode;
  mode: IsoFormMode;
  /** id baris isian langsung (mode ubah). */
  recordId?: string;
  /** kunci baris dari aplikasi (mode lengkapi). */
  sourceKey?: string;
  /** penanda saran yang dicatat (mode tambah). */
  from?: string;
  number?: string | null;
  initial: IsoValues;
  userName: string;
  today: string;
  back: string;
  cancelHref: string;
  /** Akun kantor (pemilik / operasional): boleh mengisi kolom khusus kantor (mis. harga). */
  office?: boolean;
};

/** Foto (maks. 3): unggah langsung, simpan kuncinya (dipisah baris baru) di kolom. */
function PhotoField({ column, value, onChange, cls }: { column: IsoColumn; value: string; onChange: (v: string) => void; cls: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const keys = value.split(/\n+/).map((k) => k.trim()).filter(Boolean);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadIsoPhoto(fd);
    setBusy(false);
    if (res.error || !res.key) return setErr(res.error ?? "Gagal mengunggah foto.");
    onChange([...keys, res.key].slice(0, 3).join("\n"));
  }
  return (
    <div className={cls}>
      <span className="label">{column.label}</span>
      <input type="hidden" name={`v_${column.key}`} value={value} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {keys.map((k) => (
          <span key={k} style={{ position: "relative" }}>
            <img src={`/operasional/berkas/${k}`} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 8 }} />
            <button type="button" className="link-btn" aria-label="Hapus foto" onClick={() => onChange(keys.filter((x) => x !== k).join("\n"))} style={{ position: "absolute", top: -6, right: -6 }}>×</button>
          </span>
        ))}
        {keys.length < 3 && (
          <label className="btn btn-ghost btn-sm">
            {busy ? "Mengunggah…" : "+ Foto"}
            <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={pick} />
          </label>
        )}
      </div>
      {err && <span className="help small text-bahaya">{err}</span>}
      {column.hint && <span className="help small muted">{column.hint}</span>}
    </div>
  );
}

function Field({ column, value, onChange, disabled }: { column: IsoColumn; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const name = `v_${column.key}`, id = `iso-${column.key}`;
  const wide = (column.width ?? 0) >= 24;
  const label = <label htmlFor={id}>{column.label}{column.required ? <span className="text-bahaya"> *</span> : null}</label>;
  const hint = column.hint ? <span className="help small muted">{column.hint}</span> : null;
  const cls = `field${wide ? " span-2" : ""}`;

  if (column.type === "photos") return <PhotoField column={column} value={value} onChange={onChange} cls={`field span-2`} />;
  if (disabled) {
    return (
      <div className={cls}>
        {label}
        <input id={id} value={value} disabled readOnly />
        <span className="help small muted">Diisi kantor.</span>
      </div>
    );
  }

  if (column.type === "select" && column.options && column.options.length <= 4) {
    return (
      <div className={cls}>
        <span className="label">{column.label}{column.required ? <span className="text-bahaya"> *</span> : null}</span>
        <input type="hidden" name={name} value={value} />
        <div className="seg" role="group" aria-label={column.label}>
          {column.options.map((option) => (
            <label key={option} className={`seg-opt${value === option ? " on" : ""}`}>
              <input type="radio" checked={value === option} onChange={() => {}} onClick={() => onChange(value === option ? "" : option)} /> {option}
            </label>
          ))}
        </div>
        {hint}
      </div>
    );
  }
  if (column.type === "select") {
    return (
      <div className={cls}>
        {label}
        <Select id={id} name={name} value={value} onChange={onChange} placeholder="Pilih…" options={[{ value: "", label: "—" }, ...(column.options ?? []).map((o) => ({ value: o, label: o }))]} />
        {hint}
      </div>
    );
  }
  if (column.type === "date") {
    return <div className={cls}>{label}<DateField id={id} name={name} value={value} onChange={onChange} required={column.required} />{hint}</div>;
  }
  return (
    <div className={cls}>
      {label}
      <input id={id} name={name} type={column.type === "time" ? "time" : "text"} inputMode={column.type === "number" ? "decimal" : undefined} value={value} required={column.required} onChange={(e) => onChange(e.target.value)} />
      {hint}
    </div>
  );
}

/** Formulir tambah/ubah baris form F-IB (isian langsung) dan lengkapi kolom pada baris dari data aplikasi. */
export function IsoRecordForm({ code, mode, recordId, sourceKey, from, number, initial, userName, today, back, cancelHref, office = false }: Props) {
  const form = FORM_BY_CODE[code];
  // Kolom paraf/TTD diisi lewat tombol di tabel, bukan diketik.
  const columns = useMemo(() => (mode === "lengkapi" ? form.columns.filter((c) => c.supplement) : inputColumns(form).filter((c) => !isSignColumn(c))), [form, mode]);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base = mode === "tambah" ? { ...DEFAULTS[code], ...initial } : initial;
    const start: Record<string, string> = {};
    for (const column of columns) {
      const given = toText(base[column.key]);
      start[column.key] = given || (mode === "tambah" && column.key === form.dateKey ? today : mode === "tambah" && column.defaultUser ? userName : "");
    }
    return start;
  });

  const preview = useMemo(() => {
    if (mode === "lengkapi") return [];
    const parsed: IsoValues = {};
    for (const column of columns) {
      const raw = (values[column.key] ?? "").trim();
      const n = Number(raw.replace(",", "."));
      parsed[column.key] = raw === "" ? null : column.type === "number" && Number.isFinite(n) ? n : raw;
    }
    const computed = computeIsoValues(form, parsed, today);
    return form.columns.filter((c) => c.auto).map((column) => ({ column, value: computed[column.key] })).filter((item) => item.value !== null && item.value !== undefined);
  }, [values, columns, form, mode, today]);

  const title = mode === "lengkapi" ? "Lengkapi baris" : mode === "ubah" ? `Ubah ${number ?? "isian"}` : "Tambah baris";
  const context = mode === "lengkapi" ? form.columns.filter((c) => !c.supplement && initial[c.key] !== null && initial[c.key] !== undefined && initial[c.key] !== "").slice(0, 5) : [];

  return (
    <ActionForm action={mode === "lengkapi" ? saveIsoSupplementAction : saveIsoRecordAction} className="form-section" resetOnOk={false}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="back" value={back} />
      {recordId && <input type="hidden" name="id" value={recordId} />}
      {sourceKey && <input type="hidden" name="key" value={sourceKey} />}
      {from && <input type="hidden" name="from" value={from} />}
      <div>
        <h2>{title} · {code}</h2>
        <p className="small muted">{form.title}</p>
      </div>
      {mode === "lengkapi" && (
        <div className="flag flag-info" style={{ flexDirection: "column", gap: 2 }}>
          {context.map((c) => <span key={c.key}><span className="muted">{c.label}:</span> {cellText(c, initial[c.key])}</span>)}
          {code === "F-IB-01" && <span className="small">Tipe pelanggan &amp; pembayaran berlaku untuk semua PO pelanggan ini. Mengosongkan semua kolom menghapus isian pelengkap.</span>}
        </div>
      )}
      <div className="form-grid">
        {columns
          .filter((column) => !column.showWhen || column.showWhen(values))
          .map((column) => (
            <Field key={column.key} column={column} value={values[column.key] ?? ""} disabled={column.officeOnly && !office} onChange={(v) => setValues((current) => ({ ...current, [column.key]: v }))} />
          ))}
      </div>
      {preview.length > 0 && (
        <div className="flag flag-info iso-preview">
          <b>Terhitung otomatis</b>
          <span className="iso-preview-list">
            {preview.map((item) => <span key={item.column.key}><span className="muted">{item.column.label}:</span> <b>{cellText(item.column, item.value)}</b></span>)}
          </span>
        </div>
      )}
      <div className="form-actions">
        <SubmitButton>Simpan</SubmitButton>
        <Link href={cancelHref} className="btn btn-ghost">Batal</Link>
      </div>
    </ActionForm>
  );
}
