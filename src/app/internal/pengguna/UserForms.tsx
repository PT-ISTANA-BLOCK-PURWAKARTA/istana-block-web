"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { FIELD_ROLES, ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { createUser, resetUserPassword, setUserPin, updateUserRoles } from "../actions/users";
import { Select } from "@/components/ui";

export type DriverOption = { id: string; name: string; phone: string; linkedTo: string | null };

function RoleChecks({ idPrefix, value, fieldOnly, onChange }: { idPrefix: string; value: Role[]; fieldOnly?: boolean; onChange?: (roles: Role[]) => void }) {
  const [sel, setSel] = useState<Role[]>(value);
  const list = fieldOnly ? ROLES.filter((r) => FIELD_ROLES.includes(r)) : ROLES;
  return (
    <fieldset className="role-checks">
      <legend className="sr-only">Peran</legend>
      {list.map((r) => (
        <label key={r} className="check" htmlFor={`${idPrefix}-${r}`}>
          <input
            id={`${idPrefix}-${r}`}
            type="checkbox"
            name="roles"
            value={r}
            checked={sel.includes(r)}
            onChange={(e) => {
              const next = e.target.checked ? [...sel, r] : sel.filter((x) => x !== r);
              setSel(next);
              onChange?.(next);
            }}
          />
          {ROLE_LABEL[r]}
        </label>
      ))}
    </fieldset>
  );
}

function DriverSelect({ id, drivers, value, userName }: { id: string; drivers: DriverOption[]; value?: string | null; userName?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>Data sopir <span className="help">untuk menampilkan tugas antar & armadanya</span></label>
      <Select
        id={id}
        name="driverId"
        defaultValue={value ?? ""}
        required
        placeholder="Pilih sopir…"
        options={drivers.map((d) => ({
          value: d.id,
          label: d.name,
          hint: [d.phone, d.linkedTo && d.linkedTo !== userName ? `sudah dipakai ${d.linkedTo}` : ""].filter(Boolean).join(" · ") || undefined,
          disabled: !!d.linkedTo && d.linkedTo !== userName,
        }))}
      />
      {drivers.length === 0 && <span className="help">Belum ada data sopir. Tambahkan dulu di Operasional → Sopir.</span>}
    </div>
  );
}

const pinInput = { type: "text", inputMode: "numeric", pattern: "\\d{6}", minLength: 6, maxLength: 6, autoComplete: "off", required: true, className: "pin-input pin-sm", placeholder: "6 angka" } as const;

export function NewUserForm({ drivers }: { drivers: DriverOption[] }) {
  const [kind, setKind] = useState<"lapangan" | "kantor">("lapangan");
  const [roles, setRoles] = useState<Role[]>([]);
  return (
    <ActionForm action={createUser} className="form-section" resetOnOk>
      <h2>Tambah pengguna</h2>
      <fieldset className="kind-pick">
        <legend className="label">Jenis akun</legend>
        <label className={`kind-opt${kind === "lapangan" ? " is-on" : ""}`}>
          <input type="radio" name="kind" value="lapangan" checked={kind === "lapangan"} onChange={() => { setKind("lapangan"); setRoles([]); }} />
          <b>Lapangan: nomor HP &amp; PIN</b>
          <span>Gudang, sopir, staf lapangan. Hanya bisa membuka Operasional.</span>
        </label>
        <label className={`kind-opt${kind === "kantor" ? " is-on" : ""}`}>
          <input type="radio" name="kind" value="kantor" checked={kind === "kantor"} onChange={() => { setKind("kantor"); setRoles([]); }} />
          <b>Kantor: email &amp; password</b>
          <span>Pemilik, admin situs, keuangan, admin operasional.</span>
        </label>
      </fieldset>
      <div className="form-grid" key={kind}>
        <div className="field full"><label htmlFor="nu-name">Nama</label><input id="nu-name" name="name" required placeholder={kind === "lapangan" ? "mis. Yayan (gudang)" : "mis. Rina (keuangan)"} /></div>
        {kind === "kantor" ? (
          <>
            <div className="field"><label htmlFor="nu-email">Email</label><input id="nu-email" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="nu-pass">Password awal <span className="help">minimal 10 karakter</span></label><input id="nu-pass" name="password" type="password" autoComplete="new-password" required minLength={10} /></div>
          </>
        ) : (
          <>
            <div className="field"><label htmlFor="nu-phone">Nomor HP</label><input id="nu-phone" name="phone" type="tel" inputMode="tel" required placeholder="0812 3456 7890" /></div>
            <div className="field"><label htmlFor="nu-pin">PIN awal <span className="help">6 angka, bukan berurutan</span></label><input id="nu-pin" name="pin" {...pinInput} /></div>
          </>
        )}
        <div className="field full"><span className="label">Peran</span><RoleChecks idPrefix="nu-role" value={[]} fieldOnly={kind === "lapangan"} onChange={setRoles} /></div>
        {roles.includes("sopir") && <div className="full"><DriverSelect id="nu-driver" drivers={drivers} /></div>}
      </div>
      <div><SubmitButton>Tambah pengguna</SubmitButton></div>
    </ActionForm>
  );
}

export function EditUser({
  user,
  drivers,
  self,
}: {
  user: { id: number; name: string; email: string | null; phone: string | null; roles: Role[]; driverId: string | null };
  drivers: DriverOption[];
  self: boolean;
}) {
  const [roles, setRoles] = useState<Role[]>(user.roles);
  const hasField = roles.some((r) => FIELD_ROLES.includes(r));
  return (
    <details className="role-edit">
      <summary>Ubah peran{user.email && !self ? " / password" : ""}{hasField ? " / PIN" : ""}</summary>
      <div className="stack" style={{ gap: 14, paddingTop: 10 }}>
        <ActionForm action={updateUserRoles.bind(null, user.id)} className="stack" style={{ gap: 10 }}>
          <RoleChecks idPrefix={`r${user.id}`} value={user.roles} fieldOnly={!user.email} onChange={setRoles} />
          {roles.includes("sopir") && <DriverSelect id={`d${user.id}`} drivers={drivers} value={user.driverId} userName={user.name} />}
          {self && <p className="small muted">Peran pemilik tidak bisa dilepas dari akun sendiri.</p>}
          {!user.email && <p className="small muted">Akun tanpa email hanya bisa diberi peran lapangan.</p>}
          <div><SubmitButton className="btn btn-blue btn-sm">Simpan peran</SubmitButton></div>
        </ActionForm>
        {user.email && !self && (
          <ActionForm action={resetUserPassword.bind(null, user.id)} className="inline-form" resetOnOk>
            <div className="field" style={{ flex: "1 1 220px" }}>
              <label htmlFor={`rp${user.id}`}>Atur ulang password</label>
              <input id={`rp${user.id}`} name="password" type="text" autoComplete="off" minLength={10} required placeholder="minimal 10 karakter" />
            </div>
            <SubmitButton className="btn btn-ghost btn-sm">Atur ulang</SubmitButton>
          </ActionForm>
        )}
        {user.roles.some((r) => FIELD_ROLES.includes(r)) && (
          <ActionForm action={setUserPin.bind(null, user.id)} className="inline-form" resetOnOk>
            <div className="field" style={{ flex: "1 1 180px" }}>
              <label htmlFor={`ph${user.id}`}>Nomor HP</label>
              <input id={`ph${user.id}`} name="phone" type="tel" inputMode="tel" defaultValue={user.phone ? `0${user.phone.slice(2)}` : ""} required />
            </div>
            <div className="field" style={{ flex: "1 1 140px" }}>
              <label htmlFor={`pn${user.id}`}>{user.phone ? "PIN baru" : "PIN"}</label>
              <input id={`pn${user.id}`} name="pin" {...pinInput} />
            </div>
            <SubmitButton className="btn btn-ghost btn-sm">{user.phone ? "Atur ulang PIN" : "Beri akses HP & PIN"}</SubmitButton>
          </ActionForm>
        )}
      </div>
    </details>
  );
}
