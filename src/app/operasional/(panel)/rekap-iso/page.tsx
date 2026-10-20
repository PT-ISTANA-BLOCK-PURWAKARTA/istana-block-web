import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Rekap ISO" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("iso");
  return <PageHead title="Rekap ISO" sub="Sedang disiapkan." />;
}
