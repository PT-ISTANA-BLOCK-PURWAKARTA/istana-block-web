"use client";

import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { changePassword, createUser, resetUserPassword, updateProfile, updateUserRoles } from "../../actions/users";

function RoleChecks({ idPrefix, value }: { idPrefix: string; value: Role[] }) {
  return (
    <fieldset className="role-checks">
      <legend className="sr-only">Peran</legend>
      {ROLES.map((r) => (
        <label key={r} className="check" htmlFor={`${idPrefix}-${r}`}>
          <input id={`${idPrefix}-${r}`} type="checkbox" name="roles" value={r} defaultChecked={value.includes(r)} />
          {ROLE_LABEL[r]}
        </label>
      ))}
    </fieldset>
  );
}

export function NewUserForm() {
  return (
    <ActionForm action={createUser} className="form-section" resetOnOk>
      <h2>Tambah pengguna</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="nu-name">Nama</label><input id="nu-name" name="name" required /></div>
        <div className="field"><label htmlFor="nu-email">Email</label><input id="nu-email" name="email" type="email" required /></div>
        <div className="field full"><label htmlFor="nu-pass">Password awal <span className="help">minimal 10 karakter; minta ia menggantinya setelah masuk</span></label><input id="nu-pass" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
        <div className="field full"><span className="label">Peran</span><RoleChecks idPrefix="nu-role" value={[]} /></div>
      </div>
      <div><SubmitButton>Tambah pengguna</SubmitButton></div>
    </ActionForm>
  );
}

export function RolesForm({ userId, roles, self }: { userId: number; roles: Role[]; self: boolean }) {
  return (
    <details className="role-edit">
      <summary>Ubah peran{self ? "" : " / password"}</summary>
      <div className="stack" style={{ gap: 14, paddingTop: 10 }}>
        <ActionForm action={updateUserRoles.bind(null, userId)} className="stack" style={{ gap: 10 }}>
          <RoleChecks idPrefix={`r${userId}`} value={roles} />
          {self && <p className="small muted">Peran pemilik tidak bisa dilepas dari akun sendiri.</p>}
          <div><SubmitButton className="btn btn-blue btn-sm">Simpan peran</SubmitButton></div>
        </ActionForm>
        {!self && (
          <ActionForm action={resetUserPassword.bind(null, userId)} className="inline-form" resetOnOk>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor={`rp${userId}`}>Atur ulang password</label>
              <input id={`rp${userId}`} name="password" type="text" autoComplete="off" minLength={10} required placeholder="minimal 10 karakter" />
            </div>
            <SubmitButton className="btn btn-ghost btn-sm">Atur ulang</SubmitButton>
          </ActionForm>
        )}
      </div>
    </details>
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
