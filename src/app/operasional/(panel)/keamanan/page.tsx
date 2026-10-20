import { PageHead } from "@/components/erp/ui";
import { requirePerm } from "@/lib/auth";

export const metadata = { title: "Keamanan" };

// Placeholder: diganti saat fitur ini dikerjakan.
export default async function Halaman() {
  await requirePerm("keamanan");
  return <PageHead title="Keamanan" sub="Sedang disiapkan." />;
}
