import { eq } from "drizzle-orm";
import { PasswordForm, PinForm, ProfileForm } from "@/components/auth/AccountForms";
import { PageHead } from "@/components/erp/ui";
import { PushToggle } from "@/components/ops/push/PushToggle";
import { SignaturePad } from "@/components/ops/qc/SignaturePad";
import { getDb, schema } from "@/db";
import { userHandle } from "@/lib/auth";
import { opsAccess } from "@/lib/erp/ops";
import { can } from "@/lib/roles";

export const metadata = { title: "Akun saya" };

export default async function Profil() {
  const { user } = await opsAccess();
  // Tanda tangan bergambar hanya untuk yang meng-ACC / menandatangani formulir QC.
  const canSign = can(user.roles, "setujui_qc") || can(user.roles, "ttd_pimpinan");
  const signatureKey = canSign ? (await (await getDb()).query.users.findFirst({ where: eq(schema.users.id, user.id) }))?.signatureKey ?? null : null;
  return (
    <>
      <PageHead title="Akun saya" sub={`${userHandle(user)} · masuk dengan ${user.via === "pin" ? "nomor HP & PIN" : "email & password"}`} />
      <div className="stack" style={{ gap: 20, maxWidth: 760 }}>
        <ProfileForm name={user.name} />
        {user.via === "pin" ? <PinForm /> : <PasswordForm />}
        <PushToggle />
        {canSign && <SignaturePad currentKey={signatureKey} />}
      </div>
    </>
  );
}
