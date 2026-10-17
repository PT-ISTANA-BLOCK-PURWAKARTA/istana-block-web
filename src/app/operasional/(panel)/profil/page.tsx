import { PasswordForm, ProfileForm } from "@/app/admin/(panel)/pengguna/UserForms";
import { PageHead } from "@/components/erp/ui";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Akun saya" };

export default async function Profil() {
  const { user } = await opsAccess();
  return (
    <>
      <PageHead title="Akun saya" sub={user.email} />
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <ProfileForm name={user.name} />
        <PasswordForm />
      </div>
    </>
  );
}
