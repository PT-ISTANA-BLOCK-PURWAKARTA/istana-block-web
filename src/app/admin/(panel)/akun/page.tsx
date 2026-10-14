import { requireAdmin } from "@/lib/auth";
import { PasswordForm, ProfileForm } from "../pengguna/UserForms";

export const metadata = { title: "Akun saya" };

export default async function Akun() {
  const me = await requireAdmin();
  return (
    <>
      <div className="admin-head"><div><h1>Akun saya</h1><p className="muted">{me.email}</p></div></div>
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <ProfileForm name={me.name} />
        <PasswordForm />
      </div>
    </>
  );
}
