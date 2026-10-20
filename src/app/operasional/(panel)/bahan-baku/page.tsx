import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Bahan baku & supplier" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("lihat_barang_masuk", "nilai_mutu", "nilai_kirim", "nilai_harga");
  return <PageHead title="Bahan baku & supplier" sub="Sedang disiapkan." />;
}
