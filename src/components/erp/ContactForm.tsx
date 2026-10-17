"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveContact } from "@/app/akuntansi/actions/master";
import type { Contact } from "@/db/erp";

/** Formulir pelanggan/pemasok; dipakai di /keuangan/kontak dan /operasional/pelanggan. */
export function ContactForm({ c, back, defaultKind = "pelanggan" }: { c?: Contact; back: string; defaultKind?: Contact["kind"] }) {
  return (
    <ActionForm action={saveContact.bind(null, back)} className="stack" style={{ gap: 20 }}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <section className="form-section">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ct-name">Nama</label>
            <input id="ct-name" name="name" defaultValue={c?.name} required minLength={2} placeholder="mis. Bapak Hendra / CV Maju Jaya" />
          </div>
          <div className="field">
            <label htmlFor="ct-kind">Jenis</label>
            <select id="ct-kind" name="kind" defaultValue={c?.kind ?? defaultKind}>
              <option value="pelanggan">Pelanggan</option>
              <option value="pemasok">Pemasok</option>
              <option value="keduanya">Pelanggan &amp; pemasok</option>
            </select>
          </div>
          <div className="field"><label htmlFor="ct-company">Perusahaan / instansi <span className="help">opsional</span></label><input id="ct-company" name="company" defaultValue={c?.company} /></div>
          <div className="field"><label htmlFor="ct-phone">Telepon / WhatsApp</label><input id="ct-phone" name="phone" type="tel" defaultValue={c?.phone} /></div>
          <div className="field"><label htmlFor="ct-email">Email <span className="help">opsional</span></label><input id="ct-email" name="email" type="email" defaultValue={c?.email} /></div>
          <div className="field"><label htmlFor="ct-npwp">NPWP <span className="help">untuk faktur ber-PPN</span></label><input id="ct-npwp" name="npwp" defaultValue={c?.npwp} /></div>
          <div className="field full"><label htmlFor="ct-address">Alamat</label><textarea id="ct-address" name="address" rows={3} defaultValue={c?.address} style={{ minHeight: 80 }} /></div>
          <div className="field"><label htmlFor="ct-term">Termin bayar (hari) <span className="help">0 = tunai</span></label><input id="ct-term" name="termDays" type="number" min={0} max={365} defaultValue={c?.termDays ?? 0} /></div>
          <div className="field"><span className="label">Status</span><label className="check"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Aktif</label></div>
          <div className="field full"><label htmlFor="ct-note">Catatan</label><textarea id="ct-note" name="note" rows={2} defaultValue={c?.note} style={{ minHeight: 64 }} /></div>
        </div>
      </section>
      <div className="form-actions"><SubmitButton>{c ? "Simpan perubahan" : "Simpan kontak"}</SubmitButton></div>
    </ActionForm>
  );
}
