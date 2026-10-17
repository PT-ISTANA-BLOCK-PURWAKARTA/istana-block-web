import { PasswordForm, ProfileForm } from "@/components/auth/AccountForms";
import { PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Akun saya" };

export default async function Profil() {
  const me = await requireModule("keuangan");
  return (
    <>
      <PageHead title="Akun saya" sub={me.email ?? ""} />
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <ProfileForm name={me.name} />
        <PasswordForm />
      </div>
    </>
  );
}
