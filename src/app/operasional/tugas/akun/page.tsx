import { PasswordForm, PinForm, ProfileForm } from "@/components/auth/AccountForms";
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
        {me.via === "pin" ? <PinForm /> : <PasswordForm />}
      </div>
    </>
  );
}
