import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Laporan pimpinan" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("laporan");
  return <PageHead title="Laporan pimpinan" sub="Sedang disiapkan." />;
}
