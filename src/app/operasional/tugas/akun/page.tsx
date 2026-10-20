import { PasswordForm, PinForm, ProfileForm } from "@/components/auth/AccountForms";
import { PushToggle } from "@/components/ops/push/PushToggle";
import { requirePerm, userHandle } from "@/lib/auth";

export const metadata = { title: "Akun saya" };

export default async function AkunSopir() {
  const me = await requirePerm("antar");
  return (
    <>
      <div className="driver-head">
        <h1>Akun saya</h1>
        <p className="muted">{userHandle(me)}</p>
      </div>
      <div className="stack" style={{ gap: 16 }}>
        <ProfileForm name={me.name} />
        <PushToggle description="Aktifkan agar tugas baru dan perubahan muatan langsung muncul di HP ini." />
        {me.via === "pin" ? <PinForm /> : <PasswordForm />}
      </div>
    </>
  );
}
