"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import type { SettingField, Settings } from "@/lib/settings";
import { saveSettings } from "../../actions/settings";

export function SettingsForm({ fields, values }: { fields: readonly SettingField[]; values: Settings }) {
  const groups = [...new Set(fields.map((f) => f.group))];
  return (
    <ActionForm action={saveSettings} className="stack" style={{ gap: 20 }}>
      {groups.map((g) => (
        <section className="form-section" key={g}>
          <h2>{g}</h2>
          <div className="form-grid">
            {fields
              .filter((f) => f.group === g)
              .map((f) => (
                <div className={`field ${f.type === "textarea" ? "full" : ""}`} key={f.key}>
                  <label htmlFor={f.key}>
                    {f.label} {f.help && <span className="help">{f.help}</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea id={f.key} name={f.key} rows={f.rows ?? 3} defaultValue={values[f.key as keyof Settings]} />
                  ) : (
                    <input id={f.key} name={f.key} type={f.type} defaultValue={values[f.key as keyof Settings]} />
                  )}
                </div>
              ))}
          </div>
        </section>
      ))}
      <div className="form-actions">
        <SubmitButton>Simpan informasi</SubmitButton>
      </div>
    </ActionForm>
  );
}
