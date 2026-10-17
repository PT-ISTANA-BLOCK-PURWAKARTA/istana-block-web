import { redirect } from "next/navigation";
import { ContactForm } from "@/components/erp/ContactForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { opsAccess } from "@/lib/erp/ops";

export const metadata = { title: "Pelanggan baru" };

export default async function PelangganBaru() {
  const { canEdit } = await opsAccess();
  if (!canEdit) redirect("/operasional/pelanggan");
  return (
    <>
      <BackLink href="/operasional/pelanggan">Pelanggan</BackLink>
      <PageHead title="Pelanggan baru" />
      <ContactForm back="/operasional/pelanggan" />
    </>
  );
}
