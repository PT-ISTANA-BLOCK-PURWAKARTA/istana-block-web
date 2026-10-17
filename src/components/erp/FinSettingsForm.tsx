"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { saveFinSettings } from "@/app/keuangan/actions/master";

export function FinSettingsForm({ values }: { values: Record<string, string> }) {
  return (
    <ActionForm action={saveFinSettings} className="stack" style={{ gap: 20, maxWidth: 860 }}>
      <section className="form-section">
        <h2>Pajak &amp; termin</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="fs-ppn">Tarif PPN efektif (%) <span className="help">dipakai faktur baru yang dicentang PPN</span></label>
            <input id="fs-ppn" name="fin_ppn_rate" inputMode="decimal" defaultValue={values.fin_ppn_rate} />
          </div>
          <div className="field">
            <label htmlFor="fs-term">Termin bayar default (hari)</label>
            <input id="fs-term" name="fin_term_days" type="number" min={0} max={365} defaultValue={values.fin_term_days} />
          </div>
          <div className="field">
            <label htmlFor="fs-npwp">NPWP perusahaan <span className="help">tampil di faktur</span></label>
            <input id="fs-npwp" name="fin_npwp" defaultValue={values.fin_npwp} />
          </div>
        </div>
        <p className="small muted">Tarif efektif dipakai langsung: PPN = tarif × (subtotal − diskon + ongkir). Pastikan angkanya dengan konsultan pajak perusahaan.</p>
      </section>
      <section className="form-section">
        <h2>Faktur</h2>
        <div className="field">
          <label htmlFor="fs-bank">Rekening pembayaran <span className="help">dicetak di faktur</span></label>
          <textarea id="fs-bank" name="fin_bank_info" rows={3} defaultValue={values.fin_bank_info} placeholder={"Bank … No. rekening …\na/n PT Istana Block Purwakarta"} style={{ minHeight: 80 }} />
        </div>
        <div className="field">
          <label htmlFor="fs-note">Catatan kaki faktur</label>
          <textarea id="fs-note" name="fin_invoice_note" rows={2} defaultValue={values.fin_invoice_note} style={{ minHeight: 64 }} />
        </div>
      </section>
      <section className="form-section">
        <h2>Tutup buku</h2>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="fs-lock">Kunci transaksi sampai tanggal <span className="help">kosongkan bila belum</span></label>
          <input id="fs-lock" name="fin_lock_date" type="date" defaultValue={values.fin_lock_date} />
        </div>
        <p className="small muted">Transaksi pada atau sebelum tanggal ini tidak bisa dibuat, diubah, atau dihapus, termasuk pengiriman dan produksi yang menghasilkan jurnal.</p>
      </section>
      <div className="form-actions"><SubmitButton>Simpan pengaturan</SubmitButton></div>
    </ActionForm>
  );
}
