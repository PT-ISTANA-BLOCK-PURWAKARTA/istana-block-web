"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Repeater } from "@/components/admin/Repeater";
import { formatFaq, parseFaq } from "@/lib/faq";
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
                <div className={`field ${f.type === "textarea" || f.type === "faq" ? "full" : ""}`} key={f.key}>
                  {f.type === "faq" ? (
                    <span className="label">
                      {f.label} {f.help && <span className="help">{f.help}</span>}
                    </span>
                  ) : (
                    <label htmlFor={f.key}>
                      {f.label} {f.help && <span className="help">{f.help}</span>}
                    </label>
                  )}
                  {f.type === "faq" ? (
                    <Repeater
                      name={f.key}
                      className="faq-rows"
                      addLabel="Tambah pertanyaan"
                      initial={parseFaq(values[f.key as keyof Settings])}
                      format={formatFaq}
                      columns={[
                        { key: "q", label: "Pertanyaan", type: "textarea", placeholder: "Berapa lama pengiriman ke Karawang?" },
                        { key: "a", label: "Jawaban", width: "1.6fr", type: "textarea", placeholder: "Biasanya 1–2 hari kerja setelah pembayaran dikonfirmasi." },
                      ]}
                    />
                  ) : f.type === "textarea" ? (
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
