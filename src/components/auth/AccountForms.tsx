"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { changePassword, changePin, updateProfile } from "@/app/internal/actions/users";

export function ProfileForm({ name }: { name: string }) {
  return (
    <ActionForm action={updateProfile} className="form-section">
      <h2>Profil</h2>
      <div className="field"><label htmlFor="pf-name">Nama tampilan</label><input id="pf-name" name="name" defaultValue={name} required /></div>
      <div><SubmitButton>Simpan nama</SubmitButton></div>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} className="form-section" resetOnOk>
      <h2>Ganti password</h2>
      <div className="field"><label htmlFor="pw-cur">Password saat ini</label><input id="pw-cur" name="current" type="password" autoComplete="current-password" required /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="pw-new">Password baru</label><input id="pw-new" name="next" type="password" autoComplete="new-password" minLength={10} required /></div>
        <div className="field"><label htmlFor="pw-conf">Ulangi password baru</label><input id="pw-conf" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></div>
      </div>
      <div><SubmitButton>Ganti password</SubmitButton></div>
    </ActionForm>
  );
}

const pinProps = { type: "password", inputMode: "numeric", pattern: "\\d{6}", minLength: 6, maxLength: 6, required: true, className: "pin-input pin-sm" } as const;

export function PinForm() {
  return (
    <ActionForm action={changePin} className="form-section" resetOnOk>
      <h2>Ganti PIN</h2>
      <p className="small muted">PIN 6 angka. Hindari tanggal lahir, angka sama semua, atau angka berurutan.</p>
      <div className="field"><label htmlFor="pin-cur">PIN saat ini</label><input id="pin-cur" name="current" autoComplete="current-password" {...pinProps} /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="pin-new">PIN baru</label><input id="pin-new" name="next" autoComplete="new-password" {...pinProps} /></div>
        <div className="field"><label htmlFor="pin-conf">Ulangi PIN baru</label><input id="pin-conf" name="confirm" autoComplete="new-password" {...pinProps} /></div>
      </div>
      <div><SubmitButton>Ganti PIN</SubmitButton></div>
    </ActionForm>
  );
}
