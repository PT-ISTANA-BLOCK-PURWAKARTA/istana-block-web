"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveAccount } from "@/app/akuntansi/actions/master";
import { accountGroups, type Account } from "@/db/erp";
import { GROUP_LABEL } from "@/lib/erp/accounting";
import { Select } from "@/components/ui";

export function AccountForm({ a }: { a?: Account }) {
  return (
    <ActionForm action={saveAccount} className="stack" style={{ gap: 20 }}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <section className="form-section">
        <div className="form-grid">
          <div className="field"><label htmlFor="ac-code">Kode</label><input id="ac-code" name="code" defaultValue={a?.code} required placeholder="mis. 6-2400" /></div>
          <div className="field">
            <label htmlFor="ac-group">Golongan {a?.systemKey && <span className="help">dikunci (akun sistem)</span>}</label>
            <Select id="ac-group" name="group" defaultValue={a?.group ?? "beban"} disabled={!!a?.systemKey} options={accountGroups.map((g) => ({ value: g, label: GROUP_LABEL[g] }))} />
            {a?.systemKey && <input type="hidden" name="group" value={a.group} />}
          </div>
          <div className="field full"><label htmlFor="ac-name">Nama akun</label><input id="ac-name" name="name" defaultValue={a?.name} required /></div>
          <div className="field full"><label htmlFor="ac-note">Catatan</label><input id="ac-note" name="note" defaultValue={a?.note} placeholder="mis. nomor rekening untuk akun bank" /></div>
          {!a?.systemKey && <div className="field"><label className="check"><input type="checkbox" name="active" defaultChecked={a?.active ?? true} /> Aktif</label></div>}
        </div>
      </section>
      <div className="form-actions"><SubmitButton>{a ? "Simpan perubahan" : "Simpan akun"}</SubmitButton></div>
    </ActionForm>
  );
}
