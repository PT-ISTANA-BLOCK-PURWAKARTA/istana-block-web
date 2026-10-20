import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Barang masuk" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("barang_masuk", "lihat_barang_masuk");
  return <PageHead title="Barang masuk" sub="Sedang disiapkan." />;
}
