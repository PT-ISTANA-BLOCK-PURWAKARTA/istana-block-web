"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { changePassword, createUser, updateProfile } from "../../actions/users";

export function NewUserForm() {
  return (
    <ActionForm action={createUser} className="form-section" resetOnOk>
      <h2>Tambah admin</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="nu-name">Nama</label><input id="nu-name" name="name" required /></div>
        <div className="field"><label htmlFor="nu-email">Email</label><input id="nu-email" name="email" type="email" required /></div>
        <div className="field full"><label htmlFor="nu-pass">Password awal <span className="help">minimal 10 karakter; minta ia menggantinya setelah masuk</span></label><input id="nu-pass" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
      </div>
      <div><SubmitButton>Tambah admin</SubmitButton></div>
    </ActionForm>
  );
}

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
