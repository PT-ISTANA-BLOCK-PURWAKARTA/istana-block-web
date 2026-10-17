import { AccountForm } from "@/components/erp/AccountForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Akun baru" };

export default async function AkunBaru() {
  await requireModule("keuangan");
  return (
    <>
      <BackLink href="/keuangan/akun">Daftar akun</BackLink>
      <PageHead title="Akun baru" sub="Contoh: tambahkan rekening bank kedua sebagai golongan Kas & bank." />
      <AccountForm />
    </>
  );
}
