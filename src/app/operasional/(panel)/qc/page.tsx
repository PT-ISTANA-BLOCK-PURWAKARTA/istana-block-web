import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "QC" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("qc", "setujui_qc", "ttd_pimpinan");
  return <PageHead title="QC" sub="Sedang disiapkan." />;
}
