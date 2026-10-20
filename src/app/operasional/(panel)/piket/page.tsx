import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Piket" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("piket", "selesaikan", "kalender_kelola");
  return <PageHead title="Piket" sub="Sedang disiapkan." />;
}
