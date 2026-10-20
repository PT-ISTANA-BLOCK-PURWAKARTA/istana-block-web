import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Uji lumpur pasir" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("uji_pasir", "lihat_uji_pasir");
  return <PageHead title="Uji lumpur pasir" sub="Sedang disiapkan." />;
}
