import { PasswordForm, PinForm, ProfileForm } from "@/components/auth/AccountForms";
import { PageHead } from "@/components/erp/ui";
import { userHandle } from "@/lib/auth";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Akun saya" };

export default async function Profil() {
  const { user } = await opsAccess();
  return (
    <>
      <PageHead title="Akun saya" sub={`${userHandle(user)} · masuk dengan ${user.via === "pin" ? "nomor HP & PIN" : "email & password"}`} />
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <ProfileForm name={user.name} />
        {user.via === "pin" ? <PinForm /> : <PasswordForm />}
      </div>
    </>
  );
}
