import { ContactForm } from "@/components/erp/ContactForm";
import { BackLink, PageHead } from "@/components/erp/ui";
import { requireModule } from "@/lib/auth";

export const metadata = { title: "Kontak baru" };

export default async function KontakBaru({ searchParams }: { searchParams: Promise<{ jenis?: string }> }) {
  await requireModule("keuangan");
  const { jenis } = await searchParams;
  return (
    <>
      <BackLink href="/akuntansi/kontak">Kontak</BackLink>
      <PageHead title="Kontak baru" />
      <ContactForm back="/akuntansi/kontak" defaultKind={jenis === "pemasok" ? "pemasok" : "pelanggan"} />
    </>
  );
}
