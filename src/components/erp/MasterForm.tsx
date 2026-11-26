"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Select } from "@/components/ui";
import { saveMaster } from "@/app/akuntansi/actions/masterData";
import type { MasterField } from "@/lib/erp/masterData";

type Opt = { value: string; label: string };

export function MasterForm({ kind, fields, value, options }: { kind: string; fields: MasterField[]; value?: Record<string, unknown>; options: Record<string, Opt[]> }) {
  return (
    <ActionForm action={saveMaster} className="form-section">
      <input type="hidden" name="kind" value={kind} />
      {value?.id ? <input type="hidden" name="id" value={String(value.id)} /> : null}
      <div className="form-grid">
        {fields.map((f) => {
          const id = `md-${f.name}`;
          const v = value?.[f.name];
          if (f.type === "check") return <div key={f.name} className="field"><label className="check"><input type="checkbox" name={f.name} defaultChecked={value ? Boolean(v) : true} /> {f.label}</label></div>;
          return (
            <div key={f.name} className={`field${f.full ? " full" : ""}`}>
              <label htmlFor={id}>{f.label}</label>
              {f.type === "select" ? (
                <Select id={id} name={f.name} defaultValue={v == null ? (f.options === "status" ? "aktif" : "") : String(v)} searchable={f.options !== "status"} options={[...(f.options === "status" ? [] : [{ value: "", label: "(kosong)" }]), ...(options[f.options ?? ""] ?? [])]} menuWidth={320} />
              ) : (
                <input id={id} name={f.name} type={f.type === "date" ? "date" : "text"} inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined} defaultValue={v == null ? "" : String(v)} required={f.required} />
              )}
            </div>
          );
        })}
      </div>
      <div className="form-actions"><SubmitButton>{value?.id ? "Simpan perubahan" : "Tambah"}</SubmitButton></div>
    </ActionForm>
  );
}
